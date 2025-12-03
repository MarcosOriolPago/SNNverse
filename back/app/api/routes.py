import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

# --- TEMPORARY IMPORTS ---
from ..genn_modules.genn_builder import GeNNNetworkBuilder
from ..process.manager import process_manager
from ..input.sandbox import execute_spike_function, test_function_quick
from ..api.schemas import CustomFunctionPayload, FunctionExecutionResult

# --- Data Models that should be in schemas.py ---
class NodeDef(BaseModel):
    id: str
    type: str
    params: Dict[str, Any]

class EdgeDef(BaseModel):
    source: str
    target: str

class NetworkPayload(BaseModel):
    nodes: List[NodeDef]
    edges: List[EdgeDef]

router = APIRouter()

# Global state for GeNN model building
current_builder = None
model_info = None
network_config = None

@router.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "version": "1.0.0-genn"
    }

@router.post("/network/load_genn")
async def load_network_genn(payload: NetworkPayload):
    """
    Load and build network using GeNN.
    
    This endpoint:
    1. Receives network JSON from frontend
    2. Builds GeNN model (Phase 1: Definition)
    3. Generates C++ code
    4. Compiles model
    
    Returns:
        Model information including paths, neuron count, etc.
    """
    global current_builder, model_info, network_config
    
    try:
        # Stop any running simulation first
        if process_manager.is_running():
            print("Stopping existing C++ runner...")
            process_manager.stop_all()
        
        # Convert Pydantic models to dict
        network_dict = {
            "nodes": [node.dict() for node in payload.nodes],
            "edges": [edge.dict() for edge in payload.edges]
        }
        
        # Store network configuration for input providers
        network_config = network_dict
        
        # Build GeNN model
        print(f"Building GeNN model with {len(payload.nodes)} nodes, {len(payload.edges)} edges")
        current_builder = GeNNNetworkBuilder()
        code_path, model_info = current_builder.build_from_json(network_dict)
        
        # Note: We don't call load_model() here because the C++ runner will load it
        
        return {
            "status": "loaded",
            "backend": "genn_cpp",
            "model_info": model_info
        }
        
    except Exception as e:
        print(f"Error loading GeNN network: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simulation/start_genn")
async def start_simulation_genn():
    """
    Start GeNN C++ runner and input providers.
    
    This endpoint:
    1. Launches C++ runner as subprocess
    2. C++ runner loads model and starts WebSocket on port 9002
    3. Starts input providers for Python input nodes
    4. Input providers connect to C++ runner on port 9001
    """
    global current_builder, model_info, network_config
    
    if not model_info or not current_builder:
        raise HTTPException(status_code=400, detail="No model loaded. Call /api/network/load_genn first")
    
    # Get neuron IDs for metadata
    neuron_ids = model_info.get("neuron_ids", [])
    print(f"Neuron IDs: {neuron_ids}")
    code_path = model_info.get("code_path")
    
    # Start C++ runner subprocess
    print(f"Starting C++ runner for model at: {code_path}")
    success = process_manager.start_cpp_runner(code_path)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to start C++ runner")
    
    # Start input providers for Python input nodes
    if network_config:
        python_input_nodes = [
            node for node in network_config.get("nodes", [])
            if node.get("type") == "PYTHON"
        ]
        
        for node in python_input_nodes:
            node_id = node.get("id")
            params = node.get("params", {})
            custom_function = params.get("custom_function", "")
            
            if custom_function:
                print(f"Starting input provider for Python node: {node_id}")
                provider_config = {
                    "code": custom_function,
                    "interval": 0.01,  # 10ms interval
                    "neuron_id": node_id  # Pass the node ID so spikes can be sent
                }
                process_manager.start_input_provider("python", provider_config)
    
    return {
        "status": "started",
        "backend": "genn_cpp",
        "websocket_port": 9002,
        "runner_pid": process_manager.cpp_runner_pid if process_manager.cpp_runner_process else None,
        "input_provider_pid": process_manager.input_provider_pid if process_manager.input_provider_process else None
    }
        

@router.post("/simulation/stop")
async def stop_simulation():
    """Stop the C++ runner subprocess."""
    try:
        if process_manager.is_running():
            process_manager.stop_all()
        
        return {"status": "stopped"}
        
    except Exception as e:
        print(f"Error stopping simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    
@router.post("/simulation/is_model_precompiled")
async def check_precompiled_model(model_id) -> bool:
    """
    Checks whether the determined model is already precompiled.
    """
    compiled_runner_path = "back/genn_out/user_network_CODE/build/network_runner"
    if os.path.exists(compiled_runner_path):
        return True
    else:
        return False


@router.get("/simulation/state_genn")
async def get_simulation_state_genn():
    """
    Get current C++ runner status.
    
    Returns:
        Status of the C++ runner subprocess
    """
    status = process_manager.get_status()
    
    return {
        "running": status["running"],
        "pid": status["pid"],
        "websocket_port": status["websocket_port"],
        "model_path": status["model_path"]
    }

@router.post("/input/inject_genn")
async def inject_input_genn(node_id: str, spike: bool = False, current: float = 0.0):
    """
    Inject input into a GeNN neuron (for custom Python functions).
    
    Note: This would require TCP communication with the C++ runner.
    Currently not implemented - custom functions should be handled differently.
    
    Args:
        node_id: Target neuron ID
        spike: If True, force a spike
        current: Current to inject (if not spike)
    """
    # TODO: Implement TCP socket communication with C++ runner for input injection
    raise HTTPException(
        status_code=501,
        detail="Input injection not yet implemented for C++ runner. Use custom spike functions instead."
    )

@router.post("/input/execute")
async def execute_input_function(payload: CustomFunctionPayload) -> FunctionExecutionResult:
    """
    Execute a custom Python function and return whether it generates a spike.
    This is for testing/preview, not part of the main simulation loop.
    """
    success, message = test_function_quick(payload.function_code)
    
    if success:
        # Extract spike status from message
        spike = "SPIKE" in message
        return FunctionExecutionResult(
            success=True,
            spike=spike,
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
    