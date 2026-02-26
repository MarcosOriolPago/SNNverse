import os
import sys
import shutil
import numpy as np
from pygenn import GeNNModel, init_weight_update, init_postsynaptic, SynapseMatrixType

def test_snnverse_ioffset():
    model_name = "test_snnverse_model"
    
    # Redirect GeNN builds to the dedicated Docker volume
    build_dir = "/tmp/genn_models" if os.path.exists("/tmp/genn_models") else os.getcwd()
    os.chdir(build_dir)
    
    # --- THE FIX: Forcefully remove the cached code inside the build directory ---
    code_dir = os.path.join(build_dir, f"{model_name}_CODE")
    if os.path.exists(code_dir):
        print(f"🧹 Force-clearing stale cache at {code_dir}")
        shutil.rmtree(code_dir)
    # ------------------------------------------------------------------------------

    print(f"1. Initializing Model in {build_dir}...")
    model = GeNNModel("float", model_name, backend="single_threaded_cpu")
    model.dt = 1.0

    print("2. Creating LIF Populations...")
    lif_params = {"Vrest": -70.0, "Vthresh": -55.0, "Vreset": -70.0, "TauM": 20.0, "C": 1.0, "TauRefrac": 2.0, "Ioffset": 0.0}
    
    input_neuron = model.add_neuron_population("InputLIF", 1, "LIF", lif_params, {"V": -70.0, "RefracTime": 0.0})
    target_neuron = model.add_neuron_population("TargetLIF", 1, "LIF", lif_params, {"V": -70.0, "RefracTime": 0.0})
    
    # Set parameter as dynamic BEFORE building
    input_neuron.set_param_dynamic("Ioffset")
    
    input_neuron.spike_recording_enabled = True
    target_neuron.spike_recording_enabled = True

    print("3. Connecting Synapses...")
    model.add_synapse_population(
        "syn_Input_to_Target", SynapseMatrixType.DENSE, input_neuron, target_neuron,
        init_weight_update("StaticPulse", {}, {"g": 20.0}),
        init_postsynaptic("ExpCurr", {"tau": 5.0}, {})
    )

    print("4. Building & Loading...")
    model.build()
    model.load(num_recording_timesteps=100) 

    print("5. Running Real-Time Simulation Loop...")
    for step in range(100):
        if step == 10:
            print("⚡ Injecting current via Dynamic Ioffset!")
            input_neuron.set_dynamic_param_value("Ioffset", 50.0)
        elif step == 15:
            print("🛑 Stopping current injection.")
            input_neuron.set_dynamic_param_value("Ioffset", 0.0)

        model.step_time()

    print("\n✅ SUCCESS: The GeNN simulation ran flawlessly inside Docker!")

if __name__ == "__main__":
    test_snnverse_ioffset()