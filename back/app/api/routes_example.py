"""
Example Integration: Database & Artifact Storage in FastAPI Routes

This module demonstrates how to integrate the new database and artifact storage
components into existing FastAPI endpoints.

Copy patterns from here into your actual routes.py file.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
import uuid

from ..core.database import get_db_session, get_db_manager
from ..core.models import User, Network, SimulationStat
from ..core.genn_builder import GeNNNetworkBuilder
from ..core.simulation_stats import (
    SimulationMetrics,
    SimulationStatsRecorder,
    SimulationAnalytics,
)

router = APIRouter()


# ============================================================================
# Network Building with Database Persistence
# ============================================================================

@router.post("/api/network/build")
async def build_network_with_persistence(
    payload: dict,  # Your NetworkPayload schema
    session: Session = Depends(get_db_session),
):
    """
    Build and persist a network with database integration.
    
    Steps:
    1. Create builder with network_id and user_id
    2. Compile from JSON (archives + uploads automatically)
    3. Save metadata to database
    4. Return compilation metadata
    """
    try:
        # Generate UUIDs for tracking
        network_id = uuid.uuid4()
        user_id = UUID(payload.get("user_id"))  # From auth context
        
        # Create builder with database integration
        builder = GeNNNetworkBuilder(
            network_id=str(network_id),
            user_id=str(user_id),
            model_id=payload.get("name", "network"),
        )
        
        # Build, archive, upload, and persist to DB (all in one call)
        code_path, metadata = builder.build_from_json(
            payload,
            skip_compile=False,
            save_to_db=True,  # Automatically saves to database
        )
        
        # Query to get the full network record (including compiled_code_url)
        network = session.query(Network).filter_by(
            network_id=network_id
        ).first()
        
        return {
            "status": "success",
            "network_id": str(network_id),
            "code_path": code_path,
            "model_sha": metadata.get("model_sha"),
            "compiled_code_url": network.compiled_code_url,
            "backend_used": network.backend_used,
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Warm-Start Escalation on Demand
# ============================================================================

@router.post("/api/simulation/start_with_warmstart")
async def start_simulation_with_warmstart(
    network_id: UUID,
    user_id: UUID,
    num_timesteps: int = 1000,
    session: Session = Depends(get_db_session),
):
    """
    Start simulation using warm-start if available, otherwise compile from scratch.
    
    Escalation logic:
    1. Try warm-start from database artifact
    2. If unavailable, build from scratch
    3. Record execution stats
    """
    try:
        builder = GeNNNetworkBuilder(
            network_id=str(network_id),
            user_id=str(user_id),
            model_id=f"sim_{network_id}",
        )
        
        # Try warm-start first
        used_precompiled = builder.warm_start_from_db(
            network_id, user_id, num_recording_timesteps=num_timesteps
        )
        
        if used_precompiled:
            print("✓ Warm-start successful")
        else:
            # Fall back to full build
            print("⚠ Warm-start unavailable, building from scratch")
            
            # Query network config from database
            network = session.query(Network).filter_by(
                network_id=network_id,
                user_id=user_id
            ).first()
            
            if not network:
                raise HTTPException(status_code=404, detail="Network not found")
            
            builder.build_from_json(
                network.metadata_json,
                save_to_db=False,  # Already in DB
            )
            builder.load_model(num_recording_timesteps=num_timesteps)
        
        return {
            "status": "ready",
            "network_id": str(network_id),
            "used_precompiled": used_precompiled,
            "model_sha": builder.model_sha,
            "backend": builder.backend,
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Simulation Statistics Recording
# ============================================================================

@router.post("/api/simulation/end")
async def end_simulation_and_record(
    network_id: UUID,
    user_id: UUID,
    stats: dict,  # {duration_ms, spike_count, wall_time_ms, memory_peak_mb, backend_used}
    session: Session = Depends(get_db_session),
):
    """
    Record simulation statistics after execution completes.
    
    This tracks:
    - Execution duration
    - Spike counts
    - Memory usage
    - Backend used (CPU/CUDA)
    - Whether warm-start was used
    """
    try:
        metrics = SimulationMetrics(
            user_id=user_id,
            network_id=network_id,
            duration_ms=stats.get("duration_ms", 0.0),
            spike_count=stats.get("spike_count"),
            num_timesteps=stats.get("num_timesteps"),
            wall_time_ms=stats.get("wall_time_ms"),
            memory_peak_mb=stats.get("memory_peak_mb"),
            backend_used=stats.get("backend_used", "cpu"),
            status="completed",
            used_precompiled=stats.get("used_precompiled", False),
        )
        
        recorder = SimulationStatsRecorder()
        stat_id = recorder.record(metrics)
        
        return {
            "status": "recorded",
            "stat_id": str(stat_id),
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Analytics & Performance Queries
# ============================================================================

@router.get("/api/analytics/network/{network_id}")
async def get_network_analytics(
    network_id: UUID,
    session: Session = Depends(get_db_session),
):
    """Get aggregated statistics for a network."""
    try:
        analytics = SimulationAnalytics()
        
        stats = analytics.get_network_stats(network_id)
        backends = analytics.get_backend_comparison(network_id)
        warmstart = analytics.get_warm_start_impact(network_id)
        
        return {
            "network_id": str(network_id),
            "execution_stats": stats,
            "backend_comparison": backends,
            "warm_start_impact": warmstart,
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/analytics/user/{user_id}")
async def get_user_analytics(
    user_id: UUID,
    session: Session = Depends(get_db_session),
):
    """Get aggregated statistics for a user."""
    try:
        analytics = SimulationAnalytics()
        stats = analytics.get_user_stats(user_id)
        
        return stats
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Network Management
# ============================================================================

@router.get("/api/network/list")
async def list_user_networks(
    user_id: UUID,
    session: Session = Depends(get_db_session),
):
    """List all networks for a user."""
    try:
        networks = session.query(Network).filter_by(user_id=user_id).all()
        
        return {
            "networks": [
                {
                    "network_id": str(n.network_id),
                    "name": n.name,
                    "created_at": n.created_at.isoformat(),
                    "backend_used": n.backend_used,
                    "has_compiled_artifact": n.compiled_code_url is not None,
                    "model_sha": n.model_sha,
                }
                for n in networks
            ]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/network/{network_id}")
async def get_network_details(
    network_id: UUID,
    user_id: UUID,
    session: Session = Depends(get_db_session),
):
    """Get detailed information about a specific network."""
    try:
        network = session.query(Network).filter_by(
            network_id=network_id,
            user_id=user_id,
        ).first()
        
        if not network:
            raise HTTPException(status_code=404, detail="Network not found")
        
        # Get execution statistics
        analytics = SimulationAnalytics()
        stats = analytics.get_network_stats(network_id)
        
        return {
            "network_id": str(network.network_id),
            "name": network.name,
            "description": network.description,
            "created_at": network.created_at.isoformat(),
            "last_compiled_at": network.last_compiled_at.isoformat() if network.last_compiled_at else None,
            "model_sha": network.model_sha,
            "backend_used": network.backend_used,
            "compiled_code_url": network.compiled_code_url,
            "is_example": network.is_example,
            "execution_stats": stats,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/network/{network_id}")
async def delete_network(
    network_id: UUID,
    user_id: UUID,
    session: Session = Depends(get_db_session),
):
    """Delete a network and its associated data."""
    try:
        network = session.query(Network).filter_by(
            network_id=network_id,
            user_id=user_id,
        ).first()
        
        if not network:
            raise HTTPException(status_code=404, detail="Network not found")
        
        # Cascade delete will remove associated SimulationStats
        session.delete(network)
        session.commit()
        
        return {"status": "deleted"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Health & Debug Endpoints
# ============================================================================

@router.get("/api/health/db")
async def health_db():
    """Check database connectivity."""
    try:
        db = get_db_manager()
        with db.session_context() as session:
            session.execute("SELECT 1")
        
        return {"status": "healthy", "database": "connected"}
    
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}


@router.get("/api/health/storage")
async def health_storage():
    """Check artifact storage connectivity."""
    try:
        from ..core.artifact_storage import get_storage_client
        
        client = get_storage_client()
        if client.s3_client:
            client.s3_client.list_buckets()
            return {"status": "healthy", "storage": "connected"}
        else:
            return {"status": "degraded", "storage": "unavailable"}
    
    except Exception as e:
        return {"status": "unhealthy", "storage": "disconnected", "error": str(e)}
