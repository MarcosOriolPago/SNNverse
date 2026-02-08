import threading
import time
import struct
import tempfile
import uuid
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
import numpy as np

from ..input.base import InputAdapter
from ..core.config import config

class GeNNRuntimeBase(ABC):
    def __init__(self, builder):
        self.model = builder.model
        self.populations = builder.neuron_populations
        if not self.model:
            raise RuntimeError("Model not loaded.")
        self.dt = self.model.dt
        self.timestep = 0

    def _pull_device_data(self):
        """Unified method to pull data from GPU/Device."""
        self.model.pull_recording_buffers_from_device()

# back/app/core/simulation_runtime.py

class OfflineRuntime(GeNNRuntimeBase):
    """
    Optimized for maximum throughput batch execution.
    Writes binary voltage data directly to disk and accumulates spikes in memory.
    """
    def run(self, duration_ms: float, dt: float = 1.0, chunk_size: int = None) -> Dict[str, Any]:
        # Configuration
        self.model.dt = dt
        sim_dt = self.model.dt
        buffer_size = chunk_size

        # Calculate Steps with PADDING
        # Run a multiple of 'buffer_size' to avoid "buffer not full" errors.
        requested_steps = int(duration_ms / sim_dt)
        chunks_needed = (requested_steps + buffer_size - 1) // buffer_size
        total_steps_padded = chunks_needed * buffer_size
        
        print(f"Offline Run: {duration_ms}ms ({requested_steps} steps).")
        print(f"Optimization: Padded to {total_steps_padded} steps to fit buffer {buffer_size}.")

        # Setup Outputs
        session_id = str(uuid.uuid4())
        tf = tempfile.NamedTemporaryFile(delete=False, suffix='.bin', prefix=f"snn_voltage_{session_id}_")
        voltage_file_path = tf.name
        
        final_spikes = {name: {"times": [], "ids": []} for name in self.populations}
        pop_keys = sorted(self.populations.keys())
        active_pops = [self.populations[name] for name in pop_keys]

        try:
            start_t = time.perf_counter()
            current_sim_time = self.timestep * sim_dt
            
            # Chunked Execution Loop
            for _ in range(chunks_needed):
                
                # Run Physics (Fill the Buffer)
                for _ in range(buffer_size):
                    self.model.step_time()
                
                # Update Times
                prev_sim_time = current_sim_time
                current_sim_time += (buffer_size * sim_dt)
                self.timestep += buffer_size
                
                # Pull Data (Buffer is now exactly full!)
                self._pull_device_data()
                
                # Extract Spikes
                for pop_name, pop in zip(pop_keys, active_pops):
                    if pop.spike_recording_enabled:
                        if hasattr(pop, 'spike_recording_data') and len(pop.spike_recording_data) > 0:
                            # Valid data is always at index 0 for a full buffer pull
                            raw_times, raw_ids = pop.spike_recording_data[0]
                            
                            if len(raw_times) > 0:
                                mask = (raw_times > (prev_sim_time - 1e-6)) & (raw_times <= (current_sim_time + 1e-6))
                                if mask.any():
                                    final_spikes[pop_name]["times"].extend(raw_times[mask].tolist())
                                    final_spikes[pop_name]["ids"].extend(raw_ids[mask].tolist())

                # Extract Voltages
                frame_data = []
                for pop in active_pops:
                    if "V" in pop.vars:
                        v_var = pop.vars["V"]
                        if hasattr(v_var, "pull_from_device"):
                            v_var.pull_from_device()
                        frame_data.extend(v_var.view.tolist())
                    else:
                        pass
                
                # Write one frame per chunk
                tf.write(struct.pack(f'{len(frame_data)}f', *frame_data))

            tf.close()
            elapsed = time.perf_counter() - start_t
            
            return {
                "session_id": session_id,
                "spike_data": final_spikes,
                "voltage_file": voltage_file_path,
                "duration_ms": duration_ms,
                "dt": sim_dt,
                "wall_time": elapsed
            }
            
        except Exception as e:
            tf.close()
            raise e


