import React, { memo, useState, useMemo } from 'react';
// 1. Import 'Node' for the generic type
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import NeuronIcon from "../assets/neuron.svg?react"; 

// --- Types ---
export type NeuronNodeData = {
  voltage: string; 
  parameters: {
    threshold: number;
    [key: string]: number | string; 
  };
};

// --- Color Interpolation Helper ---
const getHeatColor = (voltageString: string, threshold: number) => {
  const v = parseFloat(voltageString);
  const resting = -75; 
  const active = threshold; 

  let t = (v - resting) / (active - resting);
  t = Math.max(0, Math.min(1, t)); 

  // Interpolate from Blue (#004C8F) to Yellow (#FFD700)
  const r = Math.round(0 + (255 - 0) * t);
  const g = Math.round(76 + (215 - 76) * t);
  const b = Math.round(143 + (0 - 143) * t);

  return `rgb(${r}, ${g}, ${b})`;
};

// --- Popup Component ---
const PopupBlock: React.FC<{ data: NeuronNodeData; onClose: () => void }> = ({ data, onClose }) => {
  return (
    <div 
      className="absolute z-50 p-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl text-left"
      style={{ top: '-10%', left: '100%', minWidth: '180px', transform: 'translateX(10px)' }}
    >
      <div className="flex justify-between items-center mb-2 border-b border-gray-200 dark:border-gray-600 pb-1">
        <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">Neuron State</h4>
      </div>
      
      <div className="space-y-1">
        <p className="text-xs text-gray-700 dark:text-gray-300 flex justify-between">
          <span>Voltage:</span> <span className="font-mono font-bold">{data.voltage}</span>
        </p>
        <p className="text-xs text-gray-700 dark:text-gray-300 flex justify-between">
          <span>Threshold:</span> <span className="font-mono">{data.parameters.threshold}mV</span>
        </p>
        
        <div className="pt-1 mt-1 border-t border-gray-100 dark:border-gray-700">
          {Object.entries(data.parameters).map(([key, value]) => {
            if (key === 'threshold') return null; 
            return (
              <p key={key} className="text-[10px] text-gray-500 dark:text-gray-400 flex justify-between">
                <span className="capitalize">{key}:</span> <span>{value}</span>
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---
export default memo(({ data, isConnectable }: NodeProps<Node<NeuronNodeData>>) => {
  const [isParamsVisible, setIsParamsVisible] = useState(false);

  const handleNodeClick = () => {
    setIsParamsVisible((prev) => !prev);
  };

  const dynamicColor = useMemo(() => 
    getHeatColor(data.voltage, data.parameters.threshold), 
    [data.voltage, data.parameters.threshold]
  );

  // Handle Styling for perfect centering and visibility
  const handleStyle = {
    width: '12px',
    height: '12px',
    background: '#94a3b8', 
    border: '2px solid #1e293b', 
    borderRadius: '50%',
    zIndex: 50,
    top: '50%',
    transform: 'translateY(-50%)', 
  };

  return (
    <div 
      className="relative cursor-pointer group flex justify-center items-center"
      onClick={handleNodeClick}
    >
      {/* Neuron Icon */}
      <NeuronIcon 
        className="transition-colors duration-300 ease-in-out"
        fill={dynamicColor} 
        width={100} 
        height={100} 
        style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))' }} 
      />

      {/* Parameter Popup */}
      {isParamsVisible && (
        <PopupBlock data={data} onClose={() => setIsParamsVisible(false)} />
      )}

      <Handle 
        type="target" 
        position={Position.Left} 
        isConnectable={isConnectable} 
        style={{ ...handleStyle, left: '-6px' }} 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        isConnectable={isConnectable} 
        style={{ ...handleStyle, right: '-6px' }} 
      />
    </div>
  );
});