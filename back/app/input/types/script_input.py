import time
import threading
from typing import List
from ..base import InputAdapter
from ...core.sandbox import Sandbox
from ..registry import InputRegistry

@InputRegistry.register("python_script")
class PythonScriptInput(InputAdapter):
    def __init__(self, code: str, target_ids: List[str], interval_sec: float = 0.01, **kwargs):
        """
        Args:
            code: The user's python script (must define a 'spike(t, ctx)' function)
            target_ids: List of GeNN population names to inject spikes into (e.g. ['input1'])
            interval_sec: How often to run the script (wall clock time)
        """
        super().__init__(**kwargs)
        self.sandbox = Sandbox()
        self.code = code
        self.target_ids = target_ids
        self.base_interval = interval_sec
        self.current_interval = interval_sec
        self.thread = None
        self.func = None
        
        # Prepare the sandbox function immediately
        success, func, error = self.sandbox.compile_function(self.code)
        if success:
            self.func = func
        else:
            print(f"[Input] Compilation failed: {error}")

    def set_speed(self, speed: float):
        """Adjust execution speed based on simulation multiplier."""
        if speed <= 0: 
            return
        self.current_interval = self.base_interval / speed

    def on_start(self):
        if self.func:
            self.thread = threading.Thread(target=self._run_loop, daemon=True)
            self.thread.start()

    def on_stop(self):
        if self.thread:
            self.thread.join(timeout=1.0)

    def _run_loop(self):
        """
        The Sensor Loop. Runs at its own speed (Wall Clock).
        """
        step_counter = 0
        
        while self.active:
            start_t = time.time()
            
            # Execute User Code (Sandbox)
            if self.func:
                triggered = self.sandbox.execute(self.func, step_counter, {"step": step_counter})
                
                # Map Result to Targets & Push to Buffer
                if triggered:
                    for target_id in self.target_ids:
                        # Push event with 0ms delay
                        self.push_spike(target_id, delay_ms=0.0)
            
            step_counter += 1
            
            # Sleep to maintain rate
            elapsed = time.time() - start_t
            sleep_time = max(0, self.current_interval - elapsed)
            time.sleep(sleep_time)