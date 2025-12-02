# SNNverse

SNNverse is a web-based tool for simulating and visualizing Spiking Neural Networks (SNNs). The core goal is to provide a high-performance, scalable, and visually intuitive platform for real-time SNN analysis and interaction.

The backend leverages the **GeNN** framework to generate, compile, and run SNN models in C++. This provides high-performance simulations that can be streamed to the frontend in real-time, sending membrane voltage (Vm) at each timestep and spike events as they occur.

## Core Concepts

### Simulation and Visualization
The primary goal is to simulate and visualize user-defined SNNs in real-time, with controls for execution speed. The visualization is designed for intuitive understanding of network behavior:

*   **Axon Colors**: Axon colors change from **gray to yellow** based on the calculated spike rate (Hz) over a given time window, providing an at-a-glance view of connection activity.
*   **Neuron Colors**: Neuron colors shift from gray to yellow, representing the membrane voltage, indicating how close a neuron is to firing.

### Architecture
*   **Backend**: A Python server that uses **GeNN** to compile SNN models into efficient C++ code. This compiled runner streams simulation data (voltage and spikes) via WebSockets.
*   **Frontend**: A React-based single-page application that visualizes the network graph and its activity, designed for fluid interaction and real-time data display.
*   **Sandboxed Inputs**: Custom Python functions for input nodes are executed in a secure sandbox, ensuring safe and versatile network input. This architecture is designed with the future goal of connecting to real-world sensors for live testing.

## Key Features

### Custom Input Patterns
Input nodes can be programmed with custom Python functions to generate specific spike patterns. This allows for creating a wide range of stimuli for your network.

**Example: Periodic Spiking**
```python
def spike_function(t, ctx):
    # Spike every second
    return int(t) % 1 == 0
```

Only the `math`, `random`, and `time` modules are available for security.

### Real-time Spike Rate Monitoring
During a simulation, you can click on any neuron to open a **Spike Rate Popup**. This monitor provides real-time metrics:
-   **Current**: The instantaneous spike rate.
-   **Average**: The average rate since the popup was opened.
-   **Peak**: The highest rate observed.
-   **Sparkline Chart**: A mini-chart showing the recent history of spike activity.

## Performance and Scalability
The platform is designed to handle large-scale networks through several optimization strategies:

*   **Aggregate Visualization**: Instead of animating individual spikes (a deprecated v1.0 feature), the system visualizes aggregate spike rates. This significantly reduces computational load and allows for simulating 1000+ neurons.
*   **Selectable Communication Modes**:
    *   **WebSocket (Default)**: Provides the fastest real-time updates.
    *   **HTTP Polling**: A more scalable option for very large networks, which can be enabled in the frontend configuration (`front/src/config/visualization.ts`).
*   **Backend Throttling**: The simulation backend can be configured to send updates every N ticks, reducing the data load on the frontend for large, dense networks.

*   **Double-Buffered Streaming**: The C++ backend uses a high-performance, double-buffering strategy to provide the latest network state to the frontend.
    *   **Decoupled Simulation and I/O**: The simulation runs in a dedicated thread, writing voltage and spike data into a "back" buffer. A separate communication thread simultaneously reads from a "front" buffer.
    *   **Atomic Swapping**: The two buffers are swapped atomically, a lock-free operation that ensures the communication thread can always access the latest complete state without blocking the simulation. This results in a smoother, more consistent data stream for a real-time visualization experience on the frontend.

### Recommended Settings
| Network Size | Frontend Setting (`USE_POLLING`) | Backend Setting (`EMIT_EVERY_N_TICKS`) |
|--------------|-----------------------------------|----------------------------------------|
| < 100 neurons| `false`                           | 1                                      |
| 100-500      | `false`                           | 2                                      |
| > 500        | `true`                            | 5+                                     |


## For Developers

### Code Style
Development follows established conventions. For example, all CSS has been extracted from components into separate `.css` files under `front/src/styles/` to enforce separation of concerns, improve maintainability, and allow for better caching.

### Contributing
When adding new features, please ensure that any user-facing functionality is clearly documented within this README.
