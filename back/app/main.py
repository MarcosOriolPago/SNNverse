"""
FastAPI Backend with GeNN Integration

This integrates the GeNN workflow into the existing backend:
- Loads network from frontend JSON
- Builds GeNN model (generates C++ code)
- Runs GeNN simulation using Python runtime
- Streams results via WebSocket

The workflow:
1. User defines network in React frontend
2. POST /api/network/load_genn -> Builds GeNN model
3. POST /api/simulation/start_genn -> Runs simulation
4. WebSocket emits real-time voltage/spike data
5. POST /api/simulation/stop -> Stops simulation
"""

import socketio
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import router


# Global state for GeNN model building
current_builder = None
model_info = None

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
app.include_router(router, prefix="/api")

# Make SocketIO available to routes
app.state.sio = sio

# --- Socket.IO Events ---

@sio.event
async def connect(sid, environ):
    """Handle WebSocket connection."""
    print(f"Client connected: {sid}")
    
    # If simulation is running, start streaming data
    if app.state.current_runtime and app.state.current_runtime.running:
        print(f"Simulation already running, will stream data to {sid}")

@sio.event
async def disconnect(sid):
    """Handle WebSocket disconnection."""
    print(f"Client disconnected: {sid}")

# --- Simulation Data Streaming ---

async def stream_simulation_data(data):
    """
    Callback function for simulation runtime to stream data via SocketIO.
    
    Called by the simulation runtime's background thread.
    """
    try:
        # Emit to all connected clients
        await app.state.sio.emit('simulation_data', data)
    except Exception as e:
        print(f"Error streaming data: {e}")

def setup_simulation_streaming():
    """
    Set up the simulation runtime to stream data via SocketIO.
    Call this after creating the runtime.
    """
    if app.state.current_runtime:
        # Create a wrapper that can be called from the simulation thread
        def callback_wrapper(data):
            # Schedule the coroutine in the event loop
            asyncio.create_task(stream_simulation_data(data))
        
        app.state.current_runtime.set_websocket_callback(callback_wrapper)
        print("✓ Simulation streaming configured")

# Make this function available to routes
app.state.setup_simulation_streaming = setup_simulation_streaming

# --- 7. Main Entry Point ---

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("SNNverse Backend with GeNN Integration (Python Runtime)")
    print("=" * 60)
    print(f"Server starting on http://0.0.0.0:8000")
    print("=" * 60)
    
    uvicorn.run(sio_app, host="0.0.0.0", port=8000)
