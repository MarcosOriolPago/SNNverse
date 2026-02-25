"""
Simulation Runtimes

Two execution modes, each with a clear contract:

OfflineRuntime:
    Input:  A loaded GeNNBuilder, duration_ms, dt
    Output: SimulationResult (spike_data dict + voltage binary file)

RealTimeRuntime:
    Input:  A loaded GeNNBuilder
    Output: Live WebSocket frames via callback

Both runtimes step the GeNN model and extract data. They do NOT know about
HTTP, WebSockets, or sessions - that's the manager's job.
"""

import threading
import time
import struct
import tempfile
import uuid
import logging
from abc import ABC
from typing import Dict, List, Any, Callable, Optional

import numpy as np

from ..input.base import InputAdapter
from .config import config
from .types import SimulationResult, PopulationInfo

logger = logging.getLogger(__name__)


class GeNNRuntimeBase(ABC):
    """Shared base for both offline and real-time execution."""

    def __init__(self, builder):
        self.builder = builder
        self.model = builder.model
        self.populations = builder.populations          # {original_id: GeNN pop}
        self.population_info = builder.population_info  # {original_id: PopulationInfo}

        if not self.model:
            raise RuntimeError("Model not loaded. Call builder.load() first.")

        self.dt = self.model.dt
        self.timestep = 0

    def _pull_recording_buffers(self):
        """Pull spike recording buffers from device."""
        self.model.pull_recording_buffers_from_device()

    def _get_voltage_populations(self) -> List[tuple]:
        """
        Get populations that have voltage (V variable), sorted by key.
        Returns: [(pop_name, pop_object, pop_info), ...]
        """
        result = []
        for name in sorted(self.populations.keys()):
            info = self.population_info[name]
            if info.has_voltage:
                result.append((name, self.populations[name], info))
        return result


# ─── Offline Runtime ────────────────────────────────────────────────


