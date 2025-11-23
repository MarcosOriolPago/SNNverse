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
import { VisualizationConfig } from '../config/visualization';

import '@xyflow/react/dist/base.css';
import './../styles/lod-styles.css';
import './../styles/node-layout.css';

import NeuronNode, { type NeuronNodeData } from './blocks/NeuronNode';
import InputNodeComponent, { type InputNodeData } from './blocks/InputNode';
import Axon from './Axon';
import SpikeRatePopup from './SpikeRatePopup';
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Track spike counts per edge for rate calculation
  const spikeCountsRef = useRef<Map<string, number>>(new Map());
  const lastResetTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (VisualizationConfig.USE_POLLING) {
      // Polling mode: periodically fetch state from REST endpoint
      const pollInterval = setInterval(async () => {
        if (!isRunning) return;
        
        try {
          const response = await fetch('http://localhost:8000/api/simulation/state');
          const data = await response.json();
          
          if (data.neurons) {
            setNodes((nds) => nds.map((node) => {
              const update = data.neurons.find((u: any) => u.id === node.id);
              return update ? { ...node, data: { ...node.data, voltage: update.voltage } } : node;
            }));
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, VisualizationConfig.POLLING_INTERVAL_MS);
      
      return () => clearInterval(pollInterval);
    } else {
      // Socket.io mode: real-time updates with spike aggregation
      socketRef.current = io('http://localhost:8000');
      
      socketRef.current.on('tick', (data: any) => {
        // Update neuron voltages
        if (data.neurons) {
          setNodes((nds) => nds.map((node) => {
            const update = data.neurons.find((u: any) => u.id === node.id);
            return update ? { ...node, data: { ...node.data, voltage: update.voltage } } : node;
          }));
        }
        
        // Aggregate spikes into edge statistics
        if (data.spikes && data.spikes.length > 0) {
          const currentEdges = getEdges();
          
          // Count spikes per source node
          data.spikes.forEach((sourceId: string) => {
            // Find all edges originating from this source
            currentEdges.forEach((edge) => {
              if (edge.source === sourceId) {
                const count = spikeCountsRef.current.get(edge.id) || 0;
                spikeCountsRef.current.set(edge.id, count + 1);
              }
            });
          });
        }
      });
      
      // Periodically calculate and emit spike rates
      const rateUpdateInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastResetTimeRef.current) / 1000; // seconds
        const currentEdges = getEdges();
        const processedEdges = new Set<string>();
        
        // Emit spike rates for edges with activity
        spikeCountsRef.current.forEach((count, edgeId) => {
          const spikeRate = count / elapsed; // spikes per second
          eventBus.emit({ edgeId, spikeRate });
          processedEdges.add(edgeId);
        });
        
        // Reset counters
        spikeCountsRef.current.clear();
        lastResetTimeRef.current = now;
        
        // Emit 0 Hz for edges with no activity
        currentEdges.forEach((edge) => {
          if (!processedEdges.has(edge.id)) {
            eventBus.emit({ edgeId: edge.id, spikeRate: 0 });
          }
        });
      }, VisualizationConfig.SPIKE_AGGREGATION_WINDOW_MS);
      
      return () => { 
        socketRef.current?.disconnect();
        clearInterval(rateUpdateInterval);
      };
    }
  }, [setNodes, getEdges, isRunning]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    // Disable drop during simulation
    event.dataTransfer.dropEffect = isRunning ? 'none' : 'move';
  }, [isRunning]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // Block adding nodes during simulation
      if (isRunning) {
        console.warn('Cannot add nodes while simulation is running');
        return;
      }

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
    [screenToFlowPosition, setNodes, isRunning],
  );

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((els) => addEdge(params, els)),
    [setEdges],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!isRunning) return; // Only show during simulation
      
      // Get node position on screen
      const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
      if (nodeElement) {
        const rect = nodeElement.getBoundingClientRect();
        setPopupPosition({ x: rect.left, y: rect.top });
        setSelectedNodeId(node.id);
      }
    },
    [isRunning],
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
        onNodeClick={onNodeClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        onlyRenderVisibleElements={nodes.length > 100}  // Optimize for large networks
        nodesDraggable={!isRunning}  // Disable dragging during simulation
        nodesConnectable={!isRunning}  // Disable connecting during simulation
        nodesFocusable={!isRunning}  // Disable node focus during simulation
        edgesFocusable={!isRunning}  // Disable edge focus during simulation
        elementsSelectable={!isRunning}  // Disable selection during simulation
        className="react-flow-background"
      >
        <Controls className="react-flow-controls" />
        <Background color="#6d6d6dff" gap={16} />
      </ReactFlow>

      {selectedNodeId && (
        <SpikeRatePopup
          nodeId={selectedNodeId}
          position={popupPosition}
          onClose={() => setSelectedNodeId(null)}
          edges={edges.map(e => ({ id: e.id, source: e.source, target: e.target }))}
        />
      )}
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