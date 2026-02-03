from ..base import EventDrivenInput
from ..registry import InputRegistry
from pynput import keyboard 

@InputRegistry.register("keyboard")
class KeyboardInput(EventDrivenInput):
    """
    Keyboard input adapter that maps key presses to neuron spikes.
    Inherits from EventDrivenInput to use the standard event loop.
    """
    
    def __init__(self, key_map: dict = None, **kwargs):
        """
        Args:
            key_map: Dictionary mapping key strings to neuron IDs
        """
        # Default script: maps key to specific target from the key_map (passed as targets)
        default_code = """
def on_event(key, ctx):
    key_map = ctx['targets']
    if key in key_map:
        return [key_map[key]]
    return []
"""
        # We pass key_map as 'targets' so it's accessible in the context
        super().__init__(code=default_code, targets=key_map or {}, **kwargs)
        self.listener = None
        print(f"[KeyboardInput] Initialized with {len(self.targets)} key mappings")

    @classmethod
    def from_config(cls, config: dict):
        """Factory method to create instance from config dict."""
        return cls(key_map=config.get("map", {}))

    def on_start(self):
        """Start the keyboard listener thread."""
        if not self.targets:
            print("[KeyboardInput] Warning: No key mappings defined")
            return
            
        try:
            self.listener = keyboard.Listener(on_press=self._on_press)
            self.listener.start()
            print(f"[KeyboardInput] Listener started, monitoring {len(self.targets)} keys")
        except Exception as e:
            print(f"[KeyboardInput] Error starting listener: {e}")

    def on_stop(self):
        """Stop the keyboard listener thread."""
        if self.listener:
            try:
                self.listener.stop()
                self.listener = None
                print("[KeyboardInput] Listener stopped")
            except Exception as e:
                print(f"[KeyboardInput] Error stopping listener: {e}")

    def _normalize_key(self, key) -> str:
        """Convert pynput key object to normalized string representation."""
        try:
            # Regular character key (a, b, 1, 2, etc.)
            if hasattr(key, 'char') and key.char is not None:
                return key.char
            # Special key (space, enter, arrows, etc.)
            else:
                return str(key)
        except AttributeError:
            return str(key)

    def _on_press(self, key):
        """Handle key press events and delegate to EventDrivenInput logic."""
        try:
            k_str = self._normalize_key(key)
            # Pass the normalized key to the base class event handler
            # This triggers the sandbox script
            self.on_event(k_str)
                
        except Exception as e:
            print(f"[KeyboardInput] Error processing key press: {e}")