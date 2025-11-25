# Template-Based C++ Runner

## Overview

The SNNverse backend uses a **template-based C++ runner** approach to run GeNN models. This solves the problem of accessing GeNN's internal "merged groups" architecture by compiling a custom runner together with the generated GeNN code.

## Why Template-Based?

### The Problem
GeNN's code generation uses an internal "merged groups" architecture where neuron state variables are not exposed as simple global symbols. Trying to dynamically load and access the `.so` library fails because:
- State variable arrays (`neuron1_V`, etc.) are not generated
- Internal `MergedNeuronUpdateGroup` structures require initialization
- Arrays must be registered via `pushMergedNeuronUpdateGroup0ToDevice()` before use

### The Solution
Instead of dynamic loading, we:
1. **Generate** a custom C++ runner from a template during model build
2. **Customize** the runner with model-specific variable access code
3. **Compile** the runner together with the GeNN model code
4. Result: A standalone executable with direct access to all variables

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (React)                                        │
│   Sends network configuration                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Backend (Python/FastAPI)                                │
│   1. genn_builder.py builds GeNN model                 │
│   2. Generates customized runner.cpp from template     │
│   3. Compiles runner with GeNN code → network_runner   │
│   4. Launches network_runner subprocess                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Compiled Runner (C++ executable)                        │
│   - Loads GeNN model (compiled in)                     │
│   - Listens on TCP port 9001 for input                 │
│   - Streams output via WebSocket port 9002             │
│   - Runs simulation loop                                │
└─────────────────────────────────────────────────────────┘
```

## Build Process

### Step 1: GeNN Model Generation
```python
# In genn_builder.py
model = GeNNModel("float", "user_network", backend="single_threaded_cpu")
model.add_neuron_population("neuron1", 1, "LIF", params, init)
model.build()  # Generates C++ code in user_network_CODE/
```

### Step 2: Template Customization
```python
# Read template
template = open("cpp_runner/runner_template.cpp").read()

# Generate model-specific code
state_vars = ["float* neuron1_V;", "float* neuron1_RefracTime;"]
allocate_code = ["neuron1_V = new float[1];", "neuron1_V[0] = -70.0f;"]
push_code = ["pushMergedNeuronUpdateGroup0ToDevice(0, neuron1_RefracTime, neuron1_V);"]
emit_code = ['neurons.push_back({{"id", "neuron1"}, {"v", neuron1_V[0]}});']

# Replace placeholders
runner_code = template.replace("{TEMPLATE_STATE_VARS}", "\n".join(state_vars))
runner_code = runner_code.replace("{TEMPLATE_ALLOCATE_VARS}", "\n".join(allocate_code))
# ... etc
```

### Step 3: Compilation
```cmake
# Generated CMakeLists.txt
add_executable(network_runner
    runner.cpp       # Customized runner
    init.cc          # GeNN initialization
    neuronUpdate.cc  # GeNN neuron updates
    synapseUpdate.cc # GeNN synapse updates
    runner.cc        # GeNN runner code
)
```

Compilation happens automatically during model build:
```bash
cd user_network_CODE/build
cmake ..
make -j4
# → network_runner executable
```

## Runtime Behavior

### Initialization Sequence
1. Runner loads (code compiled in)
2. Allocates state variable arrays
3. Registers arrays with GeNN merged groups
4. Calls GeNN `allocateMem()` and `initialize()`
5. Starts WebSocket server (port 9002)
6. Starts TCP input server (port 9001)
7. Enters simulation loop

### Simulation Loop
```cpp
while (running) {
    // Step simulation
    stepTime(timestep, 1);
    timestep++;
    
    // Pull state from GPU (if GPU backend)
    if (backend == GPU) pullStateFromDevice();
    
    // Access state variables directly
    float v = neuron1_V[0];
    
    // Emit updates via WebSocket
    if (timestep % 200 == 0) {
        emit_state();  // Sends voltage/spike data
    }
}
```

### TCP Input Handling
The runner accepts JSON commands via TCP:
```json
{"type": "spike", "neuron_id": "neuron1", "time": 100.5}
{"type": "current", "neuron_id": "neuron1", "value": 5.0}
{"type": "stop"}
```

## Docker Compatibility

✅ **Perfect for Docker!**

The template approach works seamlessly in containers because:
1. **All compilation happens at build time** within the container
2. **No dynamic loading issues** - everything is statically linked
3. **Self-contained executable** - no external dependencies on GeNN internals
4. **Works with CPU-only builds** (GENN_CPU_ONLY=1)

### Dockerfile Integration
```dockerfile
FROM ubuntu:20.04

