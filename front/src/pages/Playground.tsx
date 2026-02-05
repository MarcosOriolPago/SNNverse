import React, { useState, useEffect } from 'react';
import { useNodesState, useEdgesState, ReactFlowProvider, addEdge, type Node, type Edge, type OnConnect } from '@xyflow/react';
import { useNetworkList } from '../hooks/useNetworkList';
import { useGeNNLogic } from '../hooks/useGeNNLogic';
import { ReactFlowLayout } from '../components/layout/ReactFlowLayout';
import ControlPanel from '../components/widgets/simulation/ControlPanel';
import SpeedControl from '../components/widgets/simulation/SpeedControl';
import type { NeuronNodeData } from '../components/reactFlow/NeuronNode';
import type { InputNodeData } from '../components/reactFlow/InputNode';
import { BuilderBlockSelector } from '../components/layout/BuilderBlockSelector';

import { useReactFlow } from '@xyflow/react';
import { nodeTypes, edgeTypes, defaultEdgeOptions } from '../config/nodeGraphConfig';
import { useAxonVisualizer } from '../hooks/useAxonVisualizer';
import SpikeRatePopup from '../components/widgets/simulation/SpikeRatePopup';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const PlaygroundContent = () => {
    const { screenToFlowPosition } = useReactFlow();
    const visualizerRef = React.useRef<HTMLDivElement>(null);

    // React Flow State (Read-only visualization)
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<NeuronNodeData | InputNodeData>>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // Popup State
    const [selectedAxon, setSelectedAxon] = useState<{ id: string; x: number; y: number } | null>(null);

    // Simulation Logic
    const {
        isCompiling,
        isCompiled,
        running,
        currentSpeed,
        setSpeed,
        handleCompile,
        handleRunStop,
        voltages,
        spikes,
    } = useGeNNLogic({
        networkName: null,
        shouldLoadConfig: false
    });

    // Visualize Axon Activity
    useAxonVisualizer(spikes, currentSpeed);

    // Update voltages for visualization
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

    // --- DnD Handlers ---
    const onDragOver = React.useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    // --- Network Loading Logic ---
    const loadNetworkToCanvas = async (networkName: string, dropPosition: { x: number, y: number }) => {
        try {
            console.log(`Fetching network: ${networkName}`);
            const response = await fetch(`http://localhost:8000/api/network/load_saved/${networkName}`);
            if (!response.ok) throw new Error("Failed to load network");

            const data = await response.json();
            const network = data.network; // { nodes: [], edges: [] }

            if (!network.nodes || network.nodes.length === 0) {
                console.warn("Loaded network is empty");
                return;
            }

            // Calculate offset to place network at drop position
            // We'll calculate the top-left of the saved network and align it with dropPosition
            let minX = Infinity;
            let minY = Infinity;
            network.nodes.forEach((n: any) => {
                if (n.position.x < minX) minX = n.position.x;
                if (n.position.y < minY) minY = n.position.y;
            });

            const offsetX = dropPosition.x - minX;
            const offsetY = dropPosition.y - minY;

            const newNodes = network.nodes.map((n: any) => {
                if (n.type === 'PYTHON') {
                    return {
                        ...n,
                        id: `${n.id}-${Date.now()}`,
                        position: {
                            x: n.position.x + offsetX,
                            y: n.position.y + offsetY
                        },
                        data: {
                            ...n.data,
                            label: n.id,
                            custom_function: n.params?.custom_function || '',
                            initialCode: n.params?.custom_function || '',
                            currentValue: "Ready"
                        },
                        type: 'input'
                    };
                } else if (n.type === 'KEYBOARD') {
                    return {
                        ...n,
                        id: `${n.id}-${Date.now()}`,
                        position: {
                            x: n.position.x + offsetX,
                            y: n.position.y + offsetY
                        },
                        data: {
                            label: 'Keyboard Input',
                            // We don't need params.keyMap here as it's derived from edges
                        },
                        type: 'keyboard'
                    };
                } else {
                    return {
                        ...n,
                        id: `${n.id}-${Date.now()}`,
                        position: {
                            x: n.position.x + offsetX,
                            y: n.position.y + offsetY
                        },
                        data: {
                            ...n.data,
                            label: n.id,
                            parameters: n.params
                        },
                        type: 'neuron'
                    };
                }
            });

            // Map edges to new unique IDs
            const idMap: Record<string, string> = {};
            network.nodes.forEach((n: any, i: number) => {
                idMap[n.id] = newNodes[i].id;
            });

            const newEdges = network.edges.map((e: any) => ({
                ...e,
                id: `e-${e.source}-${e.target}-${Date.now()}`,
                source: idMap[e.source],
                target: idMap[e.target],
                type: e.data?.key ? 'keyboardEdge' : 'spike',
                data: e.data || {}
            }));

            setNodes((nds) => nds.concat(newNodes));
            setEdges((eds) => eds.concat(newEdges));

        } catch (error) {
            console.error("Error loading network:", error);
        }
    };

    const onDrop = React.useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const typeData = event.dataTransfer.getData('application/reactflow');
            if (!typeData) return;

            const parsedData = JSON.parse(typeData);
            const { nodeType, networkName } = parsedData;

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            if (nodeType === 'network' && networkName) {
                // Expand network nodes
                loadNetworkToCanvas(networkName, position);
                return;
            }

            let newNode: Node;

            // Single Node Drop Logic
            console.log("Dropping node type:", nodeType);
            if (nodeType === 'output-display') {
                newNode = {
                    id: `monitor-${Date.now()}`,
                    type: 'monitor',
                    position,
                    data: { label: 'Signal Monitor' }
                };
            } else if (nodeType === 'python-input') {
                newNode = {
                    id: `input-${Date.now()}`,
                    type: 'input',
                    position,
                    data: {
                        label: 'Python Input',
                        // Ensure we have the fields the backend expects in 'params'
                        custom_function: "# Custom Input Code\nreturn True",
                        initialCode: "# Custom Input Code\nreturn True",
                        currentValue: "Ready"
                    }
                };
            } else {
                newNode = {
                    id: `${nodeType}-${Date.now()}`,
                    type: 'neuron',
                    position,
                    data: {
                        label: 'Neuron',
                        currentValue: "Ready"
                    },
                };
            }

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes, setEdges],
    );

    const onConnect: OnConnect = React.useCallback(
        (params) => setEdges((els) => addEdge(params, els)),
        [setEdges],
    );

    // Handle Axon Clicks
    const handleEdgeClick = (event: React.MouseEvent, edge: Edge) => {
        event.preventDefault();
        event.stopPropagation();

        // Calculate position relative to container
        if (visualizerRef.current) {
            const rect = visualizerRef.current.getBoundingClientRect();
            // Use scroll positions if necessary, but clientX/Y relative to rect is robust for fixed UI
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            setSelectedAxon({
                id: edge.id,
                x,
                y
            });
        }
    };


    return (
        <ResizablePanelGroup orientation="horizontal" className="flex-1 h-screen bg-bg-secondary text-slate-300">
            <ResizablePanel defaultSize={70} className="relative border-r border-border-primary" style={{ position: 'relative' }}>
                <div ref={visualizerRef} className="h-full w-full">
                    <ReactFlowLayout
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onEdgeClick={handleEdgeClick}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        defaultEdgeOptions={defaultEdgeOptions}
                        isInteractive={true}
                    >
                        {/* Simulation Controls Overlay */}
                        <ControlPanel
                            isCompiling={isCompiling}
                            isCompiled={isCompiled}
                            running={running}
                            onCompile={handleCompile}
                            onRunStop={handleRunStop}
                        />

                        {isCompiled && (
                            <SpeedControl currentSpeed={currentSpeed} setSpeed={setSpeed} />
                        )}

                        {/* Spike Rate Popup */}
                        {selectedAxon && (
                            <SpikeRatePopup
                                edgeId={selectedAxon.id}
                                position={{ x: selectedAxon.x, y: selectedAxon.y }}
                                onClose={() => setSelectedAxon(null)}
                            />
                        )}
                    </ReactFlowLayout>
                </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Panel: Experiment Setup */}
            <ResizablePanel defaultSize={30} minSize={20} className="flex flex-col bg-bg-secondary">
                <BuilderBlockSelector
                    handleCompile={handleCompile}
                    isCompiling={isCompiling}
                    isCompiled={isCompiled}
                />
            </ResizablePanel>
        </ResizablePanelGroup>
    );
};

export default function Playground() {
    return (
        <ReactFlowProvider>
            <PlaygroundContent />
        </ReactFlowProvider>
    );
}
