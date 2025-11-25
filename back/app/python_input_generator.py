"""
Python Input Generator

Executes user's Python code in a sandbox and converts output to spikes/currents
that are sent to the C++ runner.
"""

from .input_provider import InputProvider
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
    
    def __init__(self, code: str, interval: float = 0.01, **kwargs):
        """
        Initialize Python input generator.
        
        Args:
            code: Python code to execute
            interval: How often to execute the code (seconds)
            **kwargs: Passed to InputProvider (host, port)
        """
        super().__init__(**kwargs)
        self.code = code
        self.interval = interval
        self.timestep = 0
        
    def run(self):
        """Execute Python code periodically and send results to C++ runner."""
        if not self.connect():
            print("✗ Failed to connect to C++ runner")
            return
        
        self.running = True
        print(f"🐍 Python input generator started")
        print(f"   Executing code every {self.interval}s")
        
        while self.running:
            try:
                # Execute user's Python code in sandbox
                result = execute_spike_function(self.code, {"t": self.timestep})
                
                # Process results
                if result and "result" in result:
                    self._process_result(result["result"])
                
                self.timestep += 1
                time.sleep(self.interval)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"✗ Error in Python generator: {e}")
                time.sleep(self.interval)
        
        print("🐍 Python input generator stopped")
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
                        self.send_spike(spike.get("neuron_id"), spike.get("time"))
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


# Simplified version for direct usage
class SimplePythonGenerator(InputProvider):
    """
    Simplified Python generator that accepts a callable function.
    Useful for programmatic usage without sandbox.
    """
    
    def __init__(self, func: callable, interval: float = 0.01, **kwargs):
        super().__init__(**kwargs)
        self.func = func
        self.interval = interval
        self.timestep = 0
    
    def run(self):
        """Execute function periodically and send results."""
        if not self.connect():
            return
        
        self.running = True
        print(f"🐍 Simple Python generator started")
        
        while self.running:
            try:
                result = self.func(self.timestep)
                
                if result:
                    self._send_result(result)
                
                self.timestep += 1
                time.sleep(self.interval)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"✗ Error: {e}")
                time.sleep(self.interval)
        
        self.disconnect()
    
    def _send_result(self, result):
        """Send result to C++ runner."""
        if isinstance(result, dict):
            if "spike" in result:
                self.send_spike(result["spike"])
            if "current" in result:
                self.send_current(result.get("neuron_id", "default"), result["current"])
        elif isinstance(result, str):
            self.send_spike(result)
        elif isinstance(result, list):
            for neuron_id in result:
                self.send_spike(str(neuron_id))


if __name__ == "__main__":
    # Test with a simple function
    def test_generator(t):
        """Send spike every 10 timesteps."""
        if t % 10 == 0:
            return {"spike": "neuron1"}
        return None
    
    generator = SimplePythonGenerator(test_generator, interval=0.1)
    
    try:
        generator.run()
    except KeyboardInterrupt:
        print("\nStopping...")
        generator.stop()
