"""
Input Provider Base Class

Defines the interface for all input providers that send data to the C++ runner.
Input providers are separate processes that inject spikes/currents into the running network.
"""

from abc import ABC, abstractmethod
import socket
import json
import time
from typing import Optional

from ..core.config import config


class InputProvider(ABC):
    """
    Abstract base class for all input providers.
    
    Input providers connect to the C++ runner via TCP and send JSON commands:
    - {"type": "spike", "neuron_id": "n1", "time": 100.5}
    - {"type": "current", "neuron_id": "n1", "value": 5.0}
    - {"type": "stop"}
    """
    
    def __init__(self, host: str = "localhost", port: int = config.INPUT_TCP_PORT):
        self.host = host
        self.port = port
        self.socket: Optional[socket.socket] = None
        self.connected = False
        self.running = False
        
    def connect(self) -> bool:
        """
        Connect to the C++ runner's TCP input port.
        
        Returns:
            True if connected successfully
        """
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((self.host, self.port))
            self.connected = True
            print(f"✓ Input provider connected to {self.host}:{self.port}")
            return True
        except Exception as e:
            print(f"✗ Failed to connect to {self.host}:{self.port}: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Disconnect from the C++ runner."""
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
        self.socket = None
        self.connected = False
        print("✓ Input provider disconnected")
    
    def send_spike(self, neuron_id: str, time: float = None, index: int = 0):
        """
        Send a spike to the specified neuron.
        
        Args:
            neuron_id: ID of the neuron to spike
            time: Time of spike (optional, not currently used by C++ runner)
            index: Index of the neuron within the population (default 0)
        """
        if not self.connected or not self.socket:
            return
        
        # C++ runner expects: {"neuron_id": "...", "spike": true, "index": 0}
        msg = {
            "neuron_id": neuron_id,
            "spike": True,
            "index": index
        }
        
        self._send_json(msg)
    
    def send_current(self, neuron_id: str, value: float, duration: float = None):
        """
        Send a current injection to the specified neuron.
        
        Args:
            neuron_id: ID of the neuron
            value: Current value in nA
            duration: Duration in ms (optional)
        """
        if not self.connected or not self.socket:
            return
        
        msg = {
            "type": "current",
            "neuron_id": neuron_id,
            "value": value
        }
        
        if duration is not None:
            msg["duration"] = duration
        
        self._send_json(msg)
    
    def send_stop(self):
        """Send a stop command to the C++ runner."""
        if not self.connected or not self.socket:
            return
        
        self._send_json({"type": "stop"})
    
    def _send_json(self, data: dict):
        """
        Send a JSON message to the C++ runner.
        Messages are newline-delimited.
        """
        if not self.socket:
            return
        
        try:
            msg = json.dumps(data) + "\n"
            self.socket.sendall(msg.encode('utf-8'))
        except Exception as e:
            print(f"✗ Failed to send message: {e}")
            self.connected = False
    
    @abstractmethod
    def run(self):
        """
        Main loop for the input provider.
        This method should be implemented by subclasses.
        """
        pass
    
    def stop(self):
        """Stop the input provider."""
        self.running = False
        self.send_stop()
        self.disconnect()


class SimpleTestProvider(InputProvider):
    """
    Simple test input provider that sends periodic spikes.
    Useful for testing without Python sandbox.
    """
    
    def __init__(self, neuron_id: str = "neuron1", interval: float = 0.1, **kwargs):
        super().__init__(**kwargs)
        self.neuron_id = neuron_id
        self.interval = interval
    
    def run(self):
        """Send periodic spikes."""
        if not self.connect():
            return
        
        self.running = True
        count = 0
        
        print(f"Sending spikes to {self.neuron_id} every {self.interval}s...")
        
        while self.running:
            self.send_spike(self.neuron_id)
            count += 1
            
            if count % 10 == 0:
                print(f"  Sent {count} spikes")
            
            time.sleep(self.interval)
        
        self.disconnect()


if __name__ == "__main__":
    # Test the simple provider
    provider = SimpleTestProvider(neuron_id="neuron1", interval=0.5)
    
    try:
        provider.run()
    except KeyboardInterrupt:
        print("\nStopping...")
        provider.stop()
