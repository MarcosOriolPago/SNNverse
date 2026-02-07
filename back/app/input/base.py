import time
import threading
from abc import ABC, abstractmethod
from typing import List, Any
from dataclasses import dataclass
from collections import deque
from ..core.sandbox import Sandbox

@dataclass
class SpikeEvent:
    neuron_id: str
    timestamp: float # -1.0 means "ASAP" (inject immediately)
    payload: Any = None

class InputAdapter(ABC):
    def __init__(self):
        self.active = False
        self._buffer: deque[SpikeEvent] = deque()
        self._lock = threading.Lock()
        self._start_time_ref = 0.0

    def start(self):
        self._start_time_ref = time.time()
        self.active = True
        self.on_start()

    def stop(self):
        self.active = False
        self.on_stop()

    def push_spike(self, neuron_id: str, delay_ms: float = 0.0, virtual_timestamp: float = None):
        """
        Push a spike to the buffer.
        
        Args:
            neuron_id: Target neuron/population ID
            delay_ms: Added delay (only used if virtual_timestamp is None)
            virtual_timestamp: Explicit simulation time (ms). If None, treated as ASAP (-1.0).
        """
        if virtual_timestamp is not None:
            event_time = virtual_timestamp
        else:
            event_time = -1.0
        
        event = SpikeEvent(neuron_id, event_time)
        
        with self._lock:
            self._buffer.append(event)

    def get_events(self, up_to_time_ms: float) -> List[SpikeEvent]:
        ready_events = []
        
        with self._lock:
            while self._buffer:
                # Peek at the oldest event
                next_evt = self._buffer[0]
                
                is_asap = (next_evt.timestamp == -1.0)
                is_time_ready = (next_evt.timestamp <= up_to_time_ms)
                
                if is_asap or is_time_ready:
                    ready_events.append(self._buffer.popleft())
                else:
                    break
                
        return ready_events

    def get_events_all(self) -> List[SpikeEvent]:
        """Retrieve all pending events from the buffer, regardless of timestamp."""
        with self._lock:
            events = list(self._buffer)
            self._buffer.clear()
        return events

    @abstractmethod
    def on_start(self):
        pass

    @abstractmethod
    def on_stop(self):
        pass


class EventDrivenInput(InputAdapter):
    """
    Base class for inputs that react to external events (Keyboard, Serial).
    The 'driver' logic is hardcoded, but the 'response' logic is user-defined.
    """
    def __init__(self, code: str, targets: list, **kwargs):
        super().__init__(**kwargs)
        self.targets = targets
        self.sandbox = Sandbox()
        # The user function now accepts 'data' payload instead of just 'time'
        success, func, error = self.sandbox.compile_function(code)
        if not success:
            raise ValueError(f"Failed to compile input script: {error}")
        self.func = func 

    def on_event(self, data: Any):
        """
        Called by the child class when hardware data arrives.
        Executes user logic to decide if/how to spike.
        """
        if not self.active or not self.func:
            return

        # Execute user logic: spike(data, ctx)
        # We pass the raw data (e.g., the byte read, or the key pressed)
        should_spike = self.sandbox.execute(self.func, data, {"targets": self.targets})

        if should_spike:
            # If the user script returns True, spike all targets
            # Or the user script could return a list of specific IDs to spike
            target_list = should_spike if isinstance(should_spike, list) else self.targets
            for t in target_list:
                self.push_spike(t)