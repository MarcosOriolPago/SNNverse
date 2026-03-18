type SynapseEditorEvent =
  | { type: 'open'; edgeId: string; labelX: number; labelY: number }
  | { type: 'close' };

type Listener = (event: SynapseEditorEvent) => void;

class SynapseEditorBus {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  emit(event: SynapseEditorEvent) {
    this.listeners.forEach((l) => l(event));
  }
}

export const synapseEditorBus = new SynapseEditorBus();
export type { SynapseEditorEvent };
