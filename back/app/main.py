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
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import *


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

# --- Socket.IO Events ---

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
    print(f"Server starting on http://0.0.0.0:8000")
    print("=" * 60)
    
    uvicorn.run(sio_app, host="0.0.0.0", port=8000)
