import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type OnConnect,
} from '@xyflow/react';

import '@xyflow/react/dist/base.css';

import NeuronNode, { type NeuronNodeData } from './NeuronNode';
import SpikeEdge from './SpikeEdge';


const initialNodes: Node<NeuronNodeData>[] = [
  {
    id: '1',
    position: { x: 0, y: 0 },
    data: { voltage: '-70mV', parameters: { type: 'Input', threshold: -55 } },
    type: 'neuron',
  },
  {
    id: '2',
    position: { x: 250, y: 0 },
    data: { voltage: '-65mV', parameters: { type: 'Hidden', threshold: -55 } },
    type: 'neuron',
  },
  {
    id: '3',
    position: { x: 0, y: 200 },
    data: { voltage: '-70mV', parameters: { type: 'Input', threshold: -55 } },
    type: 'neuron',
  },
  {
    id: '4',
    position: { x: 250, y: 200 },
    data: { voltage: '-55mV', parameters: { type: 'Hidden', threshold: -55 } },
    type: 'neuron',
  },
  {
    id: '5',
    position: { x: 500, y: 100 },
    data: { voltage: '-70mV', parameters: { type: 'Integrator', threshold: -50 } },
    type: 'neuron',
  },
  {
    id: '6',
    position: { x: 750, y: 100 },
    data: { voltage: '-40mV', parameters: { type: 'Output', threshold: -50, action: 'Fire' } },
    type: 'neuron',
  },
];

// Edges use 'spike' type (tiny spheres)
const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'spike' },
  { id: 'e3-4', source: '3', target: '4', type: 'spike' },
  { id: 'e2-5', source: '2', target: '5', type: 'spike' },
  { id: 'e4-5', source: '4', target: '5', type: 'spike' },
  { id: 'e5-6', source: '5', target: '6', type: 'spike' },
];

const nodeTypes = {
  neuron: NeuronNode,
};

const edgeTypes = {
  spike: SpikeEdge,
};

// Set default type to 'spike'
const defaultEdgeOptions = {
  type: 'spike',
  markerEnd: 'edge-circle',
  style: {
    strokeWidth: 1,
    stroke: '#b1b1b7',
    strokeDasharray: '5, 5',
    strokeOpacity: 0.5,
  },
};

const NodeFlowLayout = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((els) => addEdge(params, els)),
    [],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
    >
      <Controls showInteractive={false} />
      
      <Background />
    </ReactFlow>
  );
};

export default NodeFlowLayout;