from ..base import EventDrivenInput
from ..registry import InputRegistry

@InputRegistry.register("keyboard")
class KeyboardInput(EventDrivenInput):
    """
    High-performance Keyboard input adapter for WebSockets.
    Receives keystrokes routed from the frontend browser via SimulationManager.
    """
    
    def __init__(self, key_map: dict = None, **kwargs):
        super().__init__(code="def on_event(x, ctx): pass", targets=key_map or {}, **kwargs)
        self.key_map = key_map or {} 
        print(f"[KeyboardInput] Web-routed mode initialized with {len(self.key_map)} keys")

    def inject_key(self, key_str: str):
        """
        Direct injection path called by the WebSocket handler.
        """
        if not self.active:
            return

        target_id = self.key_map.get(key_str)
        if target_id:
            print(f"[KeyboardInput] Web key '{key_str}' received, spiking target '{target_id}'")
            self.push_spike(target_id, virtual_timestamp=None)

    def on_start(self):
        """No background OS listeners needed for web-based input."""
        print("[KeyboardInput] Ready to receive keys from WebSockets")

    def on_stop(self):
        """Cleanup (nothing to do)."""
        pass