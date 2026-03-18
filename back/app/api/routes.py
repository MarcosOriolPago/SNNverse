"""
API Routes

Thin HTTP handlers that delegate to the SimulationManager.
No business logic here — just parse input, call manager, return response.
"""

import json
import traceback
import uuid
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, HTTPException, WebSocket, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..core.manager import simulation_manager
from ..core.sandbox import test_function
from ..core.connection_sandbox import test_connection_code
from ..core.database import get_db_manager
from ..core.models import Network, User
from ..core.security import SECRET_KEY, ALGORITHM
from .schemas import (
    CustomFunctionPayload,
    FunctionExecutionResult,
    NetworkPayload,
    OfflineConfigPayload,
    ConnectionCodePayload,
    ConnectionCodeResult,
)

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)


def get_current_user_id(token: str = Depends(oauth2_scheme)) -> uuid.UUID:
    """Extract user_id from JWT token. Raises 401 if invalid."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("user_id")
        if not user_id_str:
            raise HTTPException(status_code=401, detail="Invalid token")
        return uuid.UUID(user_id_str)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_optional_user_id(token: str = Depends(oauth2_scheme)) -> uuid.UUID | None:
    """Extract user_id from JWT token. Returns None if not authenticated."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("user_id")
        if not user_id_str:
            return None
        return uuid.UUID(user_id_str)
    except JWTError:
        return None


# ─── Health ─────────────────────────────────────────────────────────

@router.get("/")
async def root():
    """Health check."""
    return {"status": "online", "version": "2.0.0-refactored"}


# ─── Network Management ────────────────────────────────────────────

@router.get("/network/list_saved")
async def list_saved_networks(user_id: uuid.UUID = Depends(get_current_user_id)):
    """List all saved networks for the current user from database."""
    try:
        db_manager = get_db_manager()
        with db_manager.session_context() as session:
            networks_db = session.query(Network).filter(
                Network.user_id == user_id,
                Network.is_example == False
            ).order_by(Network.created_at.desc()).all()
            
            networks = []
            for net in networks_db:
                metadata = net.metadata_json or {}
                nodes = metadata.get("nodes", [])
                networks.append({
                    "name": net.name,
                    "created_at": net.created_at.isoformat() if net.created_at else "",
                    "num_nodes": len(nodes),
                    "model_info": metadata.get("model_info", {}),
                    "hash": net.model_sha or "",
                    "is_compiled": net.last_compiled_at is not None,
                    "network_id": str(net.network_id),
                })
            
            return {"status": "success", "networks": networks}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))


@router.get("/network/list_templates")
async def list_templates():
    """List all starter templates (networks where is_example is true)."""
    try:
        db_manager = get_db_manager()
        with db_manager.session_context() as session:
            networks_db = session.query(Network).filter(
                Network.is_example == True
            ).order_by(Network.created_at.asc()).all()
            
            networks = []
            for net in networks_db:
                metadata = net.metadata_json or {}
                nodes = metadata.get("nodes", [])
                networks.append({
                    "name": net.name,
                    "description": net.description or "",
                    "created_at": net.created_at.isoformat() if net.created_at else "",
                    "num_nodes": len(nodes),
                    "model_info": metadata.get("model_info", {}),
                    "hash": net.model_sha or "",
                    "is_compiled": net.last_compiled_at is not None,
                    "network_id": str(net.network_id),
                })
            
            return {"status": "success", "networks": networks}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))


