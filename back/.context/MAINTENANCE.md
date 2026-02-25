# Maintenance Guide

## "Where do I change X?" — Quick Reference

| Goal | File | Section |
|------|------|---------|
| Add a new neuron type | `core/builder.py` | `_add_population()` + add `_make_myneuron()` factory |
| Change default LIF params | `core/config.py` | `DEFAULT_LIF_PARAMS` |
| Change simulation timestep | `core/config.py` | `DEFAULT_DT` |
| Change spike buffer size | `core/config.py` | `NUM_RECORDING_TIMESTEPS_OFFLINE` |
| Add a new API endpoint | `api/routes.py` | Add `@router.get/post(...)` |
| Add new request schema | `api/schemas.py` | Add Pydantic `BaseModel` |
| Change voltage emit rate | `core/config.py` | `VOLTAGE_EMIT_INTERVAL_MS` |
| Add a new input type | `input/types/` | Create new class, use `@InputRegistry.register()` |
| Change voltage binary format | `core/runtime.py` | `OfflineRuntime.run()` write loop |
| Fix voltage seek on playback | `core/manager.py` | `get_voltages()` — `start_step * bytes_per_frame` |

---

## Adding a New Neuron Type

1. **Backend**: Add a factory method in `core/builder.py`:
   ```python
   def _make_mytype(self, name: str, params: dict):
       p = {"MyParam": params.get("my_param", 1.0)}
       pop = self.model.add_neuron_population(name, 1, "MyGeNNModel", p, {"V": -65.0})
       pop.spike_recording_enabled = True
       return pop
   ```

2. **Backend**: Register it in `_add_population()`:
   ```python
   elif node_type == "MYTYPE":
       pop = self._make_mytype(safe_name, node.params)
       has_v = True
   ```

3. **Frontend**: Add the new node component in `front/src/components/nodes/`.

4. **Frontend**: Register it in `GraphBuilder` so it appears on the canvas.

---

## Offline Voltage Binary Format

The voltage data is stored as raw packed float32 values:

```
[frame 0: N floats] [frame 1: N floats] ... [frame T floats]
```

Where:
- `N = sum of all population neuron counts (populations with V, sorted by key)`
- `T = total simulation steps = duration_ms / dt`
- Each value is a 4-byte IEEE-754 float
- Population order matches `sorted(pop_keys)` alphabetically

The reader in `manager.get_voltages()` uses `f.seek(start_step * N * 4)` to jump to any frame.

**If you change the write order** in `runtime.py`, you **must also update** the reader in `manager.py`.

---

## Spike Recording

Spikes are handled by GeNN's built-in recording system:
- Populations must have `spike_recording_enabled = True` (set in `builder.py`)
- The model is loaded with `num_recording_timesteps` (from `config.NUM_RECORDING_TIMESTEPS_OFFLINE`)
- Every 1000 steps, `model.pull_recording_buffers_from_device()` is called
- `pop.spike_recording_data[0]` returns `(times_array, ids_array)`

The spike buffer resets after each pull. The `OfflineRuntime._extract_spikes()` accumulates them into the final `SimulationResult`.

---

## Compiled Model Cache

Compiled models live in `back/genn_out/<md5_hash>_CODE/`.

The hash is computed from the full network JSON (nodes + edges). If nothing in the network changes, the model won't recompile (just reloads the binary).

To force a recompile, either:
- Change something in the network topology/params
- Delete the `back/genn_out/` directory: `rm -rf back/genn_out/`
