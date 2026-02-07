from typing import Dict, Any
import struct
from datetime import datetime

class SessionService:
    def __init__(self):
        self.store: Dict[str, Any] = {}

    def save_session(self, result: Dict, runtime):
        session_id = result["session_id"]
        
        # Calculate frame structure for seeking
        pop_sizes = {
            name: len(pop.vars["V"].view) 
            for name, pop in runtime.populations.items()
        }
        
        self.store[session_id] = {
            "file_path": result["voltage_file"],
            "dt": result["dt"],
            "total_neurons": sum(pop_sizes.values()),
            "pop_keys": sorted(pop_sizes.keys()),
            "pop_sizes": pop_sizes,
            "created_at": datetime.now()
        }

    def get_voltages(self, session_id: str, start_ms: float, end_ms: float):
        if session_id not in self.store: return None
        session = self.store[session_id]
        
        dt = session["dt"]
        start_step = int(start_ms / dt)
        num_steps = int(end_ms / dt) - start_step
        if num_steps <= 0: return []
        
        bytes_per_frame = session["total_neurons"] * 4
        frames = []
        
        try:
            with open(session["file_path"], "rb") as f:
                f.seek(start_step * bytes_per_frame)
                for i in range(num_steps):
                    data = f.read(bytes_per_frame)
                    if len(data) < bytes_per_frame: break
                    
                    values = struct.unpack(f'{session["total_neurons"]}f', data)
                    frame_map = {}
                    offset = 0
                    for pop in session["pop_keys"]:
                        size = session["pop_sizes"][pop]
                        frame_map[pop] = values[offset:offset+size]
                        offset += size
                    
                    frames.append({
                        "time": (start_step + i) * dt,
                        "voltages": frame_map
                    })
        except Exception as e:
            print(f"IO Error: {e}")
            
        return frames