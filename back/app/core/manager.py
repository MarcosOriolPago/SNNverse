"""
Simulation Manager

The central orchestrator that ties together the builder, runtime, and I/O.
This replaces both the old SimulationManager AND the separate service layer
(ModelService, InputService, SessionService, ConnectionService).

The manager is the ONLY place that knows about all components. Each component
only knows about its own types.

Workflow:
    1. load_network(payload) → Build/compile the GeNN model
    2. run_offline(duration, dt) → Run batch simulation, return results
    3. start_simulation() → Start real-time mode with WebSocket output
    4. get_voltages(session_id, ...) → Read voltage data for playback

All state is held here in the manager singleton.
"""

import json
import hashlib
import struct
import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List, Set
from datetime import datetime

import numpy as np
from fastapi import WebSocket

from .builder import GeNNBuilder
from .runtime import OfflineRuntime, RealTimeRuntime
from .config import config
from .types import (
    NetworkConfig,
    NodeConfig,
    EdgeConfig,
    SimulationResult,
    SessionInfo,
    VoltageFrame,
    PopulationInfo,
)

from ..input.registry import InputRegistry
from ..input.types.spike_input_fx import SpikeInputFx

logger = logging.getLogger(__name__)


class SimulationManager:
    """
    Singleton facade that owns the entire simulation lifecycle.

    All service logic (model, input, session, connection) is consolidated here
    to reduce indirection and make the data flow obvious.
    """

    def __init__(self):
        # ─── Model state ─────────────────────────────────────────
        self.builder: Optional[GeNNBuilder] = None
        self.network_config: Optional[NetworkConfig] = None
        self.model_info: Optional[Dict[str, Any]] = None

        # ─── Runtime state ───────────────────────────────────────
        self.current_runtime: Optional[OfflineRuntime | RealTimeRuntime] = None

        # ─── Session state (voltage file store) ──────────────────
        self.sessions: Dict[str, SessionInfo] = {}

        # ─── WebSocket state ─────────────────────────────────────
        self.active_sockets: Set[WebSocket] = set()

        # ─── Input state ─────────────────────────────────────────
        self.active_inputs: list = []

    # ═══════════════════════════════════════════════════════════════
    #  NETWORK LOADING
    # ═══════════════════════════════════════════════════════════════

    async def load_network(self, nodes: List[Dict], edges: List[Dict], name: str = None) -> Dict[str, Any]:
        """
        Build and compile a GeNN model from frontend payload.

        Input:  List of node dicts, list of edge dicts
        Output: {"status": "loaded", "model_info": {...}}
        """
        await self.stop_simulation()

        # Convert dict lists → typed config
        net = NetworkConfig(
            nodes=[NodeConfig(**n) for n in nodes],
            edges=[EdgeConfig(**e) for e in edges],
            name=name,
        )
        self.network_config = net

        # Hash for cache key
        config_str = json.dumps(
            {"nodes": nodes, "edges": edges}, sort_keys=True
        )
        model_hash = hashlib.md5(config_str.encode()).hexdigest()

        # Build
        self.builder = GeNNBuilder(model_id=model_hash)
        skip = self.builder.is_compiled()

        if skip:
            logger.info(f"✓ Using cached model: {model_hash}")

        result = self.builder.build(net, skip_compile=skip)

        self.model_info = {
            "model_id": result.model_id,
            "code_path": result.code_path,
            "backend": result.backend,
            "populations": {
                k: {
                    "name": v.name,
                    "type": v.neuron_type,
                    "has_voltage": v.has_voltage,
                }
                for k, v in result.populations.items()
            },
        }

        return {"status": "loaded", "model_info": self.model_info}

    def save_network(self, nodes: List[Dict], edges: List[Dict], name: str = None) -> Dict[str, Any]:
        """Save network config to disk (no compilation)."""
        network_dict = {"nodes": nodes, "edges": edges}
        config_str = json.dumps(network_dict, sort_keys=True)
        model_hash = hashlib.md5(config_str.encode()).hexdigest()

        genn_out = Path(__file__).parent.parent / "genn_out"
        code_path = genn_out / f"{model_hash}_CODE"
        code_path.mkdir(parents=True, exist_ok=True)

        metadata = {
            "name": name or "Unnamed Network",
            "created_at": datetime.now().isoformat(),
            "nodes": nodes,
            "edges": edges,
            "model_info": self.model_info,
        }
        with open(code_path / "network_metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)

        return {
            "status": "success",
            "message": f"Network saved: {name}",
            "hash": model_hash,
        }

    # ═══════════════════════════════════════════════════════════════
    #  OFFLINE SIMULATION
    # ═══════════════════════════════════════════════════════════════

    def run_offline(self, duration_ms: float, dt: float = 1.0) -> Dict[str, Any]:
        """
        Execute an offline (batch) simulation.

        Input:  duration_ms, dt
        Output: {"session_id": ..., "spike_data": ..., "duration_ms": ..., ...}
        """
        if not self.builder:
            raise RuntimeError("No model loaded. Call load_network first.")

        sim_dt = self.builder.model.dt
        total_steps = int(duration_ms / sim_dt)
        chunk_size = min(total_steps, config.NUM_RECORDING_TIMESTEPS_OFFLINE)

        logger.info(f"[Offline] Loading model with buffer={chunk_size}")
        self.builder.load(num_recording_timesteps=chunk_size)

        # Create runtime
        runtime = OfflineRuntime(self.builder)

        # Prepare offline inputs (spike source arrays)
        self._prepare_offline_inputs(runtime, duration_ms)

        # Run simulation
        result: SimulationResult = runtime.run(duration_ms, dt)

        # Store session for voltage playback
        self._save_session(result)

        # Return serializable response
        return {
            "session_id": result.session_id,
            "spike_data": result.spike_data,
            "voltage_file": result.voltage_file,
            "duration_ms": result.duration_ms,
            "dt": result.dt,
            "wall_time": result.wall_time_s,
        }

    # ═══════════════════════════════════════════════════════════════
    #  REAL-TIME SIMULATION
    # ═══════════════════════════════════════════════════════════════

    async def start_simulation(self) -> Dict[str, Any]:
        """Start real-time simulation with WebSocket output."""
        await self.stop_simulation()

        if not self.builder:
            raise RuntimeError("No model loaded. Call load_network first.")

        self.current_runtime = RealTimeRuntime(self.builder)

        # Bridge to WebSocket
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()

        self.current_runtime.set_websocket_callback(
            lambda data: asyncio.run_coroutine_threadsafe(
                self._broadcast(data), loop
            )
        )

        # Start inputs
        self._start_realtime_inputs(self.current_runtime)

        # Start loop
        self.current_runtime.start()
        return {"status": "started"}

    async def stop_simulation(self):
        """Stop any running simulation."""
        if self.current_runtime:
            if hasattr(self.current_runtime, "stop"):
                self.current_runtime.stop()

        self._stop_inputs()

        if self.current_runtime and hasattr(self.current_runtime, "join"):
            self.current_runtime.join()

        self.current_runtime = None
        logger.info("Simulation stopped")

    # ═══════════════════════════════════════════════════════════════
    #  WEBSOCKET HANDLING
    # ═══════════════════════════════════════════════════════════════

    async def handle_websocket(self, websocket: WebSocket):
        """Handle WebSocket connection for simulation control."""
        await websocket.accept()
        self.active_sockets.add(websocket)
        try:
            while True:
                data = await websocket.receive_json()
                cmd = data.get("command")
                if cmd == "stop":
                    await self.stop_simulation()
                elif cmd == "start":
                    await self.start_simulation()
        except Exception as e:
            logger.debug(f"WebSocket disconnected: {e}")
            self.active_sockets.discard(websocket)

    async def _broadcast(self, data: Dict):
        """Send data to all connected WebSocket clients."""
        if not self.active_sockets:
            return
        to_remove = []
        for ws in self.active_sockets:
            try:
                await ws.send_json(data)
            except Exception:
                to_remove.append(ws)
        for ws in to_remove:
            self.active_sockets.discard(ws)

    # ═══════════════════════════════════════════════════════════════
    #  INPUT HANDLING
    # ═══════════════════════════════════════════════════════════════

    def _prepare_offline_inputs(self, runtime: OfflineRuntime, duration_ms: float):
        """
        Generate CSR spike arrays for all SPIKE_FX nodes and push to GPU.

        Only SPIKE_FX nodes need offline input preparation. The SpikeSourceArray
        population IS the spike source, and downstream LIF neurons receive spikes
        via synapses automatically.
        """
        if not self.network_config:
            return

        InputRegistry.autodiscover()

        for node in self.network_config.nodes:
            if node.type.upper() != "SPIKE_FX":
                continue

            adapter = InputRegistry.create_from_node({
                "id": node.id,
                "type": node.type.lower(),
                "params": node.params,
            })

            if not adapter or not isinstance(adapter, SpikeInputFx):
                continue

            if not hasattr(adapter, "generate_batch"):
                continue

            try:
                start, end, times = adapter.generate_batch(duration_ms)
                self._push_spike_data_to_genn(runtime, node.id, start, end, times)
                logger.info(
                    f"[Input] Prepared {len(times)} spikes for '{node.id}'"
                )
            except Exception as e:
                logger.error(f"[Input] Failed to prepare '{node.id}': {e}")

    def _push_spike_data_to_genn(
        self, runtime, pop_name: str,
        start: np.ndarray, end: np.ndarray, times: np.ndarray
    ):
        """Write CSR spike data into the GeNN population's memory."""
        if pop_name not in runtime.populations:
            logger.warning(f"[Input] Population '{pop_name}' not found in runtime")
            return

        pop = runtime.populations[pop_name]

        if "spikeTimes" not in pop.extra_global_params:
            logger.warning(f"[Input] '{pop_name}' has no spikeTimes EGP")
            return

        # Safety: truncate if we exceed allocated buffer
        max_cap = len(pop.extra_global_params["spikeTimes"].view)
        if len(times) > max_cap:
            logger.warning(f"[Input] Truncating {len(times)} spikes to {max_cap}")
            times = times[:max_cap]
            start = np.minimum(start, max_cap)
            end = np.minimum(end, max_cap)

        # Write to GeNN memory
        pop.extra_global_params["spikeTimes"].view[: len(times)] = times
        pop.vars["startSpike"].view[:] = start
        pop.vars["endSpike"].view[:] = end

        # Sync to device
        pop.extra_global_params["spikeTimes"].push_to_device()
        pop.vars["startSpike"].push_to_device()
        pop.vars["endSpike"].push_to_device()

    def _start_realtime_inputs(self, runtime: RealTimeRuntime):
        """Start input adapters for real-time mode."""
        self._stop_inputs()

        if not self.network_config:
            return

        InputRegistry.autodiscover()

        for node in self.network_config.nodes:
            adapter = InputRegistry.create_from_node({
                "id": node.id,
                "type": node.type.lower(),
                "params": node.params,
            })
            if adapter:
                try:
                    runtime.add_input_source(adapter)
                    adapter.start()
                    self.active_inputs.append(adapter)
                except Exception as e:
                    logger.error(f"[Input] Error starting '{node.id}': {e}")

    def _stop_inputs(self):
        """Stop all active input adapters."""
        for gen in self.active_inputs:
            try:
                gen.stop()
            except Exception:
                pass
        self.active_inputs = []

    # ═══════════════════════════════════════════════════════════════
    #  SESSION / VOLTAGE STORAGE
    # ═══════════════════════════════════════════════════════════════

    def _save_session(self, result: SimulationResult):
        """Store session metadata for voltage file seeking."""
        pop_sizes = {}
        pop_keys = []

        for name, info in result.populations.items():
            if info.has_voltage:
                pop_sizes[name] = info.size
                pop_keys.append(name)

        pop_keys.sort()

        self.sessions[result.session_id] = SessionInfo(
            file_path=result.voltage_file,
            dt=result.dt,
            total_neurons=sum(pop_sizes.values()),
            pop_keys=pop_keys,
            pop_sizes=pop_sizes,
            total_steps=result.steps_run,
        )

    def get_voltages(
        self, session_id: str, start_ms: float, end_ms: float
    ) -> Optional[List[Dict]]:
        """
        Read voltage frames from the binary file for playback.

        Input:  session_id, time range [start_ms, end_ms)
        Output: List of {"time": float, "voltages": {pop: [v0, ...]}}
        """
        if session_id not in self.sessions:
            return None

        session = self.sessions[session_id]
        dt = session.dt
        start_step = int(start_ms / dt)
        end_step = int(end_ms / dt)
        num_steps = end_step - start_step

        if num_steps <= 0:
            return []

        bytes_per_frame = session.total_neurons * 4  # 4 bytes per float32
        frames = []

        try:
            with open(session.file_path, "rb") as f:
                f.seek(start_step * bytes_per_frame)
                for i in range(num_steps):
                    data = f.read(bytes_per_frame)
                    if len(data) < bytes_per_frame:
                        break

                    values = struct.unpack(
                        f"{session.total_neurons}f", data
                    )
                    frame_map = {}
                    offset = 0
                    for pop_name in session.pop_keys:
                        size = session.pop_sizes[pop_name]
                        frame_map[pop_name] = list(values[offset : offset + size])
                        offset += size

                    frames.append({
                        "time": (start_step + i) * dt,
                        "voltages": frame_map,
                    })
        except Exception as e:
            logger.error(f"Voltage read error: {e}")

        return frames

    # ═══════════════════════════════════════════════════════════════
    #  CONTROL / MISC
    # ═══════════════════════════════════════════════════════════════

    def inject_input(self, node_id: str, spike: bool, current: float, index: int):
        """Inject a spike or current into a running real-time simulation."""
        if self.current_runtime and isinstance(self.current_runtime, RealTimeRuntime):
            if spike:
                self.current_runtime.inject_spike(node_id, index)

    def set_speed(self, speed: float):
        """Change simulation speed (real-time mode)."""
        if self.current_runtime and hasattr(self.current_runtime, "set_speed"):
            self.current_runtime.set_speed(speed)

    def get_state(self) -> Dict[str, Any]:
        """Get current simulation state."""
        if not self.current_runtime:
            return {"running": False}
        return self.current_runtime.get_state()


# ─── Global Singleton ───────────────────────────────────────────────

simulation_manager = SimulationManager()
