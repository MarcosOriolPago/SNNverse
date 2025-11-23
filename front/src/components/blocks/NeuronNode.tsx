import React, { memo, useState, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import NeuronIcon from "../../assets/neuron.svg?react"; 

// --- Types ---
export type NeuronNodeData = Record<string, any>;

const getHeatColor = (voltageString: string, threshold: number, resting: number) => {
  const v = parseFloat(voltageString);
  const active = threshold;

  let t = (v - resting) / (active - resting);
  t = Math.max(0, Math.min(1, t)); 

  // Start Color (Gray, when t=0): RGB (140, 140, 136)
  const startR = 140;
  const startG = 140;
  const startB = 136;

  // End Color (Yellow, when t=1): RGB (255, 255, 0)
  const endR = 255;
  const endG = 255;
  const endB = 0;

  const r = Math.round(startR + (endR - startR) * t);
  const g = Math.round(startG + (endG - startG) * t);
  const b = Math.round(startB + (endB - startB) * t);

  return `rgb(${r}, ${g}, ${b})`;
};

// --- Popup Component ---
const PopupBlock: React.FC<{ data: NeuronNodeData }> = ({ data }) => {
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
        <p className="text-xs text-gray-700 dark:text-gray-300 flex justify-between">
          <span>Resting State:</span> <span className="font-mono">{data.parameters.resting}mV</span>
        </p>
        
        <div className="pt-1 mt-1 border-t border-gray-100 dark:border-gray-700">
          {Object.entries(data.parameters).map(([key, value]) => {
            if (key === 'threshold') return null; 
            return (
              <p key={key} className="text-[10px] text-gray-500 dark:text-gray-400 flex justify-between">
                <span className="capitalize">{key}:</span> <span>{value as any}</span>
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---
const NeuronNode: React.FC<NodeProps<NeuronNodeData>> = ({ data, isConnectable }) => {
  const [isParamsVisible, setIsParamsVisible] = useState(false);

  const handleNodeClick = () => {
    setIsParamsVisible((prev) => !prev);
  };

  const dynamicColor = useMemo(() => 
    getHeatColor(data.voltage, data.parameters.threshold, data.parameters.resting), 
    [data.voltage, data.parameters.threshold, data.parameters.resting]
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
        <PopupBlock data={data} />
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
};

export default memo(NeuronNode);