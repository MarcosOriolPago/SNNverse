import React, { useState } from 'react';
import { FiActivity } from 'react-icons/fi';
import { STYLES } from '../../styles/styles';

const DraggableNeuron = ({ isCollapsed }: { isCollapsed: boolean }) => {
  const [params, setParams] = useState({ threshold: -55, resting: -70, tau: 2.0 });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const onDragStart = (event: React.DragEvent) => {
    const nodeData = {
      nodeType: 'neuron',
      neuronType: 'LIF',
      parameters: params
    };
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  if (isCollapsed) return null;

  return (
    <>
      <div
        className={`p-3 mb-4 rounded-md cursor-grab active:cursor-grabbing transition-all flex items-center justify-between ${STYLES.colors.secondary} ${STYLES.boxShadow.medium}`}
        draggable
        onDragStart={(event) => onDragStart(event)}
      >
        <div className="flex items-center gap-2">
          <FiActivity className="text-[#F54927]" />
          <span className={`${STYLES.fontSize.medium} ${STYLES.colors.text}`}>LIF Neuron</span>
        </div>
        <button onClick={() => setIsModalOpen(true)} className={`${STYLES.button.base} ${STYLES.button.secondary} ${STYLES.fontSize.small}`}>Edit</button>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className={`p-6 rounded-lg ${STYLES.colors.primary} ${STYLES.boxShadow.large}`}>
            <h3 className={`${STYLES.fontSize.large} ${STYLES.colors.text} mb-4`}>LIF Neuron Parameters</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className={`${STYLES.fontSize.medium} ${STYLES.colors.textSecondary}`}>Resting State (mV)</label>
                <input
                  type="number"
                  value={params.resting}
                  onChange={(e) => setParams({ ...params, resting: Number(e.target.value) })}
                  className={`w-24 p-2 rounded ${STYLES.colors.secondary} ${STYLES.colors.text}`}
                />
              </div>
              <div className="flex justify-between items-center">
                <label className={`${STYLES.fontSize.medium} ${STYLES.colors.textSecondary}`}>Threshold (mV)</label>
                <input
                  type="number"
                  value={params.threshold}
                  onChange={(e) => setParams({ ...params, threshold: Number(e.target.value) })}
                  className={`w-24 p-2 rounded ${STYLES.colors.secondary} ${STYLES.colors.text}`}
                />
              </div>
              <div className="flex justify-between items-center">
                <label className={`${STYLES.fontSize.medium} ${STYLES.colors.textSecondary}`}>Tau (ms)</label>
                <input
                  type="number"
                  value={params.tau}
                  onChange={(e) => setParams({ ...params, tau: Number(e.target.value) })}
                  className={`w-24 p-2 rounded ${STYLES.colors.secondary} ${STYLES.colors.text}`}
                />
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setIsModalOpen(false)} className={`${STYLES.button.base} ${STYLES.button.primary}`}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DraggableNeuron;
