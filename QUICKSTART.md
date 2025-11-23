# Quick Start: Custom Spike Functions

## What's New?

You can now define custom Python functions in InputNode blocks that control when spikes are generated! The functions run safely in a sandbox and automatically trigger spike animations.

## Try It Now

### 1. Start the Backend
```bash
cd back
source .venv/bin/activate
python run.py
```

### 2. Start the Frontend
```bash
cd front
npm run dev
```

### 3. Create a Spike Function

1. Drag an **Input** node onto the canvas
2. Click the **Code** button (< > icon) to open the editor
3. Write your function (example below)
4. Click **RUN** to test it
5. Connect it to neurons and click **Run** in the top-right

### Example Functions

**Always Spike:**
```python
def spike_function(t, ctx):
    return True
```

**Random Spikes (30% chance):**
```python
def spike_function(t, ctx):
    import random
    return random.random() < 0.3
```

**Periodic Pattern:**
```python
def spike_function(t, ctx):
    # Spike every second
    return int(t) % 2 == 0
```

**Sine Wave:**
```python
def spike_function(t, ctx):
    import math
    return math.sin(t) > 0.5
```

## What Happens?

1. **Test Mode** (RUN button): Tests your function once with dummy values
2. **Simulation Mode** (Run button): Executes every simulation step:
   - Returns `True` → Spike generated → Animation flows through axon
   - Returns `False` → No spike

## Features

✓ **Sandboxed Execution** - Safe, isolated environment  
✓ **Real-time Testing** - Test before running simulation  
✓ **Visual Feedback** - See spike/no-spike status  
✓ **Automatic Animation** - Spikes flow through axons  
✓ **Error Handling** - Clear error messages  

## File Changes

### Backend
- `back/app/sandbox.py` - Secure execution engine
- `back/app/schemas.py` - New data models
- `back/app/main.py` - API endpoint + simulation integration

### Frontend
- `front/src/components/blocks/InputNode.tsx` - RUN button logic
- `front/src/components/NodeLayout.tsx` - Network payload updates

### Documentation
- `CUSTOM_FUNCTIONS.md` - Complete guide with examples
- `back/test_workflow.py` - Test suite

## Architecture

```
Monaco Editor (Frontend)
    ↓ (User writes function)
InputNode RUN Button
    ↓ (POST /api/input/execute)
Backend Sandbox
    ↓ (Validates & executes)
    ↓ (Returns True/False)
Frontend Display
    ↓ (Shows spike status)

When simulation runs:
SimulationEngine Loop
    ↓ (Executes custom function)
    ↓ (If True → emit spike)
Socket.IO
    ↓
EventBus
    ↓
Axon Component
    ↓ (SVG animation)
```

## Security

- ✓ Restricted builtins (no file I/O, network, system calls)
- ✓ Whitelisted modules only (math, random, time)
- ✓ 1-second timeout
- ✓ Return type validation (must be bool)

## Next Steps

See `CUSTOM_FUNCTIONS.md` for:
- Detailed examples
- API documentation
- Troubleshooting guide
- Advanced patterns
