import { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useGeNNStream } from './useGeNNStream';
import type { NeuronNodeData } from '../components/blocks/NeuronNode';
import type { InputNodeData } from '../components/blocks/InputNode';

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
        connect('ws://localhost:8000/api/ws/simulation');
        return () => disconnect();
    }, []);

    const handleCompile = async () => {
        if (isCompiling || running) {
            console.warn('Cannot compile while compiling or running');
            return;
        }

        const currentNodes = getNodes();
        const currentEdges = getEdges();

        const payload = {
            nodes: currentNodes.map(n => {
                const isInputNode = n.type === 'input';
                return {
                    id: n.id,
                    type: isInputNode ? 'PYTHON' : ((n.data as NeuronNodeData).parameters?.type || 'LIF'),
                    params: isInputNode
                        ? { custom_function: (n.data as InputNodeData).custom_function || '' }
                        : ((n.data as NeuronNodeData).parameters || {}),
                    size: (n.data as NeuronNodeData).size || 1,
                    position: n.position
                };
            }),
            edges: currentEdges.map(e => ({
                source: e.source,
                target: e.target
            })),
            network_name: networkName || undefined
        };

        try {
            setIsCompiling(true);

            console.log('Building and compiling GeNN model...');
            const compileResponse = await fetch('http://localhost:8000/api/network/load_genn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!compileResponse.ok) throw new Error('Failed to compile model');

            // Do NOT start runner automatically. Wait for user to click Run.
            // But we do need to connect the WebSocket to be ready.
            disconnect();
            setTimeout(() => {
                const wsUrl = 'ws://localhost:8000/api/ws/simulation';
                connect(wsUrl);
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

                const currentNodes = getNodes();
                const currentEdges = getEdges();

                const payload = {
                    nodes: currentNodes.map(n => {
                        const isInputNode = n.type === 'input';
                        return {
                            id: n.id,
                            type: isInputNode ? 'PYTHON' : ((n.data as NeuronNodeData).parameters?.type || 'LIF'),
                            params: isInputNode
                                ? { custom_function: (n.data as InputNodeData).custom_function || '' }
                                : ((n.data as NeuronNodeData).parameters || {}),
                            size: (n.data as NeuronNodeData).size || 1,
                            position: n.position
                        };
                    }),
                    edges: currentEdges.map(e => ({
                        source: e.source,
                        target: e.target
                    })),
                    network_name: networkName || undefined
                };

                const compileResponse = await fetch('http://localhost:8000/api/network/load_genn', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!compileResponse.ok) throw new Error('Failed to load network');

                console.log('✓ Network loaded (used cached compilation)');

                // For reloading, we don't start the runner yet either.
                disconnect();
                setTimeout(() => {
                    const wsUrl = 'ws://localhost:8000/api/ws/simulation';
                    connect(wsUrl);
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
