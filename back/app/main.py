import asyncio
import random
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from .sandbox import execute_spike_function, test_function_quick
from .schemas import CustomFunctionPayload, FunctionExecutionResult

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
        self.nodes = {} # { id: { voltage, threshold, tau, targets: [], type, custom_function } }
        self.dt = 0.1
        self.sim_time = 0.0  # Track simulation time

    def load_graph(self, payload: NetworkPayload):
        self.running = False
        self.nodes = {}
        self.sim_time = 0.0
        
        # Init Nodes
        for n in payload.nodes:
            node_type = n.type
            custom_func = n.params.get("custom_function", None) if node_type == "PYTHON" else None
            self.nodes[n.id] = {
                "v": -70.0,
                "thresh": float(n.params.get("threshold", -55.0)),
                "tau": float(n.params.get("tau", 2.0)),
                "targets": [],
                "type": node_type,
                "custom_function": custom_func
            }
            if node_type == "PYTHON":
                if custom_func:
                    print(f"  ✓ Loaded PYTHON node {n.id} with custom function")
                else:
                    print(f"  ⚠ WARNING: PYTHON node {n.id} has NO custom function!")

        # Init Edges (Adjacency List)
        for e in payload.edges:
            if e.source in self.nodes and e.target in self.nodes:
                self.nodes[e.source]["targets"].append(e.target)
        
        print(f"Graph loaded: {len(self.nodes)} nodes")

    async def run(self):
        self.running = True
        self.sim_time = 0.0
        print("Sim Started")
        
        # Reduce emission frequency for efficiency
        tick_counter = 0
        EMIT_EVERY_N_TICKS = 2  # Only emit every 2nd tick (adjustable)
        
        while self.running:
            updates = []
            spikes = []
            
            # 1. Calculate Physics for all nodes
            # (In a real scenario, use Matrix operations with NumPy/PyTorch for speed)
            current_state_snapshot = {k: v["v"] for k,v in self.nodes.items()}

            for nid, neuron in self.nodes.items():
                node_type = neuron.get("type", "LIF")
                
                # Handle custom Python input nodes
                if node_type == "PYTHON" and neuron.get("custom_function"):
                    try:
                        success, should_spike, error = execute_spike_function(
                            code=neuron["custom_function"],
                            time_value=self.sim_time,
                            context={"node_id": nid, "dt": self.dt},
                            timeout_seconds=0.1  # Shorter timeout for simulation
                        )
                        
                        if success and should_spike:
                            spikes.append(nid)
                            # Propagate to targets
                            for target_id in neuron["targets"]:
                                if target_id in self.nodes:
                                    self.nodes[target_id]["v"] += 10.0
                            
                            updates.append({"id": nid, "voltage": "SPIKE"})
                        else:
                            updates.append({"id": nid, "voltage": "idle"})
                            
                    except Exception as e:
                        print(f"Error executing custom function for {nid}: {e}")
                        updates.append({"id": nid, "voltage": "ERROR"})
                
                # Handle standard LIF neurons
                else:
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

            # 2. Emit (only every N ticks to reduce load)
            tick_counter += 1
            should_emit = tick_counter % EMIT_EVERY_N_TICKS == 0
            
            if should_emit and (updates or spikes):
                if spikes:
                    print(f"⚡ Emitting spikes: {spikes}")
                await sio.emit('tick', {'neurons': updates, 'spikes': spikes})

            self.sim_time += self.dt
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

@app.post("/api/input/execute")
async def execute_input_function(payload: CustomFunctionPayload) -> FunctionExecutionResult:
    """
    Execute a custom Python function and return whether it generates a spike.
    This is for testing/preview, not part of the main simulation loop.
    """
    success, message = test_function_quick(payload.function_code)
    
    if success:
        # Extract spike status from message
        spike = "SPIKE" in message
        return FunctionExecutionResult(
            success=True,
            spike=spike,
            error=None,
            message=message
        )
    else:
        return FunctionExecutionResult(
            success=False,
            spike=None,
            error=message,
            message=f"Function execution failed: {message}"
        )

@app.get("/api/simulation/state")
async def get_simulation_state():
    """
    Polling endpoint: returns current state of all neurons.
    Alternative to socket.io for reduced overhead.
    """
    if not engine.nodes:
        return {"neurons": [], "running": engine.running}
    
    neurons = [
        {"id": node_id, "voltage": f"{data['v']:.1f}mV"}
        for node_id, data in engine.nodes.items()
    ]
    
    return {
        "neurons": neurons,
        "running": engine.running,
        "time": engine.sim_time
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)