import json 
import hashlib
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import WebSocket

from .simulation_runtime import OfflineRuntime, RealTimeRuntime
from ..api.schemas import NetworkPayload
from .sim_services import SessionService, ModelService, ConnectionService, InputService
from .config import config


class SimulationManager:
    """
    The Facade that ties all services together.
    Clean, readable, and focused on flow control.
    """
    def __init__(self):
        self.model_service = ModelService()
        self.input_service = InputService()
        self.session_service = SessionService()
        self.conn_service = ConnectionService()
        
        self.current_runtime: Optional[OfflineRuntime | RealTimeRuntime] = None

    # --- Setup ---
    def calculate_model_hash(self, network_dict: Dict[str, Any]) -> str:
        """Generate a unique hash for the network configuration."""
        network_str = json.dumps(network_dict, sort_keys=True)
        return hashlib.md5(network_str.encode()).hexdigest()

    async def load_network(self, payload: NetworkPayload) -> Dict[str, Any]:
        await self.stop_simulation()
        info = self.model_service.load_network(payload)
        return {"status": "loaded", "model_info": info}

    def save_network(self, payload: NetworkPayload) -> Dict[str, Any]:
        """Save network configuration without compiling."""
        
        # Convert payload to dict
        network_dict = {
            "nodes": [node.dict() for node in payload.nodes],
            "edges": [edge.dict() for edge in payload.edges]
        }
        
        # Calculate hash for folder name
        model_hash = self.calculate_model_hash(network_dict)
        
        # Determine output directory
        # We need to ensure the directory exists even if we don't compile
        genn_out_dir = Path(__file__).parent.parent / "genn_out"
        code_path = genn_out_dir / f"{model_hash}_CODE"
        code_path.mkdir(parents=True, exist_ok=True)
        
        # Save metadata
        name = payload.network_name or "Unnamed Network"
        try:
            self._save_metadata(name, network_dict, str(code_path))
            return {
                "status": "success",
                "message": f"Network '{name}' saved successfully",
                "hash": model_hash,
                "path": str(code_path)
            }
        except Exception as e:
            raise RuntimeError(f"Failed to save network metadata: {str(e)}")

    def _save_metadata(self, name: str, network_dict: Dict, code_path: str):

        metadata = {
            "name": name,
            "created_at": datetime.now().isoformat(),
            "nodes": network_dict["nodes"],
            "edges": network_dict["edges"],
            "model_info": self.model_service.model_info
        }
        
        metadata_path = Path(code_path) / "network_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)


    # --- Offline Execution ---

    def run_offline(self, duration_ms: float, dt: float = 1.0):
        builder = self.model_service.current_builder
        if not builder: 
            raise RuntimeError("No model loaded")
        
        sim_dt = builder.model.dt
        total_steps = int(duration_ms / sim_dt)
        
        # Max buffer size safety (e.g. 2000 steps to avoid VRAM overflow)
        # If total_steps > 2000, we chunk it.
        chunk_size = min(total_steps, config.NUM_RECORDING_TIMESTEPS)

        self.current_runtime = OfflineRuntime(builder)
        
        # Pre-calculate Inputs (Batch Strategy)
        self.input_service.prepare_offline_inputs(
            self.current_runtime, 
            self.model_service.get_nodes(), 
            duration_ms
        )
        result = self.current_runtime.run(duration_ms, dt, chunk_size=chunk_size)
        self.session_service.save_session(result, self.current_runtime)
        
        return result

    # --- Real-Time Execution ---

    async def start_simulation(self):
        builder = self.model_service.current_builder
        if not builder: 
            raise RuntimeError("No model loaded")

        # Setup Runtime
        self.current_runtime = RealTimeRuntime(builder)
        
        # Bridge WebSocket
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()
            
        self.current_runtime.set_websocket_callback(
            lambda data: asyncio.run_coroutine_threadsafe(
                self.conn_service.broadcast(data), loop
            )
        )

        # Start Inputs
        self.input_service.start_realtime_inputs(
            self.current_runtime,
            self.model_service.get_nodes()
        )

        # Start Loop
        self.current_runtime.start()
        return {"status": "started"}

    async def stop_simulation(self):
        if self.current_runtime and hasattr(self.current_runtime, 'stop'):
            self.current_runtime.stop()
        self.input_service.stop_inputs()
        self.current_runtime = None

    # --- Control & Data ---

    async def handle_websocket(self, websocket: WebSocket):
        await self.conn_service.connect(websocket)
        try:
            while True:
                data = await websocket.receive_json()
                cmd = data.get("command")
                if cmd == "stop": 
                    await self.stop_simulation()
                elif cmd == "start": 
                    print("Started Simulation via WebSocket Command")
                    await self.start_simulation()
                elif cmd == "set_speed": 
                    self.set_speed(float(data.get("speed", 1.0)))
        except:
            self.conn_service.disconnect(websocket)

    def set_speed(self, speed: float):
        if self.current_runtime:
            self.current_runtime.set_speed(speed)
        self.input_service.set_speed(speed)

    def inject_input(self, node_id: str, spike: bool, current: float, index: int):
        if self.current_runtime:
            if spike: self.current_runtime.inject_spike(node_id, index)
            else: self.current_runtime.inject_current(node_id, current, index) # If implemented

    def get_voltages(self, session_id, start, end):
        return self.session_service.get_voltages(session_id, start, end)
    
    def get_state(self):
        if not self.current_runtime: return {"running": False}
        return self.current_runtime.get_state()

    def benchmark_model(self, iterations: int):
        if not self.current_runtime: raise RuntimeError("Runtime not init")
        # Assuming benchmark is implemented in runtime base
        return 0.0 # Placeholder or call runtime.benchmark()


# Global Singleton
simulation_manager = SimulationManager()
