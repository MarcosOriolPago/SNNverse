import os
from fastapi import APIRouter, HTTPException, Request, WebSocket
from typing import List, Dict, Any
import asyncio

from ..core.simulation_manager import simulation_manager
from ..input.sandbox import test_function_quick
from ..api.schemas import CustomFunctionPayload, FunctionExecutionResult, NetworkPayload

router = APIRouter()

@router.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "version": "1.0.0-genn"
    }

@router.get("/network/list_saved")
async def list_saved_networks():
    """List all saved networks."""
    try:
        import json
        from pathlib import Path
        
        genn_out_dir = Path(__file__).parent.parent / "genn_out"
        saved_networks = []
        
        if genn_out_dir.exists():
            for code_dir in genn_out_dir.glob("*_CODE"):
                metadata_file = code_dir / "network_metadata.json"
                if metadata_file.exists():
                    try:
                        with open(metadata_file, 'r') as f:
                            metadata = json.load(f)
                            runner_path = code_dir / "build" / "network_runner"
                            saved_networks.append({
                                "name": metadata.get("name", "Unnamed Network"),
                                "created_at": metadata.get("created_at", ""),
                                "model_info": metadata.get("model_info", {}),
                                "hash": code_dir.name.replace("_CODE", ""),
                                "is_compiled": runner_path.exists()
                            })
                    except Exception: pass
        
        return {"status": "success", "networks": saved_networks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/network/load_saved/{network_name}")
async def load_saved_network(network_name: str):
    """Load a saved network configuration."""
    try:
        import json
        from pathlib import Path
        
        genn_out_dir = Path(__file__).parent.parent / "genn_out"
        
        for code_dir in genn_out_dir.glob("*_CODE"):
            metadata_file = code_dir / "network_metadata.json"
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                    if metadata.get("name") == network_name:
                        runner_path = code_dir / "build" / "network_runner"
                        return {
                            "status": "success",
                            "network": metadata,
                            "is_compiled": runner_path.exists(),
                            "hash": code_dir.name.replace("_CODE", "")
                        }
        
        raise HTTPException(status_code=404, detail=f"Network '{network_name}' not found")
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/network/load_genn")
async def load_network_genn(payload: NetworkPayload):
    """Load and build network using GeNN."""
    try:
        return await simulation_manager.load_network(payload)
    except Exception as e:
        print(f"Error loading network: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simulation/start_genn")
async def start_simulation_genn(request: Request):
    """Start GeNN simulation."""
    try:
        return await simulation_manager.start_simulation()
    except Exception as e:
        print(f"Error starting simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws/simulation")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for simulation control and data streaming."""
    await simulation_manager.handle_websocket(websocket)

@router.post("/simulation/stop")
async def stop_simulation():
    """Stop the simulation runtime."""
    try:
        await simulation_manager.stop_simulation()
        return {"status": "stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/simulation/state_genn")
async def get_simulation_state_genn():
    """Get current simulation runtime status."""
    return simulation_manager.get_state()

@router.post("/input/inject_genn")
async def inject_input_genn(node_id: str, spike: bool = False, current: float = 0.0, index: int = 0):
    """Inject input into a GeNN neuron."""
    try:
        simulation_manager.inject_input(node_id, spike, current, index)
        return {"status": "injected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/input/execute")
async def execute_input_function(payload: CustomFunctionPayload) -> FunctionExecutionResult:
    """Execute a custom Python function (sandbox test)."""
    success, message = test_function_quick(payload.function_code)
    
    if success:
        return FunctionExecutionResult(
            success=True,
            spike="SPIKE" in message,
            error=None,
            message=message
        )
    else:
        return FunctionExecutionResult(
            success=False,
            spike=None,
            error=message,
            message=f"Function execution failed: {message}"
        )
    