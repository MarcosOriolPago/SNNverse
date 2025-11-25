# GeNN Backend Flexibility Implementation

## Overview

The GeNN backend runner system has been enhanced to work flexibly with both CPU and GPU backends. The system automatically detects which backend was used to build the model and adapts its behavior accordingly.

## Key Features

### 1. Automatic Backend Detection
- **Python Model Builder**: Automatically detects CUDA availability using `nvidia-smi`
- **Fallback to CPU**: If CUDA is not available or `GENN_CPU_ONLY=1` is set, uses CPU backend
- **Manual Override**: Can explicitly specify backend via constructor parameter

### 2. Backend Metadata Export
- When a model is built, backend information is exported to `backend_info.json`
- Contains:
  - `backend`: Backend name (e.g., "cuda", "single_threaded_cpu")
  - `backend_type`: Type category ("gpu" or "cpu")
  - `requires_device_sync`: Whether device synchronization is needed

### 3. Runtime Detection in C++ Runner
- Runners read `backend_info.json` on model load
- Automatically adapt behavior based on backend type
- Skip device synchronization calls when using CPU backend

## Architecture

```
┌─────────────────────┐
│  Python Builder     │
│  (genn_builder.py)  │
│                     │
│  1. Detect CUDA     │
│  2. Select backend  │
│  3. Build model     │
│  4. Export metadata │
└──────────┬──────────┘
           │
           │ backend_info.json
           ▼
┌─────────────────────┐
│  C++ Runner         │
│  (streaming/ws)     │
│                     │
│  1. Read metadata   │
│  2. Detect backend  │
│  3. Adapt behavior  │
└─────────────────────┘
```

## Files Modified

### Python Side
- **`back/app/genn_builder.py`**
  - Added `backend` parameter to constructor (default: "auto")
  - Added `_select_backend()` method for automatic detection
  - Added `_export_backend_metadata()` to create `backend_info.json`
  - Backend is now passed to `GeNNModel()` constructor

### C++ Side
- **`back/cpp_runner/genn_streaming_runner.cpp`**
  - Added `BackendType` enum (CPU, GPU, UNKNOWN)
  - Added `backend_type` and `requires_device_sync` member variables
  - Added `detect_backend()` method to read metadata
  - Wrapped all `pullStateFromDevice()` calls with backend checks

- **`back/cpp_runner/genn_websocket_runner.cpp`**
  - Same changes as streaming runner for consistency

## Usage Examples

### Python: Building Models with Different Backends

```python
from genn_builder import GeNNNetworkBuilder

# Auto-detect backend (CUDA if available, else CPU)
builder = GeNNNetworkBuilder(backend="auto")
code_path, info = builder.build_from_json(network_payload)
print(f"Using backend: {info['backend']}")

# Force CPU backend
builder = GeNNNetworkBuilder(backend="cpu")

# Force CUDA backend (will fail if CUDA not available)
builder = GeNNNetworkBuilder(backend="cuda")
```

### Environment Variables

```bash
# Force CPU-only mode
export GENN_CPU_ONLY=1

# Build with CPU backend
python3 -c "from genn_builder import GeNNNetworkBuilder; ..."
```

### C++: Runner Automatically Adapts

The C++ runner automatically detects the backend:

```bash
# Works with CPU backend
./genn_runner /path/to/cpu_model_CODE 9002

# Works with GPU backend  
./genn_runner /path/to/gpu_model_CODE 9002
```

No code changes needed - the runner reads `backend_info.json` and adapts!

## Backend-Specific Behavior

### CPU Backend (`single_threaded_cpu`)
- ✅ No device memory allocation
- ✅ Data always on host (no transfers needed)
- ✅ `pullStateFromDevice()` is not called
- ✅ Lower memory overhead
- ⚠️ Single-threaded execution

### GPU Backend (`cuda`, `hip`)
- ✅ Parallel execution on GPU
- ✅ Device memory allocation
- ✅ `pullStateFromDevice()` called when needed
- ✅ Higher throughput for large models
- ⚠️ Requires device synchronization
- ⚠️ Higher memory overhead

## Backend Detection Logic

### Python Side
1. If backend="auto":
   - Check if `nvidia-smi` succeeds → use CUDA
   - Check if `GENN_CPU_ONLY=1` → use CPU
   - Default: CPU
2. If backend="cpu" or "single_threaded_cpu" → use CPU
3. If backend="cuda" → use CUDA

### C++ Side
1. Read `backend_info.json` from model directory
2. Parse `backend_type` field:
   - "gpu" → `BackendType::GPU`, enable device sync
   - "cpu" → `BackendType::CPU`, disable device sync
3. Fallback: Check if `pullStateFromDevice` symbol exists
4. If unknown: Log warning, assume no device sync needed

## Testing

Run the test script to verify backend flexibility:

```bash
cd /home/marcos/marcos/snns/SNNverse/back
python3 test_backend_flexibility.py
```

Expected output:
```
Testing GeNN Backend Flexibility
======================================================================

Test 1: Auto backend selection
----------------------------------------------------------------------
✓ CUDA detected, using GPU backend  # or "CUDA not available, using CPU backend"
Building GeNN model 'user_network' in /tmp/genn_models_xyz
✓ Model built successfully. Generated code at: /tmp/genn_models_xyz/user_network_CODE
✓ Backend: cuda  # or "single_threaded_cpu"
✓ Backend metadata exported

Test 2: Force CPU backend
----------------------------------------------------------------------
⚙ Using CPU backend
Building GeNN model 'user_network' in /tmp/genn_models_abc
✓ Model built successfully. Generated code at: /tmp/genn_models_abc/user_network_CODE
✓ Backend: single_threaded_cpu
✓ Backend metadata exported

Summary
======================================================================
✓ Auto-selected backend: cuda (or single_threaded_cpu)
✓ CPU backend: single_threaded_cpu
```

## Benefits

1. **Single Codebase**: Same Python and C++ code works with both backends
2. **Automatic Detection**: No manual configuration needed
3. **Environment Flexibility**: Can use GPU in development, CPU in Docker
4. **Safety**: Won't try to call missing functions
5. **Performance**: Optimal behavior for each backend
6. **Debugging**: Clear logging of backend selection

## Troubleshooting

### "pullStateFromDevice not found but GPU backend detected"
- Backend metadata says GPU but function is missing
- Possible cause: Model built with CPU but metadata is wrong
- Solution: Rebuild model or delete stale `backend_info.json`

### "Backend info not found, attempting auto-detection"
- `backend_info.json` doesn't exist in model CODE directory
- Fallback: Check if `pullStateFromDevice` exists
- Solution: Rebuild model with updated `genn_builder.py`

### Model won't compile with CUDA
- CUDA toolkit not installed or not in PATH
- GeNN not built with CUDA support
- Solution: Install CUDA or force CPU backend:
  ```bash
  export GENN_CPU_ONLY=1
  ```

## Migration Guide

### For Existing Code

No changes needed! The system is backward compatible:

1. Old models without `backend_info.json` will use fallback detection
2. Runners will gracefully handle missing metadata
3. Existing models continue to work

### For New Development

Use the backend parameter in `GeNNNetworkBuilder`:

```python
# Development (use GPU if available)
builder = GeNNNetworkBuilder(backend="auto")

# Production Docker (force CPU)
builder = GeNNNetworkBuilder(backend="cpu")
```

## Future Enhancements

- [ ] Support for multi-threaded CPU backend
- [ ] Support for HIP backend (AMD GPUs)
- [ ] Automatic backend selection based on model size
- [ ] Fallback to CPU if GPU memory is insufficient
- [ ] Backend performance profiling
