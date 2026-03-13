/** Connection types for layer-to-layer / node-to-layer synapses */
export const SYNAPSE_CONNECTION_TYPES = [
  { id: 'dense', label: 'Dense (all-to-all)', description: 'Full connectivity' },
  { id: 'sparse', label: 'Sparse', description: 'Sparse connectivity' },
  { id: 'gaussian', label: 'Gaussian', description: 'Gaussian weight profile' },
] as const;

export type SynapseConnectionType = (typeof SYNAPSE_CONNECTION_TYPES)[number]['id'];
