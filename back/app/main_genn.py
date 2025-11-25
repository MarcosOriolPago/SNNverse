"""
FastAPI Backend with GeNN Integration

This integrates the GeNN workflow into the existing backend:
- Loads network from frontend JSON
- Builds GeNN model (generates C++ code)
- Runs GeNN simulation
- Streams results via WebSocket

The workflow:
1. User defines network in React frontend
2. POST /api/network/load_genn -> Builds GeNN model
3. POST /api/simulation/start_genn -> Runs simulation
4. WebSocket emits real-time voltage/spike data
5. POST /api/simulation/stop -> Stops simulation
"""

import socketio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# Import GeNN components
try:
    from .genn_builder import GeNNNetworkBuilder, GENN_AVAILABLE
    from .genn_cpp_manager import cpp_runner
    GENN_ENABLED = GENN_AVAILABLE
except ImportError as err:
    GENN_ENABLED = False
    print("GeNN not available. Using fallback simulation engine.")

# Global state for GeNN model building
current_builder = None
model_info = None

# Import existing components
from .sandbox import execute_spike_function, test_function_quick
from .schemas import CustomFunctionPayload, FunctionExecutionResult

# --- 1. Setup ---
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = FastAPI()
sio_app = socketio.ASGIApp(sio, app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. Data Models ---
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

class SimulationMode(BaseModel):
    mode: str = "genn"  # "genn" or "fallback"

# Note: WebSocket streaming is handled by the C++ runner directly
# The C++ runner connects to port 9002 and streams to the frontend
# This Python backend only manages the runner subprocess

# --- 4. API Routes ---

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "genn_available": GENN_ENABLED,
        "version": "1.0.0-genn"
    }

@app.post("/api/network/load_genn")
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
    global current_builder, model_info
    
    if not GENN_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="GeNN not available. Install pygenn: pip install pygenn"
        )
    
    try:
        # Stop any running simulation first
        if cpp_runner.is_running():
            print("Stopping existing C++ runner...")
            cpp_runner.stop()
        
        # Convert Pydantic models to dict
        network_dict = {
            "nodes": [node.dict() for node in payload.nodes],
            "edges": [edge.dict() for edge in payload.edges]
        }
        
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

@app.post("/api/simulation/start_genn")
async def start_simulation_genn():
    """
    Start GeNN C++ runner.
    
    This endpoint:
    1. Launches C++ runner as subprocess
    2. C++ runner loads model and starts WebSocket on port 9002
    3. C++ runner streams voltage/spike data to frontend
    """
    global current_builder, model_info
    
    if not GENN_ENABLED:
        raise HTTPException(status_code=503, detail="GeNN not available")
    
    if not model_info or not current_builder:
        raise HTTPException(status_code=400, detail="No model loaded. Call /api/network/load_genn first")
    
    try:
        # Get neuron IDs for metadata
        neuron_ids = model_info.get("neuron_ids", [])
        code_path = model_info.get("code_path")
        
        if not code_path:
            raise HTTPException(status_code=500, detail="Model code path not found")
        
        # Start C++ runner subprocess
        print(f"Starting C++ runner for model at: {code_path}")
        success = cpp_runner.start(
            model_code_path=code_path,
            port=9002,
            neuron_ids=neuron_ids
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to start C++ runner")
        
        return {
            "status": "started",
            "backend": "genn_cpp",
            "websocket_port": 9002,
            "pid": cpp_runner.process.pid if cpp_runner.process else None
        }
        
    except Exception as e:
        print(f"Error starting GeNN simulation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulation/stop")
async def stop_simulation():
    """Stop the C++ runner subprocess."""
    try:
        if GENN_ENABLED and cpp_runner.is_running():
            cpp_runner.stop()
        
        return {"status": "stopped"}
        
    except Exception as e:
        print(f"Error stopping simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/simulation/state_genn")
async def get_simulation_state_genn():
    """
    Get current C++ runner status.
    
    Returns:
        Status of the C++ runner subprocess
    """
    if not GENN_ENABLED:
        raise HTTPException(status_code=503, detail="GeNN not available")
    
    status = cpp_runner.get_status()
    
    return {
        "running": status["running"],
        "pid": status["pid"],
        "websocket_port": status["websocket_port"],
        "model_path": status["model_path"]
    }

@app.post("/api/input/inject_genn")
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

# --- 5. Keep existing endpoints for custom Python functions ---

@app.post("/api/input/execute")
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

# --- 6. Socket.IO Events ---

@sio.event
async def connect(sid, environ):
    """Handle WebSocket connection."""
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    """Handle WebSocket disconnection."""
    print(f"Client disconnected: {sid}")

# --- 7. Main Entry Point ---

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("SNNverse Backend with GeNN Integration")
    print("=" * 60)
    print(f"GeNN Available: {GENN_ENABLED}")
    print(f"Server starting on http://0.0.0.0:8000")
    print("=" * 60)
    
    uvicorn.run(sio_app, host="0.0.0.0", port=8000)
