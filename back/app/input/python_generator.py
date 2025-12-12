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
    
    def __init__(self, code: str, neuron_id: str = "unknown", interval: float = 0.01, runtime=None, **kwargs):
        """
        Initialize Python input generator.
        
        Args:
            code: Python code to execute
            neuron_id: ID of the neuron to send spikes to
            interval: How often to execute the code (seconds)
            runtime: Optional GeNNSimulationRuntime instance for direct injection
            **kwargs: Passed to InputProvider (host, port)
        """
        super().__init__(**kwargs)
        self.code = code
        self.neuron_id = neuron_id
        self.interval = interval
        self.runtime = runtime
        self.timestep = 0
        self.thread: Optional[threading.Thread] = None

    def connect(self) -> bool:
        """Connect to runtime or TCP."""
        if self.runtime:
            self.connected = True
            print(f"✓ Python input connected to local runtime")
            return True
        return super().connect()

    def send_spike(self, neuron_id: str, time_val: float = None, index: int = 0):
        """Send spike to runtime or TCP."""
        if self.runtime:
            self.runtime.inject_spike(neuron_id, index)
        else:
            super().send_spike(neuron_id, time_val, index)
            
    def send_current(self, neuron_id: str, value: float, duration: float = None):
        """Send current to runtime or TCP."""
        if self.runtime:
            self.runtime.inject_current(neuron_id, value, index=0) # TODO: support index
        else:
            super().send_current(neuron_id, value, duration)

    def start(self):
        """Start the generator in a separate thread."""
        if self.running:
            return
            
        self.running = True
        self.thread = threading.Thread(target=self.run, daemon=True, name=f"PyInput-{self.neuron_id}")
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
            print(f"[PyInput-{self.neuron_id}] ✗ Failed to connect input generator")
            return
        
        print(f"[PyInput-{self.neuron_id}] ✓ Generator started")
        
        # Prepare function once
        success, func, error = prepare_spike_function(self.code)
        if not success:
            print(f"[PyInput-{self.neuron_id}] ✗ Failed to compile Python input code: {error}")
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
                        # print(f"✓ Spike at t={self.timestep} for neuron {self.neuron_id}")
                        self.send_spike(self.neuron_id)
                    elif isinstance(result, (dict, list, str)):
                        self._process_result(result)
                else:
                    print(f"✗ Function error at t={self.timestep}: {error}")
                
                self.timestep += 1
                time.sleep(self.interval)
                
            except Exception as e:
                print(f"[PyInput-{self.neuron_id}] ✗ Error in generator loop: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(self.interval)
        
        # print(" Python input generator stopped")
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
                            spike.get("neuron_id", self.neuron_id), 
                            spike.get("time"),
                            spike.get("index", 0)
                        )
                    else:
                        self.send_spike(str(spike))
            
            if "currents" in result:
                for current in result["currents"]:
                    if isinstance(current, dict):
                        self.send_current(
                            current.get("neuron_id", self.neuron_id),
                            current.get("value", 0.0),
                            current.get("duration")
                        )
        
        elif isinstance(result, list):
            # List of spike IDs or current injections
            for item in result:
                if isinstance(item, dict) and "value" in item:
                    # Current injection
                    self.send_current(item.get("neuron_id", self.neuron_id), item["value"])
                else:
                    # Spike
                    self.send_spike(str(item))
        
        elif isinstance(result, str):
            # Single spike ID
            self.send_spike(result)

