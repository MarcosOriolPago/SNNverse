
import sys
import os
import time
import numpy as np

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.genn_modules.genn_builder import GeNNNetworkBuilder
from app.genn_modules.simulation_runtime import GeNNSimulationRuntime

def debug_spike_injection():
    print("Debugging Spike Injection...")
    
    # 1. Define network with ONE silent LIF neuron (Input)
    network = {
        "nodes": [
            {
                "id": "input1", 
                "type": "PYTHON", 
                "params": {"code": "return True"} 
            }
        ],
        "edges": []
    }
    
    # 2. Build model
    builder = GeNNNetworkBuilder(backend="single_threaded_cpu")
    print("Building model...")
    builder.build_from_json(network)
    builder.load_model()
    
    # 3. Create runtime
    runtime = GeNNSimulationRuntime(builder)
    runtime.recording_enabled = True
    
    neuron_id = "input1"
    
    # Step 1: Check initial state
    runtime.step()
    v = runtime._collect_voltages()[neuron_id][0]
    print(f"Step 1 (Pre-injection): V={v:.2f}")
    
    # Step 2: Inject Spike
    print("\nInjecting spike...")
    runtime.inject_spike(neuron_id, 0)
    
    # Process Injection
    # We will verify what happens inside step() by simulating it manually if needed, 
    # but for now let's call step() and check immediate results.
    
    # Override print to see internal logs from runtime
    
    runtime.step()
    
    v = runtime._collect_voltages()[neuron_id][0]
    spikes = runtime._collect_spikes()
    
    print(f"Step 2 (Post-injection): V={v:.2f}")
    print(f"Spikes detected: {spikes}")
    
    if neuron_id in spikes and 0 in spikes[neuron_id]:
        print("✅ Spike recorded!")
    else:
        print("❌ Spike NOT recorded.")
        
    # Step 3: Check next step (refractory?)
    runtime.step()
    v = runtime._collect_voltages()[neuron_id][0]
    print(f"Step 3 (Refractory check): V={v:.2f}")

if __name__ == "__main__":
    debug_spike_injection()
