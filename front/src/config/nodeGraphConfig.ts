import { type Node, type Edge } from '@xyflow/react';
import { nanoid } from 'nanoid';
import NeuronNode, { type NeuronNodeData } from '../components/blocks/NeuronNode';
import InputNodeComponent, { type InputNodeData } from '../components/blocks/InputNode';
import NetworkNode, { type NetworkNodeData } from '../components/blocks/NetworkNode';
import MonitorNode from '../components/blocks/MonitorNode';
import Axon from '../components/Axon';

export const initialNodes: Node<NeuronNodeData | InputNodeData>[] = [];

export const initialEdges: Edge[] = [
    { id: 'e1', source: 'input1', target: 'neuron1', type: 'spike' }
];

export const nodeTypes = {
    neuron: NeuronNode,
    input: InputNodeComponent,
    network: NetworkNode,
    monitor: MonitorNode,
};

export const edgeTypes = { spike: Axon };

export const defaultEdgeOptions = {
    type: 'spike',
    markerEnd: 'edge-circle',
    style: { strokeWidth: 1, stroke: '#b1b1b7', strokeDasharray: '5, 5', strokeOpacity: 0.5 },
    data: {
        spikeSpeed: 1.5, // seconds - slowed down to be clearly visible
        spikeSize: 8,    // pixels - made larger for better visibility
    },
};

export const createInputNode = (position: { x: number, y: number }): Node<InputNodeData> => {
    const defaultCode = `def spike_function(t, ctx):\n    # Return True for spike, False for no spike\n    # t = current timestep, ctx = context dictionary\n    import random\n    return random.random() > 0.5`;
    return {
        id: nanoid(),
        type: 'input',
        position,
        data: {
            initialCode: defaultCode,
            custom_function: defaultCode,
            currentValue: 'Ready',
            label: 'Python Generator'
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
