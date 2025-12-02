import { useEffect, useState } from 'react';
import { getBezierPath, BaseEdge, type EdgeProps } from '@xyflow/react';
import { eventBus } from '../utils/EventBus';
import { VisualizationConfig } from '../config/visualization';
import './../styles/lod-styles.css';

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

  const [edgePath, labelX, labelY] = getBezierPath({
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
  // gray (0 Hz) -> green (high)
  const getAxonColor = (rate: number): string => {
    if (rate == 0) {
      return 'rgb(220, 200, 200)'
    }
    const max_rate = VisualizationConfig.AXON_COLOR_MAX;

    const t = Math.min(rate / max_rate, 1);
    const green = { r: 95, g: 255, b: 0 };
    const r = Math.round(green.r * t);
    const g = Math.round(green.g * t);
    const b = Math.round(green.b * t);
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
