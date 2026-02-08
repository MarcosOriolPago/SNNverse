import { useEffect, useState } from 'react';
import { getBezierPath, BaseEdge, type EdgeProps } from '@xyflow/react';
import { eventBus } from '../lib/EventBus';
import { VisualizationConfig } from '../config/visualization';


interface AxonProps extends EdgeProps {
  data?: {
    spikeRate?: number; // Spikes per second from backend
  };
}

export default function Axon({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  id,
  selected,
}: AxonProps) {

  const [spikeRate, setSpikeRate] = useState<number>(0);

  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  // Subscribe to aggregated spike rate updates
  useEffect(() => {
    const unsubscribe = eventBus.subscribe((update) => {
      // Update format: { edgeId: string, spikeRate: number }
      if (update.edgeId === id) {
        setSpikeRate(update.spikeRate);
      }
    });

    return () => unsubscribe();
  }, [id]);

  // Calculate color based on spike rate with gradient interpolation
  // gray (0 Hz) -> light green -> mid green -> hard green
  const getAxonColor = (rate: number): string => {
    if (rate === 0) {
      return 'rgb(140, 140, 136)'; // Gray
    }

    let r: number, g: number, b: number;

    if (rate < 10) {
      // Gray to light green (0-10 Hz)
      const t = rate / 10;
      const gray = { r: 140, g: 140, b: 136 };
      const lightGreen = { r: 180, g: 255, b: 150 };
      r = Math.round(gray.r + (lightGreen.r - gray.r) * t);
      g = Math.round(gray.g + (lightGreen.g - gray.g) * t);
      b = Math.round(gray.b + (lightGreen.b - gray.b) * t);
    } else if (rate < 50) {
      // Light green to mid green (10-50 Hz)
      const t = (rate - 10) / 40;
      const lightGreen = { r: 180, g: 255, b: 150 };
      const midGreen = { r: 100, g: 220, b: 80 };
      r = Math.round(lightGreen.r + (midGreen.r - lightGreen.r) * t);
      g = Math.round(lightGreen.g + (midGreen.g - lightGreen.g) * t);
      b = Math.round(lightGreen.b + (midGreen.b - lightGreen.b) * t);
    } else {
      // Mid green to hard green (50-1000 Hz)
      const t = Math.min((rate - 50) / 950, 1);
      const midGreen = { r: 100, g: 220, b: 80 };
      const hardGreen = { r: 0, g: 180, b: 0 };
      r = Math.round(midGreen.r + (hardGreen.r - midGreen.r) * t);
      g = Math.round(midGreen.g + (hardGreen.g - midGreen.g) * t);
      b = Math.round(midGreen.b + (hardGreen.b - midGreen.b) * t);
    }

    return `rgb(${r}, ${g}, ${b})`;
  };

  const strokeWidth = spikeRate > 0 ? 2 : 1;
  const color = getAxonColor(spikeRate);
  const opacity = 1;

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        stroke: selected ? '#3b82f6' : color, // Blue when selected
        strokeWidth: selected ? strokeWidth + 2 : strokeWidth,
        opacity,
        strokeDasharray: spikeRate > 0 ? 'none' : '5, 5',
      }}
    />
  );
}
