import { useState, useEffect } from 'react';
import { useNodesState, useEdgesState, ReactFlowProvider, type Node } from '@xyflow/react';
import { useNetworkList } from '../hooks/useNetworkList';
import { ReactFlowLayout } from './ReactFlowLayout';
import { PythonEditor } from './widgets/PythonEditor';
import type { NeuronNodeData } from './blocks/NeuronNode';
import type { InputNodeData } from './blocks/InputNode';
// import '../styles/training.css';

const TrainingContent = () => {
    // State for Network Selection
    const { networks, refreshNetworks } = useNetworkList();
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
        <div className="flex flex-1 h-screen bg-slate-900 text-slate-300">
            {/* Left Panel: Visualizer */}
            <div className="flex-1 relative border-r border-slate-800">
                <div className="absolute top-4 left-4 z-50 bg-slate-800 p-2 rounded shadow-md">
                    <select
                        className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 outline-none"
                        onChange={(e) => setSelectedNetworkName(e.target.value)}
                        value={selectedNetworkName || ''}
                    >
                        <option value="">Select a Network to Train...</option>
                        {networks.map(n => (
                            <option key={n.name} value={n.name}>{n.name}</option>
                        ))}
                    </select>
                </div>

                <ReactFlowLayout
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                />
            </div>

            {/* Right Panel: Python Editor */}
            <div className="w-2/5 flex flex-col bg-slate-900 border-l border-slate-800">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Training Script</h2>
                    <button className="bg-purple-600 text-white font-semibold px-4 py-2 rounded border-none transition-colors cursor-pointer hover:bg-purple-500">
                        Run Training
                    </button>
                </div>

                <div className="flex-1 overflow-hidden">
                    <PythonEditor
                        codeContent={code}
                        setCodeContent={setCode}
                    />
                </div>
            </div>
        </div>
    );
};

export default function Training() {
    return (
        <ReactFlowProvider>
            <TrainingContent />
        </ReactFlowProvider>
    );
}
