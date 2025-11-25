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
from .genn_builder import GeNNNetworkBuilder, GENN_AVAILABLE


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
        if not GENN_AVAILABLE:
            raise RuntimeError("pygenn is not installed. Cannot run GeNN simulations.")
        
        self.builder = builder
        self.model = builder.get_model()
        self.neuron_pops = builder.get_neuron_populations()
        self.websocket_callback = websocket_callback
        
        self.running = False
        self.timestep = 0
        self.sim_time = 0.0
        
        # Track neuron state for frontend
        self.neuron_states = {}
        
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
        """
        for node_id, pop in self.neuron_pops.items():
            # Pull voltage variable
            if "V" in pop.vars:
                pop.vars["V"].pull_from_device()
            
            # Pull other relevant variables
            # For Izhikevich, also pull U
            if "U" in pop.vars:
                pop.vars["U"].pull_from_device()
                
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
                
                # Store for spike detection
                self.neuron_states[node_id] = voltage
            
            # Detect spikes
            # GeNN tracks current spikes in a special array
            # We can access it via pop.current_spikes
            current_spikes = pop.current_spikes
            if len(current_spikes) > 0:
                # This population spiked
                spikes.append(node_id)
                print(f"⚡ Spike detected: {node_id}")
        
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
            # Pull current value
            pop.vars["V"].pull_from_device()
            current_v = pop.vars["V"].current_view[0]
            
            # Add current (simplified - normally current affects dV/dt)
            new_v = current_v + current
            pop.vars["V"].current_view[0] = new_v
            
            # Push back to device
            pop.vars["V"].push_to_device()
    
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
            pop.vars["V"].pull_from_device()
            
            # Get threshold (model-dependent)
            # For LIF: Vthresh parameter
            # For Izhikevich: threshold is 30 mV
            threshold = 30.0  # Default
            
            # Set voltage above threshold
            pop.vars["V"].current_view[0] = threshold + 1.0
            pop.vars["V"].push_to_device()
            
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
