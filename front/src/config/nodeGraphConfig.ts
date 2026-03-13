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
import { SYNAPSE_CONNECTION_TYPES } from './synapseConfig';
import { expandLayerPlaceholder } from './layerFactory';
import {
    NEURON_SPACING,
    LAYER_PADDING,
    LAYER_WIDTH,
    NEURON_WIDTH,
    STANDALONE_NEURON_WIDTH,
    NEURON_INPUT_HANDLE_X_FACTOR,
    NEURON_OUTPUT_HANDLE_X_FACTOR,
    NEURON_HANDLE_Y_FACTOR,
    getChildPosition,
    isChildVisible,
} from './graphLayoutConfig';

export {
    NEURON_SPACING,
    LAYER_PADDING,
    LAYER_WIDTH,
    NEURON_WIDTH,
    STANDALONE_NEURON_WIDTH,
    NEURON_INPUT_HANDLE_X_FACTOR,
    NEURON_OUTPUT_HANDLE_X_FACTOR,
    NEURON_HANDLE_Y_FACTOR,
    getChildPosition,
    isChildVisible,
};

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
    synapseProxy: Axon,
};

export { SYNAPSE_CONNECTION_TYPES };
export { expandLayerPlaceholder };


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

/** Creates a placeholder layer (empty shell) for neuron count input. No child nodes yet. */
export const createLayerPlaceholder = (
    position: { x: number; y: number },
    neuronType: string,
    parameters: Record<string, unknown>
): Node<LayerNodeData> => {
    const layerId = nanoid();
    const placeholderHeight = 2 * LAYER_PADDING + NEURON_SPACING;
    return {
        id: layerId,
        type: 'layer',
        position,
        data: {
            neuronCount: 0,
            neuronType,
            parameters: { ...parameters, type: neuronType },
            pending: true,
        },
        style: { width: LAYER_WIDTH, height: placeholderHeight },
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
        style: { width: LAYER_WIDTH, height: parentHeight },
    };
    const childNodes = expandLayerPlaceholder(layerId, neuronCount, neuronType, parameters ?? {});

    return [parentNode, ...childNodes];
};
