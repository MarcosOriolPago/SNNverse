import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type OnConnect,
} from '@xyflow/react';
import { io, type Socket } from 'socket.io-client';
import { nanoid } from 'nanoid'; // npm install nanoid
import { FiPlay, FiStopCircle } from 'react-icons/fi';

import '@xyflow/react/dist/base.css';
import './../styles/lod-styles.css';

import NeuronNode, { type NeuronNodeData } from './NeuronNode';
import Axon from './Axon';
import { eventBus } from '../utils/EventBus';

// ... (Initial Nodes/Edges optional now, can start empty) ...
const initialNodes: Node<NeuronNodeData>[] = [];
const initialEdges: Edge[] = [];

const nodeTypes = { neuron: NeuronNode };
const edgeTypes = { spike: Axon };
const defaultEdgeOptions = {
  type: 'spike',
  markerEnd: 'edge-circle',
  style: { strokeWidth: 1, stroke: '#b1b1b7', strokeDasharray: '5, 5', strokeOpacity: 0.5 },
};

const FlowContent = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();
  const [isRunning, setIsRunning] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // --- 1. Socket Connection (Same as before) ---
  useEffect(() => {
    socketRef.current = io('http://localhost:8000');
    socketRef.current.on('tick', (data: any) => {
      // Batch Update Voltage
      if (data.neurons) {
        setNodes((nds) => nds.map((node) => {
          const update = data.neurons.find((u: any) => u.id === node.id);
          return update ? { ...node, data: { ...node.data, voltage: update.voltage } } : node;
        }));
      }
      // Trigger Spikes
      if (data.spikes) {
        data.spikes.forEach((sourceId: string) => eventBus.emit(sourceId));
      }
    });
    return () => { socketRef.current?.disconnect(); };
  }, [setNodes]);

  // --- 2. Drag and Drop Logic ---
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const typeData = event.dataTransfer.getData('application/reactflow');
      if (!typeData) return;

      const { neuronType, parameters } = JSON.parse(typeData);

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node<NeuronNodeData> = {
        id: nanoid(), // Generate unique ID
        type: 'neuron',
        position,
        data: {
          voltage: '-70.0mV',
          parameters: { ...parameters, type: neuronType } // Store dragging params
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((els) => addEdge(params, els)),
    [],
  );

  // --- 3. Run Simulation Logic ---
  const handleRunSimulation = async () => {
    if (isRunning) {
      // STOP Logic
      await fetch('http://localhost:8000/api/simulation/stop', { method: 'POST' });
      setIsRunning(false);
      return;
    }

    // 1. Build Network Topology Payload
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    const payload = {
      nodes: currentNodes.map(n => ({
        id: n.id,
        // @ts-ignore
        type: n.data.parameters?.type || 'LIF',
        // @ts-ignore
        params: n.data.parameters
      })),
      edges: currentEdges.map(e => ({
        source: e.source,
        target: e.target
      }))
    };

    try {
      // 2. Send Definition to Backend
      await fetch('http://localhost:8000/api/network/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // 3. Start Simulation
      await fetch('http://localhost:8000/api/simulation/start', { method: 'POST' });
      setIsRunning(true);
    } catch (error) {
      console.error("Failed to start simulation", error);
    }
  };

  return (
    <div className="w-full h-full relative" ref={wrapperRef}>

      {/* CONTROL BAR (Top Right Overlay) */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          onClick={handleRunSimulation}
          className={`
                flex items-center gap-2 px-4 py-2 rounded-md text-white font-bold shadow-lg transition
                ${isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}
            `}
        >
          {isRunning ? <><FiStopCircle /> Stop</> : <><FiPlay /> Run</>}
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
      >
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
};

export default function NodeFlowLayout() {
  return (
    <ReactFlowProvider>
      <FlowContent />
    </ReactFlowProvider>
  );
}