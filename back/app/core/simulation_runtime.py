import threading
import time
import struct
import tempfile
import uuid
import numpy as np
from abc import ABC
from typing import Dict, List, Any

from ..input.base import InputAdapter
from ..core.config import config

class GeNNRuntimeBase(ABC):
    def __init__(self, builder):
        self.builder = builder
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
    def __init__(self, builder):
        super().__init__(builder)
        # Setup Outputs
        self.session_id = str(uuid.uuid4())
        self.tf = tempfile.NamedTemporaryFile(delete=False, suffix='.bin', prefix=f"snn_voltage_{self.session_id}_")
        self.voltage_file_path = self.tf.name
        
        self.spikes = {name: {"times": [], "ids": []} for name in self.populations}
        self.voltages = []
    
    def run(self, duration_ms: float, dt: float = 1.0, chunk_size: int = None) -> Dict[str, Any]:
        # Configuration
        self.model.dt = dt
        sim_dt = self.model.dt
        self.buffer_size = chunk_size

        # Calculate Steps with PADDING
        # Run a multiple of 'buffer_size' to avoid "buffer not full" errors.
        requested_steps = int(duration_ms / sim_dt)
        self.chunks_needed = (requested_steps + self.buffer_size - 1) // self.buffer_size
        
        self.pop_keys = sorted(self.populations.keys())
        self.active_pops = [self.populations[name] for name in self.pop_keys]

        try:
            start_t = time.perf_counter()
            self.current_sim_time = self.timestep * sim_dt
            
            # Chunked Execution Loop
            for _ in range(self.chunks_needed):
                self._run_chunk()

            self.tf.close()
            elapsed = time.perf_counter() - start_t

            return {
                "session_id": self.session_id,
                "spike_data": self.spikes,
                "voltage_file": self.voltage_file_path,
                "duration_ms": duration_ms,
                "dt": sim_dt,
                "wall_time": elapsed
            }
            
        except Exception as e:
            self.tf.close()
            raise e

    def _run_chunk(self):
         # Run Physics (Fill the Buffer)
        for _ in range(self.buffer_size):
            self.model.step_time()
        
        self._update_times()
        self._pull_device_data()
        self._extract_spikes()
        self._extract_voltages()
        
        # Write one frame per chunk
        if len(self.voltages) > 0:
            self.tf.write(struct.pack(f'{len(self.voltages)}f', *self.voltages))

    def _extract_spikes(self):
        for pop_name, pop in zip(self.pop_keys, self.active_pops):
            if pop.spike_recording_enabled:
                if hasattr(pop, 'spike_recording_data') and len(pop.spike_recording_data) > 0:
                    # Valid data is always at index 0 for a full buffer pull
                    raw_times, raw_ids = pop.spike_recording_data[0]
                    # print(f"DEBUG: Pop {pop_name} spikes: {len(raw_times)}")
                    if len(raw_times) > 0:
                        mask = (raw_times > (self.prev_sim_time - 1e-6)) & (raw_times <= (self.current_sim_time + 1e-6))
                        # print(f"DEBUG: Pop {pop_name} spikes in window ({self.prev_sim_time}-{self.current_sim_time}): {mask.sum()}")
                        if mask.any():
                            self.spikes[pop_name]["times"].extend(raw_times[mask].tolist())
                            self.spikes[pop_name]["ids"].extend(raw_ids[mask].tolist())
            else:
                pass
                # print(f"DEBUG: Pop {pop_name} spike recording DISABLED")

    def _extract_voltages(self):
        for pop in self.active_pops:
            if "V" in pop.vars:
                v_var = pop.vars["V"]
                # For OfflineRuntime, we want the FULL history of the chunk
                if hasattr(v_var, "recording_data"):
                    # recording_data is a tuple (times, values)
                    # values shape is usually (num_steps, pop_size) or flattened
                    
                    if len(v_var.recording_data) > 0:
                        times, values = v_var.recording_data[0]
                        # print(f"DEBUG: Pop {pop.name} V recording_data: times len={len(times)}, values len={len(values)}")
                        if len(values) > 0:
                            # IMPORTANT: Flatten to 1D list of floats for struct.pack
                            # values is typically (steps, neurons) or (neurons, steps)
                            if hasattr(values, "flatten"):
                                flat = values.flatten().tolist()
                                self.voltages.extend(flat)
                                # print(f"DEBUG: Flattened numpy to {len(flat)} items")
                            elif isinstance(values, list):
                                # If list of lists (from tolist() of 2D array)
                                # or list of floats
                                import itertools
                                flat_list = list(itertools.chain.from_iterable(values)) if isinstance(values[0], list) else values
                                self.voltages.extend(flat_list)
                            else:
                                self.voltages.extend(values)
                    else:
                        print(f"DEBUG: Pop {pop.name} V recording_data is EMPTY")
                else:
                    # Fallback for 1-step buffer
                    if hasattr(v_var, "pull_from_device"):
                        v_var.pull_from_device()
                    self.voltages.extend(v_var.view.tolist())
            else:
                pass
    
    def _update_times(self):
        self.prev_sim_time = self.timestep * self.model.dt
        self.timestep += self.buffer_size
        self.current_sim_time = self.timestep * self.model.dt


