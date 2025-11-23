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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} className="w-1/3">
        <ModalHeader>Edit LIF Neuron Parameters</ModalHeader>
        <ModalContent className="flex flex-col gap-4">
          <div className="grid grid-cols-3 items-center gap-2">
            <Label htmlFor="resting" className="text-right">Resting State (mV)</Label>
            <Input
              id="resting"
              type="number"
              value={params.resting}
              onChange={(e) => setParams({ ...params, resting: Number(e.target.value) })}
              className="col-span-2"
            />
          </div>
          <div className="grid grid-cols-3 items-center gap-2">
            <Label htmlFor="threshold" className="text-right">Threshold (mV)</Label>
            <Input
              id="threshold"
              type="number"
              value={params.threshold}
              onChange={(e) => setParams({ ...params, threshold: Number(e.target.value) })}
              className="col-span-2"
            />
          </div>
          <div className="grid grid-cols-3 items-center gap-2">
            <Label htmlFor="tau" className="text-right">Tau (ms)</Label>
            <Input
              id="tau"
              type="number"
              value={params.tau}
              onChange={(e) => setParams({ ...params, tau: Number(e.target.value) })}
              className="col-span-2"
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default DraggableNeuron;