class OfflineRuntime(GeNNRuntimeBase):
    """
    Batch execution optimized for throughput.

    Strategy:
      - Step 1 timestep at a time
      - After each step, pull V from device and write to binary file
      - Spike data is accumulated from recording buffers in chunks
      - Output: SimulationResult with file path + spike data

    Voltage File Format:
      - Each frame is N floats (one per neuron with V variable)
      - Frames are written in simulation time order
      - Total frames = total_steps
      - Frame layout matches sorted pop_keys order
    """

    def run(self, duration_ms: float, dt: float = 1.0) -> SimulationResult:
        """
        Run the full offline simulation.

        Args:
            duration_ms: Total simulation duration in milliseconds
            dt: Simulation timestep (overrides model.dt)

        Returns:
            SimulationResult with spike data and voltage file path
        """
        self.model.dt = dt
        sim_dt = self.model.dt
        total_steps = int(duration_ms / sim_dt)

        # Spike recording buffer: we use config value as chunk size for pulling
        # spike recording data. Model must have been loaded with this buffer size.
        buffer_size = config.NUM_RECORDING_TIMESTEPS_OFFLINE

        # Pad to exact multiple of buffer_size
        chunks_needed = (total_steps + buffer_size - 1) // buffer_size

        # Identify populations with voltage for binary file layout
        v_pops = self._get_voltage_populations()
        num_voltage_neurons = sum(info.size for _, _, info in v_pops)

        # Setup outputs
        session_id = str(uuid.uuid4())
        tf = tempfile.NamedTemporaryFile(
            delete=False, suffix=".bin",
            prefix=f"snn_voltage_{session_id}_"
        )
        voltage_file_path = tf.name

        # Spike accumulator: {original_id: {"times": [], "ids": []}}
        final_spikes = {
            name: {"times": [], "ids": []}
            for name in self.populations
        }

        logger.info(
            f"[Offline] Running {total_steps} steps "
            f"({chunks_needed} chunks × {buffer_size} steps/chunk) "
            f"at dt={sim_dt}ms, {num_voltage_neurons} voltage neurons"
        )

        try:
            start_wall = time.perf_counter()
            steps_completed = 0

            for chunk_idx in range(chunks_needed):
                steps_this_chunk = min(buffer_size, total_steps - steps_completed)

                # Run physics for this chunk
                for step_in_chunk in range(steps_this_chunk):
                    # Step the model
                    self.model.step_time()
                    self.timestep += 1
                    steps_completed += 1

                    # Pull current voltage and write to file
                    frame_data = []
                    for pop_name, pop, info in v_pops:
                        pop.vars["V"].pull_from_device()
                        frame_data.extend(pop.vars["V"].view.flatten().tolist())

                    if frame_data:
                        tf.write(struct.pack(f"{len(frame_data)}f", *frame_data))

                # Pull spike recording data for this chunk
                # (only if we filled the buffer, otherwise the buffer may be partial)
                if steps_this_chunk == buffer_size:
                    self._pull_recording_buffers()
                    self._extract_spikes(final_spikes, chunk_idx, buffer_size, sim_dt)

            # If last chunk was partial, we still need to pull remaining spikes
            # For partial buffers, we need to be careful
            if total_steps % buffer_size != 0:
                self._pull_recording_buffers()
                self._extract_spikes(
                    final_spikes, chunks_needed - 1, buffer_size, sim_dt
                )

            tf.close()
            elapsed = time.perf_counter() - start_wall

            logger.info(
                f"[Offline] Done: {steps_completed} steps in {elapsed:.2f}s "
                f"({steps_completed / elapsed:.0f} steps/s)"
            )

            # Build population info for session store
            pop_infos = {}
            for name, pop, info in v_pops:
                pop_infos[name] = info

            return SimulationResult(
                session_id=session_id,
                spike_data=final_spikes,
                voltage_file=voltage_file_path,
                duration_ms=duration_ms,
                dt=sim_dt,
                wall_time_s=elapsed,
                steps_run=steps_completed,
                populations=pop_infos,
            )

        except Exception as e:
            tf.close()
            logger.error(f"[Offline] Simulation failed: {e}")
            raise

    def _extract_spikes(
        self,
        accum: Dict[str, Dict[str, list]],
        chunk_idx: int,
        buffer_size: int,
        sim_dt: float,
    ) -> None:
        """Extract spikes from recording buffer after pull."""
        for pop_name, pop in self.populations.items():
            info = self.population_info[pop_name]
            if not info.spike_recording:
                continue

            try:
                recording = pop.spike_recording_data
                if not recording or len(recording) == 0:
                    continue

                raw_times, raw_ids = recording[0]
                if len(raw_times) > 0:
                    accum[pop_name]["times"].extend(raw_times.tolist())
                    accum[pop_name]["ids"].extend(raw_ids.tolist())
            except (RuntimeError, IndexError, TypeError) as e:
                logger.debug(f"Spike extraction skipped for {pop_name}: {e}")


# ─── Real-Time Runtime ──────────────────────────────────────────────


