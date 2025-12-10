import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import hashlib
import json
import asyncio

# --- TEMPORARY IMPORTS ---
from ..genn_modules.genn_builder import GeNNNetworkBuilder
from ..genn_modules.simulation_runtime import GeNNSimulationRuntime
from ..process.manager import process_manager  # Still needed for input providers
from ..input.sandbox import execute_spike_function, test_function_quick
from ..api.schemas import CustomFunctionPayload, FunctionExecutionResult

# --- Data Models that should be in schemas.py ---
class NodeDef(BaseModel):
    id: str
    type: str
    params: Dict[str, Any]
    size: int = 1  # Default to 1 neuron
    position: Dict[str, float] = {"x": 0, "y": 0}  # Node position in canvas

class EdgeDef(BaseModel):
    source: str
    target: str

class NetworkPayload(BaseModel):
    nodes: List[NodeDef]
    edges: List[EdgeDef]
    network_name: str = None  # Optional: name to save this network as

router = APIRouter()

# Global state for GeNN model building and simulation
current_builder = None
current_runtime = None
model_info = None
network_config = None

def calculate_model_hash(network_dict: Dict[str, Any]) -> str:
    """Generate a unique hash for the network configuration."""
    # Sort keys to ensure consistent JSON string
    network_str = json.dumps(network_dict, sort_keys=True)
    return hashlib.md5(network_str.encode()).hexdigest()

@router.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "version": "1.0.0-genn"
    }

@router.get("/network/list_saved")
async def list_saved_networks():
    """
    List all saved networks by scanning genn_out directory.
    Returns metadata for each saved network.
    """
    try:
        import json
        from pathlib import Path
        
        genn_out_dir = Path(__file__).parent.parent / "genn_out"
        saved_networks = []
        
        # Scan all CODE directories
        for code_dir in genn_out_dir.glob("*_CODE"):
            metadata_file = code_dir / "network_metadata.json"
            
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                    
                    # Check if network is compiled (runner binary exists)
                    runner_path = code_dir / "build" / "network_runner"
                    is_compiled = runner_path.exists()
                    
                    saved_networks.append({
                        "name": metadata.get("name", "Unnamed Network"),
                        "created_at": metadata.get("created_at", ""),
                        "model_info": metadata.get("model_info", {}),
                        "hash": code_dir.name.replace("_CODE", ""),
                        "is_compiled": is_compiled
                    })
        
        return {
            "status": "success",
            "networks": saved_networks
        }
        
    except Exception as e:
        print(f"Error listing saved networks: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/network/load_saved/{network_name}")
async def load_saved_network(network_name: str):
    """
    Load a saved network's configuration by name.
    Returns the full network configuration for restoration in the UI.
    """
    try:
        import json
        from pathlib import Path
        
        genn_out_dir = Path(__file__).parent.parent / "genn_out"
        
        # Search for network by name
        for code_dir in genn_out_dir.glob("*_CODE"):
            metadata_file = code_dir / "network_metadata.json"
            
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                    
                    if metadata.get("name") == network_name:
                        # Check if network is compiled
                        runner_path = code_dir / "build" / "network_runner"
                        is_compiled = runner_path.exists()
                        
                        return {
                            "status": "success",
                            "network": metadata,
                            "is_compiled": is_compiled,
                            "hash": code_dir.name.replace("_CODE", "")
                        }
        
        # Network not found
        raise HTTPException(status_code=404, detail=f"Network '{network_name}' not found")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error loading saved network: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/network/load_genn")
