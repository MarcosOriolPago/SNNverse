
import { useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { eventBus } from '../lib/EventBus';
import { sanitizeId } from '@/lib/ids';

/**
 * Hook to visualize spike rates on Axon edges
 * normalizes rate based on simulation speed
 */
export const useAxonVisualizer = (spikes: string[] | Map<string, any>, currentSpeed: number) => {
    const { getEdges, getNodes } = useReactFlow();

    // Counter for spikes per edge: edgeId -> count
    const edgeSpikeCounts = useRef<Record<string, number>>({});

    // Last time we emitted an update
    const lastEmitTime = useRef(Date.now());

    useEffect(() => {
        if (!spikes || (Array.isArray(spikes) && spikes.length === 0) || (spikes instanceof Map && spikes.size === 0)) return;

        // 1. Fetch current edges to know connectivity
        const edges = getEdges();

        // 2. Identify active edges
        const activeSourceIds = new Set<string>();

        if (spikes instanceof Map) {
            for (const [key, val] of spikes.entries()) {
                // If value is a list of neurons that fired, and length > 0, then the population (key) is active
                if (Array.isArray(val) && val.length > 0) {
                    activeSourceIds.add(key);
                } else if (val === true || (Array.isArray(val) && val.length > 0)) {
                    // Fallback or boolean
                    activeSourceIds.add(key);
                }
            }
        } else {
            spikes.forEach(s => activeSourceIds.add(s));
        }

        const nodes = getNodes();
        edges.forEach(edge => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const sourceId = sourceNode?.parentId ?? edge.source;
            const hasSpike = activeSourceIds.has(sourceId);

            if (hasSpike) {
                edgeSpikeCounts.current[edge.id] = (edgeSpikeCounts.current[edge.id] || 0) + 1;
            }
        });

    }, [spikes, getEdges, getNodes]);

    // Timer to calculate rates and emit events
    useEffect(() => {
        const intervalId = setInterval(() => {
            const now = Date.now();
            const elapsedSec = (now - lastEmitTime.current) / 1000.0;

            if (elapsedSec < 0.1) return; // Too fast

            // Calculate and emit rates
            Object.entries(edgeSpikeCounts.current).forEach(([edgeId, count]) => {
                if (count > 0) {
                    // Normalize rate by speed multiplier
                    // Rate (Sim Hz) = (Count / RealSec) / SpeedMultiplier
                    // If speed is 0 or very small, limit it
                    const safeSpeed = Math.max(0.001, currentSpeed);
                    const realRate = count / elapsedSec;
                    const simRate = realRate / safeSpeed;

                    eventBus.emit({
                        edgeId,
                        spikeRate: simRate
                    });

                    // Reset count
                    edgeSpikeCounts.current[edgeId] = 0;
                } else {
                    // Decay to 0 if no spikes
                    eventBus.emit({
                        edgeId,
                        spikeRate: 0
                    });
                }
            });

            lastEmitTime.current = now;

        }, 100); // 10Hz visual update

        return () => clearInterval(intervalId);
    }, [currentSpeed]);
};
