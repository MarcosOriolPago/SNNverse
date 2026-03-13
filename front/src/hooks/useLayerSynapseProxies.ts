import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';

type SynapseEdgeData = {
  connectionType?: string | null;
  proxyFor?: string;
  hideLabel?: boolean;
  proxyActive?: boolean;
};

const PROXY_PREFIX = 'proxy-synapse';

const isProxyEdge = (edge: Edge): boolean =>
  !!((edge.data as SynapseEdgeData | undefined)?.proxyFor);

const isControllerSynapse = (edge: Edge): boolean =>
  edge.type === 'synapse' && !isProxyEdge(edge);

function isLayerExpanded(node?: Node): boolean {
  if (!node || node.type !== 'layer') return false;
  const data = node.data as { collapsed?: boolean; pending?: boolean; neuronCount?: number };
  if (data.pending) return false;
  return !data.collapsed && (data.neuronCount ?? 0) > 0;
}

function getLayerChildren(layerId: string, nodes: Node[]): string[] {
  return nodes
    .filter((n) => n.parentId === layerId && !n.hidden)
    .sort((a, b) => {
      const ai = (a.data as { layerIndex?: number })?.layerIndex ?? 0;
      const bi = (b.data as { layerIndex?: number })?.layerIndex ?? 0;
      return ai - bi;
    })
    .map((child) => child.id);
}

function buildProxyEdgeId(parentEdgeId: string, sourceId: string, targetId: string): string {
  return `${PROXY_PREFIX}-${parentEdgeId}-${sourceId}--${targetId}`;
}

export const useLayerSynapseProxies = (
  nodes: Node[],
  edges: Edge[],
  setEdges: Dispatch<SetStateAction<Edge[]>>
) => {
  useEffect(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const controllerEdges = edges.filter(isControllerSynapse);

    const desiredProxyEdges: Edge[] = [];
    const controllerProxyState = new Map<string, boolean>();

    controllerEdges.forEach((controller) => {
      const edgeData = (controller.data ?? {}) as SynapseEdgeData;
      const connectionType = edgeData.connectionType ?? null;
      if (!connectionType) {
        controllerProxyState.set(controller.id, false);
        return;
      }

      const sourceNode = nodeById.get(controller.source);
      const targetNode = nodeById.get(controller.target);

      const sourceIds = sourceNode?.type === 'layer' && isLayerExpanded(sourceNode)
        ? getLayerChildren(controller.source, nodes)
        : [controller.source];
      const targetIds = targetNode?.type === 'layer' && isLayerExpanded(targetNode)
        ? getLayerChildren(controller.target, nodes)
        : [controller.target];

      const shouldProxy = sourceIds.length > 1 || targetIds.length > 1;
      controllerProxyState.set(controller.id, shouldProxy);
      if (!shouldProxy) return;

      sourceIds.forEach((sourceId) => {
        targetIds.forEach((targetId) => {
          desiredProxyEdges.push({
            id: buildProxyEdgeId(controller.id, sourceId, targetId),
            source: sourceId,
            target: targetId,
            sourceHandle: sourceId === controller.source && sourceNode?.type === 'layer' ? 'layer-out' : undefined,
            targetHandle: targetId === controller.target && targetNode?.type === 'layer' ? 'layer-in' : undefined,
            type: 'synapseProxy',
            markerEnd: controller.markerEnd,
            style: controller.style,
            selectable: false,
            focusable: false,
            updatable: false,
            data: {
              connectionType,
              proxyFor: controller.id,
              hideLabel: true,
              proxyActive: false,
            } satisfies SynapseEdgeData,
          } as Edge);
        });
      });
    });

    desiredProxyEdges.sort((a, b) => a.id.localeCompare(b.id));

    setEdges((currentEdges) => {
      const currentProxyEdges = currentEdges.filter(isProxyEdge);
      const currentProxyById = new Map(currentProxyEdges.map((edge) => [edge.id, edge]));
      const desiredProxyById = new Map(desiredProxyEdges.map((edge) => [edge.id, edge]));

      let hasChanges = false;

      if (currentProxyEdges.length !== desiredProxyEdges.length) {
        hasChanges = true;
      } else {
        for (const [proxyId, desired] of desiredProxyById.entries()) {
          const current = currentProxyById.get(proxyId);
          if (
            !current ||
            current.source !== desired.source ||
            current.target !== desired.target ||
            current.sourceHandle !== desired.sourceHandle ||
            current.targetHandle !== desired.targetHandle ||
            current.type !== desired.type
          ) {
            hasChanges = true;
            break;
          }
        }
      }

      const nextNonProxyEdges = currentEdges
        .filter((edge) => !isProxyEdge(edge))
        .map((edge) => {
          if (!isControllerSynapse(edge)) return edge;

          const edgeData = (edge.data ?? {}) as SynapseEdgeData;
          const shouldBeProxyActive = controllerProxyState.get(edge.id) ?? false;
          if ((edgeData.proxyActive ?? false) === shouldBeProxyActive) {
            return edge;
          }

          hasChanges = true;
          return {
            ...edge,
            data: {
              ...edgeData,
              proxyActive: shouldBeProxyActive,
            },
          };
        });

      if (!hasChanges) return currentEdges;
      return [...nextNonProxyEdges, ...desiredProxyEdges];
    });
  }, [edges, nodes, setEdges]);
};
