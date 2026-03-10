import { type Node, type Edge } from '@xyflow/react';
import { nanoid } from 'nanoid';
import NeuronNode, { type NeuronNodeData } from '../components/reactFlow/NeuronNode';
import LayerNode, { type LayerNodeData } from '../components/reactFlow/LayerNode';
import SpikeInputFx, { type InputNodeData } from '../components/reactFlow/PySpikeFx';
import KeyboardNodeComponent, { type KeyboardNodeData } from '../components/reactFlow/KeyboardNode';
import NetworkNode, { type NetworkNodeData } from '../components/reactFlow/NetworkNode';
import MonitorNode from '../components/reactFlow/MonitorNode';
import Axon from '../components/Axon';
import KeyboardEdge from '../components/reactFlow/KeyboardEdge';
import SynapseEdge from '../components/reactFlow/SynapseEdge';

export const NEURON_SPACING = 80;
export const LAYER_PADDING = 24;

export const initialNodes: Node<NeuronNodeData | InputNodeData | KeyboardNodeData | LayerNodeData>[] = [];

export const initialEdges: Edge[] = [];

export const nodeTypes = {
    neuron: NeuronNode,
    layer: LayerNode,
    spike_fx: SpikeInputFx,
    keyboard: KeyboardNodeComponent,
    network: NetworkNode,
    monitor: MonitorNode,
};

export const edgeTypes = {
    spike: Axon,
    keyboardEdge: KeyboardEdge,
    synapse: SynapseEdge,
};

/** Connection types for layer-to-layer / node-to-layer synapses */
export const SYNAPSE_CONNECTION_TYPES = [
    { id: 'dense', label: 'Dense (all-to-all)', description: 'Full connectivity' },
    { id: 'sparse', label: 'Sparse', description: 'Sparse connectivity' },
    { id: 'gaussian', label: 'Gaussian', description: 'Gaussian weight profile' },
] as const;
export type SynapseConnectionType = (typeof SYNAPSE_CONNECTION_TYPES)[number]['id'];


export const defaultEdgeOptions = {
    type: 'spike',
    markerEnd: 'edge-circle',
    style: { strokeWidth: 1, stroke: '#b1b1b7', strokeDasharray: '5, 5', strokeOpacity: 0.5 },
    data: {
        spikeSpeed: 1.5, // seconds - slowed down to be clearly visible
        spikeSize: 8,    // pixels - made larger for better visibility
    },
};


export const createSpikeFxNode = (position: { x: number, y: number }): Node<InputNodeData> => {
    const defaultCode = `import time\nimport random\n\ndef spike_function(t, ctx):\n    # Return True for spike, False for no spike\n    # t = current timestep, ctx = context dictionary\n    return random.random() > 0.5`;
    return {
        id: nanoid(),
        type: 'spike_fx',
        position,
        data: {
            initialCode: defaultCode,
            custom_function: defaultCode,
            currentValue: 'Ready',
            label: 'Python Generator',
            frequency: 100
        },
    };
};

export const createKeyboardNode = (position: { x: number, y: number }): Node<KeyboardNodeData> => {
    return {
        id: nanoid(),
        type: 'keyboard',
        position,
        data: {
            label: 'Keyboard Input',
        },
    };
};

export const createNeuronNode = (position: { x: number, y: number }, neuronType: string, parameters: any): Node<NeuronNodeData> => {
    return {
        id: nanoid(),
        type: 'neuron',
        position,
        data: {
            voltage: -70.0,
            parameters: { ...parameters, type: neuronType }
        },
    };
};

export const createLayerNode = (
    position: { x: number; y: number },
    neuronCount: number,
    neuronType: string,
    parameters: any
): Node<LayerNodeData | NeuronNodeData>[] => {
    const layerId = nanoid();
    const collapsed = neuronCount > 5;
    const parentHeight = collapsed ? 5 * NEURON_SPACING + 2 * LAYER_PADDING : neuronCount * NEURON_SPACING + 2 * LAYER_PADDING;
    const parentWidth = 140;

    const parentNode: Node<LayerNodeData> = {
        id: layerId,
        type: 'layer',
        position,
        data: {
            neuronCount,
            neuronType,
            parameters: { ...parameters, type: neuronType },
            collapsed,
        },
        style: { width: parentWidth, height: parentHeight },
    };
    const neuronWidth = 60;
    const xCenter = (parentWidth - neuronWidth) / 2;
    const getChildPosition = (i: number) => {
        if (!collapsed) return { x: xCenter, y: LAYER_PADDING + i * NEURON_SPACING };
        if (i <= 1) return { x: xCenter, y: LAYER_PADDING + i * NEURON_SPACING };
        if (i >= neuronCount - 2) return { x: xCenter, y: LAYER_PADDING + (2 + 1 + (i - (neuronCount - 2))) * NEURON_SPACING };
        return { x: xCenter, y: 0 };
    };
    const isChildVisible = (i: number) => !collapsed || i <= 1 || i >= neuronCount - 2;
    const childNodes: Node<NeuronNodeData>[] = Array.from({ length: neuronCount }, (_, i) => ({
        id: `${layerId}-${i}`,
        type: 'neuron',
        parentId: layerId,
        extent: 'parent' as const,
        position: getChildPosition(i),
        expandParent: true,
        draggable: false,
        hidden: !isChildVisible(i),
        data: {
            voltage: -70.0,
            parameters: { ...parameters, type: neuronType },
            layerIndex: i,
            parentLayerId: layerId,
        },
    }));

    return [parentNode, ...childNodes];
};
