# Core Types

To avoid ambiguous passing of raw dictionaries (`Dict[str, Any]`), the application uses strict dataclasses defined in `core/types.py`. These act as the fundamental contracts between system modules.

## Payload Schemas (`api/schemas.py`)
These are PyDantic models used exclusively by the FastAPI routing layer to validate incoming request data. 

* `NetworkPayload`: Validates the `nodes` and `edges` JSON payload from the React Flow frontend.
* `OfflineConfigPayload`: Validates configuration params like `duration` and `dt`.

## Domain Contracts (`core/types.py`)

### 1. Model Definition (Frontend -> Builder)

**`NetworkConfig`**
The top-level configuration detailing an entire simulation topology. Contains lists of `NodeConfig` and `EdgeConfig`.

**`NodeConfig`**
* `id`: the frontend UUID.
* `type`: The component logic type (`LIF`, `SPIKE_FX`, etc).
* `params`: Key/Value dictionary of hyper-parameters (e.g. `tau`, `threshold`).

### 2. Builder Output (Builder -> Manager)

**`PopulationInfo`**
Metadata about a GeNN population instantiated by the Builder.
* `name`: Sanitized C++ variable name used internally by GeNN.
* `original_id`: The frontend UUID it maps to.
* `neuron_type`: The GeNN class type.
* `has_voltage`: Boolean. Used by the Runtime to know if it can read `.vars['V']`.

**`BuildResult`**
Returned by the GeNNBuilder after converting a NetworkConfig into C++ code.
* `model_id`: The hash used for the folder.
* `code_path`: Path to the compiled C++ code.
* `populations`: Dictionary of `PopulationInfo` mapping original IDs to their GeNN metadata.

### 3. Runtime Output (Runtime -> Manager)

**`SimulationResult`**
Returned by the OfflineRuntime after a batch execution completes.
* `session_id`: Unique playback identifier.
* `voltage_file`: Absolute path to the binary string holding raw floats of voltage data.
* `spike_data`: Dictionary containing sorted timestamps and neuron ID indices of all generated spikes.
* `steps_run`: Total timestep count (used for binary file seeking calculations).

### 4. Playback Output (Manager -> Frontend)

**`SessionInfo`**
Stored in memory by the Manager to track offline playback sessions.
* Tracks `total_neurons`, `file_path`, and `pop_sizes` to accurately calculate `f.seek()` binary offset leaps.

**`VoltageFrame`**
A single timestep of voltage data requested by the frontend playback cursor.
* `time`: the exact simulation ms.
* `voltages`: Dict mapping population names to an array of current voltages for every neuron inside that population.
