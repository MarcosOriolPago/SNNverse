
import os
import sys
from pathlib import Path

# Add back directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.genn_modules.genn_builder import GeNNNetworkBuilder
from app.genn_modules.simulation_runtime import GeNNSimulationRuntime

def debug_synapse():
    print("Debugging Synapse Propagation...")
    
    # 1. Define simple 2-neuron network
    payload = {
        "nodes": [
            {"id": "input1", "type": "PYTHON", "params": {}},
            {"id": "neuron1", "type": "LIF", "params": {"tau": 20.0, "threshold": -50.0}}
        ],
        "edges": [
            {"source": "input1", "target": "neuron1"}
        ]
    }
    
    # 2. Build Model
    builder = GeNNNetworkBuilder(model_id="debug_synapse")
    builder.build_from_json(payload)
    builder.load_model(num_recording_timesteps=1)
    
    # 3. Init Runtime
    runtime = GeNNSimulationRuntime(builder)
    print(f"Runtime initialized. Synapses: {len(builder.synapse_populations)}")
    
    # 4. Step a bit to settle
    runtime.step()
    runtime.step()
    
    # 5. Inject Spike into Input
    print("\n--- Injecting Spike into input1 ---")
    runtime.inject_spike("input1")
    
    # 6. Step and Monitor
    for i in range(10):
        # Capture voltages BEFORE step (well, runtime.step does the step)
        # We want to see the effect of the injection
        
        voltages = runtime._collect_voltages()
        print(f"Step {i} Start: V_input={voltages.get('input1', ['?'])[0]:.1f}, V_neuron={voltages.get('neuron1', ['?'])[0]:.2f}")
        
        runtime.step()
        
        voltages_after = runtime._collect_voltages()
        spikes = runtime._collect_spikes()
        print(f"   -> Result: V_input={voltages_after.get('input1', ['?'])[0]:.1f}, V_neuron={voltages_after.get('neuron1', ['?'])[0]:.2f}")
        if spikes:
            print(f"   -> Spikes: {spikes}")

if __name__ == "__main__":
    debug_synapse()
