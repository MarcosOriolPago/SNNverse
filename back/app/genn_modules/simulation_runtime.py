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
        self.speed_multiplier = 1.0
        self.dt = self.model.dt
        
        print(f"Runtime Initialized. Model dt={self.dt}ms")

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
        if pop_name in self.populations:
            pop = self.populations[pop_name]
            # Force Voltage way above threshold
            # Note: For GPU backend, this pulls/pushes. For CPU it's direct.
            pop.vars["V"].view[idx] = 2000.0 
            # Note: In latest PyGeNN 'view' might be 'current_view' depending on version
            # Using implicit push/pull via view is cleaner if supported, 
            # otherwise explicit pull_from_device() -> edit -> push_to_device() is needed.
            # Assuming CPU backend for simplicity here:
            if hasattr(pop.vars["V"], "push_to_device"):
                 pop.vars["V"].push_to_device()

    def _emit_state(self):
        """Collects data and calls websocket callback."""
        # Simple voltage collection for visualization
        data = {
            "type": "update",
            "t": self.timestep * self.dt,
            "spikes": self._collect_spikes() 
        }
        self.websocket_callback(data)

    def _collect_spikes(self):
        """
        Reads GeNN spike buffers.
        Returns: { "neuron_id": [index_that_fired, ...] }
        """
        self.model.pull_recording_buffers_from_device()
        spikes = {}
        for name, pop in self.populations.items():
            # Get spike indices for this step
            # Note: Real implementation needs time-window filtering like your original code
            # Simplified here for clarity.
            if pop.spike_recording_enabled:
                 # Logic to filter spikes belonging to [t-dt, t]
                 pass 
        return spikes