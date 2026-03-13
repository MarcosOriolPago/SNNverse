import { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useGeNNStream } from './useGeNNStream';
import { API_CONFIG } from '../config/api';
import type { Node, Edge } from '@xyflow/react';
import type { NeuronNodeData } from '../components/reactFlow/NeuronNode';
import type { InputNodeData } from '../components/reactFlow/PySpikeFx';

interface GeNNLogicProps {
    networkName: string | null;
    shouldLoadConfig: boolean;
}

export const useGeNNLogic = ({ networkName, shouldLoadConfig }: GeNNLogicProps) => {
    const { getNodes, getEdges } = useReactFlow();
    const [isCompiling, setIsCompiling] = useState(false);
    const [isCompiled, setIsCompiled] = useState(false);
    const [networkLoaded, setNetworkLoaded] = useState(false);

    const {
        connect,
        disconnect,
        voltages,
        spikes,
        currentTime,
        running,
        start,
        stop,
        setSpeed,
        currentSpeed,
    } = useGeNNStream();

    // Connect to WebSocket on mount
    useEffect(() => {
        connect(API_CONFIG.WS_SIMULATION);
        return () => disconnect();
    }, []);

    const handleCompile = async () => {
        if (isCompiling || running) {
            console.warn('Cannot compile while compiling or running');
            return;
        }

        const payload = generatePayload(getNodes, getEdges, networkName);

        try {
            setIsCompiling(true);

            console.log('Building and compiling GeNN model...');
            console.log("PAYLOAD:", JSON.stringify(payload, null, 2)); // Debugging
            const compileResponse = await fetch(API_CONFIG.NETWORK.LOAD_GENN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!compileResponse.ok) throw new Error('Failed to compile model');

            disconnect();
            setTimeout(() => {
                connect(API_CONFIG.WS_SIMULATION);
            }, 500);

            setIsCompiling(false);
            setIsCompiled(true);
            setNetworkLoaded(true);

            console.log('✓ Compilation complete. Ready to start.');
        } catch (error) {
            console.error("Failed to compile model", error);
            setIsCompiling(false);
            setIsCompiled(false);
        }
    };

    const handleRunStop = async () => {
        if (running) {
            stop();
            return;
        }

        if (!isCompiled) {
            console.warn('Please compile the model first');
            return;
        }

        try {
            console.log('Starting simulation...');

            if (!networkLoaded && shouldLoadConfig && networkName) {
                console.log('Loading compiled network into backend...');

                const payload = generatePayload(getNodes, getEdges, networkName);
                const compileResponse = await fetch(API_CONFIG.NETWORK.LOAD_GENN, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!compileResponse.ok) throw new Error('Failed to load network');

                console.log('✓ Network loaded (used cached compilation)');

                // For reloading, we don't start the runner yet either.
                disconnect();
                setTimeout(() => {
                    connect(API_CONFIG.WS_SIMULATION);
                }, 500);

                setNetworkLoaded(true);
                console.log('✓ Network backend ready');
            }

            setTimeout(() => {
                start();
            }, networkLoaded ? 100 : 1000);

            console.log('✓ Simulation started');
        } catch (error) {
            console.error('Failed to start simulation:', error);
        }
    };

    return {
        isCompiling,
        isCompiled,
        setIsCompiled,
        networkLoaded,
        voltages,
        spikes,
        currentTime,
        running,
        currentSpeed,
        setSpeed,
        handleCompile,
        handleRunStop,
    };
};

function generatePayload(getNodes: () => Node[], getEdges: () => Edge[], networkName: string | null) {
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    // Only include root nodes (no parentId) - layers and standalone neurons
    // Exclude pending layers (neuron count not yet confirmed)
    const rootNodes = currentNodes.filter((n) => {
        if (n.parentId) return false;
        if (n.type === 'layer') {
            const d = n.data as { pending?: boolean; neuronCount?: number };
            if (d?.pending || (d?.neuronCount ?? 0) === 0) return false;
        }
        return true;
    });

    const payload = {
        nodes: rootNodes.map(n => {
            if (n.type === 'spike_fx') {
                return {
                    id: n.id,
                    type: 'SPIKE_FX',
                    params: {
                        custom_function: (n.data as InputNodeData).custom_function || '',
                        frequency: (n.data as InputNodeData).frequency || 100
                    },
                    size: 1,
                    position: n.position
                };
            } else if (n.type === 'keyboard') {
                // Build keyMap from edges for Keyboard Node (resolve child targets to parent)
                const outgoingEdges = currentEdges.filter(e => e.source === n.id);
                const keyMap: Record<string, string> = {};

                outgoingEdges.forEach(e => {
                    const key = e.data?.key as string;
                    if (key && e.target) {
                        const targetNode = currentNodes.find((nd) => nd.id === e.target);
                        keyMap[key] = targetNode?.parentId ?? e.target;
                    }
                });

                return {
                    id: n.id,
                    type: 'KEYBOARD',
                    params: { keyMap },
                    size: 1,
                    position: n.position
                };
            } else if (n.type === 'layer') {
                const layerData = n.data as { neuronCount?: number; neuronType?: string; parameters?: Record<string, unknown> };
                return {
                    id: n.id,
                    type: layerData.neuronType || 'LIF',
                    params: layerData.parameters || {},
                    size: layerData.neuronCount ?? 1,
                    position: n.position
                };
            } else {
                return {
                    id: n.id,
                    type: (n.data as NeuronNodeData).parameters?.type || 'LIF',
                    params: (n.data as NeuronNodeData).parameters || {},
                    size: (n.data as NeuronNodeData).size || 1,
                    position: n.position
                };
            }
        }),
        edges: currentEdges
            .filter(e => {
                if (!e.source || !e.target) return false;
                const edgeData = e.data as { proxyFor?: string } | undefined;
                return !edgeData?.proxyFor;
            })
            .map(e => {
                const sourceNode = currentNodes.find((n) => n.id === e.source);
                const targetNode = currentNodes.find((n) => n.id === e.target);
                const source = sourceNode?.parentId ?? e.source;
                const target = targetNode?.parentId ?? e.target;
                return {
                    source,
                    target,
                    data: e.type === 'synapse' ? { connectionType: (e.data as { connectionType?: string })?.connectionType ?? 'dense' } : e.data
                };
            }),
        network_name: networkName || undefined
    };

    return payload;
}