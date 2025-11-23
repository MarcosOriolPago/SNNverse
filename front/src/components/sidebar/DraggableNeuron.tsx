import React, { useState } from 'react';
import { FiActivity } from 'react-icons/fi';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../ui/modal';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import '../../styles/draggable.css';

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

  const handleSave = () => {
    setIsModalOpen(false);
  };

  if (isCollapsed) return null;

  return (
    <>
      <div
        className="draggable-item"
        draggable
        onDragStart={(event) => onDragStart(event)}
      >
        <div className="icon-text-container">
          <FiActivity className="icon" />
          <span className="text">LIF Neuron</span>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="edit-button">Edit</button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} className="lif-modal">
        <ModalHeader>LIF Parameters</ModalHeader>
        <ModalContent className="lif-modal-content">
          <div className="lif-param-row">
            <Label htmlFor="resting" className="lif-param-label">V<sub>rest</sub></Label>
            <Input
              id="resting"
              type="number"
              value={params.resting}
              onChange={(e) => setParams({ ...params, resting: Number(e.target.value) })}
              className="lif-param-input"
            />
            <span className="lif-param-unit">mV</span>
          </div>

          <div className="lif-param-row">
            <Label htmlFor="threshold" className="lif-param-label">V<sub>th</sub></Label>
            <Input
              id="threshold"
              type="number"
              value={params.threshold}
              onChange={(e) => setParams({ ...params, threshold: Number(e.target.value) })}
              className="lif-param-input"
            />
            <span className="lif-param-unit">mV</span>
          </div>

          <div className="lif-param-row">
            <Label htmlFor="tau" className="lif-param-label">τ</Label>
            <Input
              id="tau"
              type="number"
              step="0.1"
              value={params.tau}
              onChange={(e) => setParams({ ...params, tau: Number(e.target.value) })}
              className="lif-param-input"
            />
            <span className="lif-param-unit">ms</span>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Apply</Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default DraggableNeuron;