class RealTimeRuntime(GeNNRuntimeBase):
    """
    Optimized for interactivity, latency control, and external I/O.
    """
    def __init__(self, builder):
        super().__init__(builder)
        self.running = False
        self.simulation_thread = None
        self.lock = threading.Lock()
        
        self.input_adapters: List[InputAdapter] = []
        self.manual_spike_queue = []
        self.websocket_callback = None
        
        self.min_speed = 0.001
        self.max_speed = 10.0
        self.speed_multiplier = 1.0
        
        self.last_emit_timestep = 0
        self.last_emit_wall_time = 0.0
        self.emit_interval_sec = config.VOLTAGE_EMIT_INTERVAL_MS / 1000.0

    def add_input_source(self, adapter: InputAdapter):
        self.input_adapters.append(adapter)

    def set_websocket_callback(self, cb):
        self.websocket_callback = cb

    def set_speed(self, speed: float):
        self.speed_multiplier = max(self.min_speed, min(self.max_speed, speed))

    def inject_spike(self, pop_name: str, neuron_idx: int = 0):
        with self.lock:
            self.manual_spike_queue.append((pop_name, neuron_idx))

    def start(self):
        if self.running: 
            return
        self.running = True
        self.simulation_thread = threading.Thread(target=self._run_loop, daemon=True, name="GeNN-Loop")
        self.simulation_thread.start()

    def stop(self):
        self.running = False
        if self.simulation_thread:
            self.simulation_thread.join(timeout=2.0)

    def get_state(self) -> Dict[str, Any]:
        return {
            'running': self.running,
            'timestep': self.timestep,
            'time': float(self.timestep * self.dt),
            'speed': self.speed_multiplier,
            'dt': float(self.dt)
        }

    def _run_loop(self):
        print("Real-Time Simulation Loop Started.")
        while self.running:
            start_t = time.perf_counter()
            
            try:
                self._step()
            except Exception as e:
                print(f"Simulation Error: {e}")
                self.running = False
                break
            
            # Speed Control
            target_dt = (self.dt / 1000.0) / self.speed_multiplier
            elapsed = time.perf_counter() - start_t
            
            if elapsed < target_dt:
                time.sleep(target_dt - elapsed)

    def _step(self):
        current_time_ms = self.timestep * self.dt
        
        # Process Inputs
        for adapter in self.input_adapters:
            events = adapter.get_events_all()
            for e in events:
                if e.timestamp == -1.0 or e.timestamp <= current_time_ms:
                    print("Applying Spike Forcing:", e.neuron_id, e.timestamp)
                    self._apply_spike_forcing(e.neuron_id, 0)
                else:
                    adapter.push_spike(e.neuron_id, virtual_timestamp=e.timestamp)

        # Process Manual Injections
        with self.lock:
            for pop_name, idx in self.manual_spike_queue:
                self._apply_spike_forcing(pop_name, idx)
            self.manual_spike_queue.clear()

        # Physics Step
        self.model.step_time()
        self.timestep += 1

        # Emit State (Throttled)
        now = time.perf_counter()
        if self.websocket_callback and (now - self.last_emit_wall_time) >= self.emit_interval_sec:
            self._emit_state()
            self.last_emit_wall_time = now

    def _apply_spike_forcing(self, pop_name: str, idx: int):
        if pop_name not in self.populations: 
            return
        pop = self.populations[pop_name]
        
        # Path A: Standard Neurons (Keyboard/Serial/LIF)
        if "V" in pop.vars:
            # Pull, Modify, Push (Small overhead, but works for single neurons)
            pop.vars["V"].pull_from_device()
            pop.vars["V"].view[idx] = -50.0 # Force above -55.0 threshold
            pop.vars["V"].push_to_device()
            
        # Path B: SpikeSourceArray (Python Script Nodes in Real-Time)
        elif "startSpike" in pop.vars:
            # We treat index 0 of the spikeTimes EGP as a "Real-Time Slot"
            current_sim_time = self.timestep * self.dt
            pop.extra_global_params["spikeTimes"].view[0] = current_sim_time
            pop.vars["startSpike"].view[0] = 0
            pop.vars["endSpike"].view[0] = 1
            
            # Immediate sync to GPU
            pop.extra_global_params["spikeTimes"].push_to_device()
            pop.vars["startSpike"].push_to_device()
            pop.vars["endSpike"].push_to_device()

    def _emit_state(self):
        try:
            self._pull_device_data()
        except RuntimeError:
            pass
        
        # Collect Voltages
        voltages = {}
        for name, pop in self.populations.items():
            if hasattr(pop.vars["V"], "pull_from_device"):
                pop.vars["V"].pull_from_device()
            # Just taking the first neuron's voltage for visualization sample
            voltages[name] = float(pop.vars["V"].view[0])
        
        # Collect Spikes
        spikes = self._collect_recent_spikes()
        
        data = {
            "type": "simulation_data",
            "timestep": self.timestep,
            "time": self.timestep * self.dt,
            "voltages": voltages,
            "spikes": spikes
        }
        self.websocket_callback(data)
        self.last_emit_timestep = self.timestep

    def _collect_recent_spikes(self):
        spikes = {}
        # Wait for buffer to fill slightly
        if self.timestep < 30:
            return spikes
        
        start_time = self.last_emit_timestep * self.dt
        end_time = self.timestep * self.dt
        
        for name, pop in self.populations.items():
            if pop.spike_recording_enabled:
                try:
                    spike_data = pop.spike_recording_data[0]
                    if len(spike_data[0]) > 0:
                        times = spike_data[0]
                        ids = spike_data[1]

                        print(f"[Spike Collection] Population '{name}' - Total Spikes in Buffer: {len(times)}")
                        
                        mask = (times > start_time) & (times <= end_time)
                        active_ids = ids[mask]
                        
                        if len(active_ids) > 0:
                            spikes[name] = active_ids.tolist()
                except (RuntimeError, IndexError):
                    pass
        return spikes