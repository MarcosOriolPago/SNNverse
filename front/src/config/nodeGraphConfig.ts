import { type Node, type Edge } from '@xyflow/react';
import { nanoid } from 'nanoid';
import NeuronNode, { type NeuronNodeData } from '../components/reactFlow/NeuronNode';
import SpikeInputFx, { type InputNodeData } from '../components/reactFlow/PySpikeFx';
import KeyboardNodeComponent, { type KeyboardNodeData } from '../components/reactFlow/KeyboardNode';
import NetworkNode, { type NetworkNodeData } from '../components/reactFlow/NetworkNode';
import MonitorNode from '../components/reactFlow/MonitorNode';
import Axon from '../components/Axon';
import KeyboardEdge from '../components/reactFlow/KeyboardEdge';

export const initialNodes: Node<NeuronNodeData | InputNodeData | KeyboardNodeData>[] = [];

export const initialEdges: Edge[] = [
    { id: 'e1', source: 'input1', target: 'neuron1', type: 'spike' }
];

export const nodeTypes = {
    neuron: NeuronNode,
    spike_fx: SpikeInputFx,
    keyboard: KeyboardNodeComponent,
    network: NetworkNode,
    monitor: MonitorNode,
};

export const edgeTypes = {
    spike: Axon,
    keyboardEdge: KeyboardEdge
};


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
            params: {
                keyMap: {}
            }
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
