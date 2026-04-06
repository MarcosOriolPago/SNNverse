import time
import threading
import types
from typing import List, Tuple
import numpy as np
from ..base import InputAdapter
from ...core.sandbox import Sandbox
from ..registry import InputRegistry

@InputRegistry.register("spike_fx")
class SpikeInputFx(InputAdapter):
    def __init__(self, code: str, target_ids: List[str], frequency: float = 1000.0, **kwargs):
        """
        Args:
            code: The user's python script (must define a 'spike(t, ctx)' function)
            target_ids: List of GeNN population names to inject spikes into (e.g. ['input1'])
            frequency: How often to run the script in Hz (default 1000Hz)
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

    def on_start(self, realtime: bool = True):
        """
        For real-time mode: starts a background thread that runs the spike function
        at the configured frequency and feeds spikes into the adapter buffer.
        
        For offline mode: no thread is needed. All spike timing data is pre-computed
        by generate_batch() before the simulation begins and pushed directly into
        the GeNN SpikeSourceArray population.
        """
        if self.func and realtime:
            self.thread = threading.Thread(target=self._run_realtime_loop, daemon=True)
            self.thread.start()

    def on_stop(self):
        if self.thread:
            self.thread.join(timeout=1.0)

    def _build_ctx(self, t: float, step: int) -> Tuple[dict, List[int]]:
        """Build ctx with spike(), t0, t1, t2... for user code."""
        spike_list: List[int] = []
        num_targets = len(self.target_ids)

        def spike(target: int) -> None:
            """Spike target neuron by index (0-based). Use spike(t0), spike(0), etc."""
            if isinstance(target, int) and 0 <= target < num_targets:
                spike_list.append(target)

        ctx = {
            "t": t,
            "step": step,
            "target_neuron_ids": self.target_ids,
            "spike": spike,
        }
        # Add t0, t1, t2... as target indices for easy reference
        for i in range(num_targets):
            ctx[f"t{i}"] = i
        return ctx, spike_list

    def _run_func_with_ctx(self, t, ctx: dict):
        """Run user func with ctx vars (spike, t0, t1...) injected into scope."""
        # Inject ctx keys into function's globals so spike(t0) works directly
        func = self.func
        new_globals = {**func.__globals__, **ctx}
        bound_func = types.FunctionType(
            func.__code__, new_globals, func.__name__, func.__defaults__
        )
        return bound_func(t, ctx)

    def _run_realtime_loop(self):
        """
        Real-Time Loop. Runs at the configured frequency, using time.sleep for pacing.
        """
        while self.active:
            start_time = time.time()
            # Execute User Code (Sandbox)
            if self.func:
                ctx, spike_list = self._build_ctx(None, 0)
                ctx["t"] = None  # Real-time mode
                result = self._run_func_with_ctx(None, ctx)

                # Use spike() calls if any, else fall back to return value
                if spike_list:
                    for idx in spike_list:
                        self.push_spike(self.target_ids[idx], virtual_timestamp=None)
                elif result:
                    if result is True:
                        for target_id in self.target_ids:
                            self.push_spike(target_id, virtual_timestamp=None)
                    elif isinstance(result, list):
                        target_map = {tid: i for i, tid in enumerate(self.target_ids)}
                        for tid in result:
                            if tid in target_map:
                                self.push_spike(tid, virtual_timestamp=None)
                    elif isinstance(result, str) and result in self.target_ids:
                        self.push_spike(result, virtual_timestamp=None)

            # Sleep to maintain real-time pacing
            elapsed = time.time() - start_time
            sleep_time = max(0.0, self.current_interval - elapsed)
            time.sleep(sleep_time)


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
            ctx, spike_list = self._build_ctx(t, step)

            try:
                result = self._run_func_with_ctx(t, ctx)

                # Use spike() calls if any, else fall back to return value
                if spike_list:
                    for idx in spike_list:
                        if 0 <= idx < num_targets:
                            spikes_buckets[idx].append(t)
                elif result:
                    if result is True:
                        for i in range(num_targets):
                            spikes_buckets[i].append(t)
                    elif isinstance(result, list):
                        for tid in result:
                            if tid in target_map:
                                spikes_buckets[target_map[tid]].append(t)
                    elif isinstance(result, str):
                        if result in target_map:
                            spikes_buckets[target_map[result]].append(t)
                    elif isinstance(result, int) and 0 <= result < num_targets:
                        spikes_buckets[result].append(t)

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
