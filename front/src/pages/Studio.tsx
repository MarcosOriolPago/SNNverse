import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_CONFIG } from '../config/api';
import {
    useNodesState,
    useEdgesState,
    ReactFlowProvider,
    type Edge,
} from '@xyflow/react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { CANVAS_DROP_ID } from '../components/layout/CanvasDropZone';
import type { PanelImperativeHandle } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import '@xyflow/react/dist/base.css';

import { ReactFlowLayout } from '../components/layout/ReactFlowLayout';
import { BuilderBlockSelector } from '../components/layout/BuilderBlockSelector';
import SpikeRatePopup from '../components/widgets/simulation/SpikeRatePopup';
import BuilderControls from '../components/widgets/simulation/BuilderControls';
import SaveNetworkDialog from '../components/ui/SaveNetworkDialog';
import { ToggleMenu, type StudioMode } from '../components/widgets/toggleMenu';
import SimulationFloatingToolkit from '../components/widgets/SimulationFloatingToolkit';
import RealTimeToolkit from '../components/widgets/RealTimeToolkit';

import { useGeNNLogic } from '../hooks/useGeNNLogic';
import { useAxonVisualizer } from '../hooks/useAxonVisualizer';
import { useNetworkPersistence } from '../hooks/useNetworkPersistence';
import { useLayerSynapseProxies } from '../hooks/useLayerSynapseProxies';
import { useGraphBuilder } from '../lib/useGraphBuilder';
import { useNetworkIO } from '../lib/useNetworkIO';
import { useOfflinePlayback } from '../hooks/useOfflinePlayback';
import { initialNodes, initialEdges, nodeTypes, edgeTypes, defaultEdgeOptions } from '../config/nodeGraphConfig';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserMenu } from '../components/UserMenu';
import { useAuth } from '../context/AuthContext';

const BLOCK_LABELS: Record<string, string> = {
    'layer-LIF': 'LIF Layer',
    'layer-IF': 'IF Layer',
    'layer-Izhikevich': 'Izhikevich Layer',
    'neuron-LIF': 'LIF Neuron',
    'neuron-IF': 'IF Neuron',
    'neuron-Izhikevich': 'Izhikevich Neuron',
    'spike-fx': 'Spike FX Input',
};