async def load_network_genn(payload: NetworkPayload):
    """
    Load and build network using GeNN.
    
    This endpoint:
    1. Receives network JSON from frontend
    2. Checks if model is already compiled (caching)
    3. Builds GeNN model if needed
    4. Loads model into memory
    5. Creates simulation runtime instance
    
    Returns:
        Model information including paths, neuron count, etc.
    """
    global current_builder, current_runtime, model_info, network_config
    
    try:
        # Stop any running simulation first
        if current_runtime and current_runtime.running:
            print("Stopping existing simulation...")
            current_runtime.stop()
        
        # Convert Pydantic models to dict
        network_dict = {
            "nodes": [node.dict() for node in payload.nodes],
            "edges": [edge.dict() for edge in payload.edges]
        }
        
        # Store network configuration for input providers
        network_config = network_dict
        
        # Calculate model hash for caching
        model_hash = calculate_model_hash(network_dict)
        print(f"Model hash: {model_hash}")
        
        # Create builder
        temp_builder = GeNNNetworkBuilder(model_id=model_hash)
        
        # Check if model already exists
        if temp_builder.is_compiled():
            print(f"✓ Using cached model: {model_hash}")
            current_builder = temp_builder
            code_path, model_info = current_builder.build_from_json(network_dict, skip_compile=True)
        else:
            print(f"Building new GeNN model with {len(payload.nodes)} nodes, {len(payload.edges)} edges")
            current_builder = temp_builder
            code_path, model_info = current_builder.build_from_json(network_dict)
        
        # Load model into memory (required for Python runtime)
        print("Loading model into memory...")
        current_builder.load_model(num_recording_timesteps=1000)
        
        # Create simulation runtime
        print("Creating simulation runtime...")
        current_runtime = GeNNSimulationRuntime(current_builder)
        print("✓ Simulation runtime ready")
        
        # Save network metadata if name is provided
        if payload.network_name:
            import json
            from pathlib import Path
            from datetime import datetime
            
            metadata = {
                "name": payload.network_name,
                "created_at": datetime.now().isoformat(),
                "nodes": network_dict["nodes"],
                "edges": network_dict["edges"],
                "model_info": model_info
            }
            
            metadata_path = Path(code_path) / "network_metadata.json"
            
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            print(f"✓ Network metadata saved: {metadata_path}")
        
        return {
            "status": "loaded",
            "backend": "genn_python",
            "model_info": model_info
        }
        
    except Exception as e:
        print(f"Error loading GeNN network: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simulation/start_genn")
async def start_simulation_genn(request):
    """
    Start GeNN simulation using Python runtime.
    
    This endpoint:
    1. Starts Python-based simulation loop
    2. Simulation runs in background thread
    3. Data is streamed via WebSocket (configured separately)
    """
    global current_builder, current_runtime, model_info, network_config
    
    if not model_info or not current_builder:
        raise HTTPException(status_code=400, detail="No model loaded. Call /api/network/load_genn first")
    
    if not current_runtime:
        raise HTTPException(status_code=400, detail="Runtime not initialized. Call /api/network/load_genn first")
    
    # Start the simulation
    try:
        # Get SocketIO instance from app state
        sio = request.app.state.sio
        
        # Set up WebSocket streaming
        def callback_wrapper(data):
            # Create task in the event loop to emit data
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # Schedule the emit in the event loop
                    asyncio.ensure_future(sio.emit('simulation_data', data))
            except Exception as e:
                print(f"Error scheduling data stream: {e}")
        
        current_runtime.set_websocket_callback(callback_wrapper)
        
        # Start simulation
        current_runtime.start()
        
        print("✓ Simulation started with WebSocket streaming")
        
        # TODO: Start input providers for Python input nodes if needed
        # For now, we can handle spike injection directly through the runtime
        
        return {
            "status": "started",
            "backend": "genn_python",
            "websocket_port": 8000,  # Using main server port with SocketIO
            "simulation_info": current_runtime.get_state()
        }
        
    except Exception as e:
        print(f"Error starting simulation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
        

@router.post("/simulation/stop")
async def stop_simulation():
    """Stop the simulation runtime."""
    global current_runtime
    
    try:
        if current_runtime and current_runtime.running:
            current_runtime.stop()
        
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
    Get current simulation runtime status.
    
    Returns:
        Status of the Python simulation runtime
    """
    global current_runtime
    
    if not current_runtime:
        return {
            "running": False,
            "error": "No runtime initialized"
        }
    
    state = current_runtime.get_state()
    
    return {
        "running": state["running"],
        "timestep": state["timestep"],
        "time": state["time"],
        "speed": state["speed"],
        "dt": state["dt"]
    }

@router.post("/input/inject_genn")
async def inject_input_genn(node_id: str, spike: bool = False, current: float = 0.0, index: int = 0):
    """
    Inject input into a GeNN neuron using Python runtime.
    
    Args:
        node_id: Target neuron ID
        spike: If True, force a spike
        current: Current to inject (if not spike)
        index: Index of neuron within population
    """
    global current_runtime
    
    if not current_runtime:
        raise HTTPException(status_code=400, detail="Runtime not initialized")
    
    try:
        if spike:
            current_runtime.inject_spike(node_id, index)
            return {"status": "spike_injected", "neuron_id": node_id, "index": index}
        else:
            current_runtime.inject_current(node_id, current, index)
            return {"status": "current_injected", "neuron_id": node_id, "current": current, "index": index}
            
    except Exception as e:
        print(f"Error injecting input: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
    