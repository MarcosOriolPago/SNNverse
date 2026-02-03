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
import { ReactFlowLayout } from './ReactFlowLayout';
import type { NeuronNodeData } from './blocks/NeuronNode';
import type { InputNodeData } from './blocks/InputNode';
import type { KeyboardNodeData } from './blocks/KeyboardNode';
import { initialNodes, initialEdges, nodeTypes, edgeTypes, createInputNode, createKeyboardNode, createNeuronNode, defaultEdgeOptions } from '../config/nodeGraphConfig';
import { useGeNNLogic } from '../hooks/useGeNNLogic';
import { useNetworkPersistence } from '../hooks/useNetworkPersistence';

import BuilderControls from './widgets/simulation/BuilderControls';
import SaveNetworkDialog from './ui/SaveNetworkDialog';

import '@xyflow/react/dist/base.css';


const BuilderContent = () => {
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
        nodes: nodes.map(n => {
          if (n.type === 'input') {
            return {
              id: n.id,
              type: 'PYTHON',
              position: n.position,
              params: { code: (n.data as InputNodeData).initialCode || (n.data as InputNodeData).custom_function }
            };
          } else if (n.type === 'keyboard') {
            // Reconstruct keyMap from edges to ensure it's saved in node params
            const nodeEdges = edges.filter(e => e.source === n.id);
            const keyMap: Record<string, string> = {};
            nodeEdges.forEach(e => {
              const key = e.data?.key as string;
              if (key) keyMap[key] = e.target;
            });

            return {
              id: n.id,
              type: 'KEYBOARD',
              position: n.position,
              params: { keyMap }
            };
          } else {
            return {
              id: n.id,
              type: (n.data as NeuronNodeData).parameters?.type || 'LIF',
              position: n.position,
              params: (n.data as NeuronNodeData).parameters
            };
          }
        }),
        edges: edges.map(e => ({
          source: e.source,
          target: e.target,
          weight: 1.0,
          data: e.data || {}
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

      let newNode: Node<NeuronNodeData | InputNodeData | any>;

      if (nodeType === 'input' || nodeType === 'python-input') {
        newNode = createInputNode(position);
      } else if (nodeType === 'keyboard') {
        newNode = createKeyboardNode(position);
      } else {
        newNode = createNeuronNode(position, neuronType, parameters);
      }

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, isCompiling],
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      let type = 'spike';
      if (sourceNode?.type === 'keyboard') {
        type = 'keyboardEdge';
      }
      setEdges((els) => addEdge({ ...params, type, data: {} }, els));
    },
    [setEdges, nodes],
  );

  return (
    <>
      <ReactFlowLayout
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
      </ReactFlowLayout>
    </>
  );
};


export default function Builder() {
  return (
    <ReactFlowProvider>
      <BuilderContent />
    </ReactFlowProvider>
  );
}
