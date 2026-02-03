# Adding New Input Types to SNNverse

This guide explains how to add new input sources (e.g., sensors, APIs, custom hardware) to the SNNverse backend.

## Overview

The input system uses a registry pattern to decouple input implementations from the core simulation logic. Adding a new input involves:

1.  Creating a new input class inheriting from `InputAdapter`.
2.  Registering the class with `@InputRegistry.register`.
3.  Ensuring the class is discoverable.
4.  Updating the `InputRegistry.create_from_node` factory method.

## Step-by-Step Guide

### 1. Create the Input Class

Create a new file in `app/input/types/` (e.g., `my_custom_input.py`).

Your class must inherit from `app.input.base.InputAdapter` or `app.input.base.EventDrivenInput`.

```python
from ..base import InputAdapter
from ..registry import InputRegistry
import time

@InputRegistry.register("my_custom_input")
class MyCustomInput(InputAdapter):
    def __init__(self, config: dict):
        super().__init__()
        self.target_neuron = config.get("target_neuron")
        self.rate = config.get("rate", 1.0)
        self.thread = None

    def on_start(self):
        """Called when simulation starts."""
        print(f"[MyInput] Starting input for {self.target_neuron}")
        # Start a thread, open a connection, etc.
        # Example: using a thread for periodic spikes
        import threading
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def on_stop(self):
        """Called when simulation stops."""
        print("[MyInput] Stopping input")
        # Clean up resources
        if self.thread:
            self.thread.join(timeout=1.0)

    def _run_loop(self):
        while self.active:
            # Generate spike
            self.push_spike(self.target_neuron, delay_ms=0.0)
            time.sleep(1.0 / self.rate)
```

### 2. Update the Registry Factory

To make your input usable from the frontend configuration, update the `create_from_node` method in `app/input/registry.py`.

Add a mapping for your new node type:

```python
# app/input/registry.py

    @classmethod
    def create_from_node(cls, node: dict) -> InputAdapter:
        # ... existing code ...
        
        type_mapping = {
            "python": "python_script",
            "input": "python_script",
            "keyboard": "keyboard",
            "serial": "serial_sensor",
            "my_node_type": "my_custom_input",  # <--- Add this line
        }
        
        # ... existing code ...

        # Add specific instantiation logic if necessary
        try:
            if adapter_name == "python_script":
                # ...
            elif adapter_name == "my_custom_input":
                return adapter_class(config=params)
                
        # ...
```

### 3. Frontend Integration (Optional)

If you need a custom node in the frontend:
1.  Create a React component in `front/src/components/blocks/`.
2.  Set the node `type` to match the key used in `type_mapping` (e.g., `"my_node_type"`).
3.  Pass necessary parameters in the `data` prop.

## Key Concepts

*   **`push_spike(neuron_id, delay_ms=0.0)`**: The main method to inject a spike into the simulation.
*   **`on_start()` / `on_stop()`**: Lifecycle methods managed by the `SimulationManager`.
*   **Threading**: Inputs run in the same process as the simulation manager but typically require their own threads for listening to hardware or generating periodic events to avoid blocking the main loop.
