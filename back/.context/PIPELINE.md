# Data Flow Pipelines

There are two primary pipelines in the system: Offline (Batch) execution, and Real-Time execution.

## 1. Offline Execution Pipeline

The offline pipeline allows the user to simulate an arbitrary length of time (e.g., 2000ms) instantly, and then play it back scrubbably on the frontend.

### Step 1: Network Compilation
1. **Frontend**: Sends JSON graph data to `POST /api/network/load_genn`.
2. **API (`routes.py`)**: Parses into `schemas.NetworkPayload` and calls `simulation_manager.load_network(...)`.
3. **Manager (`manager.py`)**: Converts dicts into strict `core.types.NetworkConfig`.
4. **Manager**: Hashes the config to check if a compiled binary exists.
5. **Builder (`builder.py`)**: `builder.build(network_config)`
   - Translates Nodes to PyGeNN Populations
   - Translates Edges to PyGeNN Synapses
   - Generates C++ code and compiles the binary using PyGeNN `model.build()`.
6. **Manager**: Returns success to Frontend.

### Step 2: Batch Execution
1. **Frontend**: Calls `POST /api/simulation/run_offline` with `duration_ms` and `dt`.
2. **API**: Calls `simulation_manager.run_offline(duration, dt)`.
3. **Manager**: 
   - Tells `builder.py` to load the compiled DLL (`builder.load(chunk_size)`).
   - Instantiates `OfflineRuntime`.
   - Generates batch spikes via `SpikeInputFx` adapters (which use `generate_batch()` to evaluate the python script for the entire simulation duration ahead of time).
   - Copies these spikes to the GeNN `SpikeSourceArray` memory.
4. **Runtime (`runtime.py`)**: `runtime.run()`
   - Loops for `total_steps = duration / dt`.
   - Steps the physics (`model.step_time()`).
   - Every **timestep**: Pulls voltage `V` for all neurons directly from the device view and writes it to a binary TempFile.
   - Slices spike data automatically collected in GeNN recording buffers.
   - Returns a `SimulationResult` containing the binary path and recorded spikes.
5. **Manager**: Saves the File Path in `self.sessions[session_id]` and returns the session to the Frontend.

### Step 3: Playback Fetching
1. **Frontend**: `useOfflinePlayback` hook requests overlapping chunks via `GET /api/simulation/{id}/voltages?start=0&end=1000`.
2. **API**: Calls `simulation_manager.get_voltages(...)`.
3. **Manager**: 
   - Looks up the session metadata.
   - Calculates the byte offset using the simulation `dt` and `total_neurons`.
   - Uses `f.seek()` to jump to the right frame and extracts the chunk.
4. **Frontend**: Renders the animation.


## 2. Real-Time Execution Pipeline

The real-time pipeline runs continuously and responds to user input live.

1. **Manager**: `start_simulation()` creates `RealTimeRuntime`.
2. **Manager**: Instantiates any dynamic `InputAdapters` (Keyboard, Serial, Python script).
3. **Manager**: Plugs a WebSocket broadcast callback into the Runtime.
4. **Runtime (`runtime.py`)**: Spawns a background Thread `_run_loop()`.
   - **Physics Loop**: Calls `model.step_time()`.
   - **Input Sync**: Checks all `InputAdapters` for active spikes at the current ms and immediately forces the target neuron's voltage.
   - **Timing**: Measures elapsed wall-time, sleeps if it ran faster than real-time `dt`.
   - **Emission**: Throttled every 20ms, it pulls current Voltage `view` and recent Spikes, calling the WebSocket callback.
5. **Manager**: Receives data from callback, broadcasts over `self.active_sockets`.