@router.get("/network/load_saved/{network_name}")
async def load_saved_network(
    network_name: str,
    network_id: str | None = None,
    user_id: uuid.UUID | None = Depends(get_optional_user_id),
):
    """Load a saved network configuration by name from database."""
    try:
        db_manager = get_db_manager()
        with db_manager.session_context() as session:
            from sqlalchemy import or_

            network = None
            if network_id:
                try:
                    requested_id = uuid.UUID(network_id)
                except ValueError:
                    raise HTTPException(400, "Invalid network ID format")

                query = session.query(Network).filter(Network.network_id == requested_id)
                if user_id:
                    query = query.filter(or_(Network.user_id == user_id, Network.is_example == True))
                else:
                    query = query.filter(Network.is_example == True)
                network = query.first()
            else:
                if user_id:
                    network = session.query(Network).filter(
                        Network.name == network_name,
                        Network.user_id == user_id,
                    ).first()
                    if not network:
                        network = session.query(Network).filter(
                            Network.name == network_name,
                            Network.is_example == True,
                        ).first()
                else:
                    network = session.query(Network).filter(
                        Network.name == network_name,
                        Network.is_example == True,
                    ).first()
            
            if not network:
                raise HTTPException(404, f"Network '{network_name}' not found")
            
            metadata = network.metadata_json or {}
            return {
                "status": "success",
                "network": metadata,
                "is_compiled": network.last_compiled_at is not None,
                "hash": network.model_sha or "",
                "network_id": str(network.network_id),
                "is_template": network.is_example,
            }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))


@router.post("/network/save")
async def save_network(payload: NetworkPayload, user_id: uuid.UUID = Depends(get_current_user_id)):
    """Save network to database without compiling."""
    try:
        import hashlib
        
        nodes = [n.dict() for n in payload.nodes]
        edges = [e.dict() for e in payload.edges]
        network_name = payload.network_name or "Unnamed Network"
        
        # Generate hash for the network configuration
        config_str = json.dumps({"nodes": nodes, "edges": edges}, sort_keys=True)
        model_hash = hashlib.md5(config_str.encode()).hexdigest()
        
        # Build metadata JSON
        metadata = {
            "name": network_name,
            "created_at": datetime.now().isoformat(),
            "nodes": nodes,
            "edges": edges,
            "model_info": simulation_manager.model_info,
        }
        
        db_manager = get_db_manager()
        with db_manager.session_context() as session:
            current_user = session.query(User).filter(User.user_id == user_id).first()
            if not current_user:
                raise HTTPException(status_code=404, detail="User not found")

            save_as_template = bool(payload.save_as_template)
            if save_as_template and current_user.role != "admin":
                raise HTTPException(status_code=403, detail="Only admin users can save starter templates")

            existing = None

            # Prefer lookup by network_id (unambiguous primary-key match)
            if payload.network_id:
                try:
                    nid = uuid.UUID(payload.network_id)
                    existing = session.query(Network).filter(
                        Network.network_id == nid,
                        Network.user_id == user_id,
                    ).first()
                except ValueError:
                    pass  # malformed UUID → fall through to name lookup

            # Fall back to name-based lookup for networks saved without an id
            if not existing:
                existing = session.query(Network).filter(
                    Network.user_id == user_id,
                    Network.name == network_name,
                    Network.is_example == save_as_template,
                ).first()

            if existing:
                # Update existing network
                existing.metadata_json = metadata
                existing.model_sha = model_hash
                existing.name = network_name  # allow rename via dialog
                existing.is_example = save_as_template
                existing.updated_at = datetime.utcnow()
                return {
                    "status": "success",
                    "message": f"{'Template' if save_as_template else 'Network'} updated: {network_name}",
                    "hash": model_hash,
                    "network_id": str(existing.network_id),
                    "is_template": save_as_template,
                }
            else:
                # Create new network
                new_network = Network(
                    user_id=user_id,
                    name=network_name,
                    metadata_json=metadata,
                    model_sha=model_hash,
                    is_example=save_as_template,
                )
                session.add(new_network)
                session.flush()  # populate network_id before commit
                network_id_str = str(new_network.network_id)
                return {
                    "status": "success",
                    "message": f"{'Template' if save_as_template else 'Network'} saved: {network_name}",
                    "hash": model_hash,
                    "network_id": network_id_str,
                    "is_template": save_as_template,
                }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))


@router.post("/network/load_genn")
async def load_network_genn(payload: NetworkPayload):
    """Build and compile network using GeNN."""
    try:
        nodes = [n.dict() for n in payload.nodes]
        edges = [e.dict() for e in payload.edges]
        return await simulation_manager.load_network(nodes, edges, payload.network_name)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))


