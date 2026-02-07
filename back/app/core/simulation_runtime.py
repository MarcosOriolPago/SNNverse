"""
back/app/genn_modules/simulation_runtime.py
"""
import threading
import time
from typing import Dict, List, Any
from ..input.base import InputAdapter
from ..core.config import config

class GeNNSimulationRuntime:
    """
    Manages the execution loop of the GeNN model.
    Acts as the 'Consumer' for Input Adapters.
    """
    
    def __init__(self, builder):
        self.model = builder.model
        self.populations = builder.neuron_populations
        
        if not self.model:
            raise RuntimeError("Model not loaded.")

        # Simulation State
        self.running = False
        self.timestep = 0
        self.simulation_thread = None
        self.lock = threading.Lock() # Protects shared state
        
        # IO Interfaces
        self.input_adapters: List[InputAdapter] = []
        self.manual_spike_queue = [] # For API injections
        self.websocket_callback = None
        
        # Config
        self.min_speed = 0.001
        self.max_speed = 10.0
        self.speed_multiplier = 1.0
        self.dt = self.model.dt
        
        # Recording buffer tracking
        # Note: We need to know the buffer size to check if it's ready
        # GeNN requires buffer to be full before accessing recording_data
        self.recording_buffer_size = None  # Will be set during model load
        
        print(f"Runtime Initialized. Model dt={self.dt}ms")
        self.last_emit_timestep = 0
        self.last_emit_wall_time = 0.0
        self.emit_interval_sec = config.VOLTAGE_EMIT_INTERVAL_MS # 20 FPS

    # --- Public API ---

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
        """
        Get current simulation state.
        
        Returns:
            Dictionary with current timestep, time, and running status
        """
        return {
            'running': self.running,
            'timestep': self.timestep,
            'time': float(self.timestep * self.dt),
            'speed': self.speed_multiplier,
            'dt': float(self.dt)
        }

    def set_speed(self, speed: float):
        """
        Set simulation speed multiplier.
        
        Args:
            speed: Speed multiplier (0.1x to 10.0x)
        """
        self.speed_multiplier = max(self.min_speed, min(self.max_speed, speed))
        print(f"Simulation speed set to {self.speed_multiplier}x")

    def add_input_source(self, adapter: InputAdapter):
        """Registers an input adapter to be polled."""
        self.input_adapters.append(adapter)

    def set_websocket_callback(self, cb):
        self.websocket_callback = cb

    def inject_spike(self, pop_name: str, neuron_idx: int = 0):
        """
        Manual/Adapter API to force a neuron to fire.
        We achieve this by forcing V >> Vthresh.
        """
        with self.lock:
            self.manual_spike_queue.append((pop_name, neuron_idx))

    # --- Core Loop ---

    def step(self):
        """
        Advances the physics world by ONE timestep.
        """
        current_time_ms = self.timestep * self.dt
        
        # Poll Adapters
        for adapter in self.input_adapters:
            # Fetch ALL available events (don't filter by time yet if they are ASAP)
            events = adapter.get_events_all()
            
            for e in events:
                if e.timestamp == -1.0:
                    print(f"Injecting spike (ASAP) to {e.neuron_id} at t={current_time_ms}ms")
                    self._apply_spike_forcing(e.neuron_id, 0)
                elif e.timestamp <= current_time_ms:
                    # Virtual-Time Event: It's time to process it
                    print(f"Injecting spike (Virtual) to {e.neuron_id} at t={current_time_ms}ms (sched={e.timestamp}ms)")
                    self._apply_spike_forcing(e.neuron_id, 0)
                else:
                    adapter.push_spike(e.neuron_id, virtual_timestamp=e.timestamp)

        # Apply Manual Injections (from API)
        with self.lock:
            for pop_name, idx in self.manual_spike_queue:
                self._apply_spike_forcing(pop_name, idx)
            self.manual_spike_queue.clear()

        # Physics Step
        self.model.step_time()
        self.timestep += 1

        # Output Processing (Data Streaming)
        # Wall-Clock Throttling (30 FPS)
        now = time.perf_counter()
        if self.websocket_callback and (now - self.last_emit_wall_time) >= self.emit_interval_sec:
            self._emit_state()
            self.last_emit_wall_time = now

    def _run_loop(self):
        """The actual thread loop."""
        print("Simulation Loop Started.")
        while self.running:
            start_t = time.perf_counter()
            
            try:
                self.step()
            except Exception as e:
                print(f"Simulation Error: {e}")
                self.running = False
                break
                
            # Speed Control
            target_dt = (self.dt / 1000.0) / self.speed_multiplier
            elapsed = time.perf_counter() - start_t
            if elapsed < target_dt:
                time.sleep(target_dt - elapsed)

    # --- Internal Helpers ---

    def _apply_spike_forcing(self, pop_name: str, idx: int):
        """Inject strong depolarizing current to trigger natural spike."""
        if pop_name not in self.populations:
            print(f"    WARNING: Population '{pop_name}' not found in model!")
            print(f"    Available populations: {list(self.populations.keys())}")
            return
            
        pop = self.populations[pop_name]
        
        # Pull current state from device (if using GPU)
        if hasattr(pop.vars["V"], "pull_from_device"):
            pop.vars["V"].pull_from_device()
        
        # Set next voltage to a high value to ensure it crosses threshold
        current_v = pop.vars["V"].view[idx]
        pop.vars["V"].view[idx] = current_v + 50.0  # Guaranteed to cross -55.0 threshold
        
        # Push modified state back to device (if using GPU)
        if hasattr(pop.vars["V"], "push_to_device"):
            pop.vars["V"].push_to_device()
        
        current_time_ms = self.timestep * self.dt
        print(f"  Injected current to {pop_name} at t={current_time_ms:.1f}ms (V: {current_v:.1f} → {current_v + 50.0:.1f})")

    def _emit_state(self):
        """Collects data from recording buffers and sends via websocket."""
        buffer_ready = self.timestep >= 30  # Matches num_recording_timesteps in simulation_manager
        
        if buffer_ready:
            # Pull ALL recording data from device (both spikes and voltages)
            try:
                self.model.pull_recording_buffers_from_device()
            except RuntimeError as e:
                # If buffer still not ready, fall back to current state
                buffer_ready = False
        
        # Collect voltages
        voltages = {}
        for name, pop in self.populations.items():
            if buffer_ready:
                # Try to use recording buffers for pre-spike voltage capture
                try:
                    if hasattr(pop.vars["V"], "recording_data") and len(pop.vars["V"].recording_data) > 0:
                        v_recording = pop.vars["V"].recording_data[0]
                        if len(v_recording) > 0:
                            # Use the most recent recorded voltage
                            voltages[name] = float(v_recording[-1])
                            continue
                except (RuntimeError, IndexError):
                    pass  # Fall through to current state
            
            # Fallback: use current state (for initial timesteps or if recording fails)
            if hasattr(pop.vars["V"], "pull_from_device"):
                pop.vars["V"].pull_from_device()
            voltages[name] = float(pop.vars["V"].view[0])
        
        # Combine voltage and spike data
        data = {
            "type": "simulation_data",
            "timestep": self.timestep,
            "time": self.timestep * self.dt,
            "voltages": voltages,
            "spikes": self._collect_spikes()
        }
        # Send data to frontend
        self.websocket_callback(data)
        self.last_emit_timestep = self.timestep

    def _collect_spikes(self):
        """
        Reads GeNN spike buffers and filters them for the current window.
        Returns: { "neuron_id": [index_that_fired, ...] }
        """
        spikes = {}
        
        # Check if buffer is ready before accessing spike recording data
        if self.timestep < 30:
            # Buffer not full yet, return empty spike dict
            return spikes
        
        # Define time window: (last_emit_time, current_time]
        start_time = self.last_emit_timestep * self.dt
        end_time = self.timestep * self.dt
        
        for name, pop in self.populations.items():
            if pop.spike_recording_enabled:
                try:
                    # spike_recording_data returns a list of (times, ids) for each batch. 
                    # Returns: (spike_times_array, spike_ids_array)
                    spike_data = pop.spike_recording_data[0]
                                    
                    if len(spike_data[0]) > 0:
                        times = spike_data[0]
                        ids = spike_data[1]
                        
                        # Filter spikes strictly within the window
                        mask = (times > start_time) & (times <= end_time)
                        active_ids = ids[mask]
                                            
                        if len(active_ids) > 0:
                            spikes[name] = active_ids.tolist()
                except (RuntimeError, IndexError) as e:
                    pass
                        
        return spikes