import React, { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type OnConnect,
} from '@xyflow/react';
import FlowCanvas from './common/FlowCanvas';


import '@xyflow/react/dist/base.css';

import './../styles/speed-selector.css';

import type { NeuronNodeData } from './blocks/NeuronNode';
import type { InputNodeData } from './blocks/InputNode';

// Config
import { initialNodes, initialEdges, nodeTypes, edgeTypes, defaultEdgeOptions, createInputNode, createNeuronNode } from '../config/nodeGraphConfig';

// Hooks
import { useGeNNLogic } from '../hooks/useGeNNLogic';
import { useNetworkPersistence } from '../hooks/useNetworkPersistence';

// Components
import BuilderControls from './widgets/simulation/BuilderControls';
import SaveNetworkDialog from './ui/SaveNetworkDialog';


const FlowContent = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();

  const [searchParams, setSearchParams] = useSearchParams();
  const networkName = searchParams.get('networkName');
  const shouldLoadConfig = searchParams.get('loadConfig') === 'true';

  // Logic Hooks
  const {
    isCompiling,
    setIsCompiled,
    handleCompile,
  } = useGeNNLogic({ networkName, shouldLoadConfig });

  useNetworkPersistence(networkName, shouldLoadConfig, setNodes, setEdges, setIsCompiled);

  // --- Save Logic ---
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);

  const handleSaveClick = useCallback(() => {
    if (networkName) {
      performSave(networkName);
    } else {
      setIsSaveDialogOpen(true);
    }
  }, [networkName]);

  const performSave = async (name: string) => {
    try {
      const payload = {
        network_name: name,
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type === 'input' ? 'PYTHON' : n.data.parameters?.type || 'LIF',
          position: n.position,
          params: n.type === 'input'
            ? { code: n.data.initialCode || n.data.custom_function }
            : n.data.parameters
        })),
        edges: edges.map(e => ({
          source: e.source,
          target: e.target,
          weight: 1.0
        }))
      };

      const response = await fetch('http://localhost:8000/api/network/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to save network');

      await response.json();

      if (name !== networkName) {
        setSearchParams({ networkName: name, loadConfig: 'true' });
      }

      setIsSaveDialogOpen(false);
    } catch (error) {
      console.error("Error saving network:", error);
      alert("Failed to save network. See console for details.");
    }
  };

  const handleDialogSave = (name: string) => {
    performSave(name);
  };

  // --- Interaction Handlers ---
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = isCompiling ? 'none' : 'move';
  }, [isCompiling]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (isCompiling) return;

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
    [screenToFlowPosition, setNodes, isCompiling],
  );

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((els) => addEdge(params, els)),
    [setEdges],
  );

  return (
    <>
      <FlowCanvas
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
        isInteractive={!isCompiling}
      >
        <BuilderControls
          isCompiling={isCompiling}
          onVerify={handleCompile}
          onSave={handleSaveClick}
        />
        <SaveNetworkDialog
          isOpen={isSaveDialogOpen}
          onClose={() => setIsSaveDialogOpen(false)}
          onSave={handleDialogSave}
          initialName={networkName || ''}
        />
      </FlowCanvas>
    </>
  );
};

export default function NodeFlowLayout() {
  return (
    <ReactFlowProvider>
      <FlowContent />
    </ReactFlowProvider>
  );
}