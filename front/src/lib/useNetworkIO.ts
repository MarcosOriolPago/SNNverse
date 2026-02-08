import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { NeuronNodeData } from '../components/reactFlow/NeuronNode';
import type { InputNodeData } from '../components/reactFlow/PyInputFx';

// Types for your specific node data if not already exported globally
// Ideally these should be in a types file, but using what we have.

export const useNetworkIO = () => {

    const saveNetwork = useCallback(async (name: string, nodes: Node[], edges: Edge[]) => {
        try {
            const payload = {
                network_name: name,
                nodes: nodes.map(n => {
                    if (n.type === 'input') {
                        return {
                            id: n.id,
                            type: 'PYTHON',
                            position: n.position,
                            params: { code: (n.data as InputNodeData).initialCode || (n.data as InputNodeData).custom_function }
                        };
                    } else if (n.type === 'keyboard') {
                        // Reconstruct keyMap from edges to ensure it's saved in node params
                        const nodeEdges = edges.filter(e => e.source === n.id);
                        const keyMap: Record<string, string> = {};
                        nodeEdges.forEach(e => {
                            const key = e.data?.key as string;
                            if (key) keyMap[key] = e.target;
                        });

                        return {
                            id: n.id,
                            type: 'KEYBOARD',
                            position: n.position,
                            params: { keyMap }
                        };
                    } else {
                        return {
                            id: n.id,
                            type: (n.data as NeuronNodeData).parameters?.type || 'LIF',
                            position: n.position,
                            params: (n.data as NeuronNodeData).parameters
                        };
                    }
                }),
                edges: edges.map(e => ({
                    source: e.source,
                    target: e.target,
                    weight: 1.0,
                    data: e.data || {}
                }))
            };

            const response = await fetch('http://localhost:8000/api/network/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to save network');

            await response.json();
            return true;
        } catch (error) {
            console.error("Error saving network:", error);
            return false;
        }
    }, []);

    const loadNetwork = useCallback(async (name: string) => {
        try {
            const response = await fetch(`http://localhost:8000/api/network/load_saved/${name}`);
            if (!response.ok) throw new Error("Failed to load network");

            const data = await response.json();
            return data.network;
        } catch (error) {
            console.error("Error loading network:", error);
            return null;
        }
    }, []);

    return { saveNetwork, loadNetwork };
};
