
import asyncio
import json
import hashlib
from typing import Dict, Any, List, Optional, Set
from fastapi import WebSocket, WebSocketDisconnect

from ..genn_modules.genn_builder import GeNNNetworkBuilder
from ..genn_modules.simulation_runtime import GeNNSimulationRuntime
from ..input.python_generator import PythonInputGenerator
from ..api.schemas import NetworkPayload

class SimulationManager:
    """
    Central manager for GeNN simulation state and execution.
    Handles model building, runtime management, input generation, and WebSocket communication.
    """
    
    def __init__(self):
        self.current_builder: Optional[GeNNNetworkBuilder] = None
        self.current_runtime: Optional[GeNNSimulationRuntime] = None
        self.model_info: Optional[Dict[str, Any]] = None
        self.network_config: Optional[Dict[str, Any]] = None
        
        self.active_input_generators: List[PythonInputGenerator] = []
        self.active_websockets: Set[WebSocket] = set()

    def calculate_model_hash(self, network_dict: Dict[str, Any]) -> str:
        """Generate a unique hash for the network configuration."""
        network_str = json.dumps(network_dict, sort_keys=True)
        return hashlib.md5(network_str.encode()).hexdigest()

    async def load_network(self, payload: NetworkPayload) -> Dict[str, Any]:
        """Load and build network using GeNN."""
        print(f"Loading network: {len(payload.nodes)} nodes, {len(payload.edges)} edges")
        
        # Stop existing simulation
        await self.stop_simulation()
        
        # Convert payload to dict
        network_dict = {
            "nodes": [node.dict() for node in payload.nodes],
            "edges": [edge.dict() for edge in payload.edges]
        }
        self.network_config = network_dict
        
        # Build model
        model_hash = self.calculate_model_hash(network_dict)
        print(f"Model hash: {model_hash}")
        
        temp_builder = GeNNNetworkBuilder(model_id=model_hash)
        
        if temp_builder.is_compiled():
            print(f"✓ Using cached model: {model_hash}")
            self.current_builder = temp_builder
            code_path, self.model_info = self.current_builder.build_from_json(network_dict, skip_compile=True)
        else:
            print("Building new GeNN model...")
            self.current_builder = temp_builder
            code_path, self.model_info = self.current_builder.build_from_json(network_dict)
            
        print("Loading model into memory...")
        self.current_builder.load_model(num_recording_timesteps=1)
        
        print("Creating simulation runtime...")
        self.current_runtime = GeNNSimulationRuntime(self.current_builder)
        
        # Save metadata if name provided
        if payload.network_name:
            self._save_metadata(payload.network_name, network_dict, code_path)
            
        return {
            "status": "loaded",
            "backend": "genn_python",
            "model_info": self.model_info
        }

    def _save_metadata(self, name: str, network_dict: Dict, code_path: str):
        from pathlib import Path
        from datetime import datetime
        
        metadata = {
            "name": name,
            "created_at": datetime.now().isoformat(),
            "nodes": network_dict["nodes"],
            "edges": network_dict["edges"],
            "model_info": self.model_info
        }
        
        metadata_path = Path(code_path) / "network_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

    async def start_simulation(self):
        """Start the simulation loop and input generators."""
        if not self.current_runtime:
            raise RuntimeError("Runtime not initialized")
            
        # Configure WebSocket streaming
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()
            
        def callback_wrapper(data):
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    self.broadcast_data(data),
                    loop
                )
        
        self.current_runtime.set_websocket_callback(callback_wrapper)
        
        # Start runtime
        self.current_runtime.start()
        
        # Start input generators
        self._start_input_generators()
        
        return {
            "status": "started",
            "backend": "genn_python",
            "websocket_url": "ws://localhost:8000/api/ws/simulation",
            "simulation_info": self.current_runtime.get_state()
        }

    def _start_input_generators(self):
        """Start Python input generators based on config."""
        # Stop existing
        self._stop_input_generators()
        
        if not self.network_config:
            print("Warning: No network config found when starting inputs")
            return

        for node in self.network_config.get("nodes", []):
            print(f"Checking node {node['id']} type: {node.get('type')}")
            if node.get("type", "").lower() == "python":
                params = node.get("params", {})
                code = params.get("code") or params.get("custom_function", "")
                if code:
                    try:
                        # Inject directly into the SOURCE node
                        # The spike will then propagate through synapses to any connected targets
                        generator = PythonInputGenerator(
                            code=code,
                            neuron_id=node["id"],
                            interval=0.001,
                            runtime=self.current_runtime
                        )
                        generator.start()
                        self.active_input_generators.append(generator)
                        print(f"Started generator for input node: {node['id']}")
                    except Exception as e:
                        print(f"Error starting generator {node['id']}: {e}")

    def _stop_input_generators(self):
        for gen in self.active_input_generators:
            try:
                gen.stop()
            except: pass
        self.active_input_generators = []

    async def stop_simulation(self):
        """Stop simulation and input generators."""
        if self.current_runtime and self.current_runtime.running:
            self.current_runtime.stop()
        self._stop_input_generators()

    def set_speed(self, speed: float):
        if self.current_runtime:
            self.current_runtime.set_speed(speed)

    # --- WebSocket Handling ---

    async def handle_websocket(self, websocket: WebSocket):
        await websocket.accept()
        self.active_websockets.add(websocket)
        print(f"Client connected. Total: {len(self.active_websockets)}")
        
        try:
            while True:
                data = await websocket.receive_json()
                await self.process_command(data)
        except WebSocketDisconnect:
            self.active_websockets.remove(websocket)
            print("Client disconnected")
        except Exception as e:
            print(f"WebSocket error: {e}")
            self.active_websockets.discard(websocket)

    async def process_command(self, data: Dict[str, Any]):
        command = data.get("command")
        print(f"Received command: {command}")
        
        if command == "stop":
            await self.stop_simulation()
        elif command == "start":
            # Resume/Restart if stopped
            if self.current_runtime and not self.current_runtime.running:
                await self.start_simulation()
            elif not self.current_runtime:
                 print("Cannot start: No runtime loaded")
        elif command == "set_speed":
            self.set_speed(float(data.get("speed", 1.0)))

    async def broadcast_data(self, data: Dict[str, Any]):
        """Send data to all connected clients."""
        if not self.active_websockets:
            return
        
        to_remove = []
        for ws in self.active_websockets:
            try:
                await ws.send_json(data)
            except:
                to_remove.append(ws)
        
        for ws in to_remove:
            self.active_websockets.discard(ws)

    def get_state(self):
        if not self.current_runtime:
            return {"running": False, "error": "No runtime initialized"}
        return self.current_runtime.get_state()

    def inject_input(self, node_id: str, spike: bool, current: float, index: int):
        if not self.current_runtime:
            raise RuntimeError("Runtime not initialized")
            
        if spike:
            self.current_runtime.inject_spike(node_id, index)
        else:
            self.current_runtime.inject_current(node_id, current, index)

# Global instance
simulation_manager = SimulationManager()