const StudioContent = () => {
    const [mode, setMode] = useState<StudioMode>('building');
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

    // Offline / Simulation State
    const [offlineConfig, setOfflineConfig] = useState({ duration: 1000, dt: 1.0 });
    const [offlineSession, setOfflineSession] = useState<any>(null);
    const [currentOfflineFrame, setCurrentOfflineFrame] = useState<any>(null);

    // Realtime / Benchmark State
    const [benchmarkResult, setBenchmarkResult] = useState<any>(null);
    const [showBenchmarkWarning, setShowBenchmarkWarning] = useState(false);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isAdmin } = useAuth();

    // Add refs and state for collapsible BuilderBlockSelector
    const builderPanelRef = useRef<PanelImperativeHandle>(null);

    const networkName = searchParams.get('networkName');
    const networkId = searchParams.get('networkId');   // DB UUID, set after first save
    const isTemplateParam = searchParams.get('isTemplate') === 'true';
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

    useNetworkPersistence(networkName, networkId, shouldLoadConfig, setNodes, setEdges, setIsCompiled);

    const { onDragOver, onDrop, onConnect, addNodeFromDrop } = useGraphBuilder({
        nodes,
        setNodes,
        setEdges,
        isCompiling
    });
    useLayerSynapseProxies(nodes, edges, setEdges);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        })
    );

    const handleDndDragStart = useCallback((event: DragStartEvent) => {
        setActiveBlockId(String(event.active.id));
    }, []);

    const handleDndDragEnd = useCallback(
        (event: DragEndEvent) => {
            setActiveBlockId(null);
            const { active, over } = event;
            if (!over || over.id !== CANVAS_DROP_ID) return;

            const data = active.data?.current as Record<string, unknown> | undefined;
            if (!data || typeof data.nodeType !== 'string') return;

            const rect = active.rect?.current?.translated;
            if (!rect) return;

            const clientX = rect.left + rect.width / 2;
            const clientY = rect.top + rect.height / 2;

            addNodeFromDrop(clientX, clientY, data);
        },
        [addNodeFromDrop]
    );

    const { saveNetwork } = useNetworkIO();
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [isSavingNetwork, setIsSavingNetwork] = useState(false);

    const executeSave = useCallback(async (name: string, saveAsTemplate: boolean, closeDialogOnSuccess = false) => {
        if (isSavingNetwork) return;

        setIsSavingNetwork(true);
        try {
            const result = await saveNetwork(name, nodes, edges, networkId, saveAsTemplate);
            if (!result.success) return;

            const savedNetworkId = result.networkId ?? networkId ?? undefined;
            const shouldUpdateUrl =
                name !== networkName ||
                saveAsTemplate !== isTemplateParam ||
                (savedNetworkId ?? null) !== networkId;

            if (shouldUpdateUrl) {
                setSearchParams({
                    networkName: name,
                    ...(savedNetworkId ? { networkId: savedNetworkId } : {}),
                    isTemplate: String(saveAsTemplate),
                    loadConfig: 'true',
                });
            }

            if (closeDialogOnSuccess) {
                setIsSaveDialogOpen(false);
            }
        } finally {
            setIsSavingNetwork(false);
        }
    }, [
        isSavingNetwork,
        saveNetwork,
        nodes,
        edges,
        networkId,
        networkName,
        isTemplateParam,
        setSearchParams
    ]);

    const handleSaveClick = useCallback(async () => {
        if (isSavingNetwork) return;

        if (isAdmin) {
            setIsSaveDialogOpen(true);
            return;
        }

        if (networkName) {
            await executeSave(networkName, false);
        } else {
            setIsSaveDialogOpen(true);
        }
    }, [isAdmin, isSavingNetwork, networkName, executeSave]);

    const handleDialogSave = useCallback(async (name: string, saveAsTemplate: boolean) => {
        await executeSave(name, saveAsTemplate, true);
    }, [executeSave]);

    // Offline Playback Hook
    const {
        currentTime: offlineTime,
        isPlaying: isOfflinePlaying,
        togglePlay: toggleOfflinePlay,
        setTime: setOfflineTime,
    } = useOfflinePlayback({
        sessionId: offlineSession?.session_id,
        dt: offlineConfig.dt,
        duration: offlineConfig.duration,
        playbackSpeed: currentSpeed,
        onFrameUpdate: (frame) => setCurrentOfflineFrame(frame)
    });

    // Merge Voltages & Spikes
    // Expand layer voltages: pop -> [v0,v1,...] becomes "pop-0"->v0, "pop-1"->v1 for children; "pop"->v0 for single-neuron
    const activeVoltages = useMemo(() => {
        if (mode === 'offline' && currentOfflineFrame?.voltages) {
            const m = new Map<string, number>();
            Object.entries(currentOfflineFrame.voltages).forEach(([pop, arr]) => {
                const vals = arr as number[];
                if (vals.length === 1) {
                    m.set(pop, vals[0]);
                } else {
                    vals.forEach((v, i) => m.set(`${pop}-${i}`, v));
                }
            });
            return m;
        }
        return voltages;
    }, [mode, currentOfflineFrame, voltages]);

    // For offline spikes, we need to filter from the full session data
    const activeSpikes = useMemo(() => {
        console.log(`[Spike Mapping] Mode: ${mode}, Offline Spikes Available: ${offlineSession?.spike_data ? 'Yes' : 'No'}`);
        if (mode === 'offline' && offlineSession?.spike_data) {
            const currentWindowSpikes = new Map();
            // Simple window calc: spikes in [t-dt, t]
            Object.entries(offlineSession.spike_data).forEach(([pop, data]: [string, any]) => {
                const times = data.times;
                const ids = data.ids;
                const matches = [];
                for (let i = 0; i < times.length; i++) {
                    if (times[i] > offlineTime - 30 && times[i] <= offlineTime) {
                        matches.push(ids[i]);
                    }
                }
                if (matches.length) currentWindowSpikes.set(pop, matches);
            });
            return currentWindowSpikes;
        }
        return spikes;
    }, [mode, offlineSession, offlineTime, spikes]);

    useAxonVisualizer(activeSpikes, currentSpeed);

    useEffect(() => {
        // Update nodes with voltages (standalone neurons and layer children)
        const sourceVoltages = activeVoltages;

        if (mode !== 'building' && sourceVoltages.size > 0) {
            setNodes((nds) => nds.map((node) => {
                const voltage = sourceVoltages.get(node.id);
                if (voltage !== undefined) {
                    return {
                        ...node,
                        data: { ...node.data, voltage }
                    };
                }
                return node;
            }));
        }
    }, [activeVoltages, setNodes, mode]);

    const [selectedAxon, setSelectedAxon] = useState<{ id: string; x: number; y: number } | null>(null);

    const handleEdgeClick = (event: React.MouseEvent, edge: Edge) => {
        if (mode === 'building') return; // Enabled in both offline and realtime
        event.preventDefault();
        event.stopPropagation();
        setSelectedAxon({ id: edge.id, x: event.clientX, y: event.clientY });
    };

    const handleModeChangeLogic = (_newMode: StudioMode) => {
        // Stop realtime if leaving realtime
        if (mode === 'realtime' && running) {
            handleRunStop();
        }
        // Stop offline playback if leaving offline
        if (mode === 'offline' && isOfflinePlaying) {
            toggleOfflinePlay();
        }
    };

    const handleRunOffline = async () => {
        if (!isCompiled) {
            await handleCompile();
        }

        try {
            const res = await fetch(API_CONFIG.SIMULATION.RUN_OFFLINE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(offlineConfig)
            });
            const data = await res.json();
            console.log('Received offline session data:', data);
            setOfflineSession(data);
            setOfflineTime(0);
        } catch (e) {
            console.error(e);
        }
    };

    const handleBenchmark = async () => {
        try {
            const res = await fetch(API_CONFIG.SIMULATION.BENCHMARK, { method: 'POST' });
            const data = await res.json();
            setBenchmarkResult(data);

            // Check warning condition: avg_step_ms > (1000 / input_rate)
            // Assuming max input rate 1000Hz for check
            if (data.avg_step_ms > 1.0) { // Simple threshold for now
                setShowBenchmarkWarning(true);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (mode === 'building' && builderPanelRef.current) {
            // Small delay to ensure the panel is rendered before resizing
            const timer = setTimeout(() => {
                const panel = builderPanelRef.current;
                if (panel && panel.isCollapsed()) {
                    panel.resize(25);
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [mode]);

    return (
        <div className="h-full w-full flex flex-col relative bg-bg-secondary">
            <DndContext sensors={sensors} onDragStart={handleDndDragStart} onDragEnd={handleDndDragEnd}>
            <ResizablePanelGroup id="studio-panels" orientation="horizontal" className="flex-1 overflow-hidden">
                <ResizablePanel
                    id="studio-main-panel"
                    defaultSize={mode === 'building' ? "75%" : "100%"}
                    minSize={mode === 'building' ? "75%" : "100%"}
                    className="relative"
                >
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
                        <div className="absolute top-4 left-4 z-50 flex items-center gap-3">
                            <button
                                onClick={() => navigate('/')}
                                className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors shadow-sm"
                            >
                                <ArrowLeft className="w-4 h-4 ml-2" />
                                <span className="font-medium text-sm mr-2">Home</span>
                            </button>
                        </div>
                        <div className="absolute bottom-4 left-4 z-50">
                            <UserMenu />
                        </div>

                        <ToggleMenu
                            mode={mode}
                            setMode={setMode}
                            onModeChange={handleModeChangeLogic}
                        />

                        {mode === 'offline' && (
                            <SimulationFloatingToolkit
                                offlineSession={offlineSession}
                                setOfflineSession={setOfflineSession}
                                offlineConfig={offlineConfig}
                                setOfflineConfig={setOfflineConfig}
                                isCompiling={isCompiling}
                                isCompiled={isCompiled}
                                handleRunOffline={handleRunOffline}
                                isOfflinePlaying={isOfflinePlaying}
                                toggleOfflinePlay={toggleOfflinePlay}
                                offlineTime={offlineTime}
                                setOfflineTime={setOfflineTime}
                                currentSpeed={currentSpeed}
                                setSpeed={setSpeed}
                            />
                        )}

                        {mode === 'realtime' && (
                            <RealTimeToolkit
                                handleBenchmark={handleBenchmark}
                                benchmarkResult={benchmarkResult}
                                showBenchmarkWarning={showBenchmarkWarning}
                                isCompiling={isCompiling}
                                isCompiled={isCompiled}
                                running={running}
                                onCompile={handleCompile}
                                onRunStop={handleRunStop}
                            />
                        )}

                        {selectedAxon && mode !== 'building' && (
                            <SpikeRatePopup
                                edgeId={selectedAxon.id}
                                position={{ x: selectedAxon.x, y: selectedAxon.y }}
                                onClose={() => setSelectedAxon(null)}
                            />
                        )}

                        {mode === 'building' && (
                            <BuilderControls
                                isCompiling={isCompiling}
                                isSaving={isSavingNetwork}
                                onVerify={handleCompile}
                                onSave={handleSaveClick}
                            />
                        )}

                        <SaveNetworkDialog
                            isOpen={isSaveDialogOpen}
                            onClose={() => setIsSaveDialogOpen(false)}
                            onSave={handleDialogSave}
                            initialName={networkName || ''}
                            isAdmin={isAdmin}
                            initialSaveAsTemplate={isTemplateParam}
                            isSaving={isSavingNetwork}
                        />

                    </ReactFlowLayout>
                </ResizablePanel>

                {mode === 'building' && (
                    <>
                        <ResizableHandle withHandle />
                        <ResizablePanel
                            id="studio-builder-panel"
                            ref={builderPanelRef}
                            defaultSize={"25%"}
                            minSize={"15%"}
                            maxSize={"40%"}
                            collapsible={true}
                            collapsedSize={"0%"}
                            className=" transition-[width] duration-300 ease-in-out"
                        >
                            <BuilderBlockSelector />
                        </ResizablePanel>
                    </>
                )}
            </ResizablePanelGroup>
            <DragOverlay dropAnimation={null}>
                {activeBlockId ? (
                    <div className="px-4 py-3 rounded-2xl bg-slate-800/90 backdrop-blur-md border border-cyan-400/50 shadow-lg shadow-cyan-500/20 text-slate-100 text-sm font-medium cursor-grabbing">
                        {BLOCK_LABELS[activeBlockId] ?? activeBlockId}
                    </div>
                ) : null}
            </DragOverlay>
            </DndContext>
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
