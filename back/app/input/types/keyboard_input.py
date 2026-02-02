from ..base import InputAdapter
from ..registry import InputRegistry
from pynput import keyboard 

@InputRegistry.register("keyboard")
class KeyboardInput(InputAdapter):
    def __init__(self, config: dict):
        super().__init__()
        # Config example: {"map": {"Key.space": "neuron_1", "a": "neuron_2"}}
        self.key_map = config.get("map", {}) 
        self.listener = None

    def on_start(self):
        self.listener = keyboard.Listener(on_press=self._on_press)
        self.listener.start()

    def on_stop(self):
        if self.listener:
            self.listener.stop()

    def _on_press(self, key):
        """Convert real-time key presses to spikes."""
        try:
            # Handle special keys vs char keys
            k_str = key.char if hasattr(key, 'char') else str(key)
            
            if k_str in self.key_map:
                target_neuron = self.key_map[k_str]
                # Push spike immediately (0ms delay from event)
                self.push_spike(target_neuron, delay_ms=0.0)
                
        except AttributeError:
            pass