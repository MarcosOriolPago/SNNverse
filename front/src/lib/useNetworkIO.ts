import { useCallback, useEffect, useRef } from 'react';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../context/AuthContext';
import type { Node, Edge } from '@xyflow/react';
import type { NeuronNodeData } from '../components/reactFlow/NeuronNode';
import type { InputNodeData } from '../components/reactFlow/PySpikeFx';

export const useNetworkIO = () => {
    const { token } = useAuth();

    // Keep a ref that always reflects the latest token without leaking it
    // into callback dependency arrays (which would make them unstable).
    const tokenRef = useRef(token);
    useEffect(() => {
        tokenRef.current = token;
    }, [token]);

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
            const currentToken = tokenRef.current;
            if (currentToken) {
                headers['Authorization'] = `Bearer ${currentToken}`;
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
    }, []); // stable — reads token from ref at call-time

    const loadNetwork = useCallback(async (name: string) => {
        try {
            const headers: Record<string, string> = {};
            const currentToken = tokenRef.current;
            if (currentToken) {
                headers['Authorization'] = `Bearer ${currentToken}`;
            }

            const response = await fetch(API_CONFIG.NETWORK.LOAD_SAVED(name), { headers });
            if (!response.ok) throw new Error("Failed to load network");

            const data = await response.json();
            return data.network;
        } catch (error) {
            console.error("Error loading network:", error);
            return null;
        }
    }, []); // stable — reads token from ref at call-time

    const listNetworks = useCallback(async () => {
        try {
            const headers: Record<string, string> = {};
            const currentToken = tokenRef.current;
            if (currentToken) {
                headers['Authorization'] = `Bearer ${currentToken}`;
            }

            const response = await fetch(API_CONFIG.NETWORK.LIST_SAVED, { headers });
            if (!response.ok) throw new Error("Failed to list networks");

            const data = await response.json();
            return data.networks;
        } catch (error) {
            console.error("Error listing networks:", error);
            return [];
        }
    }, []); // stable — reads token from ref at call-time

    return { saveNetwork, loadNetwork, listNetworks };
};
