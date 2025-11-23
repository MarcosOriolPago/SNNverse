// Updated to handle aggregated edge statistics instead of individual spikes
interface EdgeUpdate {
  edgeId: string;
  spikeRate: number; // Spikes per second
}

type Listener = (update: EdgeUpdate) => void;

class SimulationEventBus {
  private listeners: Set<Listener> = new Set();

  // Edges subscribe here
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
        this.listeners.delete(listener);
    }
  }

  // NodeLayout triggers this with aggregated data
  emit(update: EdgeUpdate) {
    this.listeners.forEach((listener) => listener(update));
  }
}

// Create a single shared instance
export const eventBus = new SimulationEventBus();
