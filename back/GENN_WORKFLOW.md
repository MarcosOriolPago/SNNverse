# GeNN Integration Workflow

This document describes the complete GeNN integration for SNNverse backend.

## Architecture Overview

The GeNN workflow follows a 4-phase pipeline:

```
Frontend (React) → Backend (Python) → GeNN (C++ Code Gen) → Simulation → WebSocket
```

### Phase 1: Definition (The "Blueprint")
**Location**: `genn_builder.py`

**What happens**:
1. User drags nodes in React Frontend and clicks "Run"
2. Frontend sends JSON payload to Python Backend (FastAPI):
   ```json
   {
     "nodes": [
       {"id": "neuron1", "type": "LIF", "params": {"threshold": -55.0, "tau": 20.0}},
       {"id": "neuron2", "type": "IZHIKEVICH", "params": {...}}
     ],
     "edges": [
       {"source": "neuron1", "target": "neuron2"}
     ]
   }
   ```
3. Python Builder Script (`GeNNNetworkBuilder`):
   - Imports `pygenn`
   - Calls `model.add_neuron_population(...)` for each node
   - Calls `model.add_synapse_population(...)` for each edge
   - Calls `model.build()` ← **Crucial Step**

**Inside `model.build()`**:
- GeNN analyzes your network description
- Generates C++ source files on disk (in `user_network_CODE/` folder):
  - `definitions.h` (headers)
  - `runner.cpp` (simulation loop logic)
  - CUDA kernels (if using GPU backend)

**Result**: A folder full of C++ code specific to the user's network.

### Phase 2: Compilation (The "Factory")
**Status**: Currently handled by GeNN internally via PyBind11

**What happens**:
- GeNN's `model.load()` compiles generated C++ code
- Creates shared object library (`.so` or `.dll`)
- Links it into Python process

**Future Enhancement** (Optional):
For explicit C++ runner separation, you could:
1. Extract generated code
2. Compile with: `g++ -shared -fPIC -o lib_user_network.so ...`
3. Load dynamically with `dlopen()` in C++ runner

### Phase 3: Execution (The "Runner")
**Location**: `genn_simulator.py`

**What happens**:
1. Python Backend starts `GeNNSimulationEngine`
2. Simulation loop:
   ```python
   while running:
       model.step_time()           # Advance physics by 1 timestep (0.1ms)
       pull_state_from_device()    # GPU → CPU
       extract_data()              # Read voltages, detect spikes
       emit_to_websocket()         # Stream to frontend
   ```
3. Real-time streaming at ~20Hz (adjustable)

### Phase 4: Visualization (The "View")
**Location**: Frontend (existing WebSocket handlers)

**What happens**:
- Frontend listens to WebSocket `'tick'` events
- Receives voltage data: `{neurons: [{id, voltage}, ...], spikes: [...]}`
- Updates charts/graphs in real-time (60fps)
- Triggers spike animations along axons

## File Structure

```
back/
├── app/
│   ├── genn_builder.py       # Phase 1: Network definition → GeNN model
│   ├── genn_simulator.py     # Phase 3: Simulation execution
│   ├── main_genn.py          # FastAPI integration
│   ├── main.py               # Original (fallback) engine
│   ├── sandbox.py            # Custom Python function execution
│   └── schemas.py            # Pydantic models
├── genn/                      # GeNN library (submodule or installation)
└── GENN_WORKFLOW.md          # This file
```

## API Endpoints

### 1. Load Network (Phase 1)
```http
POST /api/network/load_genn
Content-Type: application/json

{
  "nodes": [...],
  "edges": [...]
}

Response:
{
  "status": "loaded",
  "backend": "genn",
  "model_info": {
    "model_name": "user_network",
    "work_dir": "/tmp/genn_models_xyz",
    "code_path": "/tmp/genn_models_xyz/user_network_CODE",
    "num_neurons": 3,
    "num_synapses": 2,
    "dt": 0.1,
    "neuron_ids": ["neuron1", "neuron2", "input1"]
  }
}
```

### 2. Start Simulation (Phase 3)
```http
POST /api/simulation/start_genn?max_steps=1000

Response:
{
  "status": "started",
  "backend": "genn"
}
```

### 3. Stop Simulation
```http
POST /api/simulation/stop

Response:
{
  "status": "stopped"
}
```

