import asyncio
import random
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

# --- 1. Setup ---
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = FastAPI()
sio_app = socketio.ASGIApp(sio, app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. Data Models ---
class NodeDef(BaseModel):
    id: str
    type: str
    params: Dict[str, Any]

class EdgeDef(BaseModel):
    source: str
    target: str

class NetworkPayload(BaseModel):
    nodes: List[NodeDef]
    edges: List[EdgeDef]

# --- 3. Simulation Engine (Simplified Graph) ---
class SimulationEngine:
    def __init__(self):
        self.running = False
        self.nodes = {} # { id: { voltage, threshold, tau, targets: [] } }
        self.dt = 0.1

    def load_graph(self, payload: NetworkPayload):
        self.running = False
        self.nodes = {}
        
        # Init Nodes
        for n in payload.nodes:
            self.nodes[n.id] = {
                "v": -70.0,
                "thresh": float(n.params.get("threshold", -55.0)),
                "tau": float(n.params.get("tau", 2.0)),
                "targets": [] 
            }

        # Init Edges (Adjacency List)
        for e in payload.edges:
            if e.source in self.nodes and e.target in self.nodes:
                self.nodes[e.source]["targets"].append(e.target)
        
        print(f"Graph loaded: {len(self.nodes)} nodes")

    async def run(self):
        self.running = True
        print("Sim Started")
        while self.running:
            updates = []
            spikes = []
            
            # 1. Calculate Physics for all nodes
            # (In a real scenario, use Matrix operations with NumPy/PyTorch for speed)
            current_state_snapshot = {k: v["v"] for k,v in self.nodes.items()}

            for nid, neuron in self.nodes.items():
                # Basic LIF Dynamics: v(t+1) = v(t) + (Rest - v(t))/tau + Input
                # Add random noise as "Input" for visual effect
                noise = random.uniform(0, 5.0)
                
                # Decay
                decay = (current_state_snapshot[nid] - (-70.0)) / neuron["tau"]
                new_v = current_state_snapshot[nid] - decay + noise

                # Fire?
                if new_v >= neuron["thresh"]:
                    spikes.append(nid)
                    new_v = -75.0 # Reset
                    
                    # Propagate spike to targets (Immediate Synapse for demo)
                    # In real SNN, this adds current to target's next step
                    for target_id in neuron["targets"]:
                         if target_id in self.nodes:
                             # Simply boost target voltage for visual effect
                             self.nodes[target_id]["v"] += 5.0 

                self.nodes[nid]["v"] = new_v
                
                # Optimizaton: Only send update if changed significantly
                updates.append({"id": nid, "voltage": f"{new_v:.1f}mV"})

            # 2. Emit
            if updates or spikes:
                await sio.emit('tick', {'neurons': updates, 'spikes': spikes})

            await asyncio.sleep(0.05) # 20Hz refresh

engine = SimulationEngine()

# --- 4. API Routes ---

@app.post("/api/network/load")
async def load_network(payload: NetworkPayload):
    engine.load_graph(payload)
    return {"status": "loaded"}

@app.post("/api/simulation/start")
async def start_sim():
    if not engine.running:
        asyncio.create_task(engine.run())
    return {"status": "started"}

@app.post("/api/simulation/stop")
async def stop_sim():
    engine.running = False
    return {"status": "stopped"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)