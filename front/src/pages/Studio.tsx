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
import { ToggleMenu, type StudioMode } from '../components/widgets/toggleMenu';

import { useGeNNLogic } from '../hooks/useGeNNLogic';
import { useAxonVisualizer } from '../hooks/useAxonVisualizer';
import { useNetworkPersistence } from '../hooks/useNetworkPersistence';
import { useGraphBuilder } from '../lib/useGraphBuilder';
import { useNetworkIO } from '../lib/useNetworkIO';
import { initialNodes, initialEdges, nodeTypes, edgeTypes, defaultEdgeOptions } from '../config/nodeGraphConfig';

const StudioContent = () => {
    const [mode, setMode] = useState<StudioMode>('building');
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

    const handleModeChangeLogic = (newMode: StudioMode) => {
        // If we are switching back to building, stop the simulation
        if (newMode === 'building' && running) {
            handleRunStop();
        }
    };

    return (
        <div className="h-full w-full flex flex-col relative bg-bg-secondary">
            <ToggleMenu
                mode={mode}
                setMode={setMode}
                onModeChange={handleModeChangeLogic}
            />

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
        </div >
    );
};

export default function Studio() {
    return (
        <ReactFlowProvider>
            <StudioContent />
        </ReactFlowProvider>
    );
}