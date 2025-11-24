# Custom Spike Functions

This document explains how to use custom Python functions in InputNode blocks to control spike generation.

## Overview

InputNode blocks now support custom Python functions that determine when spikes should be generated. These functions are:
- **Executed safely** in a sandboxed environment
- **Validated** to return boolean values (True = spike, False = no spike)
- **Integrated** into the simulation loop for real-time spike generation
- **Animated** automatically when spikes are generated

## Function Signature

Your custom function must follow this signature:

```python
def spike_function(t, ctx):
    # t: current simulation time (float)
    # ctx: context dictionary with additional info
    #      - node_id: ID of the current node
    #      - dt: simulation time step
    
    # Your logic here...
    
    return True   # Generate a spike
    # or
    return False  # Don't generate a spike
```

## Available Modules

You can import and use these modules in your functions:
- **`math`** - Mathematical functions (sin, cos, sqrt, etc.)
- **`random`** - Random number generation
- **`time`** - Time-related utilities

**Note:** Other modules (like `os`, `sys`, `subprocess`) are blocked for security.

## Examples

### 1. Constant Spiking
```python
def spike_function(t, ctx):
    return True  # Always spike
```

### 2. Periodic Spiking
```python
def spike_function(t, ctx):
    # Spike every second
    return int(t) % 1 == 0
```

### 3. Random Spiking
```python
def spike_function(t, ctx):
    import random
    # 30% chance to spike at each timestep
    return random.random() < 0.3
```

### 4. Sine Wave Pattern
```python
def spike_function(t, ctx):
    import math
    # Spike when sine wave is positive
    return math.sin(2 * math.pi * t) > 0.5
```

### 5. Alternating Pattern
```python
def spike_function(t, ctx):
    # Spike for 1 second, pause for 1 second, repeat
    return (t % 2.0) < 1.0
```

### 6. Burst Pattern
```python
def spike_function(t, ctx):
    import random
    # Generate bursts: spike rapidly for 0.5s every 2s
    in_burst = (t % 2.0) < 0.5
    return in_burst and random.random() < 0.8
```

## Workflow

### Testing a Function (RUN Button)
1. Open an InputNode's code editor
2. Write your spike function
3. Click the **RUN** button to test it
4. The node displays:
   - ⚡ SPIKE - Function returned True
   - ○ No Spike - Function returned False
   - ❌ Error - Function had an error

### Running in Simulation
1. Configure your InputNode with a custom function
2. Connect it to other neurons via axons
3. Click the **Run** button in the top-right corner
4. Your function executes every simulation step:
   - When it returns `True`, a spike is generated
   - The spike propagates to connected neurons
   - An animation flows through the axon

## Security & Limitations

### Security Features
- ✓ Sandboxed execution (restricted builtins)
- ✓ 1-second timeout per execution
- ✓ Only whitelisted modules allowed
- ✓ No file I/O or network access
- ✓ No system calls

### Limitations
- Functions must return `bool` (True/False)
- Execution timeout: 1 second (0.1s during simulation)
- Cannot access global variables
- Cannot import non-whitelisted modules

## API Endpoints

### Test Execution
```
POST /api/input/execute
Content-Type: application/json

{
  "node_id": "node-123",
  "function_code": "def spike_function(t, ctx):\n    return True"
}

Response:
{
  "success": true,
  "spike": true,
  "error": null,
  "message": "Function executed successfully: SPIKE"
}
```

### Load Network with Custom Functions
```
POST /api/network/load
Content-Type: application/json

{
  "nodes": [
    {
      "id": "input-1",
      "type": "PYTHON",
      "params": {
        "custom_function": "def spike_function(t, ctx):\n    return True",
        ...
      }
    }
  ],
  "edges": [...]
}
```

## Troubleshooting

### "Function must return True or False"
Your function returned something other than a boolean. Make sure all code paths return `True` or `False`.

### "ImportError: Module 'X' is not allowed"
You tried to import a module that isn't whitelisted. Use only `math`, `random`, or `time`.

### "Function execution timed out"
Your function took longer than 1 second. Simplify your logic or reduce computation.

### "Syntax error at line X"
There's a Python syntax error in your code. Check for typos, missing colons, incorrect indentation, etc.

## Tips

1. **Keep it simple** - Functions execute every simulation step (~50ms)
2. **Test first** - Use the RUN button before running the full simulation
3. **Use time wisely** - The `t` parameter is your friend for patterns
4. **Randomness** - Use `random` module for stochastic behavior
5. **Debug** - Check the browser console for error messages