class RealTimeRuntime(GeNNRuntimeBase):
    """
    Optimized for interactivity, latency control, and external I/O.
    """
    def __init__(self, builder):
        super().__init__(builder)
        builder.load_model(num_recording_timesteps=config.NUM_RECORDING_TIMESTEPS_REALTIME)        
        
        self.running = False
        self.simulation_thread = None
        self.lock = threading.Lock()
        
        self.input_adapters: List[InputAdapter] = []
        self.manual_spike_queue = []
        self.websocket_callback = None
        
        # Build Parent Mapping for Sub-Populations (e.g. Keyboard Keys)
        self.pop_to_parent_map = {}
        for parent_id, key_map in builder.keyboard_maps.items():
            for key_char in key_map.keys():
                # Reconstruct the sub-population name exactly as Builder does
                safe_key = builder._sanitize_id(builder._normalize_key_name(key_char))
                sub_pop_name = f"{parent_id}_{safe_key}"
                self.pop_to_parent_map[sub_pop_name] = parent_id
        
        self.last_emit_timestep = 0
        self.last_emit_wall_time = 0.0
        self.emit_interval_sec = config.VOLTAGE_EMIT_INTERVAL_MS / 1000.0

    def add_input_source(self, adapter: InputAdapter):
        self.input_adapters.append(adapter)

    def set_websocket_callback(self, cb):
        self.websocket_callback = cb

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

    def join(self):
        """Wait for thread to finish (Called by Manager)."""
        if self.simulation_thread and self.simulation_thread.is_alive():
            self.simulation_thread.join(timeout=3.0)

    def get_state(self) -> Dict[str, Any]:
        return {
            'running': self.running,
            'timestep': self.timestep,
            'time': float(self.timestep * self.dt),
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
            target_dt = self.dt / 1000.0
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
                    # e.neuron_id is usually a sub-pop name for keyboards
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
            pop.vars["V"].view[idx] = 0.0 # Force above -55.0 threshold
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
            
            # Map to parent ID if it's a keyboard sub-population
            display_name = self.pop_to_parent_map.get(name, name)
            
            # Then map to original frontend ID (reverse sanitization)
            original_id = self.builder.id_to_original.get(display_name, display_name)
            
            voltages[original_id] = float(pop.vars["V"].view[0])
        
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
        
        # Add epsilon to catch spikes that happen exactly on the boundary
        epsilon = 1e-4
        start_time = (self.last_emit_timestep * self.dt) - epsilon
        end_time = (self.timestep * self.dt) + epsilon
        
        for name, pop in self.populations.items():
            if pop.spike_recording_enabled:
                try:
                    spike_data = pop.spike_recording_data[0]
                    if len(spike_data[0]) > 0:
                        times = spike_data[0]
                        ids = spike_data[1]
                        
                        mask = (times > start_time) & (times <= end_time)
                        active_ids = ids[mask]
                        
                        if len(active_ids) > 0:
                            # Map ID to Parent if exists (for Keyboard sub-pops)
                            parent_id = self.pop_to_parent_map.get(name, name)
                            
                            # Then map to original frontend ID (reverse sanitization)
                            original_id = self.builder.id_to_original.get(parent_id, parent_id)
                            
                            if original_id not in spikes:
                                spikes[original_id] = []
                            
                            # Append directly
                            spikes[original_id].extend(active_ids.tolist())
                            
                            print(f"⚡ SENDING SPIKES: {original_id} -> {spikes[original_id]} (GeNN: {name})")
                            
                except (RuntimeError, IndexError):
                    pass
        return spikes