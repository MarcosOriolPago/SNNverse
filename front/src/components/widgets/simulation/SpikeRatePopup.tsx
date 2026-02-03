import { useEffect, useState } from 'react';
import { eventBus } from '../../../utils/EventBus';
// import '../../../styles/spike-rate-popup.css';

interface SpikeRatePopupProps {
  nodeId?: string;       // Optional: for node monitoring
  edgeId?: string;       // Optional: for specific edge monitoring
  position: { x: number; y: number };
  onClose: () => void;
  edges?: Array<{ id: string; source: string; target: string }>; // Required only if using nodeId
}

export default function SpikeRatePopup({ nodeId, edgeId, position, onClose, edges = [] }: SpikeRatePopupProps) {
  const [spikeRates, setSpikeRates] = useState<Map<string, number>>(new Map());
  const [history, setHistory] = useState<number[]>([]);
  const MAX_HISTORY = 40; // More data points for smooth visualization

  // Find all outgoing edges if monitoring a node
  const outgoingEdges = nodeId ? edges.filter(e => e.source === nodeId) : [];

  useEffect(() => {
    // Subscribe to all edge updates
    const unsubscribe = eventBus.subscribe((update) => {
      // Determine if update is relevant
      let isRelevant = false;

      if (edgeId) {
        // Direct edge monitoring
        isRelevant = update.edgeId === edgeId;
      } else if (nodeId) {
        // Node monitoring (outgoing edges)
        isRelevant = outgoingEdges.some(e => e.id === update.edgeId);
      }

      if (isRelevant) {
        setSpikeRates((prev) => {
          const next = new Map(prev);
          next.set(update.edgeId, update.spikeRate);
          return next;
        });
      }
    });

    return () => unsubscribe();
  }, [nodeId, edgeId, edges]);

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
      className="absolute z-modal min-w-[220px] p-0 font-sans animate-[popupSlideIn_0.3s_ease-out] bg-gradient-to-[135deg] from-gray-900/98 to-gray-800/98 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.1)] backdrop-blur-lg"
      style={{
        left: position.x + 60,
        top: position.y - 80,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center px-3.5 py-3 border-b border-white/10">
        <div className="text-[13px] font-semibold text-gray-100 flex items-center gap-2">
          <span className="w-2 h-2 bg-green rounded-full animate-[pulse_2s_ease-in-out_infinite]"></span>
          Spike Activity
        </div>
        <button className="bg-none border-none p-0 m-0 cursor-pointer w-6 h-6 flex items-center justify-center text-gray-400 text-2xl rounded-sm transition-fast hover:bg-white/10 hover:text-text-primary" onClick={onClose}>×</button>
      </div>

      <div className="p-3.5">
        <div className="flex justify-between items-baseline mb-2.5">
          <div className="text-[11px] text-gray-400 uppercase tracking-[0.5px]">Rate</div>
          <div className="text-xl font-bold tabular-nums text-green">{totalRate.toFixed(1)} <span className="text-xs font-normal text-gray-500 ml-0.5">Hz</span></div>
        </div>

        <div className="flex items-end gap-0.5 h-10 mt-3.5 pt-2.5 border-t border-white/10">
          {history.map((value, index) => {
            const height = (value / maxHistoryValue) * 100;
            const bgColor = value === 0 ? '#6b7280' : value < 50 ? '#fbbf24' : '#10b981';
            return (
              <div
                key={index}
                className="flex-1 min-h-[2px] rounded-t-[2px] transition-[height,background-color] duration-fast"
                style={{
                  height: `${Math.max(height, 2)}%`,
                  backgroundColor: bgColor
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Inline animations */}
      <style>{`
        @keyframes popupSlideIn {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
