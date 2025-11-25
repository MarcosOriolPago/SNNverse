# GeNN Integration - Quick Start Guide

This guide will help you get started with the GeNN-based backend for SNNverse.

## Prerequisites

1. **Python 3.8+** installed
2. **(Optional) CUDA Toolkit** for GPU acceleration
   - If you don't have CUDA, GeNN will use CPU backend (works fine for small networks)

## Installation Steps

### 1. Install Dependencies

```bash
cd /home/marcos/marcos/snns/SNNverse/back

# Install Python packages
pip install -r requirements.txt

# This includes:
# - fastapi, uvicorn (web framework)
# - python-socketio (WebSocket)
# - pygenn>=5.0.0 (GeNN library)
# - numpy, torch, etc.
```

### 2. Verify GeNN Installation

Test that pygenn is available:

```bash
python -c "import pygenn; print('GeNN version:', pygenn.__version__)"
```

Expected output: `GeNN version: 5.x.x`

If this fails, try:
```bash
pip install --upgrade pygenn
```

### 3. Test the Builder Module

Create a test script `test_genn_builder.py`:

```python
#!/usr/bin/env python3
"""Test GeNN builder with a simple network."""

import sys
sys.path.insert(0, '/home/marcos/marcos/snns/SNNverse/back')

from app.genn_builder import GeNNNetworkBuilder

# Define a simple network
test_payload = {
    "nodes": [
        {"id": "neuron1", "type": "LIF", "params": {"threshold": -55.0, "tau": 20.0}},
        {"id": "neuron2", "type": "LIF", "params": {"threshold": -50.0, "tau": 15.0}},
        {"id": "input1", "type": "PYTHON", "params": {}}
    ],
    "edges": [
        {"source": "input1", "target": "neuron1"},
        {"source": "neuron1", "target": "neuron2"}
    ]
}

print("=" * 60)
print("Testing GeNN Network Builder")
print("=" * 60)

# Build model
builder = GeNNNetworkBuilder()
code_path, model_info = builder.build_from_json(test_payload)

print("\n✓ Model built successfully!")
print(f"\nGenerated code location: {code_path}")
print(f"\nModel info:")
for key, value in model_info.items():
    print(f"  {key}: {value}")

# Load model
builder.load_model()
print("\n✓ Model loaded into memory!")

print("\n" + "=" * 60)
print("SUCCESS: GeNN builder is working!")
print("=" * 60)
```

Run it:
```bash
cd /home/marcos/marcos/snns/SNNverse/back
python test_genn_builder.py
```

Expected output:
```
============================================================
Testing GeNN Network Builder
============================================================
Building GeNN model 'user_network' in /tmp/genn_models_xyz
✓ Model built successfully. Generated code at: /tmp/genn_models_xyz/user_network_CODE

Generated code location: /tmp/genn_models_xyz/user_network_CODE

Model info:
  model_name: user_network
  work_dir: /tmp/genn_models_xyz
  code_path: /tmp/genn_models_xyz/user_network_CODE
  num_neurons: 3
  num_synapses: 2
  dt: 0.1
  neuron_ids: ['neuron1', 'neuron2', 'input1']

Loading GeNN model into memory...
✓ Model loaded successfully.

============================================================
SUCCESS: GeNN builder is working!
============================================================
```

### 4. Test the Simulation Engine

Create a test script `test_genn_simulator.py`:

```python
#!/usr/bin/env python3
"""Test GeNN simulator with a simple network."""

import asyncio
import sys
sys.path.insert(0, '/home/marcos/marcos/snns/SNNverse/back')

from app.genn_builder import GeNNNetworkBuilder
from app.genn_simulator import GeNNSimulationEngine

# Simple test network
test_payload = {
    "nodes": [
        {"id": "n1", "type": "LIF", "params": {"threshold": -55.0, "tau": 20.0}},
        {"id": "n2", "type": "LIF", "params": {"threshold": -50.0, "tau": 15.0}}
    ],
    "edges": [
        {"source": "n1", "target": "n2"}
    ]
}

# Callback to print simulation data
async def print_callback(updates, spikes):
    """Print voltage updates and spikes."""
    voltages = ", ".join([f"{u['id']}={u['voltage']}" for u in updates])
    print(f"[t={engine.sim_time:.1f}ms] {voltages}", end="")
    if spikes:
        print(f" | SPIKES: {', '.join(spikes)}", end="")
    print()

async def main():
    global engine
    
    print("=" * 60)
    print("Testing GeNN Simulation Engine")
    print("=" * 60)
    
    # Build and load model
    print("\n1. Building model...")
    builder = GeNNNetworkBuilder()
    code_path, info = builder.build_from_json(test_payload)
    builder.load_model()
    print(f"   ✓ Model ready ({info['num_neurons']} neurons)")
    
    # Create engine
    print("\n2. Creating simulation engine...")
    engine = GeNNSimulationEngine(builder, print_callback)
    print("   ✓ Engine created")
    
    # Run simulation for 100 steps
    print("\n3. Running simulation (100 timesteps)...")
    print("-" * 60)
    await engine.run(max_timesteps=100)
    print("-" * 60)
    
    print("\n" + "=" * 60)
    print("SUCCESS: GeNN simulator is working!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
```

Run it:
```bash
cd /home/marcos/marcos/snns/SNNverse/back
python test_genn_simulator.py
```

