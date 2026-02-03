import React, { useState, useEffect } from 'react';
import { useNodesState, useEdgesState, ReactFlowProvider, addEdge, type Node, type Edge, type OnConnect } from '@xyflow/react';
import { useNetworkList } from '../hooks/useNetworkList';
import { useGeNNLogic } from '../hooks/useGeNNLogic';
import { ReactFlowLayout } from './ReactFlowLayout';
import ControlPanel from './widgets/simulation/ControlPanel';
import SpeedControl from './widgets/simulation/SpeedControl';
import type { NeuronNodeData } from './blocks/NeuronNode';
import type { InputNodeData } from './blocks/InputNode';
import { AccordionSection } from './ui/AccordionSection';
// import '../styles/playground.css';


import DraggableInput from './sidebar/DraggableInput';
import DraggableOutput from './sidebar/DraggableOutput';
import DraggableNetwork from './sidebar/DraggableNetwork';
import { useReactFlow } from '@xyflow/react';
import { nodeTypes, edgeTypes, defaultEdgeOptions } from '../config/nodeGraphConfig';
import { useAxonVisualizer } from '../hooks/useAxonVisualizer';
import SpikeRatePopup from './widgets/simulation/SpikeRatePopup';

const PlaygroundContent = () => {
    const { screenToFlowPosition } = useReactFlow();
    const visualizerRef = React.useRef<HTMLDivElement>(null);

    // State for Selectors
    const { networks, refreshNetworks } = useNetworkList();
    const [selectedInputType, setSelectedInputType] = useState<string>('python');
    const [selectedOutputType, setSelectedOutputType] = useState<string>('display');

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


    // Placeholder for Training/Input
    const [code, setCode] = useState("# Write your custom training script here\n\ndef train(network):\n    pass");
    const [inputDef, setInputDef] = useState("# Define custom inputs\n\ninput_1 = PoissonGroup(10, rates=50*Hz)");

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

    // Close popup on background click (handled by ReactFlow onPaneClick if needed, or overlay)
    // For now, popup has a close button. We can also add click listener.

    return (
        <div className="flex flex-1 h-screen bg-bg-secondary text-slate-300">
            {/* Left Panel: Visualizer */}
            <div className="flex-1 relative border-r border-border-primary" ref={visualizerRef} style={{ position: 'relative' }}>
                {/* Visualizer content */}
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

            {/* Right Panel: Experiment Setup */}
            <div className="w-1/3 flex flex-col bg-bg-secondary border-l border-border-primary">
                <div className="p-lg border-b border-border-primary">
                    <h2 className="text-2xl font-bold text-text-primary mb-sm">Experiment Setup</h2>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>

                    {/* Inputs Category */}
                    <AccordionSection title="Inputs" defaultOpen={false}>
                        <label className="text-base font-semibold text-text-muted">Input Source</label>
                        <select
                            className="w-full bg-bg-primary border border-border-secondary text-slate-200 rounded-md px-[0.625rem] py-[0.625rem] text-md outline-none transition-normal appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20fill=%27none%27%20viewBox=%270%200%2024%2024%27%20stroke=%27%2394a3b8%27%20stroke-width=%272%27%3E%3Cpath%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%20d=%27M19%209l-7%207-7-7%27%3E%3C/path%3E%3C/svg%3E')] bg-no-repeat bg-[right_0.75rem_center] bg-[length:var(--spacing-lg)] focus:border-primary-light"
                            onChange={(e) => setSelectedInputType(e.target.value)}
                            value={selectedInputType}
                        >
                            <option value="python">Python Generator</option>
                            <option value="sensor">Sensor Stream</option>
                        </select>

                        {selectedInputType === 'python' && (
                            <div className="form-group-mt">
                                <label className="text-base font-semibold text-text-muted">Generator Code</label>
                                <textarea
                                    className="bg-bg-primary border border-border-primary rounded-sm px-md py-md text-base font-mono text-slate-300 h-48 outline-none resize-y focus:border-purple"
                                    value={inputDef}
                                    onChange={(e) => setInputDef(e.target.value)}
                                />
                            </div>
                        )}

                        {selectedInputType === 'sensor' && (
                            <div className="info-box">
                                Connect external sensor streams via websocket port 8001.
                            </div>
                        )}

                        <div className="section-divider">
                            <div className="section-header">Draggable Items</div>
                            <div className="flex-wrap gap-2">
                                <DraggableInput isCollapsed={false} />
                                {/* Add more draggable items here if needed */}
                            </div>
                        </div>
                    </AccordionSection>

                    {/* Networks Category (Updated) */}
                    <AccordionSection title="Networks" defaultOpen={true}>
                        <div className="text-xs text-slate-500 mb-3">
                            Drag networks to the canvas to use them as blocks.
                        </div>
                        <div className="flex-col gap-2">
                            {networks.length === 0 && <div className="empty-state">No saved networks found.</div>}
                            {networks.map(n => (
                                <DraggableNetwork key={n.name} name={n.name} isCollapsed={false} />
                            ))}
                        </div>
                    </AccordionSection>

                    {/* 4. Outputs Category */}
                    <AccordionSection title="Outputs" defaultOpen={false}>
                        <label className="text-base font-semibold text-text-muted">Output Processor</label>
                        <select
                            className="w-full bg-bg-primary border border-border-secondary text-slate-200 rounded-md px-[0.625rem] py-[0.625rem] text-md outline-none transition-normal appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20fill=%27none%27%20viewBox=%270%200%2024%2024%27%20stroke=%27%2394a3b8%27%20stroke-width=%272%27%3E%3Cpath%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%20d=%27M19%209l-7%207-7-7%27%3E%3C/path%3E%3C/svg%3E')] bg-no-repeat bg-[right_0.75rem_center] bg-[length:var(--spacing-lg)] focus:border-primary-light"
                            onChange={(e) => setSelectedOutputType(e.target.value)}
                            value={selectedOutputType}
                        >
                            <option value="display">Real-time Display</option>
                            <option value="postprocessor">Postprocessor Script</option>
                        </select>

                        {selectedOutputType === 'postprocessor' && (
                            <div className="form-group-mt">
                                <label className="text-base font-semibold text-text-muted">Processing Script</label>
                                <textarea
                                    className="bg-bg-primary border border-border-primary rounded-sm px-md py-md text-base font-mono text-slate-300 h-48 outline-none resize-y focus:border-purple"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="section-divider">
                            <div className="section-header">Draggable Items</div>
                            <div className="flex-wrap gap-2">
                                <DraggableOutput isCollapsed={false} />
                            </div>
                        </div>
                    </AccordionSection>

                </div>

                <div className="p-4 border-t border-slate-800">
                    <button
                        className="bg-purple text-text-primary font-semibold px-lg py-sm rounded-sm border-none transition-normal mt-auto cursor-pointer w-full hover:bg-purple-light"
                        onClick={handleCompile}
                        disabled={isCompiling || isCompiled}
                        style={{ opacity: isCompiling || isCompiled ? 0.5 : 1 }}
                    >
                        {isCompiling ? 'Initializing...' : isCompiled ? 'Experiment Ready' : 'Initialize Experiment'}
                    </button>
                </div>
            </div >
        </div >
    );
};

export default function Playground() {
    return (
        <ReactFlowProvider>
            <PlaygroundContent />
        </ReactFlowProvider>
    );
}
