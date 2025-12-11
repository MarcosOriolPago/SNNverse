import { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useGeNNStream } from './useGeNNStream';
import type { NeuronNodeData } from '../components/blocks/NeuronNode';
import type { InputNodeData } from '../components/blocks/InputNode';

interface GeNNLogicProps {
    networkName: string | null;
    shouldLoadConfig: boolean;
}

interface StartGeNNResponse {
    websocket_url?: string;
    status?: string;
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

            console.log('Starting C++ runner and input providers...');
            const startResponse = await fetch('http://localhost:8000/api/simulation/start_genn', {
                method: 'POST'
            });

            if (!startResponse.ok) throw new Error('Failed to start C++ runner');

            const startData = await startResponse.json() as StartGeNNResponse;

            disconnect();
            setTimeout(() => {
                const wsUrl = startData?.websocket_url || 'ws://localhost:8000/api/ws/simulation';
                connect(wsUrl);
            }, 500);

            setIsCompiling(false);
            setIsCompiled(true);
            setNetworkLoaded(true);

            console.log('✓ Compilation complete. C++ runner ready.');
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

                const startResponse = await fetch('http://localhost:8000/api/simulation/start_genn', {
                    method: 'POST'
                });

                if (!startResponse.ok) throw new Error('Failed to start runner');

                const startData = await startResponse.json() as StartGeNNResponse;

                disconnect();
                setTimeout(() => {
                    const wsUrl = startData?.websocket_url || 'ws://localhost:8000/api/ws/simulation';
                    connect(wsUrl);
                }, 500);

                setNetworkLoaded(true);
                console.log('✓ Runner started');
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
        running,
        currentSpeed,
        setSpeed,
        handleCompile,
        handleRunStop,
    };
};
