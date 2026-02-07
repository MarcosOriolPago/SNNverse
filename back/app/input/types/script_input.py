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
                ctx = {"step": step_counter, "t": next_virtual_t}
                triggered = self.sandbox.execute(self.func, step_counter, ctx)
                
                # Map Result to Targets & Push to Buffer
                if triggered:
                    for target_id in self.target_ids:
                        # Push with Explicit Virtual Timestamp
                        self.push_spike(target_id, virtual_timestamp=next_virtual_t)
            
            step_counter += 1
            # No time.sleep here! We generate ahead of time.