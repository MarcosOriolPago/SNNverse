# SpikeVerse Backend Architecture

The SpikeVerse backend handles the execution of User-Defined Spiking Neural Networks via GeNN.

## System Overview

The backend exposes an HTTP/WebSocket API that receives network topologies from the frontend, compiles them into optimized GeNN C++ simulations, executes them, and streams back voltage and spike data.

## Modular Architecture

The codebase follows a clear separation of concerns without over-engineering (no excessive service layers). The data flows unidirectionally from the user down to the simulation.

```
back/app/
├── api/                  # 1. Transport Layer (FastAPI)
│   ├── routes.py         # Thin HTTP endpoints
│   ├── auth.py           # Authentication routes
│   └── schemas.py        # Pydantic data contracts (Payloads)
│
├── core/                 # 2. Business Logic / Orchestration
│   ├── manager.py        # Central Orchestrator (SimulationManager)
│   ├── builder.py        # GeNN C++ Code Generator (GeNNBuilder)
│   ├── runtime.py        # Execution engines (OfflineRuntime, RealTimeRuntime)
│   ├── types.py          # Shared Dataclasses representing core domain objects
│   ├── config.py         # Static configuration constants
│   └── sandbox.py        # Safely executes user provided python scripts
│
└── input/                # 3. Input Data Providers
    ├── base.py           # InputAdapter Base Class
    ├── registry.py       # Auto-discovery registry for inputs
    └── types/            # Concrete input implementations
        ├── spike_input_fx.py   # Python Code (Sandbox) input
        ├── keyboard_input.py   # WebSocket Keyboard Events
        └── serial_input.py     # USB Serial Sensor Events
```

## Layer Responsibilities

1. **API Layer (`api/`)**
   Receives generic HTTP/WS data. Parses it into strict Types via Pydantic (`schemas.py`). Delegates immediately to `manager.py`. It holds ZERO business logic.

2. **Manager (`core/manager.py`)**
   The sole orchestrator. 
   - Receives typed data from the API.
   - Tells `builder.py` to compile the model.
   - Spawns the appropriate runtime (`OfflineRuntime` or `RealTimeRuntime`).
   - Hooks up inputs from the `input/` package to the runtime.
   - Holds active sessions and WebSocket connections.

3. **Builder (`core/builder.py`)**
   Translates a `NetworkConfig` (Nodes, Edges) into a GeNN model.
   - Manages the C++ code generation directory.
   - Only knows about `types.py` classes. Does NOT know about HTTP, WebSockets, or the Manager.

4. **Runtime (`core/runtime.py`)**
   Executes the compiled GeNN model.
   - `OfflineRuntime`: Runs as fast as possible, pulling voltage/spike buffers and saving directly to binary files for playback.
   - `RealTimeRuntime`: Runs in a loop synced to wall-clock time, emitting real-time data to a callback function.

5. **Input Package (`input/`)**
   Provides adapters that convert external signals (keyboard, python code, serial) into `SpikeEvent` objects that the Runtime can ingest.
