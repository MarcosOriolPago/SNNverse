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
import '../styles/playground.css';


import DraggableInput from './sidebar/DraggableInput';
import DraggableOutput from './sidebar/DraggableOutput';
import DraggableNetwork from './sidebar/DraggableNetwork';
import { useReactFlow } from '@xyflow/react';
import { nodeTypes, edgeTypes, defaultEdgeOptions } from '../config/nodeGraphConfig';
import { useAxonVisualizer } from '../hooks/useAxonVisualizer';
import { sanitizeId } from '../utils/ids';

const PlaygroundContent = () => {
    const { screenToFlowPosition } = useReactFlow();
    // State for Selectors
    const { networks, refreshNetworks } = useNetworkList();
    const [selectedInputType, setSelectedInputType] = useState<string>('python');
    const [selectedOutputType, setSelectedOutputType] = useState<string>('display');

    // React Flow State (Read-only visualization)
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<NeuronNodeData | InputNodeData>>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

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
    console.log(spikes)

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
                const isInputNode = n.type === 'PYTHON';
                return {
                    ...n,
                    id: `${n.id}-${Date.now()}`, // Unique IDs to avoid collision if dropped multiple times
                    position: {
                        x: n.position.x + offsetX,
                        y: n.position.y + offsetY
                    },
                    data: isInputNode ? {
                        ...n.data,
                        label: n.id,
                        // For input nodes, extract custom_function from params and place it directly in data
                        custom_function: n.params?.custom_function || '',
                        initialCode: n.params?.custom_function || '',
                        currentValue: "Ready"
                    } : {
                        ...n.data,
                        label: n.id,
                        // For neuron nodes, keep params in parameters
                        parameters: n.params
                    },
                    type: isInputNode ? 'input' : 'neuron'
                };
            });

            // Map edges to new unique IDs
            // We need a map of oldID -> newID
            const idMap: Record<string, string> = {};
            network.nodes.forEach((n: any, i: number) => {
                idMap[n.id] = newNodes[i].id;
            });

            const newEdges = network.edges.map((e: any) => ({
                ...e,
                id: `e-${e.source}-${e.target}-${Date.now()}`,
                source: idMap[e.source],
                target: idMap[e.target]
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

    return (
        <div className="playground-container">
            {/* Left Panel: Visualizer */}
            <div className="playground-visualizer">
                {/* Visualizer content */}
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
                </ReactFlowLayout>
            </div>

            {/* Right Panel: Experiment Setup */}
            <div className="playground-setup-panel">
                <div className="playground-setup-header">
                    <h2 className="playground-setup-title">Experiment Setup</h2>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>

                    {/* Inputs Category */}
                    <AccordionSection title="Inputs" defaultOpen={false}>
                        <label className="playground-label">Input Source</label>
                        <select
                            className="playground-select"
                            onChange={(e) => setSelectedInputType(e.target.value)}
                            value={selectedInputType}
                        >
                            <option value="python">Python Generator</option>
                            <option value="sensor">Sensor Stream</option>
                        </select>

                        {selectedInputType === 'python' && (
                            <div className="form-group-mt">
                                <label className="playground-label">Generator Code</label>
                                <textarea
                                    className="playground-textarea"
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
                        <label className="playground-label">Output Processor</label>
                        <select
                            className="playground-select"
                            onChange={(e) => setSelectedOutputType(e.target.value)}
                            value={selectedOutputType}
                        >
                            <option value="display">Real-time Display</option>
                            <option value="postprocessor">Postprocessor Script</option>
                        </select>

                        {selectedOutputType === 'postprocessor' && (
                            <div className="form-group-mt">
                                <label className="playground-label">Processing Script</label>
                                <textarea
                                    className="playground-textarea"
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
                        className="playground-apply-button w-full"
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
