
import { useEffect, useRef, useMemo } from 'react';
import { useReactFlow, type Edge } from '@xyflow/react';
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

    // Cache map: sourceId -> edgeIds[]
    const sourceToEdgesMap = useRef<Record<string, string[]>>({});

    // Update the source->edge map whenever edges change
    // We can't use 'edges' from props effectively if they are not passed, 
    // but getEdges() is lazy. 
    // We'll trust that the parent component re-renders this hook when topology changes 
    // or we poll getEdges occasionally? 
    // Actually, simple solution: Rebuild map every 1s or just iterate all edges (slow if many edges).
    // Better: Monitor edges from store.
    // But hooks rules... 
    // Let's rely on spike processing loop to fetch edges lazily or maintain a map.
    // For now, let's assume edges are passed or we fetch them.
    // Since we don't have 'edges' dependency here, we might miss topology changes.
    // Let's fetching edges in the interval loop.

    useEffect(() => {
        if (!spikes || spikes.length === 0) return;

        // 1. Fetch current edges to know connectivity
        const edges = getEdges();

        // Debug: Check if we have edges and spikes
        // console.log(`Visualizer: ${spikes.length} spikes, ${edges.length} edges`);

        // 2. Identify active edges
        const activeSourceIds = new Set(spikes);
        let matchCount = 0;

        edges.forEach(edge => {
            if (activeSourceIds.has(edge.source)) {
                edgeSpikeCounts.current[edge.id] = (edgeSpikeCounts.current[edge.id] || 0) + 1;
                matchCount++;
            }
        });

        if (matchCount > 0) {
            console.log(`⚡ Matched ${matchCount} spikes to edges`);
        }

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
                    const safeSpeed = Math.max(0.01, currentSpeed);
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

            // Also clear counts for edges that didn't fire?
            // The iteration above covers all edges that have EVER fired since mount.
            // We should garbage collect edges that are removed? 
            // For now, just resetting to 0 is fine.

            lastEmitTime.current = now;

        }, 100); // 10Hz visual update

        return () => clearInterval(intervalId);
    }, [currentSpeed]);
};
