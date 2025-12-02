"""
GeNN Simulation Engine Module

This module handles Phase 3 (Execution) of the workflow:
- Loads the built GeNN model
- Runs simulation loop
- Streams neuron state (voltage, spikes) to frontend via WebSocket
"""

import asyncio
import numpy as np
from typing import Dict, List, Any, Optional
from .genn_builder import GeNNNetworkBuilder


class GeNNSimulationEngine:
    """
    Runs GeNN simulation and streams results.
    This is the Operator that turns the machine on and watches the gauges.
    """
    
    def __init__(self, builder: GeNNNetworkBuilder, websocket_callback=None):
        """
        Initialize the simulation engine.
        
        Args:
            builder: GeNNNetworkBuilder instance with built model
            websocket_callback: Async function to call with simulation data
                               Should accept (update_data, spike_data) as arguments
        """
        
        self.builder = builder
        self.model = builder.get_model()
        
        if self.model is None:
            raise RuntimeError("Model is None. Ensure builder.build_from_json() was called.")
        
        self.neuron_pops = builder.get_neuron_populations()
        
        if not self.neuron_pops:
            raise RuntimeError("No neuron populations found in model.")
        
        self.websocket_callback = websocket_callback
        
        self.running = False
        self.timestep = 0
        self.sim_time = 0.0
        
        # Track neuron state for frontend
        self.neuron_states = {}
        self.previous_voltages = {}  # Track previous voltages for spike detection
        self.spike_threshold = {}  # Store threshold for each neuron
        
        # Detect backend type for conditional device operations
        self.backend = builder.backend
        self.is_gpu_backend = self.backend in ["cuda", "hip"]
        
        print(f"Simulation engine initialized with {len(self.neuron_pops)} neurons")
        print(f"Backend: {self.backend} (GPU operations: {self.is_gpu_backend})")
        
    async def run(self, max_timesteps: Optional[int] = None):
        """
        Run the simulation loop.
        
        Args:
            max_timesteps: Maximum number of timesteps to simulate.
                          If None, runs indefinitely until stopped.
        """
        if self.model is None:
            raise RuntimeError("Model not loaded. Call builder.load_model() first.")
        
        self.running = True
        self.timestep = 0
        self.sim_time = 0.0
        
        print("🚀 Starting GeNN simulation...")
        
        try:
            while self.running:
                if max_timesteps is not None and self.timestep >= max_timesteps:
                    break
                
                # Step 1: Advance simulation by one timestep
                self.model.step_time()
                
                # Step 2: Pull state from device (GPU -> CPU)
                self._pull_state_from_device()
                
                # Step 3: Extract voltage and spike data
                updates, spikes = self._extract_simulation_data()
                
                # Step 4: Stream data to frontend via WebSocket
                if self.websocket_callback:
                    await self.websocket_callback(updates, spikes)
                
                # Update counters
                self.timestep += 1
                self.sim_time = self.model.t
                
                # Sleep to control simulation speed (adjust as needed)
                # For real-time visualization at ~20Hz
                await asyncio.sleep(0.05)
                
        except Exception as e:
            print(f"❌ Simulation error: {e}")
            raise
        finally:
            self.running = False
            print(f"✓ Simulation stopped at t={self.sim_time:.2f}ms (step {self.timestep})")
    
    def stop(self):
        """Stop the simulation."""
        self.running = False
        
    def _pull_state_from_device(self):
        """
        Pull neuron state variables from GPU to CPU.
        This is necessary to read the current voltage, etc.
        For CPU backends, this is a no-op as data is already on host.
        """
        if not self.is_gpu_backend:
            # CPU backend: data is already on host, no need to pull
            return
        
        for node_id, pop in self.neuron_pops.items():
            # Pull voltage variable
            if "V" in pop.vars:
                try:
                    pop.vars["V"].pull_from_device()
                except AttributeError:
                    # CPU backend may not have pull_from_device
                    pass
            
            # Pull other relevant variables
            # For Izhikevich, also pull U
            if "U" in pop.vars:
                try:
                    pop.vars["U"].pull_from_device()
                except AttributeError:
                    pass
                
    def _extract_simulation_data(self) -> tuple[List[Dict], List[str]]:
        """
        Extract voltage and spike data from neuron populations.
        
        Returns:
            Tuple of (neuron_updates, spike_ids)
            - neuron_updates: List of {id, voltage} dicts
            - spike_ids: List of neuron IDs that spiked this timestep
        """
        updates = []
        spikes = []
        
        for node_id, pop in self.neuron_pops.items():
            # Get voltage
            if "V" in pop.vars:
                voltage_array = pop.vars["V"].current_values
                voltage = float(voltage_array[0]) if len(voltage_array) > 0 else 0.0
                
                updates.append({
                    "id": node_id,
                    "voltage": f"{voltage:.1f}mV"
                })
                
                self.neuron_states[node_id] = voltage
            
            # Detect spikes using GeNN's spike recording if available
            # GeNN records spikes in current_spikes array after pulling from device
            try:
                # Pull spike data from device if GPU backend
                if self.is_gpu_backend and hasattr(pop, 'current_spikes'):
                    pop.pull_current_spikes_from_device()
                
                # Check if any spikes were recorded for this population
                if hasattr(pop, 'current_spikes'):
                    current_spike_count = pop.current_spikes
                    if current_spike_count > 0:
                        spikes.append(node_id)
                        print(f"⚡ Spike detected: {node_id}")
                else:
                    # Fallback: threshold-based spike detection
                    # Get threshold for this neuron
                    if node_id not in self.spike_threshold:
                        try:
                            # For LIF neurons, threshold is in Vthresh parameter
                            if hasattr(pop, 'params') and 'Vthresh' in pop.params:
                                self.spike_threshold[node_id] = pop.params['Vthresh']
                            else:
                                self.spike_threshold[node_id] = -55.0  # Default LIF threshold
                        except:
                            self.spike_threshold[node_id] = -55.0
                    
                    # Simple spike detection: voltage reset detection
                    prev_voltage = self.previous_voltages.get(node_id, voltage)
                    threshold = self.spike_threshold.get(node_id, -55.0)
                    
                    # Check if voltage dropped significantly (indicating spike and reset)
                    if prev_voltage > threshold - 5.0 and voltage < prev_voltage - 10.0:
                        spikes.append(node_id)
                        print(f"⚡ Spike detected: {node_id} (V: {prev_voltage:.1f} → {voltage:.1f}mV)")
                    
                    # Update previous voltage
                    self.previous_voltages[node_id] = voltage
            except Exception as e:
                # If spike recording fails, continue without spike detection
                # This ensures the simulation doesn't crash
                pass
        
        return updates, spikes
    
    def inject_current(self, node_id: str, current: float):
        """
        Inject external current into a neuron.
        Useful for custom Python input functions.
        
        Args:
            node_id: ID of the neuron
            current: Current to inject (pA or dimensionless)
        """
        if node_id not in self.neuron_pops:
            print(f"Warning: Neuron {node_id} not found")
            return
        
        pop = self.neuron_pops[node_id]
        
        # For LIF neurons, we can modify Ioffset parameter if it's dynamic
        # Or we can directly modify voltage
        if "V" in pop.vars:
            # Pull current value (only for GPU backends)
            if self.is_gpu_backend:
                try:
                    pop.vars["V"].pull_from_device()
                except AttributeError:
                    pass
            
            current_v = pop.vars["V"].current_view[0]
            
            # Add current (simplified - normally current affects dV/dt)
            new_v = current_v + current
            pop.vars["V"].current_view[0] = new_v
            
            # Push back to device (only for GPU backends)
            if self.is_gpu_backend:
                try:
                    pop.vars["V"].push_to_device()
                except AttributeError:
                    pass
    
    def trigger_spike(self, node_id: str):
        """
        Force a neuron to spike.
        Useful for custom Python input nodes.
        
        Args:
            node_id: ID of the neuron to trigger
        """
        if node_id not in self.neuron_pops:
            print(f"Warning: Neuron {node_id} not found")
            return
        
        pop = self.neuron_pops[node_id]
        
        # For SpikeSourceArray, we can update spike times
        # For other neurons, we can push voltage above threshold
        if "V" in pop.vars:
            # Pull from device (only for GPU backends)
            if self.is_gpu_backend:
                try:
                    pop.vars["V"].pull_from_device()
                except AttributeError:
                    pass
            
            # Get threshold (model-dependent)
            # For LIF: Vthresh parameter
            # For Izhikevich: threshold is 30 mV
            threshold = 30.0  # Default
            
            # Set voltage above threshold
            pop.vars["V"].current_view[0] = threshold + 1.0
            
            # Push to device (only for GPU backends)
            if self.is_gpu_backend:
                try:
                    pop.vars["V"].push_to_device()
                except AttributeError:
                    pass
            
            print(f"🎯 Triggered spike for {node_id}")
    
    def get_state_snapshot(self) -> Dict[str, Any]:
        """
        Get current state of all neurons.
        
        Returns:
            Dictionary with neuron states
        """
        self._pull_state_from_device()
        
        snapshot = {
            "timestep": self.timestep,
            "time_ms": self.sim_time,
            "neurons": []
        }
        
        for node_id, pop in self.neuron_pops.items():
            neuron_data = {"id": node_id}
            
            if "V" in pop.vars:
                voltage = float(pop.vars["V"].current_values[0])
                neuron_data["voltage"] = voltage
            
            if "U" in pop.vars:
                u_value = float(pop.vars["U"].current_values[0])
                neuron_data["u"] = u_value
            
            snapshot["neurons"].append(neuron_data)
        
        return snapshot


