type Listener = (sourceId: string) => void;

class SimulationEventBus {
  private listeners: Set<Listener> = new Set();

  // Edges subscribe here
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
        this.listeners.delete(listener);
    }
  }

  // NodeLayout triggers this
  emit(sourceId: string) {
    this.listeners.forEach((listener) => listener(sourceId));
  }
}

// Create a single shared instance
export const eventBus = new SimulationEventBus();