@router.delete("/network/delete/{network_id}")
async def delete_network(network_id: str, user_id: uuid.UUID = Depends(get_current_user_id)):
    """Delete a saved network by ID.

    Owners can delete their own networks.
    Admin users can also delete starter templates.
    """
    try:
        db_manager = get_db_manager()
        with db_manager.session_context() as session:
            try:
                nid = uuid.UUID(network_id)
            except ValueError:
                raise HTTPException(400, "Invalid network ID format")

            current_user = session.query(User).filter(User.user_id == user_id).first()
            if not current_user:
                raise HTTPException(status_code=404, detail="User not found")

            network = session.query(Network).filter(Network.network_id == nid).first()
            if not network:
                raise HTTPException(404, "Network not found")

            is_owner = network.user_id == user_id
            can_delete_template = current_user.role == "admin" and network.is_example
            if not (is_owner or can_delete_template):
                raise HTTPException(403, "Not authorized to delete this network")

            session.delete(network)
            return {"status": "success", "message": "Network deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))


# ─── Simulation Control ────────────────────────────────────────────

@router.post("/simulation/run_offline")
async def run_offline_simulation(config: OfflineConfigPayload):
    """Run batch offline simulation."""
    try:
        return simulation_manager.run_offline(config.duration, config.dt)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))


@router.post("/simulation/start_realtime")
async def start_realtime_simulation():
    """Start real-time simulation loop."""
    try:
        return await simulation_manager.start_simulation()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/simulation/start_genn")
async def start_simulation_genn():
    """Start GeNN simulation (alias for start_realtime)."""
    try:
        return await simulation_manager.start_simulation()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/simulation/state_genn")
async def get_simulation_state():
    """Get current simulation status."""
    return simulation_manager.get_state()


@router.websocket("/ws/simulation")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time simulation data streaming."""
    await simulation_manager.handle_websocket(websocket)


# ─── Voltage Playback ──────────────────────────────────────────────

@router.get("/simulation/{session_id}/voltages")
async def get_offline_voltages(session_id: str, start: float, end: float):
    """Fetch voltage frames for offline playback."""
    data = simulation_manager.get_voltages(session_id, start, end)
    if data is None:
        raise HTTPException(404, "Session not found")
    return data


# ─── Input Injection ───────────────────────────────────────────────

@router.post("/input/inject_genn")
async def inject_input(
    node_id: str,
    spike: bool = False,
    current: float = 0.0,
    index: int = 0,
):
    """Inject input into a running simulation."""
    try:
        simulation_manager.inject_input(node_id, spike, current, index)
        return {"status": "injected"}
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── Sandbox ───────────────────────────────────────────────────────

@router.post("/input/execute")
async def execute_input_function(payload: CustomFunctionPayload) -> FunctionExecutionResult:
    """Execute a custom Python function in sandbox."""
    success, message, console_output = test_function(payload.function_code)

    if success:
        return FunctionExecutionResult(
            success=True,
            spike="SPIKE" in message,
            error=None,
            message=message,
            console_output=console_output,
        )
    else:
        return FunctionExecutionResult(
            success=False,
            spike=None,
            error=message,
            message=f"Function execution failed: {message}",
            console_output=console_output,
        )


# ─── Connection Code Sandbox ───────────────────────────────────────

@router.post("/synapse/test_code")
async def test_synapse_code(payload: ConnectionCodePayload) -> ConnectionCodeResult:
    """Test connection code in sandbox and return stats."""
    success, message, console_output, stats = test_connection_code(
        payload.code, payload.n1, payload.n2
    )
    return ConnectionCodeResult(
        success=success,
        message=message,
        console_output=console_output,
        stats=stats,
    )


# ─── Benchmark ─────────────────────────────────────────────────────

@router.post("/simulation/benchmark")
async def benchmark_simulation(iterations: int = 100):
    """Run benchmark (placeholder)."""
    return {"avg_step_ms": 0.0, "safe_max_input_hz": 0.0}
