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
    from .genn_simulator import genn_manager, GENN_AVAILABLE
    GENN_ENABLED = GENN_AVAILABLE
except ImportError as err:
    GENN_ENABLED = False
    print("GeNN not available. Using fallback simulation engine.")

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

# --- 3. WebSocket Callback ---
async def websocket_emit_callback(updates: List[Dict], spikes: List[str]):
    """
    Callback function for GeNN simulator to emit data via WebSocket.
    
    Args:
        updates: List of neuron voltage updates
        spikes: List of neuron IDs that spiked
    """
    if updates or spikes:
        await sio.emit('tick', {
            'neurons': updates,
            'spikes': spikes
        })

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
    4. Compiles and prepares for simulation
    
    Returns:
        Model information including paths, neuron count, etc.
    """
    if not GENN_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="GeNN not available. Install pygenn: pip install pygenn"
        )
    
    try:
        # Convert Pydantic models to dict
        network_dict = {
            "nodes": [node.dict() for node in payload.nodes],
            "edges": [edge.dict() for edge in payload.edges]
        }
        
        # Build GeNN model
        print(f"Building GeNN model with {len(payload.nodes)} nodes, {len(payload.edges)} edges")
        model_info = await genn_manager.load_and_build_network(network_dict)
        
        return {
            "status": "loaded",
            "backend": "genn",
            "model_info": model_info
        }
        
    except Exception as e:
        print(f"Error loading GeNN network: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulation/start_genn")
async def start_simulation_genn(max_steps: Optional[int] = None):
    """
    Start GeNN simulation.
    
    This endpoint:
    1. Starts the GeNN simulation loop
    2. Streams voltage/spike data via WebSocket
    
    Args:
        max_steps: Maximum timesteps (None for infinite)
    """
    if not GENN_ENABLED:
        raise HTTPException(status_code=503, detail="GeNN not available")
    
    try:
        # Start simulation with WebSocket callback
        await genn_manager.start_simulation(
            websocket_callback=websocket_emit_callback,
            max_timesteps=max_steps
        )
        
        return {
            "status": "started",
            "backend": "genn"
        }
        
    except Exception as e:
        print(f"Error starting GeNN simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulation/stop")
async def stop_simulation():
    """Stop the running simulation (GeNN or fallback)."""
    try:
        if GENN_ENABLED:
            await genn_manager.stop_simulation()
        
        return {"status": "stopped"}
        
    except Exception as e:
        print(f"Error stopping simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/simulation/state_genn")
async def get_simulation_state_genn():
    """
    Get current simulation state from GeNN.
    
    Returns:
        Snapshot of all neuron states (voltage, etc.)
    """
    if not GENN_ENABLED:
        raise HTTPException(status_code=503, detail="GeNN not available")
    
    state = genn_manager.get_current_state()
    
    if state is None:
        return {"neurons": [], "running": False}
    
    return state

@app.post("/api/input/inject_genn")
async def inject_input_genn(node_id: str, spike: bool = False, current: float = 0.0):
    """
    Inject input into a GeNN neuron (for custom Python functions).
    
    Args:
        node_id: Target neuron ID
        spike: If True, force a spike
        current: Current to inject (if not spike)
    """
    if not GENN_ENABLED:
        raise HTTPException(status_code=503, detail="GeNN not available")
    
    try:
        genn_manager.inject_input(node_id, spike=spike, current=current)
        
        return {
            "status": "injected",
            "node_id": node_id,
            "spike": spike,
            "current": current
        }
        
    except Exception as e:
        print(f"Error injecting input: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
