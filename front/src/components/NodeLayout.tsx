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
import { useGeNNStream } from '../hooks/useGeNNStream';
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
  const [isCompiling, setIsCompiling] = useState(false);
  const [isCompiled, setIsCompiled] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const {
    connect,
    disconnect,
    voltages,
    spikes,
    connected,
    running,
    start,
    stop,
  } = useGeNNStream();

  // Track spike counts per edge for rate calculation
  const spikeCountsRef = useRef<Map<string, number>>(new Map());
  const lastResetTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    connect('ws://localhost:9002');
    return () => disconnect();
  }, [connect, disconnect]);

  // Update neuron voltages from C++ backend
  useEffect(() => {
    setNodes((nds) => nds.map((node) => {
      const voltage = voltages.get(node.id);
      if (voltage !== undefined) {
        return {
          ...node,
          data: { ...node.data, voltage: `${voltage.toFixed(1)}mV` }
        };
      }
      return node;
    }));
  }, [voltages, setNodes]);

  // Aggregate spikes for rate calculation
  useEffect(() => {
    if (spikes.length === 0) return;

    const currentEdges = getEdges();
    spikes.forEach((sourceId) => {
      currentEdges.forEach((edge) => {
        if (edge.source === sourceId) {
          const count = spikeCountsRef.current.get(edge.id) || 0;
          spikeCountsRef.current.set(edge.id, count + 1);
        }
      });
    });
  }, [spikes, getEdges]);

  // Periodically emit spike rates to event bus (existing code)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastResetTimeRef.current) / 1000;

      spikeCountsRef.current.forEach((count, edgeId) => {
        const spikeRate = count / elapsed;
        eventBus.emit({ edgeId, spikeRate });
      });

      spikeCountsRef.current.clear();
      lastResetTimeRef.current = now;
    }, 1000);  // Update every second

    return () => clearInterval(interval);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    // Disable drop during simulation or compilation
    event.dataTransfer.dropEffect = (running || isCompiling) ? 'none' : 'move';
  }, [running, isCompiling]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // Block adding nodes during simulation or compilation
      if (running || isCompiling) {
        console.warn('Cannot add nodes while simulation is running or compiling');
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
        const defaultCode = `def spike_function(t, ctx):\n    # Return True for spike, False for no spike\n    # t = current timestep, ctx = context dictionary\n    import random\n    return random.random() > 0.5`;
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
    [screenToFlowPosition, setNodes, running, isCompiling],
  );

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((els) => addEdge(params, els)),
    [setEdges],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!running) return; // Only show during simulation

      // Get node position on screen
      const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
      if (nodeElement) {
        const rect = nodeElement.getBoundingClientRect();
        setPopupPosition({ x: rect.left, y: rect.top });
        setSelectedNodeId(node.id);
      }
    },
    [running],
  );

  const handleCompile = async () => {
    if (isCompiling || running) {
      console.warn('Cannot compile while compiling or running');
      return;
    }

    // Build network and compile model
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    const payload = {
      nodes: currentNodes.map(n => {
        const isInputNode = n.type === 'input';
        return {
          id: n.id,
          type: isInputNode ? 'PYTHON' : ((n.data as NeuronNodeData).parameters?.type || 'LIF'),
          params: isInputNode
            ? { custom_function: (n.data as InputNodeData).custom_function || '' }
            : ((n.data as NeuronNodeData).parameters || {}),
          size: (n.data as NeuronNodeData).size || 1
        };
      }),
      edges: currentEdges.map(e => ({
        source: e.source,
        target: e.target
      }))
    };

    try {
      setIsCompiling(true);

      // Step 1: Build GeNN model (generates + compiles C++ runner)
      console.log('Building and compiling GeNN model...');
      const compileResponse = await fetch('http://localhost:8000/api/network/load_genn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!compileResponse.ok) {
        throw new Error('Failed to compile model');
      }

      // Step 2: Launch C++ runner and input providers (but don't start simulation yet)
      console.log('Starting C++ runner and input providers...');
      const startResponse = await fetch('http://localhost:8000/api/simulation/start_genn', {
        method: 'POST'
      });

      if (!startResponse.ok) {
        throw new Error('Failed to start C++ runner');
      }

      // Reconnect WebSocket to ensure we are talking to the new runner
      disconnect();
      setTimeout(() => {
        connect('ws://localhost:9002');
      }, 500);

      setIsCompiling(false);
      setIsCompiled(true);

      console.log('✓ Compilation complete. C++ runner ready. Press Run to start simulation.');
    } catch (error) {
      console.error("Failed to compile model", error);
      setIsCompiling(false);
      setIsCompiled(false);
    }
  };

  const handleRunStop = () => {
    if (!isCompiled) {
      console.warn('Please compile the model first');
      return;
    }

    if (running) {
      // Stop simulation
      stop();
    } else {
      // Start simulation
      console.log('Start')
      start();
    }
  };

  return (
    <div className="flow-wrapper" ref={wrapperRef}>
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          onClick={handleCompile}
          disabled={isCompiling || running}
          className={`run-button ${isCompiling ? 'compiling' : ''} ${isCompiled ? 'compiled' : ''}`}
        >
          {isCompiling ? (
            <>
              <div className="loading-spinner" />
              Compiling...
            </>
          ) : (
            <>
              <FiPlay />
              Compile
            </>
          )}
        </button>

        <button
          onClick={handleRunStop}
          disabled={!isCompiled || isCompiling}
          className={`run-button ${running ? 'running' : 'stopped'}`}
        >
          {running ? (
            <>
              <FiStopCircle /> Stop
            </>
          ) : (
            <>
              <FiPlay /> Run
            </>
          )}
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
        nodesDraggable={!running && !isCompiling}  // Disable dragging during simulation
        nodesConnectable={!running && !isCompiling}  // Disable connecting during simulation
        nodesFocusable={!running && !isCompiling}  // Disable node focus during simulation
        edgesFocusable={!running && !isCompiling}  // Disable edge focus during simulation
        elementsSelectable={!running && !isCompiling}  // Disable selection during simulation
        selectionOnDrag={!running && !isCompiling}  // Enable area selection by dragging
        panOnDrag={[1, 2]}  // Pan with middle or right mouse button
        panActivationKeyCode="Control"  // Require Ctrl key for panning with left mouse button
        deleteKeyCode={['Backspace', 'Delete']}  // Enable deletion with Delete/Backspace keys
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