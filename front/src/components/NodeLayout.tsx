import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  type OnConnect,
} from '@xyflow/react';


import '@xyflow/react/dist/base.css';
import './../styles/lod-styles.css';
import './../styles/node-layout.css';
import './../styles/speed-selector.css';

import { eventBus } from '../utils/EventBus';
import type { NeuronNodeData } from './blocks/NeuronNode';
import type { InputNodeData } from './blocks/InputNode';
import SpikeRatePopup from './SpikeRatePopup';

// Config
import { initialNodes, initialEdges, nodeTypes, edgeTypes, defaultEdgeOptions, createInputNode, createNeuronNode } from '../config/nodeGraphConfig';

// Hooks
import { useGeNNLogic } from '../hooks/useGeNNLogic';
import { useNetworkPersistence } from '../hooks/useNetworkPersistence';

// Components
import SpeedControl from './simulation/SpeedControl';
import ControlPanel from './simulation/ControlPanel';


const FlowContent = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition, getEdges } = useReactFlow();

  // UI State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [searchParams] = useSearchParams();
  const networkName = searchParams.get('networkName');
  const shouldLoadConfig = searchParams.get('loadConfig') === 'true';

  // Logic Hooks
  const {
    isCompiling,
    isCompiled,
    setIsCompiled,
    voltages,
    spikes,
    running,
    currentSpeed,
    setSpeed,
    handleCompile,
    handleRunStop,
  } = useGeNNLogic({ networkName, shouldLoadConfig });

  useNetworkPersistence(networkName, shouldLoadConfig, setNodes, setEdges, setIsCompiled);

  // --- Spike Rate and Updates ---
  const spikeCountsRef = useRef<Map<string, number>>(new Map());
  const lastResetTimeRef = useRef<number>(Date.now());

  // Update neuron voltages from C++ backend
  useEffect(() => {
    setNodes((nds) => nds.map((node) => {
      const voltage = voltages.get(node.id);
      if (voltage !== undefined) {
        return {
          ...node,
          data: {
            ...node.data,
            voltage: voltage
          }
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

  // Periodically emit spike rates to event bus
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
    }, 1000);

    return () => clearInterval(interval);
  }, []);


  // --- Interaction Handlers ---

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = (running || isCompiling) ? 'none' : 'move';
  }, [running, isCompiling]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

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
        newNode = createInputNode(position);
      } else {
        newNode = createNeuronNode(position, neuronType, parameters);
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
      if (!running) return;

      const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
      if (nodeElement) {
        const rect = nodeElement.getBoundingClientRect();
        setPopupPosition({ x: rect.left, y: rect.top });
        setSelectedNodeId(node.id);
      }
    },
    [running],
  );

  return (
    <div className="flow-wrapper" ref={wrapperRef}>
      <ControlPanel
        isCompiling={isCompiling}
        isCompiled={isCompiled}
        running={running}
        onCompile={handleCompile}
        onRunStop={handleRunStop}
      />

      {running && (
        <SpeedControl currentSpeed={currentSpeed} setSpeed={setSpeed} />
      )}

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
        onlyRenderVisibleElements={nodes.length > 100}
        nodesDraggable={!running && !isCompiling}
        nodesConnectable={!running && !isCompiling}
        nodesFocusable={!running && !isCompiling}
        edgesFocusable={!running && !isCompiling}
        elementsSelectable={!running && !isCompiling}
        selectionOnDrag={!running && !isCompiling}
        panOnDrag={[1, 2]}
        panActivationKeyCode="Control"
        deleteKeyCode={['Backspace', 'Delete']}
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