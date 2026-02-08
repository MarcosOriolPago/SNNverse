import serial
import threading
from ..base import EventDrivenInput
from ..registry import InputRegistry

@InputRegistry.register("serial_sensor")
class SerialInput(EventDrivenInput):
    def __init__(self, config: dict):
        # Extract serial config
        self.port = config.get("port", "/dev/ttyUSB0")
        self.baud = config.get("baud", 9600)
        
        # Initialize the base event logic (compiles the user script)
        super().__init__(code=config.get("code"), targets=config.get("targets"))
        
        self.serial_conn = None
        self.thread = None

    def on_start(self):
        try:
            self.serial_conn = serial.Serial(self.port, self.baud, timeout=1)
            self.thread = threading.Thread(target=self._listen_loop, daemon=True)
            self.thread.start()
        except Exception as e:
            print(f"Serial Error: {e}")

    def _listen_loop(self):
        """The Blocking IO Loop (Efficient)"""
        while self.active and self.serial_conn.is_open:
            try:
                # Read 1 byte or line (blocking)
                if self.serial_conn.in_waiting > 0:
                    data = self.serial_conn.read() # or readline()
                    val = int.from_bytes(data, "big")
                    
                    # TRIGGER the user logic immediately
                    # User script expected signature: def on_data(byte_val, ctx): ...
                    # We pass 'val' as the first argument, and ctx (targets) is passed by EventDrivenInput.on_event
                    self.on_event(val)
            except Exception:
                break

    def on_stop(self):
        if self.serial_conn:
            self.serial_conn.close()