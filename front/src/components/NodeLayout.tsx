import React, { useCallback } from 'react';
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
import { FiFile } from 'react-icons/fi';

import '@xyflow/react/dist/base.css';

import TurboNode, { type TurboNodeData } from './TurboNode';
import TurboEdge from './TurboEdge';
import SpikeEdge from './SpikeEdge'; // Import the new Spike Edge
import FunctionIcon from './FunctionIcon';

const initialNodes: Node<TurboNodeData>[] = [
  {
    id: '1',
    position: { x: 0, y: 0 },
    data: { icon: <FunctionIcon />, title: 'Sensory Input', subtitle: 'Retina' },
    type: 'turbo',
  },
  {
    id: '2',
    position: { x: 250, y: 0 },
    data: { icon: <FunctionIcon />, title: 'Hidden Layer', subtitle: 'Neuron A' },
    type: 'turbo',
  },
  {
    id: '3',
    position: { x: 0, y: 250 },
    data: { icon: <FunctionIcon />, title: 'Sensory Input', subtitle: 'Cochlea' },
    type: 'turbo',
  },
  {
    id: '4',
    position: { x: 250, y: 250 },
    data: { icon: <FunctionIcon />, title: 'Hidden Layer', subtitle: 'Neuron B' },
    type: 'turbo',
  },
  {
    id: '5',
    position: { x: 500, y: 125 },
    data: { icon: <FunctionIcon />, title: 'Integration', subtitle: 'Processing' },
    type: 'turbo',
  },
  {
    id: '6',
    position: { x: 750, y: 125 },
    data: { icon: <FiFile />, title: 'Motor Output', subtitle: 'Action' },
    type: 'turbo',
  },
];

const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    type: 'spike', // Use the spike type
  },
  {
    id: 'e3-4',
    source: '3',
    target: '4',
    type: 'spike',
  },
  {
    id: 'e2-5',
    source: '2',
    target: '5',
    type: 'spike',
  },
  {
    id: 'e4-5',
    source: '4',
    target: '5',
    type: 'spike',
  },
  {
    id: 'e5-6',
    source: '5',
    target: '6',
    type: 'spike',
  },
];

const nodeTypes = {
  turbo: TurboNode,
};

// Register both edge types
const edgeTypes = {
  turbo: TurboEdge,
  spike: SpikeEdge,
};

// Set 'spike' as the default so new connections are automatically animated
const defaultEdgeOptions = {
  type: 'spike',
  markerEnd: 'edge-circle',
  style: {
    strokeWidth: 2,
    stroke: '#b1b1b7', // A neutral color for the "wire"
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
      <svg>
        <defs>
          <linearGradient id="edge-gradient">
            <stop offset="0%" stopColor="#ae53ba" />
            <stop offset="100%" stopColor="#2a8af6" />
          </linearGradient>

          <marker
            id="edge-circle"
            viewBox="-5 -5 10 10"
            refX="0"
            refY="0"
            markerUnits="strokeWidth"
            markerWidth="10"
            markerHeight="10"
            orient="auto"
          >
            <circle stroke="#2a8af6" strokeOpacity="0.75" r="2" cx="0" cy="0" />
          </marker>
        </defs>
      </svg>
      <Background />
    </ReactFlow>
  );
};

export default NodeFlowLayout;