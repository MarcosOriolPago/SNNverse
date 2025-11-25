# SNNverse Backend Architecture

## Overview

The SNNverse backend uses a **modular architecture** where:
1. **Backend API** (FastAPI) orchestrates all processes
2. **GeNN Builder** compiles neural network models to C++
3. **C++ Runner** executes models at maximum speed
4. **Input Providers** inject data from various sources (Python, sensors, files)
5. **WebSocket** streams results to frontend

This design allows the C++ network to run indefinitely, accepting input from anywhere, without being tied to Python.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│                                                              │
│  • Network Designer                                          │
│  • Visualization                                             │
│  • Python Code Editor                                        │
└───────────────┬──────────────────────────────────────────────┘
                │
                │ WebSocket: Network Config + Start Command
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API (FastAPI + SocketIO)                │
│                                                              │
│  1. Receive network configuration                            │
│  2. Build GeNN model → /tmp/model_CODE/                     │
│  3. Launch C++ runner process                                │
│  4. Launch input provider process                            │
│  5. Monitor and manage processes                             │
└────────┬──────────────────────┬──────────────────────────────┘
         │                      │
         │                      │
         ▼                      ▼
┌──────────────────┐    ┌──────────────────┐
│  C++ Runner      │    │ Input Provider   │
│  (subprocess)    │◄───┤  (subprocess)    │
│                  │    │                  │
│  • Port 9002 WS  │    │  • Python sandbox│
│  • Port 9001 TCP │    │  • Sensor driver │
│  • Runs model    │    │  • File reader   │
│  • Indefinite    │    │  • etc.          │
└────────┬─────────┘    └──────────────────┘
         │
         │ Voltage + Spikes
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│                     Real-time Visualization                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Backend API (`back/app/main.py`)

**Responsibilities**:
- Receive network configuration from frontend via WebSocket
- Build GeNN model using `genn_builder.py`
- Launch and monitor C++ runner subprocess
- Launch and monitor input provider subprocess
- Handle stop/restart commands
- Manage process lifecycle

**Key Endpoints**:
```python
POST /api/network/start_with_input
{
  "network": {"nodes": [...], "edges": [...]},
  "input_config": {"type": "python", "code": "..."}
}

POST /api/network/stop
POST /api/network/status
```

### 2. GeNN Builder (`back/app/genn_builder.py`)

**Responsibilities**:
- Convert JSON network definition to GeNN model
- Auto-detect CPU vs GPU backend
- Compile model to C++ code
- Export backend metadata

**Output**:
- `/tmp/genn_models_xyz/user_network_CODE/`
  - `librunner.so` - Compiled model
  - `backend_info.json` - Backend metadata
  - `neuron_metadata.json` - Neuron info

### 3. C++ Runner (`back/cpp_runner/genn_streaming_runner.cpp`)

**Responsibilities**:
- Load compiled GeNN model (`librunner.so`)
- Initialize simulation
- **Listen on TCP port 9001** for input commands
- Run simulation loop continuously
- **Send output to WebSocket port 9002**
- Respond to stop signal

**Input Format** (TCP, JSON):
```json
{"type": "spike", "neuron_id": "input1", "time": 100.5}
{"type": "current", "neuron_id": "neuron1", "value": 5.0}
```

**Output Format** (WebSocket, JSON):
```json
{"type": "spike", "t": 15.3, "ids": ["n1"]}
{"type": "voltage", "t": 20.0, "neurons": [{...}]}
```

### 4. Input Provider (Modular)

**Base Interface** (`back/app/input_provider.py`):
```python
class InputProvider(ABC):
    @abstractmethod
    def connect(self, host: str, port: int): ...
    
    @abstractmethod
    def send_spike(self, neuron_id: str, time: float): ...
    
    @abstractmethod
    def send_current(self, neuron_id: str, value: float): ...
    
    @abstractmethod
    def run(self): ...  # Main loop
    
    @abstractmethod
    def stop(self): ...
```

**Implementations**:

#### Python Input Generator (`python_input_generator.py`)
- Executes user's Python code in sandbox
- Converts output to spikes/currents
- Sends to C++ runner via TCP

#### Sensor Input Provider (future)
- Reads from GPIO/serial/USB
- Converts sensor data to spikes
- Real-time data injection

#### File Input Provider (future)
- Reads spike times from file
- Plays back recorded data

### 5. Process Manager (`back/app/process_manager.py`)

