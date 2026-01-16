"""
Python Input Generator

Executes user's Python code in a sandbox and converts output to spikes/currents
that are sent to the C++ runner.
"""

from .provider import InputProvider
from .sandbox import prepare_spike_function, execute_prepared_function
import time
import threading
from typing import Any, Optional



class PythonInputGenerator(InputProvider):
    """
    Input provider that executes user's Python code and sends results to simulation.
    
    The Python function should return boolean (spike/no-spike) or a dict.
    Supports running in a separate thread and injecting directly into GeNNSimulationRuntime.
    """
    
    def __init__(self, code: str, target_ids: list[str], interval: float = 0.01, runtime=None, **kwargs):
        """
        Initialize Python input generator.
        
        Args:
            code: Python code to execute
            target_ids: List of neuron IDs to send spikes to
            interval: How often to execute the code (seconds)
            runtime: Optional GeNNSimulationRuntime instance for direct injection
            **kwargs: Passed to InputProvider (host, port)
        """
        super().__init__(**kwargs)
        self.code = code
        self.target_ids = target_ids
        self.interval = interval
        self.runtime = runtime
        self.timestep = 0
        self.thread: Optional[threading.Thread] = None

    def connect(self) -> bool:
        """Connect to runtime or TCP."""
        if self.runtime:
            self.connected = True
            print(f"✓ Python input connected to local runtime (targets: {self.target_ids})")
            return True
        return super().connect()

    def send_spike(self, neuron_id: str = None, time_val: float = None, index: int = 0):
        """Send spike to runtime or TCP."""
        # If no specific ID provided, broadcast to all initialized targets
        targets = [neuron_id] if neuron_id else self.target_ids
        
        for tid in targets:
            if self.runtime:
                self.runtime.inject_spike(tid, index)
            else:
                super().send_spike(tid, time_val, index)
            
    def send_current(self, neuron_id: str = None, value: float = 0.0, duration: float = None):
        """Send current to runtime or TCP."""
        # If no specific ID provided, broadcast to all initialized targets
        targets = [neuron_id] if neuron_id else self.target_ids

        for tid in targets:
            if self.runtime:
                self.runtime.inject_current(tid, value, index=0) # TODO: support index
            else:
                super().send_current(tid, value, duration)

    def start(self):
        """Start the generator in a separate thread."""
        if self.running:
            return
            
        self.running = True
        self.thread = threading.Thread(target=self.run, daemon=True, name=f"PyInput-{len(self.target_ids)}")
        self.thread.start()
        
    def stop(self):
        """Stop the generator."""
        super().stop()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1.0)
        self.thread = None

    def run(self):
        """Execute Python code periodically and send results."""
        if not self.connect():
            print(f"[PyInput] ✗ Failed to connect input generator")
            return
        
        print(f"[PyInput] ✓ Generator started")
        
        # Prepare function once
        success, func, error = prepare_spike_function(self.code)
        if not success:
            print(f"[PyInput] ✗ Failed to compile Python input code: {error}")
            self.disconnect()
            return
            
        while self.running:
            try:
                # Execute prepared function
                success, result, error = execute_prepared_function(
                    func=func,
                    time_value=self.timestep,
                    context={"timestep": self.timestep},
                    timeout_seconds=0.5
                )
                
                # Process results if successful
                if success:
                    # result is a boolean (True for spike, False for no spike)
                    if result is True:
                        self.send_spike() # Broadcast to all targets
                    elif result is False or result is None:
                         pass
                    elif isinstance(result, (dict, list, str, int)):
                        self._process_result(result)
                else:
                    print(f"✗ Function error at t={self.timestep}: {error}")
                
                self.timestep += 1
                
                # Check runtime speed if available to sync input rate
                current_speed = 1.0
                if self.runtime and hasattr(self.runtime, 'speed_multiplier'):
                    current_speed = self.runtime.speed_multiplier
                
                # Adjust sleep time based on speed
                sleep_time = self.interval / current_speed
                time.sleep(sleep_time)
                
            except Exception as e:
                print(f"[PyInput] ✗ Error in generator loop: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(self.interval)
        
        self.disconnect()
    
    def _process_result(self, result: Any):
        """
        Process complex results (dict/list) from user's Python code.
        """
        if isinstance(result, dict):
            # Full format with spikes and currents
            if "spikes" in result:
                for spike in result["spikes"]:
                    if isinstance(spike, dict):
                        self.send_spike(
                            spike.get("neuron_id"), 
                            spike.get("time"),
                            spike.get("index", 0)
                        )
                    else:
                        # If string, use it as ID. If just True/1, broadcast
                        if isinstance(spike, str):
                            self.send_spike(spike)
                        else:
                             self.send_spike()
            
            if "currents" in result:
                for current in result["currents"]:
                    if isinstance(current, dict):
                        self.send_current(
                            current.get("neuron_id"),
                            current.get("value", 0.0),
                            current.get("duration")
                        )
        
        elif isinstance(result, list):
            # List of spike IDs or current injections
            for item in result:
                if isinstance(item, dict) and "value" in item:
                    # Current injection
                    self.send_current(item.get("neuron_id"), item["value"])
                else:
                    # Spike
                    if isinstance(item, str):
                         self.send_spike(str(item))
                    else:
                         self.send_spike()
        
        elif isinstance(result, str):
            # Single spike ID
            self.send_spike(result)

