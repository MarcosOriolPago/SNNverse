import { useCallback } from 'react';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../context/AuthContext';
import type { Node, Edge } from '@xyflow/react';
import type { NeuronNodeData } from '../components/reactFlow/NeuronNode';
import type { InputNodeData } from '../components/reactFlow/PySpikeFx';

// Types for your specific node data if not already exported globally
// Ideally these should be in a types file, but using what we have.

export const useNetworkIO = () => {
    const { token } = useAuth();

    const saveNetwork = useCallback(async (name: string, nodes: Node[], edges: Edge[]) => {
        try {
            const payload = {
                network_name: name,
                nodes: nodes.map(n => {
                    if (n.type === 'spike_fx') {
                        return {
                            id: n.id,
                            type: 'SPIKE_FX',
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

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(API_CONFIG.NETWORK.SAVE, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to save network');

            await response.json();
            return true;
        } catch (error) {
            console.error("Error saving network:", error);
            return false;
        }
    }, [token]);

    const loadNetwork = useCallback(async (name: string) => {
        try {
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(API_CONFIG.NETWORK.LOAD_SAVED(name), { headers });
            if (!response.ok) throw new Error("Failed to load network");

            const data = await response.json();
            return data.network;
        } catch (error) {
            console.error("Error loading network:", error);
            return null;
        }
    }, [token]);

    const listNetworks = useCallback(async () => {
        console.log("[v0] listNetworks called, token exists:", !!token);
        try {
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            console.log("[v0] Fetching from:", API_CONFIG.NETWORK.LIST_SAVED);
            const response = await fetch(API_CONFIG.NETWORK.LIST_SAVED, { headers });
            console.log("[v0] Response status:", response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error("[v0] Response error:", errorText);
                throw new Error("Failed to list networks");
            }

            const data = await response.json();
            console.log("[v0] Networks received:", data);
            return data.networks;
        } catch (error) {
            console.error("[v0] Error listing networks:", error);
            return [];
        }
    }, [token]);

    return { saveNetwork, loadNetwork, listNetworks };
};