### 4. Get Current State
```http
GET /api/simulation/state_genn

Response:
{
  "timestep": 452,
  "time_ms": 45.2,
  "neurons": [
    {"id": "neuron1", "voltage": -68.3},
    {"id": "neuron2", "voltage": -55.1, "u": 2.3}
  ]
}
```

### 5. Inject Input (for Custom Python Functions)
```http
POST /api/input/inject_genn?node_id=input1&spike=true

Response:
{
  "status": "injected",
  "node_id": "input1",
  "spike": true,
  "current": 0.0
}
```

## WebSocket Events

### Client → Server
```javascript
// Connect
socket.connect()

// Disconnect
socket.disconnect()
```

### Server → Client
```javascript
// Simulation tick (emitted every 50ms)
socket.on('tick', (data) => {
  // data = {
  //   neurons: [{id: "neuron1", voltage: "-68.3mV"}, ...],
  //   spikes: ["neuron1", "input1"]
  // }
})
```

## Neuron Models Supported

### 1. LIF (Leaky Integrate-and-Fire)
```json
{
  "id": "n1",
  "type": "LIF",
  "params": {
    "threshold": -55.0,      // mV (Vthresh)
    "reset": -70.0,          // mV (Vreset)
    "tau": 20.0,             // ms (TauM - membrane time constant)
    "rest": -70.0,           // mV (Vrest)
    "capacitance": 1.0,      // nF (C) - optional, default 1.0
    "ioffset": 0.0,          // nA (Ioffset) - optional, default 0.0
    "tau_refrac": 2.0        // ms (TauRefrac) - optional, default 2.0
  }
}
```

GeNN built-in model: `"LIF"` (requires 7 parameters: C, TauM, Vrest, Vreset, Vthresh, Ioffset, TauRefrac)

### 2. Izhikevich
```json
{
  "id": "n2",
  "type": "IZHIKEVICH",
  "params": {
    "a": 0.02,
    "b": 0.2,
    "c": -65.0,
    "d": 8.0
  }
}
```

GeNN built-in model: `"Izhikevich"`

### 3. Custom Python Input (Spike Source)
```json
{
  "id": "input1",
  "type": "PYTHON",
  "params": {
    "custom_function": "def spike_function(t, ctx): return t % 100 < 10"
  }
}
```

Implemented as `SpikeSourceArray` with dynamic spike injection.

## Custom Python Functions

For input nodes with custom Python logic:

1. **During Build**: Node marked as `PYTHON` type
2. **During Simulation**:
   - Python function executed each timestep
   - If returns `True` → inject spike via `inject_input_genn`
   - If returns `False` → no action

Example integration:
```python
# In simulation loop
for node_id, node_data in custom_python_nodes.items():
    success, should_spike, error = execute_spike_function(
        code=node_data["custom_function"],
        time_value=sim_time,
        context={"node_id": node_id}
    )
    
    if success and should_spike:
        genn_manager.inject_input(node_id, spike=True)
```

## Installation

### Prerequisites
```bash
# 1. Install GeNN (requires CUDA for GPU support)
pip install pygenn

# Or build from source:
cd back/genn
make
pip install -e .

# 2. Install Python dependencies
cd back
pip install -r requirements.txt
```

### Requirements
Add to `requirements.txt`:
```
pygenn>=5.0.0
```

## Running the Server

### Option 1: Use New GeNN Backend
```bash
cd back
python -m app.main_genn
```

### Option 2: Keep Original (Fallback) Backend
```bash
cd back
python -m app.main
```

The GeNN backend gracefully falls back to the original simulation engine if `pygenn` is not installed.

## Development Workflow

### Testing Locally

1. **Build a test network**:
```python
from app.genn_builder import GeNNNetworkBuilder

payload = {
    "nodes": [
        {"id": "n1", "type": "LIF", "params": {"threshold": -55.0}},
        {"id": "n2", "type": "LIF", "params": {"threshold": -50.0}}
    ],
    "edges": [
        {"source": "n1", "target": "n2"}
    ]
}

builder = GeNNNetworkBuilder()
code_path, info = builder.build_from_json(payload)
print(f"Generated code at: {code_path}")
```

2. **Inspect generated code**:
```bash
ls -la /tmp/genn_models_*/user_network_CODE/
# See: definitions.h, runner.cpp, etc.
```

