import type { Node, Edge } from '@xyflow/react';

export interface BackendNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    params: any;
}

export interface BackendEdge {
    source: string;
    target: string;
    data?: any;
}

export const mapBackendNodeToReactFlow = (node: BackendNode, offset = { x: 0, y: 0 }): Node => {
    const id = `${node.id}-${Date.now()}`;
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
    } else {
        return {
            id,
            type: 'neuron',
            position,
            data: {
                label: node.id,
                voltage: -70.0,
                parameters: { ...node.params, type: node.type }
            }
        };
    }
};

export const mapBackendEdgeToReactFlow = (edge: BackendEdge, idMap: Record<string, string>): Edge => {
    return {
        id: `e-${edge.source}-${edge.target}-${Date.now()}`,
        source: idMap[edge.source] || edge.source,
        target: idMap[edge.target] || edge.target,
        type: edge.data?.key ? 'keyboardEdge' : 'spike',
        data: edge.data || {}
    };
};
