"""
back/app/genn_modules/simulation_runtime.py
"""
import threading
import time
import numpy as np
from typing import Dict, List, Any, Optional
from collections import deque
from ..input.base import InputAdapter

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
        self.min_speed = 0.1
        self.max_speed = 10.0
        self.speed_multiplier = 1.0
        self.dt = self.model.dt
        
        print(f"Runtime Initialized. Model dt={self.dt}ms")
        self.last_emit_timestep = 0
        self.forced_spikes = []  # Track manually injected spikes: [(time_ms, pop_name, idx), ...]

    # --- Public API ---

    def start(self):
        if self.running: return
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
        # 1. Input Processing (The Consumer Logic)
        # We fetch events intended for the *current* simulation time
        current_time_ms = self.timestep * self.dt
        
        # A) Poll Adapters
        for adapter in self.input_adapters:
            events = adapter.get_events(up_to_time_ms=current_time_ms)
            for e in events:
                print(f"Injecting spike from adapter to {e.neuron_id} at t={current_time_ms}ms")
                self._apply_spike_forcing(e.neuron_id, 0) # e.neuron_id is the Pop Name

        # B) Apply Manual Injections (from API)
        with self.lock:
            for pop_name, idx in self.manual_spike_queue:
                self._apply_spike_forcing(pop_name, idx)
            self.manual_spike_queue.clear()

        # 2. Physics Step
        self.model.step_time()
        self.timestep += 1
        
        # Debug: Check voltages after step (every 100 steps to avoid spam)
        if self.timestep % 100 == 0:
            for name, pop in self.populations.items():
                if hasattr(pop.vars["V"], "pull_from_device"):
                    pop.vars["V"].pull_from_device()
                v = pop.vars["V"].view[0]
                if v != -70.0:  # Only print if voltage changed from rest
                    print(f"  [t={current_time_ms:.1f}ms] {name} V={v:.2f}")

        # 3. Output Processing (Data Streaming)
        if self.websocket_callback and self.timestep % 10 == 0: # Throttle to every 10 steps
            self._emit_state()

    def _run_loop(self):
        """The actual thread loop."""
        print("Simulation Loop Started.")
        while self.running:
            start_t = time.time()
            
            try:
                self.step()
            except Exception as e:
                print(f"Simulation Error: {e}")
                self.running = False
                break
                
            # Speed Control
            target_dt = (self.dt / 1000.0) / self.speed_multiplier
            elapsed = time.time() - start_t
            if elapsed < target_dt:
                time.sleep(target_dt - elapsed)

    # --- Internal Helpers ---

    def _apply_spike_forcing(self, pop_name: str, idx: int):
        """Direct memory access to force a spike."""
        if pop_name not in self.populations:
            print(f"⚠️  WARNING: Population '{pop_name}' not found in model!")
            print(f"   Available populations: {list(self.populations.keys())}")
            return
            
        pop = self.populations[pop_name]
        
        # Pull current state from device (if using GPU)
        if hasattr(pop.vars["V"], "pull_from_device"):
            pop.vars["V"].pull_from_device()
        
        # Read current voltage for debugging
        current_v = pop.vars["V"].view[idx]
        
        # Force Voltage way above threshold to guarantee spike
        # Note: Input neurons have Vthresh=1000, so we need to go higher
        pop.vars["V"].view[idx] = 2000.0
        
        # Push modified state back to device (if using GPU)
        if hasattr(pop.vars["V"], "push_to_device"):
            pop.vars["V"].push_to_device()
        
        # Manually track this spike since GeNN recording doesn't capture forced spikes
        current_time_ms = self.timestep * self.dt
        self.forced_spikes.append((current_time_ms, pop_name, idx))
        print(f"  [TRACKED] Forced spike: {pop_name} at t={current_time_ms:.1f}ms")

    def _emit_state(self):
        """Collects data and calls websocket callback."""
        # Pull voltages from device
        for pop in self.populations.values():
            if hasattr(pop.vars["V"], "pull_from_device"):
                pop.vars["V"].pull_from_device()
        
        # Collect voltages
        voltages = {}
        for name, pop in self.populations.items():
            voltages[name] = float(pop.vars["V"].view[0])  # For single neuron populations
        
        # Simple voltage collection for visualization
        data = {
            "type": "simulation_data",
            "timestep": self.timestep,
            "time": self.timestep * self.dt,
            "voltages": voltages,
            "spikes": self._collect_spikes() 
        }
        self.websocket_callback(data)
        self.last_emit_timestep = self.timestep

    def _collect_spikes(self):
        """
        Reads GeNN spike buffers and filters them for the current window.
        Returns: { "neuron_id": [index_that_fired, ...] }
        """
        self.model.pull_recording_buffers_from_device()
        spikes = {}
        
        # Define time window: (last_emit_time, current_time]
        start_time = self.last_emit_timestep * self.dt
        end_time = self.timestep * self.dt
                
        for name, pop in self.populations.items():
            if pop.spike_recording_enabled:
                # spike_recording_data returns a list of (times, ids) for each batch. 
                # We assume batch size 1 (idx 0).
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
        
        # Add manually tracked forced spikes
        for spike_time, pop_name, idx in self.forced_spikes:
            if start_time < spike_time <= end_time:
                if pop_name not in spikes:
                    spikes[pop_name] = []
                if idx not in spikes[pop_name]:
                    spikes[pop_name].append(idx)
        
        # Clear forced spikes that are older than the current window
        self.forced_spikes = [(t, n, i) for t, n, i in self.forced_spikes if t > start_time]
                        
        return spikes