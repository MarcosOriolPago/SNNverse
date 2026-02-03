
import { useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { eventBus } from '../utils/EventBus';

/**
 * Hook to visualize spike rates on Axon edges
 * normalizes rate based on simulation speed
 */
export const useAxonVisualizer = (spikes: string[], currentSpeed: number) => {
    const { getEdges } = useReactFlow();

    // Counter for spikes per edge: edgeId -> count
    const edgeSpikeCounts = useRef<Record<string, number>>({});

    // Last time we emitted an update
    const lastEmitTime = useRef(Date.now());

    useEffect(() => {
        if (!spikes || spikes.length === 0) return;

        // 1. Fetch current edges to know connectivity
        const edges = getEdges();

        // 2. Identify active edges
        const activeSourceIds = new Set(spikes);
        let matchCount = 0;

        edges.forEach(edge => {
            const hasSpike = activeSourceIds.has(edge.source);

            if (hasSpike) {
                edgeSpikeCounts.current[edge.id] = (edgeSpikeCounts.current[edge.id] || 0) + 1;
                matchCount++;
            }
        });

    }, [spikes, getEdges]);

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
