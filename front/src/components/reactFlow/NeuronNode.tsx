import React, { memo, useState, useMemo } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import NeuronIcon from "../../../public/neuron.svg?react";

// --- Types ---
export type NeuronNodeData = Record<string, any>;

const getHeatColor = (voltage: number, threshold: number, resting: number) => {
  const v = voltage;
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
    <div className="absolute z-popup p-md bg-gray-800/90 backdrop-blur-sm border border-slate-600 rounded-lg shadow-xl text-left left-1/2 -translate-x-1/2 top-full mt-2 w-48 animate-[fadeIn_0.2s_ease]">
      <div className="flex justify-between items-center mb-sm border-b border-slate-600 pb-1">
        <h4 className="font-bold text-base text-text-primary m-0">Neuron State</h4>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm text-slate-300 flex justify-between">
          <span>Voltage:</span> <span className="font-mono font-bold">{typeof data.voltage === 'number' ? `${data.voltage.toFixed(1)}mV` : data.voltage}</span>
        </p>
        <p className="text-sm text-slate-300 flex justify-between">
          <span>Threshold:</span> <span className="font-mono">{(data.parameters.threshold ?? data.parameters.Vthresh ?? -50.0)}mV</span>
        </p>
        <p className="text-sm text-slate-300 flex justify-between">
          <span>Resting State:</span> <span className="font-mono">{(data.parameters.resting ?? data.parameters.Vrest ?? -65.0)}mV</span>
        </p>

        <div className="pt-1 mt-1 border-t border-slate-700">
          {Object.entries(data.parameters).map(([key, value]) => {
            if (key === 'threshold') return null;
            return (
              <p key={key} className="text-xs text-slate-400 flex justify-between">
                <span>{key}:</span> <span>{value as any}</span>
              </p>
            );
          })}
        </div>
      </div>

      <div className="pt-2 mt-2 border-t border-slate-700">
        <p className="text-sm text-slate-300 flex justify-between items-center">
          <span>Population Size:</span>
          <input
            type="number"
            min="1"
            className="w-16 px-1 py-0.5 text-right bg-slate-700 border border-slate-600 rounded text-text-primary text-sm"
            value={data.size || 1}
            onChange={(e) => {
              const newSize = parseInt(e.target.value) || 1;
              data.size = newSize;
              if (data.onUpdate) data.onUpdate({ ...data, size: newSize });
            }}
          />
        </p>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>

  );
};

// --- Main Component ---
const NeuronNode: React.FC<NodeProps> = ({ id, data, isConnectable, selected }) => {
  const nodeData = data as NeuronNodeData;
  const { setNodes } = useReactFlow();
  const [isParamsVisible, setIsParamsVisible] = useState(false);

  const handleNodeClick = () => {
    setIsParamsVisible((prev) => !prev);
  };

  // Safe parameter access with defaults
  const threshold = nodeData.parameters?.threshold ?? nodeData.parameters?.Vthresh ?? -50.0;
  const resting = nodeData.parameters?.resting ?? nodeData.parameters?.Vrest ?? -65.0;
  const voltage = typeof nodeData.voltage === 'number' ? nodeData.voltage : parseFloat(nodeData.voltage) || resting;

  const dynamicColor = useMemo(() =>
    getHeatColor(voltage, threshold, resting),
    [voltage, threshold, resting]
  );

  return (
    <div
      className={`relative cursor-pointer flex justify-center items-center ${selected ? 'rounded-full ring-2 ring-blue-500 shadow-sm' : ''}`}
      onClick={handleNodeClick}
    >
      {/* Neuron Icon */}
      <NeuronIcon
        className="transition-colors duration-300 ease-in-out filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.2)]"
        fill={dynamicColor}
        width={100}
        height={100}
      />

      {/* Population Size Badge */}
      {(nodeData.size || 1) > 1 && (
        <div className="absolute -top-1 -right-1 bg-blue text-white text-[10px] font-bold px-[0.5rem] py-[0.125rem] rounded-full shadow-sm z-dropdown">
          x{nodeData.size}
        </div>
      )}

      {/* Parameter Popup */}
      {isParamsVisible && (
        <PopupBlock
          data={{
            ...nodeData,
            onUpdate: (newData: any) => {
              setNodes((nds) => nds.map((node) => {
                if (node.id === id) {
                  return { ...node, data: newData };
                }
                return node;
              }));
            }
          }}
        />
      )}

      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="!w-[12px] !h-[12px] !bg-slate-400 !border-[2px] !border-slate-800 !z-popup !top-1/2 !-translate-y-1/2 opacity-10 hover:opacity-100 !left-[-6px]"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="!w-[12px] !h-[12px] !bg-slate-400 !border-[2px] !border-slate-800 !z-popup !top-1/2 !-translate-y-1/2 opacity-10 hover:opacity-100 !right-[-6px]"
      />
    </div>
  );
};

export default memo(NeuronNode);