# Install GeNN
ENV GENN_PATH=/opt/genn
ENV GENN_CPU_ONLY=1
RUN git clone https://github.com/genn-team/genn.git ${GENN_PATH}
RUN cd ${GENN_PATH} && python3 setup.py develop

# Copy SNNverse backend
COPY back/app /app/app
COPY back/cpp_runner /app/cpp_runner

# At runtime:
# 1. Backend builds model (generates + compiles runner)
# 2. Backend launches network_runner executable
# 3. Runner connects to input providers and frontend
```

## Template Placeholders

The `runner_template.cpp` file contains these placeholders:

| Placeholder | Replaced With | Example |
|------------|---------------|---------|
| `{NEURON_METADATA_JSON}` | JSON metadata | `{"neurons": [{"id": "neuron1", ...}]}` |
| `{TEMPLATE_STATE_VARS}` | Variable declarations | `float* neuron1_V;` |
| `{TEMPLATE_ALLOCATE_VARS}` | Allocation code | `neuron1_V = new float[1];` |
| `{TEMPLATE_PUSH_VARS}` | Register with GeNN | `pushMergedNeuronUpdateGroup0ToDevice(...)` |
| `{TEMPLATE_PULL_STATE}` | GPU sync (if needed) | `pullStateFromDevice();` |
| `{TEMPLATE_EMIT_CODE}` | State variable access | `neurons.push_back({{"id", "neuron1"}, {"v", neuron1_V[0]}});` |

## File Locations

```
back/
├── app/
│   └── genn_builder.py              # Generates and compiles runner
├── cpp_runner/
│   └── runner_template.cpp          # Template source
└── /tmp/genn_models_xyz/
    └── user_network_CODE/
        ├── runner.cpp               # Generated (customized)
        ├── CMakeLists.txt           # Generated
        ├── build/
        │   └── network_runner       # Compiled executable ✓
        ├── init.cc                  # GeNN generated
        ├── neuronUpdate.cc          # GeNN generated
        └── runner.cc                # GeNN generated
```

## Advantages

1. **No GeNN source modifications needed** ✅
2. **Works with any GeNN backend** (CPU/CUDA/HIP) ✅
3. **Docker-friendly** (self-contained) ✅
4. **Direct variable access** (no dynamic loading issues) ✅
5. **Type-safe** (compiled together) ✅
6. **Fast** (no runtime overhead) ✅

## Neuron Type Support

The template generator handles different neuron types:

### LIF Neurons
```cpp
// Variables: V (voltage), RefracTime (refractory period)
float* neuron1_V;
float* neuron1_RefracTime;
```

### Izhikevich Neurons
```cpp
// Variables: V (voltage), U (recovery variable)
float* neuron1_V;
float* neuron1_U;
```

Additional neuron types can be added by extending `_generate_custom_runner()` in `genn_builder.py`.

## Future Enhancements

1. **Spike injection**: Implement TCP commands to inject spikes
2. **Current injection**: Set Ioffset dynamically
3. **Multi-neuron populations**: Support populations with > 1 neuron
4. **Recording**: Add spike/voltage recording to file
5. **Performance tuning**: Optimize simulation loop

## Comparison with Alternatives

| Approach | GeNN Modification | Docker Support | Complexity |
|----------|------------------|----------------|------------|
| **Template Runner** | None ✅ | Perfect ✅ | Medium |
| Dynamic .so Loading | Needs custom GeNN | Poor ❌ | High |
| Python Runner | None ✅ | Good ⚠️ | Low |
| Shared PyGeNN | None ✅ | Good ⚠️ | Low |

The template approach is the best balance of performance, compatibility, and maintainability for a production Docker deployment.
