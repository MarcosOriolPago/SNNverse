import React, { useState, useEffect } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState, type Node, type Edge } from '@xyflow/react';
import { useNetworkList } from '../hooks/useNetworkList';
import { useGeNNLogic } from '../hooks/useGeNNLogic';
import FlowCanvas from './common/FlowCanvas';
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

const PlaygroundContent = () => {
    const { screenToFlowPosition } = useReactFlow();
    // State for Selectors
    const { networks } = useNetworkList();
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

            let newNode: Node;

            if (nodeType === 'network') {
                newNode = {
                    id: `network-${networkName}-${Date.now()}`,
                    type: 'network',
                    position,
                    data: {
                        label: networkName,
                        networkName: networkName
                    }
                };
            } else {
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
                            initialCode: "# Custom Input Code\n",
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
            }

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes],
    );

    return (
        <div className="playground-container">
            {/* Left Panel: Visualizer */}
            <div className="playground-visualizer">
                {/* Visualizer content */}
                <FlowCanvas
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
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
                        <div className="playground-controls-overlay">
                            <SpeedControl currentSpeed={currentSpeed} setSpeed={setSpeed} />
                        </div>
                    )}
                </FlowCanvas>
            </div>

            {/* Right Panel: Experiment Setup */}
            <div className="playground-setup-panel">
                <div className="playground-setup-header">
                    <h2 className="playground-setup-title">Experiment Setup</h2>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>

                    {/* 2. Inputs Category */}
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
                            <div className="playground-input-group mt-3">
                                <label className="playground-label">Generator Code</label>
                                <textarea
                                    className="playground-textarea"
                                    value={inputDef}
                                    onChange={(e) => setInputDef(e.target.value)}
                                />
                            </div>
                        )}

                        {selectedInputType === 'sensor' && (
                            <div className="p-3 bg-slate-900 rounded border border-slate-800 text-sm text-slate-400 mt-3">
                                Connect external sensor streams via websocket port 8001.
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-slate-800">
                            <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Draggable Items</div>
                            <div className="flex flex-wrap gap-2">
                                <DraggableInput isCollapsed={false} />
                                {/* Add more draggable items here if needed */}
                            </div>
                        </div>
                    </AccordionSection>

                    {/* 3. Networks Category (Updated) */}
                    <AccordionSection title="Networks" defaultOpen={true}>
                        <div className="text-xs text-slate-500 mb-3">
                            Drag networks to the canvas to use them as blocks.
                        </div>
                        <div className="flex flex-col gap-2">
                            {networks.length === 0 && <div className="text-sm text-slate-500 italic">No saved networks found.</div>}
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
                            <div className="playground-input-group mt-3">
                                <label className="playground-label">Processing Script</label>
                                <textarea
                                    className="playground-textarea"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-slate-800">
                            <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Draggable Items</div>
                            <div className="flex flex-wrap gap-2">
                                <DraggableOutput isCollapsed={false} />
                            </div>
                        </div>
                    </AccordionSection>

                </div>

                <div className="p-4 border-t border-slate-800">
                    <button className="playground-apply-button w-full">
                        Initialize Experiment
                    </button>
                </div>
            </div >
        </div >
    );
};

const Playground: React.FC = () => {
    return (
        <ReactFlowProvider>
            <PlaygroundContent />
        </ReactFlowProvider>
    );
};

export default Playground;
