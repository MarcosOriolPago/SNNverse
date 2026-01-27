import threading
import time
from abc import ABC, abstractmethod
from typing import List, Any
from dataclasses import dataclass
from collections import deque

@dataclass
class SpikeEvent:
    neuron_id: str
    timestamp: float
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

    def push_spike(self, neuron_id: str, delay_ms: float = 0.0):
        current_wall_time = time.time()
        elapsed_ms = (current_wall_time - self._start_time_ref) * 1000.0
        event_time = elapsed_ms + delay_ms
        
        event = SpikeEvent(neuron_id, event_time)
        
        with self._lock:
            self._buffer.append(event)

    def get_events(self, up_to_time_ms: float) -> List[SpikeEvent]:
        ready_events = []
        
        with self._lock:
            while self._buffer and self._buffer[0].timestamp <= up_to_time_ms:
                ready_events.append(self._buffer.popleft())
                
        return ready_events

    @abstractmethod
    def on_start(self):
        pass

    @abstractmethod
    def on_stop(self):
        pass