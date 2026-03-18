import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';

type SynapseEdgeData = {
  connectionType?: string;
  proxyFor?: string;
  proxyKind?: 'proxy' | 'detail';
  hideLabel?: boolean;
  proxyActive?: boolean;
};

type NormalizedController = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  connectionType: string;
  sourceNode?: Node;
  targetNode?: Node;
  isLayerConnection: boolean;
  showDetailed: boolean;
  sourceLayerChildren: string[];
  targetLayerChildren: string[];
};

const PROXY_PREFIX = 'proxy-synapse';
const DETAIL_PREFIX = 'detail-synapse';

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
    .filter((n) => n.parentId === layerId)
    .sort((a, b) => {
      const ai = (a.data as { layerIndex?: number })?.layerIndex ?? 0;
      const bi = (b.data as { layerIndex?: number })?.layerIndex ?? 0;
      return ai - bi;
    })
    .map((child) => child.id);
}

function normalizeControllerEdge(edge: Edge, nodeById: Map<string, Node>, nodes: Node[]): NormalizedController {
  const sourceNode = nodeById.get(edge.source);
  const targetNode = nodeById.get(edge.target);

  const normalizedSource = sourceNode?.parentId ?? edge.source;
  const normalizedTarget = targetNode?.parentId ?? edge.target;
  const normalizedSourceNode = nodeById.get(normalizedSource);
  const normalizedTargetNode = nodeById.get(normalizedTarget);
  const sourceIsLayer = normalizedSourceNode?.type === 'layer';
  const targetIsLayer = normalizedTargetNode?.type === 'layer';
  const sourceLayerExpanded = sourceIsLayer && isLayerExpanded(normalizedSourceNode);
  const targetLayerExpanded = targetIsLayer && isLayerExpanded(normalizedTargetNode);
  const sourceLayerChildren = sourceIsLayer ? getLayerChildren(normalizedSource, nodes) : [];
  const targetLayerChildren = targetIsLayer ? getLayerChildren(normalizedTarget, nodes) : [];

  const edgeData = (edge.data ?? {}) as SynapseEdgeData;
  return {
    id: edge.id,
    source: normalizedSource,
    target: normalizedTarget,
    sourceHandle: sourceIsLayer ? 'layer-out' : edge.sourceHandle,
    targetHandle: targetIsLayer ? 'layer-in' : edge.targetHandle,
    connectionType: edgeData.connectionType ?? 'dense',
    sourceNode: normalizedSourceNode,
    targetNode: normalizedTargetNode,
    isLayerConnection: sourceIsLayer || targetIsLayer,
    showDetailed: sourceLayerExpanded || targetLayerExpanded,
    sourceLayerChildren,
    targetLayerChildren,
  };
}

function buildProxyEdgeId(controllerId: string): string {
  return `${PROXY_PREFIX}-${controllerId}`;
}

function buildDetailEdgeId(controllerId: string, sourceId: string, targetId: string): string {
  return `${DETAIL_PREFIX}-${controllerId}-${sourceId}--${targetId}`;
}

