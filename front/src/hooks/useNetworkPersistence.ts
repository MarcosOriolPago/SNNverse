import { useEffect } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import type { NeuronNodeData } from '../components/blocks/NeuronNode';
import type { InputNodeData } from '../components/blocks/InputNode';

export const useNetworkPersistence = (
    networkName: string | null,
    shouldLoadConfig: boolean,
    setNodes: (nodes: Node<NeuronNodeData | InputNodeData>[]) => void,
    setEdges: (edges: Edge[]) => void,
    setIsCompiled: (compiled: boolean) => void
) => {

    useEffect(() => {
        if (shouldLoadConfig && networkName) {
            const loadSavedNetwork = async () => {
                try {
                    const response = await fetch(`http://localhost:8000/api/network/load_saved/${encodeURIComponent(networkName)}`);
                    const data = await response.json();

                    if (data.status === 'success' && data.network) {
                        const savedNetwork = data.network;

                        // Check if network is already compiled
                        if (data.is_compiled) {
                            console.log('✓ Network is already compiled, enabling Run button');
                            setIsCompiled(true);
                        } else {
                            console.log('⚠ Network not compiled, will require compilation');
                        }

                        // Restore nodes with positions
                        const restoredNodes = savedNetwork.nodes.map((node: any) => {
                            if (node.type === 'PYTHON') {
                                return {
                                    id: node.id,
                                    type: 'input',
                                    position: node.position || { x: 100, y: 100 },
                                    data: {
                                        initialCode: node.params.custom_function || '',
                                        custom_function: node.params.custom_function || '',
                                        currentValue: 'Ready',
                                        label: 'Python Generator'
                                    }
                                };
                            } else if (node.type === 'KEYBOARD') {
                                return {
                                    id: node.id,
                                    type: 'keyboard',
                                    position: node.position || { x: 100, y: 100 },
                                    data: {
                                        label: 'Keyboard Input',
                                        params: node.params || { keyMap: {} }
                                    }
                                };
                            } else {
                                return {
                                    id: node.id,
                                    type: 'neuron',
                                    position: node.position || { x: 400, y: 100 },
                                    data: {
                                        voltage: -70.0,
                                        parameters: { ...node.params, type: node.type }
                                    }
                                };
                            }
                        });

                        // Restore edges
                        const restoredEdges = savedNetwork.edges.map((edge: any, idx: number) => ({
                            id: `e${idx}`,
                            source: edge.source,
                            target: edge.target,
                            type: edge.data?.key ? 'keyboardEdge' : 'spike',
                            data: edge.data || {}
                        }));

                        setNodes(restoredNodes);
                        setEdges(restoredEdges);

                        console.log('✓ Network configuration loaded:', networkName);
                    }
                } catch (error) {
                    console.error('Error loading saved network:', error);
                }
            };

            loadSavedNetwork();
        }
    }, [shouldLoadConfig, networkName, setNodes, setEdges, setIsCompiled]);
};
