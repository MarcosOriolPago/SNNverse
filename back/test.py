import numpy as np
from pygenn import GeNNModel, init_weight_update, init_postsynaptic, SynapseMatrixType

def test_segfault():
    print("1. Initializing Model...")
    # Explicitly using 32-bit float to match GeNN's C++ "float"
    model = GeNNModel("float", "test_segfault_model", backend="single_threaded_cpu")
    model.dt = 1.0

    print("2. Creating Populations...")
    # SpikeSourceArray
    spike_pop = model.add_neuron_population(
        "SpikeFX", 1, "SpikeSourceArray", {}, {"startSpike": [0], "endSpike": [0]}
    )
    # FIX APPLIED HERE: using np.float32!
    spike_pop.extra_global_params["spikeTimes"].set_init_values(np.zeros(100, dtype=np.float32))
    spike_pop.spike_recording_enabled = True

    # Two LIF Neurons
    lif_params = {"Vrest": -70.0, "Vthresh": -55.0, "Vreset": -70.0, "TauM": 20.0, "C": 1.0, "TauRefrac": 2.0, "Ioffset": 0.0}
    lif1 = model.add_neuron_population("LIF1", 1, "LIF", lif_params, {"V": -70.0, "RefracTime": 0.0})
    lif2 = model.add_neuron_population("LIF2", 1, "LIF", lif_params, {"V": -70.0, "RefracTime": 0.0})
    lif1.spike_recording_enabled = True
    lif2.spike_recording_enabled = True

    print("3. Connecting Synapses...")
    # 1 SpikeFX -> 2 separate LIF neurons
    model.add_synapse_population(
        "syn_SpikeFX_to_LIF1", SynapseMatrixType.DENSE, spike_pop, lif1,
        init_weight_update("StaticPulse", {}, {"g": 20.0}), # High weight to guarantee spikes
        init_postsynaptic("ExpCurr", {"tau": 5.0}, {})
    )
    model.add_synapse_population(
        "syn_SpikeFX_to_LIF2", SynapseMatrixType.DENSE, spike_pop, lif2,
        init_weight_update("StaticPulse", {}, {"g": 20.0}),
        init_postsynaptic("ExpCurr", {"tau": 5.0}, {})
    )

    print("4. Building & Loading...")
    model.build()
    # Using a small recording buffer to test if overflow is the cause
    model.load(num_recording_timesteps=10) 

    print("5. Running Simulation Loop...")
    try:
        for step in range(100):
            # Simulate real-time injection logic
            current_time = step * model.dt
            spike_pop.extra_global_params["spikeTimes"].view[0] = current_time
            spike_pop.vars["startSpike"].view[0] = 0
            spike_pop.vars["endSpike"].view[0] = 1
            
            spike_pop.extra_global_params["spikeTimes"].push_to_device()
            spike_pop.vars["startSpike"].push_to_device()
            spike_pop.vars["endSpike"].push_to_device()

            # The physics step - if it segfaults here, it's a C++ math/memory error
            model.step_time()

            # Every 5 steps, pull buffers
            if step % 5 == 0:
                # If it segfaults here, it's a Buffer Overflow!
                model.pull_recording_buffers_from_device()
                
        print("\n✅ SUCCESS: The test script ran without segfaulting!")
    except Exception as e:
        print(f"\n❌ FAILED with Python exception: {e}")

if __name__ == "__main__":
    test_segfault()