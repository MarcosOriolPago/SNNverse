/** Connection types for layer-to-layer / node-to-layer synapses */
export const SYNAPSE_CONNECTION_TYPES = [
  { id: 'dense', label: 'Dense (all-to-all)', description: 'Full connectivity' },
  { id: 'sparse', label: 'Sparse', description: 'Sparse connectivity' },
  { id: 'gaussian', label: 'Gaussian', description: 'Gaussian weight profile' },
  { id: 'code', label: 'Code (Python)', description: 'Custom connectivity via Python' },
] as const;

export type SynapseConnectionType = (typeof SYNAPSE_CONNECTION_TYPES)[number]['id'];

export const DEFAULT_CONNECTION_CODE = `# Connection Code
# Environment: n1 (source size), n2 (target size)
# Functions: connect(i, j), set_weight(i, j, w), disconnect(i, j)

# Example: one-to-one diagonal with weight 5.0
for i in range(min(n1, n2)):
    connect(i, i)
    set_weight(i, i, 5.0)
`;
