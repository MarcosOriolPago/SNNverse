import React, { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
// Assuming your custom neuron SVG is here:
import NeuronIcon from './../assets/neuron.svg?react'; 

// NOTE: For the animation, you would typically use a library like framer-motion.
// Since I cannot include external libraries, the "PopupBlock" below is a placeholder.

// --- 1. Define Node Data Structure ---
export type NeuronNodeData = {
  // Use 'voltage' for the dynamic value display
  voltage: string; 
  // Use 'params' for the data shown in the pop-up
  parameters: Record<string, number | string>; 
};

// --- 2. Parameter Pop-up Component (Placeholder for Animation) ---
const PopupBlock: React.FC<{ data: NeuronNodeData['parameters'] }> = ({ data }) => {
  // In a real app, this would use framer-motion for smooth pop-up effect
  return (
    <div 
      className="absolute z-10 p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl"
      style={{ top: '50%', right: '100%', transform: 'translate(10px, -50%)', minWidth: '150px' }}
    >
      <h4 className="font-bold text-sm mb-1">Parameters:</h4>
      {Object.entries(data).map(([key, value]) => (
        <p key={key} className="text-xs">
          <strong>{key}:</strong> {value}
        </p>
      ))}
    </div>
  );
};

// --- 3. Main Neuron Node Component ---
export default memo(({ data, isConnectable }: NodeProps<NeuronNodeData>) => {
  const [isParamsVisible, setIsParamsVisible] = useState(false);

  // Toggle pop-up visibility on click
  const handleNodeClick = () => {
    setIsParamsVisible(prev => !prev);
  };

  // Determine voltage color (e.g., green/blue for resting, red for spiking)
  // Simple logic based on the string:
  const voltageValue = parseFloat(data.voltage);
  const iconColor = voltageValue > -60 ? '#F54927' : '#004C8F';

  return (
    <div 
      className="relative cursor-pointer"
      onClick={handleNodeClick}
    >
      
      {/* --- The Neuron Icon (The main visual body) --- */}
      <NeuronIcon 
        className="transition-colors duration-300"
        fill={iconColor} // Use the fill prop to set the dynamic color
        width={72} 
        height={72} 
      />

      {/* --- Current Membrane Voltage (Centered Text) --- */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ color: iconColor === '#F54927' ? '#FFFFFF' : '#000000' }} // Adjust text color for visibility
      >
        <span className="text-xs font-bold whitespace-nowrap">
          {data.voltage}
        </span>
      </div>

      {/* --- Parameter Popup Block (Animated on click) --- */}
      {isParamsVisible && <PopupBlock data={data.parameters} />}

      {/* --- React Flow Handles --- */}
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} style={{ top: '50%' }} />
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} style={{ top: '50%' }} />
    </div>
  );
});