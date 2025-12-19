import React, { memo, useState, useMemo } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import NeuronIcon from "../../assets/neuron.svg?react";
import "../../styles/nodes.css";

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
    <div className="neuron-popup">
      <div className="neuron-popup-header">
        <h4 className="neuron-popup-title">Neuron State</h4>
      </div>

      <div className="neuron-popup-content">
        <p className="neuron-popup-row">
          <span>Voltage:</span> <span className="neuron-popup-value-bold">{typeof data.voltage === 'number' ? `${data.voltage.toFixed(1)}mV` : data.voltage}</span>
        </p>
        <p className="neuron-popup-row">
          <span>Threshold:</span> <span className="neuron-popup-value">{(data.parameters.threshold ?? data.parameters.Vthresh ?? -50.0)}mV</span>
        </p>
        <p className="neuron-popup-row">
          <span>Resting State:</span> <span className="neuron-popup-value">{(data.parameters.resting ?? data.parameters.Vrest ?? -65.0)}mV</span>
        </p>

        <div className="neuron-popup-divider">
          {Object.entries(data.parameters).map(([key, value]) => {
            if (key === 'threshold') return null;
            return (
              <p key={key} className="neuron-popup-param">
                <span className="neuron-popup-param-key">{key}:</span> <span>{value as any}</span>
              </p>
            );
          })}
        </div>
      </div>

      <div className="neuron-popup-section">
        <p className="neuron-popup-input-row">
          <span>Population Size:</span>
          <input
            type="number"
            min="1"
            className="neuron-popup-input"
            value={data.size || 1}
            onChange={(e) => {
              const newSize = parseInt(e.target.value) || 1;
              data.size = newSize;
              if (data.onUpdate) data.onUpdate({ ...data, size: newSize });
            }}
          />
        </p>
      </div>
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
      className={`neuron-node-container ${selected ? 'selected' : ''}`}
      onClick={handleNodeClick}
    >
      {/* Neuron Icon */}
      <NeuronIcon
        className="transition-colors duration-300 ease-in-out neuron-icon"
        fill={dynamicColor}
        width={100}
        height={100}
        style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))' }}
      />

      {/* Population Size Badge */}
      {(nodeData.size || 1) > 1 && (
        <div className="population-badge">
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
        className="neuron-handle neuron-handle-left"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="neuron-handle neuron-handle-right"
      />
    </div>
  );
};

export default memo(NeuronNode);