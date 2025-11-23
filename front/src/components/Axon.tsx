import { useEffect, useState } from 'react';
import { getBezierPath, BaseEdge, type EdgeProps } from '@xyflow/react';
import { eventBus } from '../utils/EventBus'; // Import the bus
import './../styles/lod-styles.css';

interface Spike {
  id: number;
  progress: number;
  startTime: number;
}

interface AxonProps extends EdgeProps {
  data?: {
    spikeSpeed?: number; // Speed in seconds (default 0.6s)
    spikeSize?: number;  // Radius in pixels (default 5)
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
  source, // We need the Source ID to know if this edge should fire
  data,
}: AxonProps) {
  
  const [spikes, setSpikes] = useState<Spike[]>([]);
  const [spikeIdCounter, setSpikeIdCounter] = useState(0);
  
  // Configurable spike animation parameters
  const spikeSpeed = data?.spikeSpeed ?? 1.5; // seconds
  const spikeSize = data?.spikeSize ?? 8;     // pixels

  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });
  
  // Parse SVG path to get points along bezier curve
  const getPointAlongPath = (percent: number) => {
    // Create temporary SVG path element to use getPointAtLength
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', edgePath);
    tempSvg.appendChild(tempPath);
    
    const pathLength = tempPath.getTotalLength();
    const point = tempPath.getPointAtLength(pathLength * percent);
    
    return { x: point.x, y: point.y };
  };
  
  // Animation loop to update all spikes
  useEffect(() => {
    if (spikes.length === 0) return;
    
    let animationFrame: number;
    
    const animate = () => {
      const now = Date.now();
      const duration = spikeSpeed * 1000;
      
      setSpikes(prevSpikes => {
        const updatedSpikes = prevSpikes
          .map(spike => {
            const elapsed = now - spike.startTime;
            const progress = Math.min(elapsed / duration, 1);
            return { ...spike, progress };
          })
          .filter(spike => spike.progress < 1); // Remove completed spikes
        
        if (updatedSpikes.length > 0) {
          animationFrame = requestAnimationFrame(animate);
        }
        
        return updatedSpikes;
      });
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [spikes.length, spikeSpeed]);
  
  // Subscribe to spike events
  useEffect(() => {
    const unsubscribe = eventBus.subscribe((firedSourceId) => {
      if (firedSourceId === source) {
        console.log(`🔥 Axon firing! Source: ${source}`);
        
        // Add new spike
        const newSpike: Spike = {
          id: spikeIdCounter,
          progress: 0,
          startTime: Date.now()
        };
        
        setSpikeIdCounter(prev => prev + 1);
        setSpikes(prev => [...prev, newSpike]);
      }
    });

    return () => unsubscribe();
  }, [source, spikeIdCounter]);
  
  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />

      {spikes.map(spike => {
        const pos = getPointAlongPath(spike.progress);
        return (
          <circle
            key={spike.id}
            cx={pos.x}
            cy={pos.y}
            r={spikeSize}
            fill="#6b7280"
            stroke="#ffffff"
            strokeWidth="1"
            opacity={0.5}
          />
        );
      })}
    </>
  );
}

