import React, { useState } from 'react';
import { FiActivity } from 'react-icons/fi';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../modal';
import { Input } from '../input';
import { Label } from '../label';
import { Button } from '../button';
import { BlockCard } from '../BlockCard';


const DraggableNeuron = ({ isCollapsed }: { isCollapsed: boolean }) => {
  const [params, setParams] = useState<{ threshold: number | string, resting: number | string, tau: number | string }>({
    threshold: -55,
    resting: -70,
    tau: 2.0
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const onDragStart = (event: React.DragEvent) => {
    // Ensure all values are numbers when dragging
    const nodeData = {
      nodeType: 'neuron',
      neuronType: 'LIF',
      parameters: {
        threshold: typeof params.threshold === 'string' ? parseFloat(params.threshold) || -55 : params.threshold,
        resting: typeof params.resting === 'string' ? parseFloat(params.resting) || -70 : params.resting,
        tau: typeof params.tau === 'string' ? parseFloat(params.tau) || 2.0 : params.tau,
      }
    };
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleSave = () => {
    // Convert any string values to numbers before closing
    setParams({
      threshold: typeof params.threshold === 'string' ? parseFloat(params.threshold) || -55 : params.threshold,
      resting: typeof params.resting === 'string' ? parseFloat(params.resting) || -70 : params.resting,
      tau: typeof params.tau === 'string' ? parseFloat(params.tau) || 2.0 : params.tau,
    });
    setIsModalOpen(false);
  };

  if (isCollapsed) return null;

  return (
    <>
      <BlockCard
        onDragStart={(event) => onDragStart(event)}
        color="cyan"
        className="relative"
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-md">
            <FiActivity className="w-[1.1rem] h-[1.1rem] text-slate-500 transition-all duration-300 group-hover:text-cyan-400 group-hover:drop-shadow-[0_0_6px_rgba(56,189,248,0.6)] group-hover:scale-110" />
            <span className="text-md font-medium tracking-[0.01em]">LIF Neuron</span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-sm font-semibold px-[0.6rem] py-xs rounded-sm bg-slate-900/80 text-slate-300 border border-slate-700/50 opacity-0 translate-x-[5px] transition-all duration-200 cursor-pointer group-hover:opacity-100 group-hover:translate-x-0 hover:bg-cyan-400 hover:text-slate-900 hover:border-cyan-400 hover:shadow-[0_0_8px_rgba(56,189,248,0.4)]"
          >
            Edit
          </button>
        </div>
      </BlockCard>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <ModalHeader>LIF Parameters</ModalHeader>
        <ModalContent className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="resting" className="w-[60%] text-right mb-0">V<sub>rest</sub></Label>
            <div className='flex items-center gap-2 w-[35%]'>
              <Input
                id="resting"
                type="number"
                value={params.resting}
                onChange={(e) => setParams({ ...params, resting: e.target.value })}
                className="w-full text-right"
              />
              <span className="text-slate-500 text-sm">mV</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="threshold" className="w-[60%] text-right mb-0">V<sub>th</sub></Label>
            <div className='flex items-center gap-2 w-[35%]'>
              <Input
                id="threshold"
                type="number"
                value={params.threshold}
                onChange={(e) => setParams({ ...params, threshold: e.target.value })}
                className="w-full text-right"
              />
              <span className="text-slate-500 text-sm">mV</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="tau" className="w-[60%] text-right mb-0">τ</Label>
            <div className='flex items-center gap-2 w-[35%]'>
              <Input
                id="tau"
                type="number"
                step="0.1"
                value={params.tau}
                onChange={(e) => setParams({ ...params, tau: e.target.value })}
                className="w-full text-right"
              />
              <span className="text-slate-500 text-sm">ms</span>
            </div>
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
