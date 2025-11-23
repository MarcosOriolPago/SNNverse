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
import './../styles/node-layout.css';

import NeuronNode, { type NeuronNodeData } from './blocks/NeuronNode';
import InputNodeComponent, { type InputNodeData } from './blocks/InputNode';
import Axon from './Axon';
import { eventBus } from '../utils/EventBus';

const initialNodes: Node<NeuronNodeData | InputNodeData>[] = [];
const initialEdges: Edge[] = [];

const nodeTypes = { 
  neuron: NeuronNode,
  input: InputNodeComponent,
};

const edgeTypes = { spike: Axon };

const defaultEdgeOptions = {
  type: 'spike',
  markerEnd: 'edge-circle',
  style: { strokeWidth: 1, stroke: '#b1b1b7', strokeDasharray: '5, 5', strokeOpacity: 0.5 },
  data: {
    spikeSpeed: 1.5, // seconds - slowed down to be clearly visible
    spikeSize: 8,    // pixels - made larger for better visibility
  },
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
      if (data.spikes && data.spikes.length > 0) {
        console.log('⚡ Spikes received from backend:', data.spikes);
        data.spikes.forEach((sourceId: string) => {
          console.log(`  → Emitting spike for node: ${sourceId}`);
          eventBus.emit(sourceId);
        });
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

      let newNode: Node<NeuronNodeData | InputNodeData>;

      if (nodeType === 'input' || nodeType === 'python-input') {
        const defaultCode = `def spike_function(t, ctx):\n    # Return True for spike, False for no spike\n    import random\n    return random.random() > 0.5`;
        newNode = {
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
      } else {
        newNode = {
          id: nanoid(),
          type: 'neuron',
          position,
          data: {
            voltage: '-70.0mV',
            parameters: { ...parameters, type: neuronType }
          },
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
      nodes: currentNodes.map(n => {
        const params = { ...n.data };
        // For input nodes, ensure we have the latest code from the editor
        if (n.type === 'input') {
          // Try to get the code from initialCode or custom_function
          params.custom_function = params.initialCode || params.custom_function;
        }
        return {
          id: n.id,
          type: n.type === 'input' ? 'PYTHON' : (n.data.parameters as any)?.type || 'LIF',
          params
        };
      }),
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
    <div className="flow-wrapper" ref={wrapperRef}>
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          onClick={handleRunSimulation}
          className={`run-button ${isRunning ? 'running' : 'stopped'}`}
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
        className="react-flow-background"
      >
        <Controls className="react-flow-controls" />
        <Background color="#6d6d6dff" gap={16} />
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