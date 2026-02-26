import { useEffect } from 'react';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../context/AuthContext';
import type { Node, Edge } from '@xyflow/react';
import type { NeuronNodeData } from '../components/reactFlow/NeuronNode';
import type { InputNodeData } from '../components/reactFlow/PySpikeFx';
import { mapBackendNodeToReactFlow, mapBackendEdgeToReactFlow } from '../lib/networkHelpers';

export const useNetworkPersistence = (
    networkName: string | null,
    shouldLoadConfig: boolean,
    setNodes: (nodes: Node<NeuronNodeData | InputNodeData>[]) => void,
    setEdges: (edges: Edge[]) => void,
    setIsCompiled: (compiled: boolean) => void
) => {
    const { token } = useAuth();

    useEffect(() => {
        if (shouldLoadConfig && networkName) {
            const loadSavedNetwork = async () => {
                try {
                    const headers: Record<string, string> = {};
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }

                    const response = await fetch(API_CONFIG.NETWORK.LOAD_SAVED(networkName), { headers });
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

                        // Restore nodes
                        const restoredNodes = savedNetwork.nodes.map((node: any) => mapBackendNodeToReactFlow(node));

                        const idMap: Record<string, string> = {};
                        savedNetwork.nodes.forEach((n: any, i: number) => {
                            idMap[n.id] = restoredNodes[i].id;
                        });

                        // Restore edges
                        const restoredEdges = savedNetwork.edges.map((edge: any) => mapBackendEdgeToReactFlow(edge, idMap));

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
    }, [shouldLoadConfig, networkName, setNodes, setEdges, setIsCompiled, token]);
};
