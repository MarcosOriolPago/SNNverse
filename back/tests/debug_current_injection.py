
import sys
import os
import time
import numpy as np

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.genn_modules.genn_builder import GeNNNetworkBuilder
from app.genn_modules.simulation_runtime import GeNNSimulationRuntime

def debug_current_injection():
    print("Debugging Current Injection...")
    
    # 1. Define network with ONE silent LIF neuron (Input)
    # We need to make sure Ioffset works or we can simply add to V
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
    
    # Step 2: Inject CURRENT (High enough to cause spike)
    # LIF C=1.0, Vthresh=1000.0, Vrest=-70.0
    # To spike, we need V > 1000. 
    # Current injection adds to V? Or Ioffset? 
    # The runtime implementation adds to V directly.
    
    print("\nInjecting current (voltage add)...")
    # Try adding huge voltage
    runtime.inject_current(neuron_id, 2000.0, 0)
    
    runtime.step()
    
    v = runtime._collect_voltages()[neuron_id][0]
    spikes = runtime._collect_spikes()
    
    print(f"Step 2 (Post-injection): V={v:.2f}")
    print(f"Spikes detected: {spikes}")
    
    if neuron_id in spikes and 0 in spikes[neuron_id]:
        print("✅ Spike recorded!")
    else:
        print("❌ Spike NOT recorded.")

if __name__ == "__main__":
    debug_current_injection()
