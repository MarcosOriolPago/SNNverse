from typing import List, Dict
import numpy as np

from ...input.registry import InputRegistry
from ...input.types.spike_input_fx import SpikeInputFx

class InputService:
    def __init__(self):
        self.active_generators: List[SpikeInputFx] = []

    def start_realtime_inputs(self, runtime, nodes: List[Dict]):
        """Starts input threads for Real-Time mode."""
        self.stop_inputs()
        InputRegistry.autodiscover()
        
        for node in nodes:
            adapter = InputRegistry.create_from_node(node)
            if adapter:
                try:
                    runtime.add_input_source(adapter)
                    adapter.start()
                    self.active_generators.append(adapter)
                except Exception as e:
                    print(f"Input Error ({node['id']}): {e}")

    def prepare_offline_inputs(self, runtime, nodes: List[Dict], duration_ms: float):
        """Generates CSR arrays and pushes to GPU for Offline mode."""
        InputRegistry.autodiscover()

        for node in nodes:
            # Create temporary adapter for generation
            adapter = InputRegistry.create_from_node(node)
            if not adapter or not isinstance(adapter, SpikeInputFx):
                continue
            
            if hasattr(adapter, 'generate_batch'):
                try:
                    start, end, times = adapter.generate_batch(duration_ms)
                    self._push_to_genn(runtime, adapter.target_ids[0], start, end, times)
                except Exception as e:
                    print(f"Offline Input Gen Error ({node['id']}): {e}")

    def stop_inputs(self):
        for gen in self.active_generators:
            try: gen.stop()
            except: pass
        self.active_generators = []

    def set_speed(self, speed: float):
        for gen in self.active_generators:
            if hasattr(gen, 'set_speed'): gen.set_speed(speed)

    def _push_to_genn(self, runtime, pop_name, start, end, times):
        """Internal helper to write to GeNN memory."""
        if pop_name not in runtime.populations: return
        pop = runtime.populations[pop_name]
        
        if "spikeTimes" in pop.extra_global_params:
            # Safety Truncation
            max_cap = len(pop.extra_global_params["spikeTimes"].view)
            if len(times) > max_cap:
                times = times[:max_cap]
                start = np.minimum(start, max_cap)
                end = np.minimum(end, max_cap)

            # Write Memory
            pop.extra_global_params["spikeTimes"].view[:len(times)] = times
            pop.vars["startSpike"].view[:] = start
            pop.vars["endSpike"].view[:] = end
            
            # Sync Device
            pop.push_extra_global_param_to_device("spikeTimes")
            pop.push_var_to_device("startSpike")
            pop.push_var_to_device("endSpike")