**Responsibilities**:
- Launch subprocesses with proper arguments
- Monitor process health
- Capture stdout/stderr for logging
- Handle graceful shutdown
- Restart on failure (optional)

```python
class ProcessManager:
    def start_cpp_runner(self, model_path, ws_port, input_port): ...
    def start_input_provider(self, provider_type, config, input_port): ...
    def stop_all(self): ...
    def get_status(self): ...
```

---

## Communication Protocol

### Input Port (TCP 9001)

**C++ Runner listens**, Input Provider sends:

```json
{"type": "spike", "neuron_id": "input1", "time": 100.5}
{"type": "current", "neuron_id": "neuron1", "value": 5.0, "duration": 10.0}
{"type": "stop"}
```

### Output Port (WebSocket 9002)

**C++ Runner sends**, Frontend receives:

```json
{"type": "metadata", "dt": 0.1, "neurons": [...]}
{"type": "spike", "t": 15.3, "ids": ["n1", "n2"]}
{"type": "voltage", "t": 20.0, "neurons": [{"id": "n1", "v": -68.3}]}
```

---

## Workflow

### Network Startup Sequence

1. **Frontend** sends network configuration + input config
2. **Backend API**:
   - Validates configuration
   - Builds GeNN model (CPU/GPU auto-detected)
   - Launches C++ runner on port 9002
   - Launches input provider
   - Returns process IDs and ports
3. **C++ Runner**:
   - Loads model
   - Listens on TCP 9001 for input
   - Starts WebSocket server on 9002
   - Waits for "start" command
4. **Input Provider**:
   - Connects to C++ runner (TCP 9001)
   - Begins sending spikes/currents
5. **Frontend**:
   - Connects to WebSocket 9002
   - Sends "start" command
   - Receives real-time data

### Network Shutdown Sequence

1. **Frontend** sends stop command
2. **Backend API**:
   - Sends stop signal to input provider
   - Sends stop signal to C++ runner
   - Waits for graceful shutdown (timeout 5s)
   - Force kills if needed
   - Cleans up temp files
3. **Processes** exit cleanly

---

## Benefits

### Modularity
- **Input sources are pluggable**: Python, sensors, files, network streams
- **No changes to C++ runner** when adding new input types
- **Easy testing**: Test each component independently

### Performance
- **C++ runs at full speed**: Not blocked by Python or I/O
- **Separate processes**: Input provider can run on different core/machine
- **Minimal overhead**: TCP has <1ms latency

### Flexibility
- **Multiple inputs**: Can have multiple input providers
- **Hot-swapping**: Stop one provider, start another
- **Real-time sensors**: Direct hardware access without Python GIL

### Scalability
- **Distributed**: Input provider can run on separate machine
- **Load balancing**: Multiple C++ runners for large networks
- **Cloud-ready**: Easy to containerize and deploy

---

## Migration Path

### Phase 1: Cleanup ✅ COMPLETE
- Organized documentation
- Removed obsolete files
- Created docs/ directory

### Phase 2: C++ Modifications (Next)
- Add TCP input listener
- Parse JSON input commands
- Inject spikes/currents into model
- Test standalone

### Phase 3: Backend Orchestration
- Create `process_manager.py`
- Create `input_provider.py` base class
- Create `python_input_generator.py`
- Update `main.py` to use new architecture

### Phase 4: Frontend Integration
- Update WebSocket connection
- Add input configuration UI
- Test end-to-end

---

## File Organization

```
back/
├── app/
│   ├── main.py                   # Main backend entry (orchestrator)
│   ├── genn_builder.py           # GeNN model compilation
│   ├── process_manager.py        # Subprocess management
│   ├── input_provider.py         # Base class for inputs
│   ├── python_input_generator.py # Python sandbox input
│   └── schemas.py                # Pydantic models
│
├── cpp_runner/
│   ├── genn_streaming_runner.cpp # Main C++ runner
│   ├── CMakeLists.txt            # Build config
│   └── build.sh                  # Build script
│
├── docs/
│   ├── architecture.md           # This file
│   ├── cpp-runner.md             # C++ runner details
│   ├── backend-flexibility.md    # CPU/GPU backend switching
│   ├── genn-workflow.md          # GeNN build workflow
│   └── test-results.md           # Test documentation
│
└── run.py                        # Server launcher
```

---

## Next Steps

1. Review and approve this architecture
2. Implement Phase 2: C++ input listener
3. Implement Phase 3: Backend orchestration
4. Test with Python input generator
5. Add sensor input provider
6. Deploy and monitor
