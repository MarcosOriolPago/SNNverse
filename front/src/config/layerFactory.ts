import type { Node } from '@xyflow/react';
import { getChildPosition, isChildVisible } from './graphLayoutConfig';

export const expandLayerPlaceholder = (
  layerId: string,
  neuronCount: number,
  neuronType: string,
  parameters: Record<string, unknown>,
  collapsedOverride?: boolean
): Node[] => {
  const collapsed = collapsedOverride ?? (neuronCount > 5);
  return Array.from({ length: neuronCount }, (_, i) => ({
    id: `${layerId}-${i}`,
    type: 'neuron',
    parentId: layerId,
    extent: 'parent' as const,
    position: getChildPosition(neuronCount, collapsed, i),
    expandParent: true,
    draggable: false,
    hidden: !isChildVisible(neuronCount, collapsed, i),
    data: {
      voltage: -70.0,
      parameters: { ...parameters, type: neuronType },
      layerIndex: i,
      parentLayerId: layerId,
    },
  }));
};