Expected output:
```
============================================================
Testing GeNN Simulation Engine
============================================================

1. Building model...
   ✓ Model ready (2 neurons)

2. Creating simulation engine...
   ✓ Engine created

3. Running simulation (100 timesteps)...
------------------------------------------------------------
🚀 Starting GeNN simulation...
[t=0.1ms] n1=-70.0mV, n2=-70.0mV
[t=0.2ms] n1=-69.5mV, n2=-69.8mV
[t=0.3ms] n1=-68.9mV, n2=-69.5mV
...
[t=10.0ms] n1=-65.2mV, n2=-67.1mV | SPIKES: n1
...
✓ Simulation stopped at t=10.00ms (step 100)
------------------------------------------------------------

============================================================
SUCCESS: GeNN simulator is working!
============================================================
```

### 5. Test the FastAPI Integration

Start the GeNN-enabled backend:

```bash
cd /home/marcos/marcos/snns/SNNverse/back
python -m app.main_genn
```

Expected output:
```
============================================================
🚀 SNNverse Backend with GeNN Integration
============================================================
GeNN Available: True
Server starting on http://0.0.0.0:8000
============================================================
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 6. Test API Endpoints

In another terminal, test the endpoints:

```bash
# Check server status
curl http://localhost:8000/

# Expected: {"status":"online","genn_available":true,"version":"1.0.0-genn"}

# Load a test network
curl -X POST http://localhost:8000/api/network/load_genn \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": [
      {"id": "n1", "type": "LIF", "params": {"threshold": -55.0}},
      {"id": "n2", "type": "LIF", "params": {"threshold": -50.0}}
    ],
    "edges": [
      {"source": "n1", "target": "n2"}
    ]
  }'

# Expected: {"status":"loaded","backend":"genn","model_info":{...}}

# Start simulation
curl -X POST http://localhost:8000/api/simulation/start_genn

# Expected: {"status":"started","backend":"genn"}

# Check simulation state
curl http://localhost:8000/api/simulation/state_genn

# Expected: {"timestep":42,"time_ms":4.2,"neurons":[...]}

# Stop simulation
curl -X POST http://localhost:8000/api/simulation/stop

# Expected: {"status":"stopped"}
```

### 7. Test with Frontend

If you have the React frontend running:

1. **Start backend**:
   ```bash
   cd /home/marcos/marcos/snns/SNNverse/back
   python -m app.main_genn
   ```

2. **Start frontend** (in another terminal):
   ```bash
   cd /home/marcos/marcos/snns/SNNverse/front
   npm start
   ```

3. **In the browser**:
   - Open http://localhost:3000
   - Drag some neuron blocks onto the canvas
   - Connect them with axons
   - Click "Run" button
   - Watch the real-time voltage visualization!

## Troubleshooting

### Problem: `ModuleNotFoundError: No module named 'pygenn'`

**Solution**: Install pygenn
```bash
pip install pygenn
```

### Problem: `CUDA not available` error

**Solution**: Use CPU backend (automatic fallback, no action needed)

Alternatively, explicitly force CPU:
```python
# In genn_builder.py, line 70:
self.model = GeNNModel("float", model_name, backend="single_threaded_cpu")
```

### Problem: Simulation runs but no voltage changes

**Check**:
1. Are neurons receiving input?
2. Add some noise or external current:
   ```python
   # In simulation loop, inject test current
   engine.inject_current("n1", current=10.0)
   ```

### Problem: WebSocket not emitting data

**Check**:
1. Is frontend connected to correct port? (default: 8000)
2. Check browser console for WebSocket errors
3. Verify Socket.IO event names match (`'tick'`)

### Problem: Generated code not found

**Solution**: Check disk space and permissions
```bash
# GeNN generates code in /tmp by default
ls -la /tmp/genn_models_*
```

## Next Steps

1. **Customize neuron models**: Edit `genn_builder.py` to add new neuron types
2. **Add more synaptic dynamics**: Modify synapse creation in `_add_synapse_populations()`
3. **Integrate custom Python functions**: Connect `sandbox.py` execution to `inject_input_genn`
4. **Optimize performance**: Tune `asyncio.sleep()` duration, batch neurons, use GPU

## Performance Notes

### Small networks (< 100 neurons)
- CPU backend is sufficient
- Real-time visualization works smoothly
- Latency: ~50ms per step

### Medium networks (100-10,000 neurons)
- GPU backend recommended (if available)
- May need to reduce WebSocket emission frequency
- Latency: ~10ms per step

### Large networks (> 10,000 neurons)
- GPU backend required
- Use GeNN's spike recording instead of per-step emission
- Latency: <1ms per step

## Architecture Recap

```
User Action (Frontend)
    ↓
POST /api/network/load_genn (Phase 1: Definition)
    ↓
GeNNNetworkBuilder.build_from_json()
    ↓
GeNN generates C++ code (Phase 2: Compilation)
    ↓
POST /api/simulation/start_genn (Phase 3: Execution)
    ↓
GeNNSimulationEngine.run()
    ↓
WebSocket 'tick' events (Phase 4: Visualization)
    ↓
Frontend updates charts in real-time
```

## Files Created

- `back/app/genn_builder.py` - Converts JSON → GeNN model
- `back/app/genn_simulator.py` - Runs simulation loop
- `back/app/main_genn.py` - FastAPI with GeNN endpoints
- `back/GENN_WORKFLOW.md` - Full documentation
- `back/GENN_QUICKSTART.md` - This file
- `back/requirements.txt` - Updated with pygenn

## Support

For issues:
1. Check GeNN documentation: https://genn-team.github.io/genn/
2. Review `GENN_WORKFLOW.md` for detailed explanations
3. Enable debug logging in `genn_builder.py` and `genn_simulator.py`

Happy simulating! 🧠⚡
