"""
API Routes

Thin HTTP handlers that delegate to the SimulationManager.
No business logic here — just parse input, call manager, return response.
"""

import json
import traceback
from pathlib import Path

from fastapi import APIRouter, HTTPException, WebSocket

from ..core.manager import simulation_manager
from ..core.sandbox import test_function
from .schemas import (
    CustomFunctionPayload,
    FunctionExecutionResult,
    NetworkPayload,
    OfflineConfigPayload,
)

router = APIRouter()


# ─── Health ─────────────────────────────────────────────────────────

@router.get("/")
async def root():
    """Health check."""
    return {"status": "online", "version": "2.0.0-refactored"}


# ─── Network Management ────────────────────────────────────────────

@router.get("/network/list_saved")
async def list_saved_networks():
    """List all saved networks from disk."""
    try:
        genn_out_dir = Path(__file__).parent.parent / "genn_out"
        networks = []

        if genn_out_dir.exists():
            for code_dir in genn_out_dir.glob("*_CODE"):
                meta_file = code_dir / "network_metadata.json"
                if meta_file.exists():
                    try:
                        with open(meta_file) as f:
                            meta = json.load(f)
                            runner = code_dir / "build" / "network_runner"
                            networks.append({
                                "name": meta.get("name", "Unnamed"),
                                "created_at": meta.get("created_at", ""),
                                "num_nodes": len(meta.get("nodes", [])),
                                "model_info": meta.get("model_info", {}),
                                "hash": code_dir.name.replace("_CODE", ""),
                                "is_compiled": runner.exists(),
                            })
                    except Exception:
                        pass

        return {"status": "success", "networks": networks}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/network/load_saved/{network_name}")
async def load_saved_network(network_name: str):
    """Load a saved network configuration by name."""
    genn_out_dir = Path(__file__).parent.parent / "genn_out"

    for code_dir in genn_out_dir.glob("*_CODE"):
        meta_file = code_dir / "network_metadata.json"
        if meta_file.exists():
            with open(meta_file) as f:
                meta = json.load(f)
                if meta.get("name") == network_name:
                    runner = code_dir / "build" / "network_runner"
                    return {
                        "status": "success",
                        "network": meta,
                        "is_compiled": runner.exists(),
                        "hash": code_dir.name.replace("_CODE", ""),
                    }

    raise HTTPException(404, f"Network '{network_name}' not found")


@router.post("/network/save")
async def save_network(payload: NetworkPayload):
    """Save network without compiling."""
    try:
        nodes = [n.dict() for n in payload.nodes]
        edges = [e.dict() for e in payload.edges]
        return simulation_manager.save_network(nodes, edges, payload.network_name)
    except Exception as e:
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


# ─── Benchmark ─────────────────────────────────────────────────────

@router.post("/simulation/benchmark")
async def benchmark_simulation(iterations: int = 100):
    """Run benchmark (placeholder)."""
    return {"avg_step_ms": 0.0, "safe_max_input_hz": 0.0}