class GeNNSimulationManager:
    """
    Manages multiple GeNN simulations.
    Handles building, loading, running, and stopping simulations.
    """
    
    def __init__(self):
        self.current_builder: Optional[GeNNNetworkBuilder] = None
        self.current_engine: Optional[GeNNSimulationEngine] = None
        self.simulation_task: Optional[asyncio.Task] = None
        
    async def load_and_build_network(self, network_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build GeNN model from network payload.
        
        Args:
            network_payload: Network definition from frontend
            
        Returns:
            Model information dictionary
        """
        # Stop existing simulation if running
        if self.current_engine and self.current_engine.running:
            await self.stop_simulation()
        
        # Build new model
        self.current_builder = GeNNNetworkBuilder()
        code_path, model_info = self.current_builder.build_from_json(network_payload)
        
        # Load model into memory
        self.current_builder.load_model()
        
        return model_info
    
    async def start_simulation(self, websocket_callback, max_timesteps: Optional[int] = None):
        """
        Start simulation with WebSocket streaming.
        
        Args:
            websocket_callback: Async function for WebSocket emission
            max_timesteps: Max simulation steps (None for infinite)
        """
        if self.current_builder is None:
            raise RuntimeError("No model loaded. Call load_and_build_network() first.")
        
        # Create simulation engine
        self.current_engine = GeNNSimulationEngine(
            self.current_builder,
            websocket_callback
        )
        
        # Start simulation as background task
        self.simulation_task = asyncio.create_task(
            self.current_engine.run(max_timesteps)
        )
        
        print("✓ Simulation started")
    
    async def stop_simulation(self):
        """Stop the running simulation."""
        if self.current_engine:
            self.current_engine.stop()
        
        if self.simulation_task:
            await self.simulation_task
            self.simulation_task = None
        
        print("✓ Simulation stopped")
    
    def get_current_state(self) -> Optional[Dict[str, Any]]:
        """Get current simulation state snapshot."""
        if self.current_engine:
            return self.current_engine.get_state_snapshot()
        return None
    
    def inject_input(self, node_id: str, spike: bool = False, current: float = 0.0):
        """
        Inject input into a neuron (for custom Python functions).
        
        Args:
            node_id: Target neuron ID
            spike: If True, trigger a spike
            current: Current to inject (if spike=False)
        """
        if self.current_engine is None:
            return
        
        if spike:
            self.current_engine.trigger_spike(node_id)
        else:
            self.current_engine.inject_current(node_id, current)


# Singleton instance
genn_manager = GeNNSimulationManager()
