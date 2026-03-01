import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_CONFIG } from '../config/api';
import {
    useNodesState,
    useEdgesState,
    ReactFlowProvider
} from '@xyflow/react';
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
import { useGraphBuilder } from '../lib/useGraphBuilder';
import { useNetworkIO } from '../lib/useNetworkIO';
import { useOfflinePlayback } from '../hooks/useOfflinePlayback';
import { initialNodes, initialEdges, nodeTypes, edgeTypes, defaultEdgeOptions } from '../config/nodeGraphConfig';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserMenu } from '../components/UserMenu';

const StudioContent = () => {
    const [mode, setMode] = useState<StudioMode>('building');

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

    // Add refs and state for collapsible BuilderBlockSelector
    const builderPanelRef = useRef<PanelImperativeHandle>(null);

    const networkName = searchParams.get('networkName');
    const networkId = searchParams.get('networkId');   // DB UUID, set after first save
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

    const handleSaveClick = useCallback(async () => {
        if (networkName) {
            // Silent save for existing networks — pass the tracked network_id so the
            // backend can do an unambiguous primary-key update instead of name-matching.
            const result = await saveNetwork(networkName, nodes, edges, networkId);
            if (result.success && result.networkId && !networkId) {
                // Store the ID for future saves (edge case: name-based match on first update)
                setSearchParams({ networkName, networkId: result.networkId, loadConfig: 'true' });
            }
        } else {
            setIsSaveDialogOpen(true);
        }
    }, [networkName, networkId, nodes, edges, saveNetwork, setSearchParams]);

    const handleDialogSave = async (name: string) => {
        const result = await saveNetwork(name, nodes, edges, networkId);
        if (result.success) {
            setSearchParams({
                networkName: name,
                ...(result.networkId ? { networkId: result.networkId } : {}),
                loadConfig: 'true',
            });
            setIsSaveDialogOpen(false);
        }
    };

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
    const activeVoltages = useMemo(() => {
        return (mode === 'offline' && currentOfflineFrame?.voltages)
            ? new Map(Object.entries(currentOfflineFrame.voltages).map(([k, v]) => [k, (v as number[])[0]])) // Using 1st neuron voltage for now
            : voltages;
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
        // Update nodes with voltages
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

    const handleEdgeClick = (event: React.MouseEvent, edge: any) => {
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
