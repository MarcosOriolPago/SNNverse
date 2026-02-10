from ..base import EventDrivenInput
from ..registry import InputRegistry
from pynput import keyboard 

@InputRegistry.register("keyboard")
class KeyboardInput(EventDrivenInput):
    """
    High-performance Keyboard input adapter.
    Bypasses the Sandbox to provide direct, low-latency spike injection.
    """
    
    def __init__(self, key_map: dict = None, source_id: str = None, **kwargs):
        # We pass dummy code to super() just to satisfy the EventDrivenInput init
        # because we are overriding the on_event logic below.
        super().__init__(code="def on_event(x, ctx): pass", targets=key_map or {}, **kwargs)
        self.listener = None
        self.key_map = key_map or {} # Use a local direct reference for speed
        self.source_id = source_id
        print(f"[KeyboardInput] Low-latency mode initialized with {len(self.key_map)} keys")

    def on_event(self, key_str: str):
        """
        OVERRIDE: Direct injection path.
        Bypasses Sandbox execution to achieve near-instant spike pushing.
        """
        if not self.active:
            return

        # Check if this key has a mapping (even if target is unknown at this level)
        if self.source_id and key_str in self.key_map:
            safe_source = self._sanitize_id(self.source_id)
            safe_key = self._sanitize_id(key_str)
            presyn_pop_name = f"{safe_source}_{safe_key}"
            print(f"Pushing spike to population: {presyn_pop_name}")
            self.push_spike(presyn_pop_name, virtual_timestamp=None)

    def _on_press(self, key):
        """Handle key press events and delegate to direct fast-path."""
        try:
            k_str = self._normalize_key_name(key)

            # Call our local overridden on_event
            self.on_event(k_str)
        except Exception as e:
            print(f"[KeyboardInput] Error processing key press: {e}")

    def on_start(self):
        """Start the keyboard listener thread."""
        if not self.key_map:
            print("[KeyboardInput] Warning: No key mappings defined")
            return
            
        try:
            # pynput runs this in its own thread, ensuring non-blocking IO
            self.listener = keyboard.Listener(on_press=self._on_press)
            self.listener.start()
            print(f"[KeyboardInput] Fast-path listener started")
        except Exception as e:
            print(f"[KeyboardInput] Error starting listener: {e}")

    def on_stop(self):
        """Stop the keyboard listener thread."""
        if self.listener:
            try:
                self.listener.stop()
                self.listener = None
            except Exception as e:
                print(f"[KeyboardInput] Error stopping listener: {e}")

    def _normalize_key_name(self, key) -> str:
        """Convert pynput key object to normalized string representation."""
        try:
            if hasattr(key, 'char') and key.char is not None:
                return key.char
            
            # Handle Special Keys explicitly
            k_str = str(key)

            if k_str == 'Key.space':
                return 'Space'  # Map to what your frontend expects
            elif k_str == 'Key.enter':
                return 'Enter'
            elif k_str == 'Key.up':
                return 'ArrowUp'
            elif k_str == 'Key.down':
                return 'ArrowDown'
            elif k_str == 'Key.left':
                return 'ArrowLeft'
            elif k_str == 'Key.right':
                return 'ArrowRight'
            elif k_str == 'Key.shift':
                return 'Shift'
            elif k_str == 'Key.alt':
                return 'Alt'
            elif k_str == 'Key.backspace':
                return 'Backspace'
            elif k_str == 'Key.tab':
                return 'Tab'
            elif k_str == 'Key.esc':
                return 'Escape'
            
            return k_str
            
        except AttributeError:
            return str(key)

    def _sanitize_id(self, text: str) -> str:
        return "".join(c if c.isalnum() else "_" for c in text)
