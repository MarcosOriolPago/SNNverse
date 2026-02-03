/**
 * Visualization Configuration
 * 
 * This file allows switching between real-time socket.io updates
 * and efficient polling-based updates for large-scale simulations.
 */

export const VisualizationConfig = {
  // Use polling instead of socket.io for reduced computational overhead
  // Recommended for simulations with >500 neurons
  USE_POLLING: false,

  // Polling interval in milliseconds (only used if USE_POLLING is true)
  POLLING_INTERVAL_MS: 100,

  // Spike rate aggregation window in milliseconds
  SPIKE_AGGREGATION_WINDOW_MS: 100,

  // Backend tick emission throttling
  // Backend emits every N ticks (configured on backend side)
  BACKEND_EMIT_EVERY_N_TICKS: 2,

  // Color thresholds for axon visualization (spikes per second)
  AXON_COLOR_MAX: 100,

  // Neuron color thresholds (voltage based - configured in NeuronNode)
  NEURON_RESTING_VOLTAGE: -70,
  NEURON_THRESHOLD_VOLTAGE: -55,
};
