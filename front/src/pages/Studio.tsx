import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    useNodesState,
    useEdgesState,
    ReactFlowProvider
} from '@xyflow/react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import '@xyflow/react/dist/base.css';

import { ReactFlowLayout } from '../components/layout/ReactFlowLayout';
import { BuilderBlockSelector } from '../components/layout/BuilderBlockSelector';
import ControlPanel from '../components/widgets/simulation/ControlPanel';
import SpeedControl from '../components/widgets/simulation/SpeedControl';
import SpikeRatePopup from '../components/widgets/simulation/SpikeRatePopup';
import BuilderControls from '../components/widgets/simulation/BuilderControls';
import SaveNetworkDialog from '../components/ui/SaveNetworkDialog';

import { useGeNNLogic } from '../hooks/useGeNNLogic';
import { useAxonVisualizer } from '../hooks/useAxonVisualizer';
import { useNetworkPersistence } from '../hooks/useNetworkPersistence';
import { useGraphBuilder } from '../lib/useGraphBuilder';
import { useNetworkIO } from '../lib/useNetworkIO';
import { initialNodes, initialEdges, nodeTypes, edgeTypes, defaultEdgeOptions } from '../config/nodeGraphConfig';

const StudioContent = () => {
    const [mode, setMode] = useState<'building' | 'simulating'>('building');
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [searchParams, setSearchParams] = useSearchParams();

    const networkName = searchParams.get('networkName');
    const shouldLoadConfig = searchParams.get('loadConfig') === 'true';

    const {
        isCompiling,
        setIsCompiled,
        isCompiled,
        running,
        currentSpeed,
        setSpeed,
        handleCompile,
        handleRunStop,
        voltages,
        spikes,
    } = useGeNNLogic({ networkName, shouldLoadConfig });

    useNetworkPersistence(networkName, shouldLoadConfig, setNodes, setEdges, setIsCompiled);

    const { onDragOver, onDrop, onConnect } = useGraphBuilder({
        nodes,
        setNodes,
        setEdges,
        isCompiling
    });

    const { saveNetwork } = useNetworkIO();
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

    const handleSaveClick = useCallback(() => {
        if (networkName) {
            saveNetwork(networkName, nodes, edges);
        } else {
            setIsSaveDialogOpen(true);
        }
    }, [networkName, nodes, edges, saveNetwork]);

    const handleDialogSave = async (name: string) => {
        const success = await saveNetwork(name, nodes, edges);
        if (success) {
            setSearchParams({ networkName: name, loadConfig: 'true' });
            setIsSaveDialogOpen(false);
        }
    };

    useAxonVisualizer(spikes, currentSpeed);

    useEffect(() => {
        if (mode === 'simulating' && voltages.size > 0) {
            setNodes((nds) => nds.map((node) => {
                const voltage = voltages.get(node.id);
                if (voltage !== undefined) {
                    return {
                        ...node,
                        data: { ...node.data, voltage }
                    };
                }
                return node;
            }));
        }
    }, [voltages, setNodes, mode]);

    const [selectedAxon, setSelectedAxon] = useState<{ id: string; x: number; y: number } | null>(null);

    const handleEdgeClick = (event: React.MouseEvent, edge: any) => {
        if (mode !== 'simulating') return;
        event.preventDefault();
        event.stopPropagation();
        setSelectedAxon({ id: edge.id, x: event.clientX, y: event.clientY });
    };

    const toggleMode = () => {
        if (mode === 'building') {
            setMode('simulating');
        } else {
            setMode('building');
            if (running) handleRunStop();
        }
    };

    return (
        <div className="h-full w-full flex flex-col">
            <div className="flex justify-center items-center p-2 bg-bg-secondary border-b border-border-primary">
                <div
                    onClick={toggleMode}
                    className="bg-bg-primary rounded-full p-1 flex items-center border border-border-primary cursor-pointer relative w-64 h-10"
                >
                    <div
                        className="absolute h-[80%] w-[48%] bg-accent-primary rounded-full transition-all duration-300 ease-in-out"
                        style={{
                            left: mode === 'building' ? '2%' : '50%',
                        }}
                    />
                    <div className={`flex-1 text-center py-1 z-10 text-sm font-medium transition-colors duration-300 ${mode === 'building' ? 'text-white' : 'text-text-secondary'}`}>
                        Building
                    </div>
                    <div className={`flex-1 text-center py-1 z-10 text-sm font-medium transition-colors duration-300 ${mode === 'simulating' ? 'text-white' : 'text-text-secondary'}`}>
                        Simulating
                    </div>
                </div>
            </div>

            <ResizablePanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
                <ResizablePanel defaultSize={mode === 'building' ? 75 : 100} className="relative">
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
                        isInteractive={mode === 'building' && !isCompiling}
                    >
                        {mode === 'simulating' && (
                            <>
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
                                {selectedAxon && (
                                    <SpikeRatePopup
                                        edgeId={selectedAxon.id}
                                        position={{ x: selectedAxon.x, y: selectedAxon.y }}
                                        onClose={() => setSelectedAxon(null)}
                                    />
                                )}
                            </>
                        )}

                        {mode === 'building' && (
                            <BuilderControls
                                isCompiling={isCompiling}
                                onVerify={handleCompile}
                                onSave={handleSaveClick}
                            />
                        )}

                        <SaveNetworkDialog
                            isOpen={isSaveDialogOpen}
                            onClose={() => setIsSaveDialogOpen(false)}
                            onSave={handleDialogSave}
                            initialName={networkName || ''}
                        />

                    </ReactFlowLayout>
                </ResizablePanel>

                {mode === 'building' && (
                    <>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={25} minSize={15} maxSize={40} className="bg-bg-secondary">
                            <BuilderBlockSelector />
                        </ResizablePanel>
                    </>
                )}
            </ResizablePanelGroup>
        </div>
    );
};

export default function Studio() {
    return (
        <ReactFlowProvider>
            <StudioContent />
        </ReactFlowProvider>
    );
}