
import sys
import os
import time
import numpy as np

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.genn_modules.genn_builder import GeNNNetworkBuilder
from app.genn_modules.simulation_runtime import GeNNSimulationRuntime

def debug_direct_view():
    print("Debugging Direct View Access...")
    
    network = {
        "nodes": [{"id": "input1", "type": "PYTHON", "params": {"code": "return True"}}],
        "edges": []
    }
    
    builder = GeNNNetworkBuilder(backend="single_threaded_cpu")
    print("Building model...")
    builder.build_from_json(network)
    builder.load_model()
    
    pop = builder.get_neuron_populations()["input1"]
    
    # Init
    print("Initial state:")
    pop.vars["V"].pull_from_device()
    print(f"V (pulled) = {pop.vars['V'].current_view[0]}")
    
    # Try Direct View Access if available (view is numpy array wrapping memory)
    # In PyGeNN, vars["V"].view might give direct access?
    # Let's inspect the object
    print(f"Var type: {type(pop.vars['V'])}")
    
    # Try sticking to pull/modify/push but verify update
    print("\nModifying V -> 2000.0 via push")
    pop.vars["V"].pull_from_device()
    pop.vars["V"].current_view[0] = 2000.0
    pop.vars["V"].push_to_device()
    
    # Immediately pull back to verify persistence BEFORE step
    pop.vars["V"].pull_from_device()
    print(f"V (post-push, pre-step) = {pop.vars['V'].current_view[0]}")
    
    # Step
    print("\nStepping model...")
    builder.get_model().step_time()
    
    # Check after step
    pop.vars["V"].pull_from_device()
    print(f"V (post-step) = {pop.vars['V'].current_view[0]}")
    
    # Check spikes
    builder.get_model().pull_recording_buffers_from_device()
    pk_times, pk_ids = pop.spike_recording_data[0]
    print(f"Spike times: {pk_times}")
    print(f"Spike IDs: {pk_ids}")

if __name__ == "__main__":
    debug_direct_view()