3. **Run simulation**:
```python
builder.load_model()

from app.genn_simulator import GeNNSimulationEngine

async def print_callback(updates, spikes):
    print(f"Voltages: {updates}")
    if spikes:
        print(f"Spikes: {spikes}")

engine = GeNNSimulationEngine(builder, print_callback)
await engine.run(max_timesteps=100)
```

## Performance Considerations

### CPU vs GPU
- **CPU Backend**: `backend="single_threaded_cpu"`
  - Good for small networks (<1000 neurons)
  - No CUDA required
  - Easier debugging

- **GPU Backend**: Default (auto-selects CUDA if available)
  - Scales to millions of neurons
  - Requires NVIDIA GPU + CUDA
  - Much faster for large networks

### Optimization Tips
1. **Batch neurons**: Group similar neurons into populations
2. **Sparse connectivity**: Use `SynapseMatrixType.SPARSE` for large sparse networks
3. **Reduce WebSocket frequency**: Increase `asyncio.sleep()` in simulation loop
4. **Use recording system**: GeNN's built-in spike recording (see `spike_recording_enabled`)

## Troubleshooting

### Issue: `pygenn` import fails
```
ImportError: No module named 'pygenn'
```
**Solution**: Install pygenn: `pip install pygenn`

### Issue: CUDA not found
```
RuntimeError: CUDA backend not available
```
**Solution**: Use CPU backend explicitly:
```python
model = GeNNModel("float", "model_name", backend="single_threaded_cpu")
```

### Issue: Generated code not found
```
FileNotFoundError: user_network_CODE not found
```
**Solution**: Check that `model.build()` completed successfully. Look for compilation errors in console.

### Issue: Simulation too slow
**Solution**: 
1. Increase `asyncio.sleep()` duration in `genn_simulator.py`
2. Use GPU backend
3. Reduce emission frequency (`EMIT_EVERY_N_TICKS`)

## Future Enhancements

### 1. Dynamic C++ Runner (Optional)
Currently, GeNN loads into Python process via PyBind11. For complete separation:

```cpp
// dynamic_runner.cpp
#include <dlfcn.h>

int main(int argc, char* argv[]) {
    void* lib = dlopen(argv[1], RTLD_NOW);
    
    auto init = (void(*)()) dlsym(lib, "runner_init");
    auto step = (void(*)()) dlsym(lib, "runner_step");
    
    init();
    while (true) {
        step();
        // Read memory, serialize, send to WebSocket
    }
}
```

Compile: `g++ -o dynamic_runner dynamic_runner.cpp -ldl`

Run: `./dynamic_runner ./lib_user_network.so`

### 2. Recording System
Enable GeNN's built-in spike recording:

```python
pop.spike_recording_enabled = True
model.load(num_recording_timesteps=1000)

# After simulation
model.pull_recording_buffers_from_device()
spike_times, spike_ids = pop.spike_recording_data[0]
```

### 3. Multi-Batch Simulations
Run multiple parameter configurations simultaneously:

```python
model.batch_size = 512  # 512 parallel simulations

# All neurons duplicated 512 times
# Useful for parameter sweeps, training
```

### 4. Custom Neuron Models
Define custom models in C++ code strings:

```python
from pygenn import create_neuron_model

custom_model = create_neuron_model(
    "my_custom_model",
    params=["a", "b"],
    vars=[("V", "scalar"), ("U", "scalar")],
    sim_code="""
    V += (0.04*V*V + 5*V + 140 - U + Isyn) * DT;
    U += a*(b*V - U) * DT;
    if (V >= 30) {
        V = c;
        U += d;
    }
    """
)

pop = model.add_neuron_population("pop", 100, custom_model, {...}, {...})
```

## Summary

| Phase | Component | Input | Output | Role |
|-------|-----------|-------|--------|------|
| 1. Definition | `genn_builder.py` | JSON network | C++ code | **Architect** (draws blueprints) |
| 2. Compilation | GeNN internals | C++ code | `.so` library | **Engineer** (builds machine) |
| 3. Execution | `genn_simulator.py` | Model | Spike/voltage data | **Operator** (runs machine) |
| 4. Visualization | Frontend | WebSocket stream | Real-time charts | **Display** (shows results) |

The system is fully modular and can fallback to the original Python-based simulation if GeNN is unavailable.
