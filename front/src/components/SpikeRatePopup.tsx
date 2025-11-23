import { useEffect, useState } from 'react';
import { eventBus } from '../utils/EventBus';
import '../styles/spike-rate-popup.css';

interface SpikeRatePopupProps {
  nodeId: string;
  position: { x: number; y: number };
  onClose: () => void;
  edges: Array<{ id: string; source: string; target: string }>;
}

export default function SpikeRatePopup({ nodeId, position, onClose, edges }: SpikeRatePopupProps) {
  const [spikeRates, setSpikeRates] = useState<Map<string, number>>(new Map());
  const [history, setHistory] = useState<number[]>([]);
  const MAX_HISTORY = 20; // Keep last 20 data points

  // Find all outgoing edges from this node
  const outgoingEdges = edges.filter(e => e.source === nodeId);

  useEffect(() => {
    // Subscribe to all edge updates
    const unsubscribe = eventBus.subscribe((update) => {
      // Check if this edge is one of our outgoing edges
      const isRelevant = outgoingEdges.some(e => e.id === update.edgeId);
      
      if (isRelevant) {
        setSpikeRates((prev) => {
          const next = new Map(prev);
          next.set(update.edgeId, update.spikeRate);
          return next;
        });
      }
    });

    return () => unsubscribe();
  }, [nodeId, edges]);

  // Calculate aggregate spike rate from all outgoing edges
  const totalRate = Array.from(spikeRates.values()).reduce((sum, rate) => sum + rate, 0);
  
  // Update peak and history when total rate changes
  useEffect(() => {
    
    setHistory((prevHistory) => {
      const newHistory = [...prevHistory, totalRate];
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }
      return newHistory;
    });
  }, [totalRate]);


  // Simple sparkline bars
  const maxHistoryValue = Math.max(...history, 1);
  
  return (
    <div 
      className="spike-rate-popup"
      style={{
        left: position.x + 60,
        top: position.y - 80,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="popup-header">
        <div className="popup-title">
          <span className="pulse-dot"></span>
          Spike Activity
        </div>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="popup-content">
        <div className="metric-row">
          <div className="metric-label">Rate</div>
          <div className="metric-value current">{totalRate.toFixed(1)} <span className="unit">Hz</span></div>
        </div>

        <div className="sparkline">
          {history.map((value, index) => {
            const height = (value / maxHistoryValue) * 100;
            const bgColor = value === 0 ? '#6b7280' : value < 50 ? '#fbbf24' : '#10b981';
            return (
              <div 
                key={index} 
                className="sparkline-bar"
                style={{ 
                  height: `${Math.max(height, 2)}%`,
                  backgroundColor: bgColor
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
