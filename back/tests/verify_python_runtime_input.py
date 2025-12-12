
import sys
import os
import time

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.genn_modules.genn_builder import GeNNNetworkBuilder
from app.genn_modules.simulation_runtime import GeNNSimulationRuntime

def test_python_input_injection():
    print("Testing Python Input Injection fix...")
    
    # 1. Define network: Input (LIF-silent) -> Neuron (LIF)
    network = {
        "nodes": [
            {
                "id": "input1", 
                "type": "PYTHON", 
                "params": {"code": "return True"} # Not used here, we inject manually
            },
            {
                "id": "neuron1", 
                "type": "LIF", 
                "params": {"threshold": -55.0, "tau": 20.0, "rest": -70.0}
            }
        ],
        "edges": [
            {"source": "input1", "target": "neuron1"}
        ]
    }
    
    # 2. Build model
    builder = GeNNNetworkBuilder(backend="single_threaded_cpu")
    print("Building model...")
    builder.build_from_json(network)
    builder.load_model()
    
    # 3. Create runtime
    runtime = GeNNSimulationRuntime(builder)
    runtime.recording_enabled = True # ensuring recording is on
    
    print("\nStarting simulation loop (manual stepping)...")
    
    # Track voltages
    voltages_n1 = []
    
    # Step 1-10: No input
    for i in range(10):
        runtime.step()
        v = runtime._collect_voltages()
        voltages_n1.append(v["neuron1"][0])
        print(f"Propagating: t={runtime.timestep} V_neuron1={v['neuron1'][0]:.2f}")
        
    initial_voltage = voltages_n1[-1]
    
    # Step 11: Inject spike into INPUT node
    print("\nInjecting spike into input1 at t=11...")
    runtime.inject_spike("input1", 0)
    
    # Process the injection
    runtime.step() 
    v = runtime._collect_voltages()
    voltages_n1.append(v["neuron1"][0])
    spikes = runtime._collect_spikes()
    print(f"Injection Step: t={runtime.timestep} V_neuron1={v['neuron1'][0]:.2f} Spikes={spikes}")
    
    if "input1" in spikes and 0 in spikes["input1"]:
        print("✅ SUCCESS: Input node spiked!")
    else:
        print("❌ FAILURE: Input node did NOT spike.")
        
    # Step 12-20: Observe propagation
    print("\nObserving propagation...")
    max_voltage = -999
    
    for i in range(20):
        runtime.step()
        v = runtime._collect_voltages()
        val = v["neuron1"][0]
        voltages_n1.append(val)
        spikes = runtime._collect_spikes()
        print(f"Post-injection: t={runtime.timestep} V_neuron1={val:.2f}")
        
        if val > max_voltage:
            max_voltage = val
            
    print(f"\nInitial V: {initial_voltage:.2f}")
    print(f"Max V: {max_voltage:.2f}")
    
    if max_voltage > initial_voltage + 0.1:
        print("✅ SUCCESS: Neuron voltage increased!")
    else:
        print("❌ FAILURE: Neuron voltage did not increase significantly.")
        
    if max_voltage > initial_voltage + 10:
         print("⚠ NOTE: Voltage increase is very large, might be too strong or direct injection?")

if __name__ == "__main__":
    test_python_input_injection()
