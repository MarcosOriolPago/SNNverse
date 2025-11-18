import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { nanoid } from 'nanoid';
import { FiPlay, FiStopCircle } from 'react-icons/fi';

import '@xyflow/react/dist/base.css';
import './../styles/lod-styles.css';

import NeuronNode, { type NeuronNodeData } from './blocks/NeuronNode';
import InputNodeComponent, { defaultPythonFunction } from './blocks/InputNode';
import Axon from './Axon';
import { eventBus } from '../utils/EventBus';

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const nodeTypes = { 
  neuron: NeuronNode,
  input: InputNodeComponent
};

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

  useEffect(() => {
    socketRef.current = io('http://localhost:8000');
    socketRef.current.on('tick', (data: any) => {
      if (data.neurons) {
        setNodes((nds) => nds.map((node) => {
          const update = data.neurons.find((u: any) => u.id === node.id);
          return update ? { ...node, data: { ...node.data, voltage: update.voltage } } : node;
        }));
      }
      if (data.spikes) {
        data.spikes.forEach((sourceId: string) => eventBus.emit(sourceId));
      }
    });
    return () => { socketRef.current?.disconnect(); };
  }, [setNodes]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const typeData = event.dataTransfer.getData('application/reactflow');
      if (!typeData) return;

      const parsedData = JSON.parse(typeData);
      const { nodeType = 'neuron', neuronType, parameters } = parsedData;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let newNode: Node;

      if (nodeType === 'input' || nodeType === 'python-input') {
        newNode = {
          id: nanoid(),
          type: 'input',
          position,
          data: { 
            initialCode: defaultPythonFunction,
            currentValue: 0,
            label: 'Python Generator'
          },
        };
      } else {
        newNode = {
          id: nanoid(),
          type: 'neuron',
          position,
          data: {
            voltage: '-70.0mV',
            parameters: { ...parameters, type: neuronType }
          } as NeuronNodeData,
        };
      }

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((els) => addEdge(params, els)),
    [setEdges],
  );

  const handleRunSimulation = async () => {
    if (isRunning) {
      await fetch('http://localhost:8000/api/simulation/stop', { method: 'POST' });
      setIsRunning(false);
      return;
    }

    const currentNodes = getNodes();
    const currentEdges = getEdges();

    const payload = {
      nodes: currentNodes.map(n => ({
        id: n.id,
        type: n.type === 'input' ? 'PYTHON' : (n.data.parameters as any)?.type || 'LIF',
        params: n.data
      })),
      edges: currentEdges.map(e => ({
        source: e.source,
        target: e.target
      }))
    };

    try {
      await fetch('http://localhost:8000/api/network/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      await fetch('http://localhost:8000/api/simulation/start', { method: 'POST' });
      setIsRunning(true);
    } catch (error) {
      console.error("Failed to start simulation", error);
    }
  };

  return (
    <div className="w-full h-full relative" ref={wrapperRef}>
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
        className="bg-gray-950"
      >
        <Controls className="bg-gray-800 border-gray-700 fill-white" />
        <Background color="#333" gap={16} />
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