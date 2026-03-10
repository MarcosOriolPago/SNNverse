import type { Node, Edge } from '@xyflow/react';
import { createLayerNode } from '../config/nodeGraphConfig';

export interface BackendNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    params: any;
    size?: number;
}

export interface BackendEdge {
    source: string;
    target: string;
    data?: any;
}

export const mapBackendNodeToReactFlow = (node: BackendNode, offset = { x: 0, y: 0 }): Node | Node[] => {
    const ts = Date.now();
    const id = `${node.id}-${ts}`;
    const position = {
        x: (node.position?.x || 0) + offset.x,
        y: (node.position?.y || 0) + offset.y
    };

    if (node.type === 'SPIKE_FX') {
        return {
            id,
            type: 'spike_fx',
            position,
            data: {
                initialCode: node.params?.code || node.params?.custom_function || '',
                custom_function: node.params?.code || node.params?.custom_function || '',
                currentValue: 'Ready',
                label: node.id
            }
        };
    } else if (node.type === 'KEYBOARD') {
        return {
            id,
            type: 'keyboard',
            position,
            data: {
                label: 'Keyboard Input',
                params: node.params || { keyMap: {} }
            }
        };
    } else if (node.type === 'layer') {
        const neuronCount = node.params?.neuronCount ?? node.size ?? 1;
        const neuronType = node.params?.neuronType ?? 'LIF';
        const parameters = { ...node.params };
        delete parameters.neuronCount;
        delete parameters.neuronType;
        const layerNodes = createLayerNode(position, neuronCount, neuronType, parameters);
        const parentId = id;
        layerNodes[0].id = parentId;
        layerNodes.forEach((n, i) => {
            if (i > 0) {
                (n as Node).id = `${parentId}-${i - 1}`;
                (n as Node).parentId = parentId;
            }
        });
        return layerNodes;
    } else {
        return {
            id,
            type: 'neuron',
            position,
            data: {
                label: node.id,
                voltage: -70.0,
                parameters: { ...node.params, type: node.type },
                size: node.size ?? 1
            }
        };
    }
};

export const mapBackendNodesToReactFlow = (nodes: BackendNode[], offset = { x: 0, y: 0 }): { nodes: Node[]; idMap: Record<string, string> } => {
    const result: Node[] = [];
    const idMap: Record<string, string> = {};
    nodes.forEach((node) => {
        const mapped = mapBackendNodeToReactFlow(node, offset);
        const arr = Array.isArray(mapped) ? mapped : [mapped];
        arr.forEach((n, i) => {
            result.push(n);
            if (i === 0) idMap[node.id] = n.id;
        });
    });
    return { nodes: result, idMap };
};

export const mapBackendEdgeToReactFlow = (edge: BackendEdge, idMap: Record<string, string>): Edge => {
    const edgeType = edge.data?.key ? 'keyboardEdge' : (edge.data?.connectionType !== undefined ? 'synapse' : 'spike');
    return {
        id: `e-${edge.source}-${edge.target}-${Date.now()}`,
        source: idMap[edge.source] || edge.source,
        target: idMap[edge.target] || edge.target,
        type: edgeType,
        data: edge.data || {}
    };
};
