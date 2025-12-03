"""
Python Input Generator

Executes user's Python code in a sandbox and converts output to spikes/currents
that are sent to the C++ runner.
"""

from .provider import InputProvider
from .sandbox import execute_spike_function
import time
from typing import Dict, Any, List


class PythonInputGenerator(InputProvider):
    """
    Input provider that executes user's Python code and sends results to C++ runner.
    
    The Python function should return spikes/currents in the format:
    {
        "spikes": [{"neuron_id": "n1", "time": 100.5}, ...],
        "currents": [{"neuron_id": "n2", "value": 5.0}, ...]
    }
    """
    
    def __init__(self, code: str, neuron_id: str = "unknown", interval: float = 0.01, **kwargs):
        """
        Initialize Python input generator.
        
        Args:
            code: Python code to execute
            neuron_id: ID of the neuron to send spikes to
            interval: How often to execute the code (seconds)
            **kwargs: Passed to InputProvider (host, port)
        """
        super().__init__(**kwargs)
        self.code = code
        self.neuron_id = neuron_id
        self.interval = interval
        self.timestep = 0
        
    def run(self):
        """Execute Python code periodically and send results to C++ runner."""
        if not self.connect():
            print("✗ Failed to connect to C++ runner")
            return
        
        self.running = True
        print(f" Python input generator started")
        print(f"   Executing code every {self.interval}s")
        
        while self.running:
            try:
                # Execute user's Python code in sandbox
                # execute_spike_function returns (success, result, error_message)
                success, result, error = execute_spike_function(
                    code=self.code,
                    time_value=self.timestep,
                    context={"timestep": self.timestep},
                    timeout_seconds=1.0
                )
                
                # Process results if successful
                if success:
                    # result is a boolean (True for spike, False for no spike)
                    if result:
                        print(f"✓ Spike at t={self.timestep} for neuron {self.neuron_id}")
                        self.send_spike(self.neuron_id)
                else:
                    print(f"✗ Function error at t={self.timestep}: {error}")
                
                self.timestep += 1
                time.sleep(self.interval)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"✗ Error in Python generator: {e}")
                time.sleep(self.interval)
        
        print(" Python input generator stopped")
        self.disconnect()
    
    def _process_result(self, result: Any):
        """
        Process the result from user's Python code and send to C++ runner.
        
        Supported formats:
        - {"spikes": [...], "currents": [...]}
        - [{"neuron_id": "n1", "value": 5.0}, ...]  # currents
        - ["n1", "n2"]  # spike neuron IDs
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
                        self.send_spike(str(spike))
            
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
                    self.send_spike(str(item))
        
        elif isinstance(result, str):
            # Single spike ID
            self.send_spike(result)

