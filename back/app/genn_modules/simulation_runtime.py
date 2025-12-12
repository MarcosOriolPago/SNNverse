"""
GeNN Simulation Runtime Module

This module provides a Python-based simulation runtime that leverages
PyGeNN's native API for running simulations, instead of generating
custom C++ runners.

Key features:
- Direct use of PyGeNN's model.step_time() for simulation
- Built-in spike recording via PyGeNN API
- Variable access through PyGeNN's push/pull mechanism
- Thread-safe simulation loop with WebSocket streaming
"""

import threading
import time
from typing import Dict, Any, Optional, Tuple, List
import numpy as np
from collections import deque

from ..core.config import config


class GeNNSimulationRuntime:
    """
    Manages GeNN model execution using PyGeNN's runtime API.
    
    This replaces the custom C++ runner generation with a Python-driven
    simulation loop that directly controls the GeNN model.
    """
    
    def __init__(self, builder):
        """
        Initialize runtime with a built GeNN model.
        
        Args:
            builder: GeNNNetworkBuilder instance with built and loaded model
        """
        from .genn_builder import GeNNNetworkBuilder
        
        self.builder: GeNNNetworkBuilder = builder
        self.model = builder.get_model()
        self.neuron_populations = builder.get_neuron_populations()
        
        if self.model is None:
            raise RuntimeError("Model not initialized. Call builder.load_model() first.")
        
        # Simulation state
        self.running = False
        self.simulation_thread: Optional[threading.Thread] = None
        self.timestep = 0
        self.current_time = 0.0
        self.dt = self.model.dt
        
        # Simulation speed control
        self.speed_multiplier = 1.0
        self.min_speed = 0.001
        self.max_speed = 10.0
        
        # Data streaming
        self.voltage_buffer = deque(maxlen=100)  # Keep last 100 timesteps
        self.spike_buffer = deque(maxlen=100)
        
        # WebSocket connection (will be set externally)
        self.websocket_callback = None
        
        # Spike injection queue
        self.spike_injection_queue = []
        self.spike_queue_lock = threading.Lock()
        
        # Recording configuration
        self.recording_enabled = True
        self.voltage_sample_interval = 1  # Sample every N timesteps
        
        # Track manual injections for immediate reporting
        self._injected_spikes_this_step = set()
        
        print(f"✓ Simulation runtime initialized (dt={self.dt}ms)")
    
    def set_websocket_callback(self, callback):
        """
        Set callback function for streaming data via WebSocket.
        
        Args:
            callback: Async function that takes (timestep, data_dict) as arguments
        """
        self.websocket_callback = callback
    
    def set_speed(self, speed: float):
        """
        Set simulation speed multiplier.
        
        Args:
            speed: Speed multiplier (0.1x to 10.0x)
        """
        self.speed_multiplier = max(self.min_speed, min(self.max_speed, speed))
        print(f"Simulation speed set to {self.speed_multiplier}x")
    
    def start(self):
        """Start the simulation loop in a background thread."""
        if self.running:
            print("Warning: Simulation already running")
            return
        
        self.running = True
        self.simulation_thread = threading.Thread(
            target=self._simulation_loop,
            daemon=True,
            name="GeNN-Simulation"
        )
        self.simulation_thread.start()
        print("✓ Simulation started")
    
    def stop(self):
        """Stop the simulation loop gracefully."""
        if not self.running:
            return
        
        print("Stopping simulation...")
        self.running = False
        
        if self.simulation_thread:
            self.simulation_thread.join(timeout=5.0)
            if self.simulation_thread.is_alive():
                print("Warning: Simulation thread did not stop cleanly")
            else:
                print("✓ Simulation stopped")
        
        self.simulation_thread = None
    
    def step(self):
        """
        Execute a single simulation timestep.
        
        This is the core method that:
        1. Processes spike injections
        2. Steps the GeNN model forward
        3. Collects voltages and spikes
        4. Streams data if callback is set
        """
        # Process any queued spike injections
        self._process_spike_injections()
        
        # Step the GeNN simulation
        self.model.step_time()
        
        # Update timestep counter
        self.timestep += 1
        self.current_time = self.model.t
        
        # Collect data (optionally sampled)
        if self.recording_enabled and (self.timestep % self.voltage_sample_interval == 0):
            voltages = self._collect_voltages()
            spikes = self._collect_spikes()
            
            # Store in buffers
            self.voltage_buffer.append({
                'timestep': self.timestep,
                'time': self.current_time,
                'voltages': voltages
            })
            
            self.spike_buffer.append({
                'timestep': self.timestep,
                'time': self.current_time,
                'spikes': spikes
            })
            
            # Stream via WebSocket if callback is set
            if self.websocket_callback:
                data = {
                    'type': 'simulation_data',
                    'timestep': self.timestep,
                    'time': float(self.current_time),
                    'voltages': voltages,
                    'spikes': spikes
                }
                print(data)
                # Call the callback (it will handle async execution)
                try:
                    self.websocket_callback(data)
                except Exception as e:
                    print(f"Error in WebSocket callback: {e}")
    
    def _simulation_loop(self):
        """
        Main simulation loop running in background thread.
        
        Runs continuously while self.running is True, with dynamic
        sleep based on speed multiplier.
        """
        print(f"Simulation loop started (dt={self.dt}ms)")
        
        while self.running:
            try:
                # Execute one timestep
                self.step()
                print('Step')
                
                sleep_time = (10.0 / self.speed_multiplier) / 1000.0  # Convert to seconds
                sleep_time = max(0.001, sleep_time)  # Minimum 1ms to avoid busy-wait
                
                time.sleep(sleep_time)
                
            except Exception as e:
                print(f"Error in simulation loop: {e}")
                import traceback
                traceback.print_exc()
                self.running = False
                break
        
        print("Simulation loop ended")
    
    def _collect_voltages(self) -> Dict[str, List[float]]:
        """
        Collect current voltage values from all neuron populations.
        
        Uses PyGeNN's pull_from_device() and current_values API.
        
        Returns:
            Dictionary mapping neuron_id -> list of voltages
        """
        voltages = {}
        
        for node_id, pop in self.neuron_populations.items():
            # Check if this population has voltage variable
            if "V" in pop.vars:
                voltage = pop.vars["V"]
                
                # Get current values as numpy array and convert to list
                v_array = voltage.current_values
                print("Voltage array", v_array)
                voltages[node_id] = v_array.tolist()
        
        return voltages
    
    def _collect_spikes(self) -> Dict[str, List[int]]:
        """
        Collect spikes that occurred in this timestep.
        
        Uses PyGeNN's spike recording API.
        
        Returns:
            Dictionary mapping neuron_id -> list of neuron indices that spiked
        """
        spikes = {}
        
        # Pull recording buffers from device
        self.model.pull_recording_buffers_from_device()
        
        for node_id, pop in self.neuron_populations.items():
            if pop.spike_recording_enabled:
                try:
                    # Get spike recording data for batch 0
                    # Returns (spike_times, spike_ids)
                    spike_times, spike_ids = pop.spike_recording_data[0]
                    
                    # Filter spikes for current timestep
                    # (spike_times are in ms, current_time is in ms)
                    current_spikes = spike_ids[
                        np.abs(spike_times - self.current_time) < self.dt/2
                    ]
                    
                    if len(current_spikes) > 0:
                        spikes[node_id] = current_spikes.tolist()
                        
                except Exception as e:
                    # Spike recording might not be available for all population types
                    pass
        
        # Merge manual injections
        # This ensures we see our own injections even if recording misses them
        for neuron_id, index in self._injected_spikes_this_step:
            if neuron_id not in spikes:
                spikes[neuron_id] = []
            if index not in spikes[neuron_id]:
                spikes[neuron_id].append(index)
        
        # Clear manual injections for next step
        self._injected_spikes_this_step.clear()
        
        return spikes
    
    def inject_spike(self, neuron_id: str, index: int = 0):
        """
        Queue a spike injection for the next timestep.
        
        Thread-safe method to inject spikes from external sources
        (e.g., Python input nodes, user interaction).
        
        Args:
            neuron_id: ID of the neuron population
            index: Index of the specific neuron within the population
        """
        with self.spike_queue_lock:
            self.spike_injection_queue.append({
                'neuron_id': neuron_id,
                'index': index
            })
            # Also track for reporting in next step
            self._injected_spikes_this_step.add((neuron_id, index))
    
    def inject_current(self, neuron_id: str, current: float, index: int = 0):
        """
        Inject current into a neuron.
        
        For models with an input current parameter (like LIF's Ioffset),
        we can temporarily modify it.
        
        Args:
            neuron_id: ID of the neuron population
            current: Current to inject (nA)
            index: Index of the specific neuron within the population
        """
        if neuron_id not in self.neuron_populations:
            print(f"Warning: Neuron {neuron_id} not found")
            return
        
        pop = self.neuron_populations[neuron_id]
        
        # For LIF neurons, we could modify Ioffset temporarily
        # Or we could add to the voltage directly
        # This is a simplified version that adds to voltage
        if "V" in pop.vars:
            pop.vars["V"].pull_from_device()
            current_v = pop.vars["V"].current_view[index]
            pop.vars["V"].current_view[index] = current_v + current
            pop.vars["V"].push_to_device()
    
    def _process_spike_injections(self):
        """
        Process queued spike injections by forcing voltage above threshold.
        
        Called at the start of each timestep.
        """
        with self.spike_queue_lock:
            if not self.spike_injection_queue:
                return
            
            # Process all queued injections
            for injection in self.spike_injection_queue:
                neuron_id = injection['neuron_id']
                index = injection['index']
                
                if neuron_id not in self.neuron_populations:
                    print(f"Warning: Cannot inject spike, neuron {neuron_id} not found")
                    continue
                
                pop = self.neuron_populations[neuron_id]
                
                # For spike source arrays, we need to use the extra global params
                # For regular neurons, force voltage above threshold
                if "V" in pop.vars:
                    pop.vars["V"].pull_from_device()
                    pop.vars["V"].current_view[index] = 2000.0  # Well above threshold (even for silent nodes)
                    pop.vars["V"].push_to_device()
                    print(f"Injected spike into {neuron_id}[{index}]")
                elif "spikeTimes" in pop.extra_global_params:
                    # This is a SpikeSourceArray - more complex handling needed
                    # For now, just log
                    print(f"Spike injection for SpikeSourceArray {neuron_id} not yet implemented")
            
            # Clear the queue
            self.spike_injection_queue.clear()
    
    def get_state(self) -> Dict[str, Any]:
        """
        Get current simulation state.
        
        Returns:
            Dictionary with current timestep, time, and running status
        """
        return {
            'running': self.running,
            'timestep': self.timestep,
            'time': float(self.current_time),
            'speed': self.speed_multiplier,
            'dt': float(self.dt)
        }
    
    def get_recent_data(self, num_timesteps: int = 10) -> Dict[str, Any]:
        """
        Get recent voltage and spike data.
        
        Args:
            num_timesteps: Number of recent timesteps to return
        
        Returns:
            Dictionary with recent voltages and spikes
        """
        recent_voltages = list(self.voltage_buffer)[-num_timesteps:]
        recent_spikes = list(self.spike_buffer)[-num_timesteps:]
        
        return {
            'voltages': recent_voltages,
            'spikes': recent_spikes
        }
    
    def reset(self):
        """
        Reset simulation to initial state.
        
        Note: This requires reloading the model, which might be expensive.
        For now, just reset counters.
        """
        if self.running:
            print("Warning: Cannot reset while simulation is running")
            return
        
        self.timestep = 0
        self.current_time = 0.0
        self.voltage_buffer.clear()
        self.spike_buffer.clear()
        
        # Could also reset GeNN model state here if needed
        # self.model.timestep = 0
        
        print("✓ Simulation reset")
