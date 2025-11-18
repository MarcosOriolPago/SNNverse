import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  useOnViewportChange,
  ReactFlowProvider,
  type Node,
  type Edge,
  type OnConnect,
} from '@xyflow/react';
import { io, type Socket } from 'socket.io-client';

import '@xyflow/react/dist/base.css';
import './../styles/lod-styles.css'; // Import LOD styles

import NeuronNode, { type NeuronNodeData } from './NeuronNode';
import Axon from './Axon';

// --- Initial Static Data (Skeleton) ---
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
    data: { voltage: '-70mV', parameters: { type: 'Hidden', threshold: -55 } },
    type: 'neuron',
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'spike' },
];

const nodeTypes = { neuron: NeuronNode };
const edgeTypes = { spike: Axon };

const defaultEdgeOptions = {
  type: 'spike',
  markerEnd: 'edge-circle',
  style: { strokeWidth: 1, stroke: '#b1b1b7', strokeDasharray: '5, 5', strokeOpacity: 0.5 },
};

// --- Inner Component to Access ReactFlow Context ---
const FlowContent = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Socket Reference
  const socketRef = useRef<Socket | null>(null);

  // Track Zoom for LOD
  useOnViewportChange({
    onChange: (viewport) => setZoomLevel(viewport.zoom),
  });

  // Determine Level of Detail (LOD)
  // High Detail if Zoom > 0.6 (Zoomed In). Otherwise Low Detail.
  const isHighDetail = useMemo(() => zoomLevel > 0.6, [zoomLevel]);

  // Setup Socket Connection
  useEffect(() => {
    // Connect to Python Backend
    socketRef.current = io('http://localhost:8000');

    socketRef.current.on('connect', () => {
      console.log('Connected to SNN Simulation Backend');
    });

    // Handle Real-time 'tick' updates
    socketRef.current.on('tick', (data: { neurons: { id: string; voltage: string }[], spikes: any[] }) => {
      
      // Batch Update Nodes
      if (data.neurons && data.neurons.length > 0) {
        setNodes((currentNodes) => 
          currentNodes.map((node) => {
            const update = data.neurons.find((u) => u.id === node.id);
            if (update) {
              // Return new object to trigger re-render of specific node
              return {
                ...node,
                data: {
                  ...node.data,
                  voltage: update.voltage,
                },
              };
            }
            return node;
          })
        );
      }

      if (data.spikes && data.spikes.length > 0) {
        // console.log("Spikes received:", data.spikes.length);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [setNodes]);

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((els) => addEdge(params, els)),
    [],
  );

  return (
    // Apply the LOD class to the wrapper
    <div className={`w-full h-full flow-wrapper ${isHighDetail ? 'lod-high' : 'lod-low'}`}>
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
        // Optimization: Only render visible elements
        onlyRenderVisibleElements={true} 
      >
        <Controls showInteractive={false} />
        <Background />
      </ReactFlow>
    </div>
  );
};

// --- Main Export Wrapped in Provider ---
export default function NodeFlowLayout() {
  return (
    <ReactFlowProvider>
      <div style={{ width: '100vw', height: '100vh' }}>
        <FlowContent />
      </div>
    </ReactFlowProvider>
  );
}