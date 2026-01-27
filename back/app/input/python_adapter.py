import threading
import time
from typing import List
from .base import InputAdapter
from .sandbox import prepare_spike_function, execute_prepared_function

class PythonScriptInput(InputAdapter):
    def __init__(self, code: str, target_ids: List[str], interval_sec: float = 0.01, **kwargs):
        """
        Args:
            code: The user's python script (must define a 'spike(t, ctx)' function)
            target_ids: List of GeNN population names to inject spikes into (e.g. ['input1'])
            interval_sec: How often to run the script (wall clock time)
        """
        super().__init__(**kwargs)
        self.code = code
        self.target_ids = target_ids
        self.interval = interval_sec
        self.thread = None
        
        # Prepare the sandbox function immediately
        success, self.func, error = prepare_spike_function(self.code)
        if not success:
            print(f"Error compiling input script: {error}")
            self.func = None

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
                triggered = self._execute_user_code(step_counter)
                
                # Map Result to Targets & Push to Buffer
                if triggered:
                    for target_id in self.target_ids:
                        # Push event with 0ms delay
                        self.push_spike(target_id, delay_ms=0.0)
            
            step_counter += 1
            
            # Sleep to maintain rate
            elapsed = time.time() - start_t
            sleep_time = max(0, self.interval - elapsed)
            time.sleep(sleep_time)

    def _execute_user_code(self, t: int) -> bool:
        """
        Executes the sandbox function.
        Returns True if a spike should be generated.
        """
        success, result, error = execute_prepared_function(
            func=self.func,
            time_value=t,  # Pass the step counter as 't'
            context={"step": t},
            timeout_seconds=0.5
        )
        
        if not success:
            return False
            
        # Handle Boolean return (Simple Spike)
        if isinstance(result, bool):
            return result
            
        return False