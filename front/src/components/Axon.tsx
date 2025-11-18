import { useEffect, useState } from 'react';
import { getBezierPath, BaseEdge, type EdgeProps } from '@xyflow/react';
import { eventBus } from '../utils/EventBus'; // Import the bus
import './../styles/lod-styles.css';

export default function Axon({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  source, // We need the Source ID to know if this edge should fire
}: EdgeProps) {
  
  const [isFiring, setIsFiring] = useState(false);
  // We use a distinct key to force re-mounting of the animation element
  const [spikeKey, setSpikeKey] = useState(0); 

  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  useEffect(() => {
    // SUBSCRIBE to the Event Bus
    const unsubscribe = eventBus.subscribe((firedSourceId) => {
      // FILTER: Only fire if the signal comes from MY source neuron
      if (firedSourceId === source) {
        setIsFiring(true);
        setSpikeKey((k) => k + 1); // Force animation restart
        
        // Cleanup animation after 0.5s
        setTimeout(() => setIsFiring(false), 500);
      }
    });

    return () => unsubscribe();
  }, [source]);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />

      {isFiring && (
        <circle 
          key={spikeKey} // Key change forces the <animateMotion> to restart t=0
          className="spike-packet" 
          r="3" 
          fill="#6b7280"
          stroke="#ffffff"
          opacity="0.8"
        >
          <animateMotion
            dur="0.5s"
            repeatCount="1"
            path={edgePath}
            rotate="auto"
            fill="freeze"
          />
        </circle>
      )}
    </>
  );
}