class RealTimeRuntime(GeNNRuntimeBase):
    """
    Interactive execution with WebSocket output.

    Runs in a background thread, steps the model at real-time pace,
    and emits voltage/spike frames at a throttled rate.
    """

    def __init__(self, builder):
        super().__init__(builder)
        builder.load(num_recording_timesteps=config.NUM_RECORDING_TIMESTEPS_REALTIME)

        self.running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        self.input_adapters: List[InputAdapter] = []
        self.manual_spike_queue: List[tuple] = []
        self.websocket_callback: Optional[Callable] = None

        self.last_emit_timestep = 0
        self.last_emit_wall_time = 0.0
        self.emit_interval_sec = config.VOLTAGE_EMIT_INTERVAL_MS / 1000.0

    def add_input_source(self, adapter: InputAdapter):
        """Register an input adapter for this runtime."""
        self.input_adapters.append(adapter)

    def set_websocket_callback(self, cb: Callable):
        """Set the callback for emitting simulation frames."""
        self.websocket_callback = cb

    def inject_spike(self, pop_name: str, neuron_idx: int = 0):
        """Queue a manual spike injection (thread-safe)."""
        with self._lock:
            self.manual_spike_queue.append((pop_name, neuron_idx))

    def start(self):
        """Start the simulation loop in a background thread."""
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(
            target=self._run_loop, daemon=True, name="GeNN-RT-Loop"
        )
        self._thread.start()

    def stop(self):
        """Signal the simulation loop to stop."""
        self.running = False

    def join(self):
        """Wait for the simulation thread to finish."""
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)

    def get_state(self) -> Dict[str, Any]:
        return {
            "running": self.running,
            "timestep": self.timestep,
            "time": float(self.timestep * self.dt),
            "dt": float(self.dt),
        }

    # ─── Internal Loop ─────────────────────────────────────────────

    def _run_loop(self):
        logger.info("Real-Time loop started")
        while self.running:
            start_t = time.perf_counter()
            try:
                self._step()
            except Exception as e:
                logger.error(f"Simulation error: {e}")
                self.running = False
                break

            # Pace to real-time
            target_dt = self.dt / 1000.0
            elapsed = time.perf_counter() - start_t
            if elapsed < target_dt:
                time.sleep(target_dt - elapsed)

    def _step(self):
        current_time_ms = self.timestep * self.dt

        # Process input adapters
        for adapter in self.input_adapters:
            events = adapter.get_events_all()
            for e in events:
                if e.timestamp == -1.0 or e.timestamp <= current_time_ms:
                    self._apply_spike_forcing(e.neuron_id, 0)
                else:
                    adapter.push_spike(e.neuron_id, virtual_timestamp=e.timestamp)

        # Process manual spike queue
        with self._lock:
            for pop_name, idx in self.manual_spike_queue:
                self._apply_spike_forcing(pop_name, idx)
            self.manual_spike_queue.clear()

        # Physics step
        self.model.step_time()
        self.timestep += 1

        # Emit state (throttled)
        now = time.perf_counter()
        if self.websocket_callback and (now - self.last_emit_wall_time) >= self.emit_interval_sec:
            self._emit_state()
            self.last_emit_wall_time = now

    def _apply_spike_forcing(self, pop_name: str, idx: int):
        """Force a spike on a population neuron."""
        if pop_name not in self.populations:
            return
        pop = self.populations[pop_name]

        if "V" in pop.vars:
            # Standard neuron: set V above threshold
            pop.vars["V"].pull_from_device()
            pop.vars["V"].view[idx] = 0.0
            pop.vars["V"].push_to_device()

        elif "startSpike" in pop.vars:
            # SpikeSourceArray: set next spike time
            current_sim_time = self.timestep * self.dt
            pop.extra_global_params["spikeTimes"].view[0] = current_sim_time
            pop.vars["startSpike"].view[0] = 0
            pop.vars["endSpike"].view[0] = 1
            pop.extra_global_params["spikeTimes"].push_to_device()
            pop.vars["startSpike"].push_to_device()
            pop.vars["endSpike"].push_to_device()

    def _emit_state(self):
        """Emit current voltages and recent spikes via callback."""
        try:
            self._pull_recording_buffers()
        except RuntimeError:
            pass

        # Collect voltages (skip SpikeSourceArray - no V variable)
        voltages = {}
        for name, pop, info in self._get_voltage_populations():
            pop.vars["V"].pull_from_device()
            voltages[name] = float(pop.vars["V"].view[0])

        # Collect spikes
        spikes = self._collect_recent_spikes()

        data = {
            "type": "simulation_data",
            "timestep": self.timestep,
            "time": self.timestep * self.dt,
            "voltages": voltages,
            "spikes": spikes,
        }
        self.websocket_callback(data)
        self.last_emit_timestep = self.timestep

    def _collect_recent_spikes(self) -> Dict[str, list]:
        """Get spikes that occurred since last emit."""
        spikes = {}
        epsilon = 1e-4
        start_time = (self.last_emit_timestep * self.dt) - epsilon
        end_time = (self.timestep * self.dt) + epsilon

        for name, pop in self.populations.items():
            info = self.population_info[name]
            if not info.spike_recording:
                continue
            try:
                recording = pop.spike_recording_data
                if not recording or len(recording) == 0:
                    continue
                times, ids = recording[0]
                if len(times) == 0:
                    continue

                mask = (times > start_time) & (times <= end_time)
                active_ids = ids[mask]
                if len(active_ids) > 0:
                    spikes[name] = active_ids.tolist()
            except (RuntimeError, IndexError, TypeError):
                pass

        return spikes
