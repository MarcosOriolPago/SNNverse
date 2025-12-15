import React, { useState, useEffect } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState, type Node } from '@xyflow/react';
import { useNetworkList } from '../hooks/useNetworkList';
import NetworkVisualizer from './NetworkVisualizer';
import { PythonEditor } from './widgets/PythonEditor';
import type { NeuronNodeData } from './blocks/NeuronNode';
import type { InputNodeData } from './blocks/InputNode';
import '../styles/training.css';

const TrainingContent = () => {
    // State for Network Selection
    const { networks } = useNetworkList();
    const [selectedNetworkName, setSelectedNetworkName] = useState<string | null>(null);

    // React Flow State (Read-only visualization)
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<NeuronNodeData | InputNodeData>>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Training Code State
    const [code, setCode] = useState(`# Training script for selected network
import numpy as np

# 'network' is available as a global object representing the loaded network
# Example usage:

def train_step(data):
    # network.train(data)
    pass

print(f"Training network: {selectedNetworkName || 'None'}")
`);

    // Update default code when network changes
    useEffect(() => {
        if (selectedNetworkName) {
            setCode(prev => {
                if (prev.includes("Training network: None")) {
                    return prev.replace("None", selectedNetworkName);
                }
                return prev;
            });
        }
    }, [selectedNetworkName]);


    // Load selected network visualization
    useEffect(() => {
        if (selectedNetworkName) {
            const loadNetwork = async () => {
                try {
                    const response = await fetch(`http://localhost:8000/api/network/load_saved/${encodeURIComponent(selectedNetworkName)}`);
                    const data = await response.json();
                    if (data.status === 'success' && data.network) {
                        const savedNetwork = data.network;
                        const restoredNodes = savedNetwork.nodes.map((node: any) => ({
                            id: node.id,
                            type: node.type === 'PYTHON' ? 'input' : 'neuron',
                            position: node.position || { x: 0, y: 0 },
                            data: {
                                ...node.params,
                                voltage: -70.0,
                                parameters: { ...node.params, type: node.type }
                            }
                        }));
                        const restoredEdges = savedNetwork.edges.map((edge: any, idx: number) => ({
                            id: `e${idx}`,
                            source: edge.source,
                            target: edge.target,
                            type: 'spike'
                        }));

                        setNodes(restoredNodes);
                        setEdges(restoredEdges);
                    }
                } catch (e) {
                    console.error("Failed to load network", e);
                }
            };
            loadNetwork();
        }
    }, [selectedNetworkName, setNodes, setEdges]);


    return (
        <div className="training-container">
            {/* Left Panel: Visualizer */}
            <div className="training-visualizer">
                <div className="training-select-container">
                    <select
                        className="training-select"
                        onChange={(e) => setSelectedNetworkName(e.target.value)}
                        value={selectedNetworkName || ''}
                    >
                        <option value="">Select a Network to Train...</option>
                        {networks.map(n => (
                            <option key={n.name} value={n.name}>{n.name}</option>
                        ))}
                    </select>
                </div>

                <NetworkVisualizer
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                />
            </div>

            {/* Right Panel: Python Editor */}
            <div className="training-editor-panel">
                <div className="training-editor-header">
                    <h2 className="training-editor-title">Training Script</h2>
                    <button className="training-run-button">
                        Run Training
                    </button>
                </div>

                <div className="training-editor-content">
                    <PythonEditor
                        codeContent={code}
                        setCodeContent={setCode}
                    />
                </div>
            </div>
        </div>
    );
};

const Training: React.FC = () => {
    return (
        <ReactFlowProvider>
            <TrainingContent />
        </ReactFlowProvider>
    );
};

export default Training;
