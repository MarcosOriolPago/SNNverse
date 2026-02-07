import threading
from typing import List, Tuple
import numpy as np
from ..base import InputAdapter
from ...core.sandbox import Sandbox
from ..registry import InputRegistry

@InputRegistry.register("python_script")
class SpikeInputFx(InputAdapter):
    def __init__(self, code: str, target_ids: List[str], frequency: float = 100.0, **kwargs):
        """
        Args:
            code: The user's python script (must define a 'spike(t, ctx)' function)
            target_ids: List of GeNN population names to inject spikes into (e.g. ['input1'])
            frequency: How often to run the script in Hz (default 100Hz)
        """
        super().__init__(**kwargs)
        self.sandbox = Sandbox()
        self.code = code
        self.target_ids = target_ids
        self.frequency = max(0.1, frequency) # Avoid div by zero
        self.base_interval = 1.0 / self.frequency
        self.current_interval = self.base_interval
        self.thread = None
        self.func = None
        
        # Prepare the sandbox function immediately
        success, func, error = self.sandbox.compile_function(self.code)
        if success:
            self.func = func
        else:
            print(f"[Input] Compilation failed: {error}")

    def on_start(self):
        if self.func:
            self.thread = threading.Thread(target=self._run_loop, daemon=True)
            self.thread.start()

    def on_stop(self):
        if self.thread:
            self.thread.join(timeout=1.0)

    def _run_loop(self):
        """
        The Script Loop. Runs as fast as possible ( Virtual Time Generator ),
        throttled only by buffer size (Backpressure).
        """
        step_counter = 0
        
        while self.active:
            next_virtual_t = step_counter * (self.base_interval * 1000.0)

            # Execute User Code (Sandbox)
            if self.func:
                # We pass the virtual time as context if needed
                ctx = {
                    "step": step_counter, 
                    "t": next_virtual_t,
                    "frequency": self.frequency,
                    "rate": self.frequency,
                    "dt": self.base_interval
                }
                triggered = self.sandbox.execute(self.func, step_counter, ctx)
                
                # Map Result to Targets & Push to Buffer
                if triggered:
                    for target_id in self.target_ids:
                        # Push with Explicit Virtual Timestamp
                        self.push_spike(target_id, virtual_timestamp=next_virtual_t)
            
            step_counter += 1
            # No time.sleep here! We generate ahead of time.

    def generate_batch(self, duration_ms: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Generates the compressed sparse row (CSR) arrays for GeNN SpikeSourceArray.
        Returns: (startSpike, endSpike, spikeTimes)
        """
        if not self.func:
            return np.array([0]), np.array([0]), np.array([])

        # Calculate exactly how many times the script runs
        dt_script = 1000.0 / self.frequency
        num_steps = int(duration_ms / dt_script)
        
        # Optimization: Pre-map target IDs to local indices [0, 1, 2...]
        # This allows O(1) bucket access instead of string dictionary lookups
        target_map = {tid: i for i, tid in enumerate(self.target_ids)}
        num_targets = len(self.target_ids)
        
        # Buckets for each neuron: spikes[0] = [t1, t2...], spikes[1] = [...]
        spikes_buckets = [[] for _ in range(num_targets)]

        print(f"[ScriptInput] Generating batch: {num_steps} steps @ {self.frequency}Hz")
        
        for step in range(num_steps):
            t = step * dt_script
            
            # Fast Context Creation
            ctx = {
                "t": t,
                "step": step,
                "target_neuron_ids": self.target_ids # Pass the list so they can iterate
            }
            
            try:
                result = self.func(t, ctx)
                if result:
                    if result is True:
                        # Spike ALL
                        for i in range(num_targets):
                            spikes_buckets[i].append(t)
                    
                    elif isinstance(result, list):
                        # Spike Specific List
                        for tid in result:
                            if tid in target_map:
                                spikes_buckets[target_map[tid]].append(t)
                                
                    elif isinstance(result, str):
                        # Spike Single
                        if result in target_map:
                            spikes_buckets[target_map[result]].append(t)
                            
            except Exception as e:
                print(f"Error in script at t={t}: {e}")
                continue

        # Flatten to GeNN CSR Format (startSpike, endSpike, spikeTimes)
        # C++ array structure GeNN needs
        
        start_spike = np.zeros(num_targets, dtype=np.uint32)
        end_spike = np.zeros(num_targets, dtype=np.uint32)
        
        flat_times = []
        current_offset = 0
        
        for i in range(num_targets):
            neuron_spikes = spikes_buckets[i]
            count = len(neuron_spikes)
            
            start_spike[i] = current_offset
            end_spike[i] = current_offset + count
            
            flat_times.extend(neuron_spikes)
            current_offset += count
            
        spike_times = np.array(flat_times, dtype=np.float32)
        
        return start_spike, end_spike, spike_times