export const useLayerSynapseProxies = (
  nodes: Node[],
  edges: Edge[],
  setEdges: Dispatch<SetStateAction<Edge[]>>
) => {
  useEffect(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const controllerEdges = edges.filter(isControllerSynapse);
    const controllerEdgeById = new Map(controllerEdges.map((edge) => [edge.id, edge]));
    const normalizedControllers = controllerEdges.map((edge) => normalizeControllerEdge(edge, nodeById, nodes));
    const normalizedById = new Map(normalizedControllers.map((controller) => [controller.id, controller]));

    const desiredGeneratedEdges: Edge[] = [];
    const controllerPathHidden = new Map<string, boolean>();

    normalizedControllers.forEach((controller) => {
      const connectionType = controller.connectionType;
      if (!controller.isLayerConnection) {
        controllerPathHidden.set(controller.id, false);
        return;
      }

      const sourceNode = controller.sourceNode;
      const targetNode = controller.targetNode;

      controllerPathHidden.set(controller.id, true);

      const proxyEdge: Edge = {
        id: buildProxyEdgeId(controller.id),
        source: controller.source,
        target: controller.target,
        sourceHandle: sourceNode?.type === 'layer' ? 'layer-out' : undefined,
        targetHandle: targetNode?.type === 'layer' ? 'layer-in' : undefined,
        type: 'synapse',
        markerEnd: controllerEdgeById.get(controller.id)?.markerEnd,
        style: controllerEdgeById.get(controller.id)?.style,
        selectable: false,
        focusable: false,
        data: {
          connectionType,
          proxyFor: controller.id,
          proxyKind: 'proxy',
          hideLabel: true,
          proxyActive: controller.showDetailed,
        } satisfies SynapseEdgeData,
      };
      desiredGeneratedEdges.push(proxyEdge);

      const sourceIds = sourceNode?.type === 'layer'
        ? controller.sourceLayerChildren
        : [controller.source];
      const targetIds = targetNode?.type === 'layer'
        ? controller.targetLayerChildren
        : [controller.target];
      if (sourceIds.length === 0 || targetIds.length === 0) return;

      sourceIds.forEach((sourceId) => {
        targetIds.forEach((targetId) => {
          desiredGeneratedEdges.push({
            id: buildDetailEdgeId(controller.id, sourceId, targetId),
            source: sourceId,
            target: targetId,
            sourceHandle: sourceId === controller.source && sourceNode?.type === 'layer'
              ? 'layer-out'
              : undefined,
            targetHandle: targetId === controller.target && targetNode?.type === 'layer'
              ? 'layer-in'
              : undefined,
            type: 'synapse',
            markerEnd: controllerEdgeById.get(controller.id)?.markerEnd,
            style: controllerEdgeById.get(controller.id)?.style,
            selectable: false,
            focusable: false,
            data: {
              connectionType,
              proxyFor: controller.id,
              proxyKind: 'detail',
              hideLabel: true,
              proxyActive: !controller.showDetailed,
            } satisfies SynapseEdgeData,
          } as Edge);
        });
      });
    });

    desiredGeneratedEdges.sort((a, b) => a.id.localeCompare(b.id));

    setEdges((currentEdges) => {
      const currentGeneratedEdges = currentEdges.filter(isProxyEdge);
      const currentGeneratedById = new Map(currentGeneratedEdges.map((edge) => [edge.id, edge]));
      const desiredGeneratedById = new Map(desiredGeneratedEdges.map((edge) => [edge.id, edge]));

      let hasChanges = false;

      if (currentGeneratedEdges.length !== desiredGeneratedEdges.length) {
        hasChanges = true;
      } else {
        for (const [generatedId, desired] of desiredGeneratedById.entries()) {
          const current = currentGeneratedById.get(generatedId);
          const desiredData = (desired.data ?? {}) as SynapseEdgeData;
          const currentData = (current?.data ?? {}) as SynapseEdgeData;
          if (
            !current ||
            current.source !== desired.source ||
            current.target !== desired.target ||
            current.sourceHandle !== desired.sourceHandle ||
            current.targetHandle !== desired.targetHandle ||
            current.type !== desired.type ||
            (currentData.connectionType ?? null) !== (desiredData.connectionType ?? null) ||
            currentData.proxyKind !== desiredData.proxyKind ||
            (currentData.proxyActive ?? false) !== (desiredData.proxyActive ?? false)
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

          const normalized = normalizedById.get(edge.id);
          if (!normalized) return edge;
          const edgeData = (edge.data ?? {}) as SynapseEdgeData;
          const shouldHideControllerPath = controllerPathHidden.get(edge.id) ?? false;
          const needsEndpointUpdate =
            edge.source !== normalized.source ||
            edge.target !== normalized.target ||
            edge.sourceHandle !== normalized.sourceHandle ||
            edge.targetHandle !== normalized.targetHandle;
          const needsProxyFlagUpdate = (edgeData.proxyActive ?? false) !== shouldHideControllerPath;
          if (!needsEndpointUpdate && !needsProxyFlagUpdate) {
            return edge;
          }

          hasChanges = true;
          return {
            ...edge,
            source: normalized.source,
            target: normalized.target,
            sourceHandle: normalized.sourceHandle ?? undefined,
            targetHandle: normalized.targetHandle ?? undefined,
            data: {
              ...edgeData,
              proxyActive: shouldHideControllerPath,
            },
          };
        });

      if (!hasChanges) return currentEdges;
      return [...nextNonProxyEdges, ...desiredGeneratedEdges];
    });
  }, [edges, nodes, setEdges]);
};
