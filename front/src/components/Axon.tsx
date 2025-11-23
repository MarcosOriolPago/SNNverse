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
  // gray (0 Hz) -> yellow (low) -> green (high)
  const getAxonColor = (rate: number): string => {
    const { LOW, HIGH } = VisualizationConfig.AXON_COLOR_THRESHOLDS;
    
    if (rate === 0) return '#6b7280'; // gray
    
    if (rate < LOW) {
      // Gradient from gray to yellow
      const t = rate / LOW; // 0 to 1
      const gray = { r: 107, g: 107, b: 128 };
      const yellow = { r: 251, g: 191, b: 36 };
      const r = Math.round(gray.r + (yellow.r - gray.r) * t);
      const g = Math.round(gray.g + (yellow.g - gray.g) * t);
      const b = Math.round(gray.b + (yellow.b - gray.b) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    if (rate < HIGH) {
      // Gradient from yellow to green
      const t = (rate - LOW) / (HIGH - LOW); // 0 to 1
      const yellow = { r: 251, g: 191, b: 36 };
      const green = { r: 16, g: 185, b: 129 };
      const r = Math.round(yellow.r + (green.r - yellow.r) * t);
      const g = Math.round(yellow.g + (green.g - yellow.g) * t);
      const b = Math.round(yellow.b + (green.b - yellow.b) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    return '#10b981'; // green (saturated)
  };
  
  const getOpacity = (rate: number): number => {
    const { LOW } = VisualizationConfig.AXON_COLOR_THRESHOLDS;
    
    if (rate === 0) return 0.3;
    if (rate < LOW) {
      // Gradient from 0.3 to 0.8
      const t = rate / LOW;
      return 0.3 + (0.5 * t);
    }
    return 0.8 + (0.2 * Math.min(rate / 100, 1)); // 0.8 to 1.0
  };
  
  const strokeWidth = spikeRate > 0 ? 2 : 1;
  const color = getAxonColor(spikeRate);
  const opacity = getOpacity(spikeRate);
  
  return (
    <BaseEdge 
      path={edgePath} 
      markerEnd={markerEnd} 
      style={{
        ...style,
        stroke: color,
        strokeWidth,
        opacity,
        strokeDasharray: spikeRate > 0 ? 'none' : '5, 5',
        transition: 'stroke 0.15s ease-in-out, opacity 0.15s ease-in-out, stroke-width 0.15s ease-in-out',
      }} 
    />
  );
}

