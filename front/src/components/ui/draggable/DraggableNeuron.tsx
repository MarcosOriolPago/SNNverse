import React, { useState, useMemo } from 'react';
import { FiActivity } from 'react-icons/fi';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../modal';
import { Input } from '../input';
import { Label } from '../label';
import { Button } from '../button';
import { DraggableBlock } from './DraggableBlock';
import { cn } from '@/lib/utils';

export type NeuronType = 'LIF' | 'IF' | 'Izhikevich';

const NEURON_TYPE_CONFIG: Record<NeuronType, { label: string; color: 'cyan' | 'purple' | 'green' }> = {
  LIF: { label: 'LIF Neuron', color: 'cyan' },
  IF: { label: 'IF Neuron', color: 'purple' },
  Izhikevich: { label: 'Izhikevich Neuron', color: 'green' },
};

interface DraggableNeuronProps {
  neuronType: NeuronType;
  isCollapsed?: boolean;
}

const DraggableNeuron = ({ neuronType, isCollapsed = false }: DraggableNeuronProps) => {
  const config = NEURON_TYPE_CONFIG[neuronType];

  const [params, setParams] = useState<Record<string, number | string>>(
    neuronType === 'Izhikevich'
      ? { a: 0.02, b: 0.2, c: -65, d: 8 }
      : { threshold: -55, rest: -70, tau: 2.0, tau_refrac: 2.0 }
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const blockData = useMemo(() => {
    const parameters =
      neuronType === 'Izhikevich'
        ? {
            a: typeof params.a === 'string' ? parseFloat(params.a) || 0.02 : params.a,
            b: typeof params.b === 'string' ? parseFloat(params.b) || 0.2 : params.b,
            c: typeof params.c === 'string' ? parseFloat(params.c) || -65 : params.c,
            d: typeof params.d === 'string' ? parseFloat(params.d) || 8 : params.d,
          }
        : {
            threshold: typeof params.threshold === 'string' ? parseFloat(params.threshold) || -55 : params.threshold,
            rest: typeof params.rest === 'string' ? parseFloat(params.rest) || -70 : params.rest,
            tau: typeof params.tau === 'string' ? parseFloat(params.tau) || 2.0 : params.tau,
            tau_refrac: typeof params.tau_refrac === 'string' ? parseFloat(params.tau_refrac) || 2.0 : params.tau_refrac,
          };
    return { nodeType: 'neuron', neuronType, parameters };
  }, [neuronType, params]);

  const handleSave = () => {
    if (neuronType === 'Izhikevich') {
      setParams({
        a: typeof params.a === 'string' ? parseFloat(params.a) || 0.02 : params.a,
        b: typeof params.b === 'string' ? parseFloat(params.b) || 0.2 : params.b,
        c: typeof params.c === 'string' ? parseFloat(params.c) || -65 : params.c,
        d: typeof params.d === 'string' ? parseFloat(params.d) || 8 : params.d,
      });
    } else {
      setParams({
        threshold: typeof params.threshold === 'string' ? parseFloat(params.threshold) || -55 : params.threshold,
        rest: typeof params.rest === 'string' ? parseFloat(params.rest) || -70 : params.rest,
        tau: typeof params.tau === 'string' ? parseFloat(params.tau) || 2.0 : params.tau,
        tau_refrac: typeof params.tau_refrac === 'string' ? parseFloat(params.tau_refrac) || 2.0 : params.tau_refrac,
      });
    }
    setIsModalOpen(false);
  };

  if (isCollapsed) return null;

  return (
    <>
      <DraggableBlock id={`neuron-${neuronType}`} data={blockData} color={config.color} className="relative">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-md">
            <FiActivity
              className={cn(
                'w-[1.1rem] h-[1.1rem] text-slate-500 transition-all duration-300',
                config.color === 'purple' && 'group-hover:text-purple-400 group-hover:drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]',
                config.color === 'cyan' && 'group-hover:text-cyan-400 group-hover:drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]',
                config.color === 'green' && 'group-hover:text-green-400 group-hover:drop-shadow-[0_0_6px_rgba(74,222,128,0.6)]',
                'group-hover:scale-110'
              )}
            />
            <span className="text-md font-medium tracking-[0.01em]">{config.label}</span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className={cn(
              'text-sm font-semibold px-[0.6rem] py-xs rounded-sm bg-slate-900/80 text-slate-300 border border-slate-700/50 opacity-0 translate-x-[5px] transition-all duration-200 cursor-pointer group-hover:opacity-100 group-hover:translate-x-0',
              config.color === 'purple' && 'hover:bg-purple-400 hover:text-slate-900 hover:border-purple-400',
              config.color === 'cyan' && 'hover:bg-cyan-400 hover:text-slate-900 hover:border-cyan-400',
              config.color === 'green' && 'hover:bg-green-400 hover:text-slate-900 hover:border-green-400'
            )}
          >
            Edit
          </button>
        </div>
      </DraggableBlock>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <ModalHeader>{config.label} Parameters</ModalHeader>
        <ModalContent className="flex flex-col gap-6">
          {neuronType === 'Izhikevich' ? (
            <>
              <div className="flex items-center justify-between">
                <Label htmlFor="a" className="w-[60%] text-right mb-0">a</Label>
                <Input id="a" type="number" step="0.01" value={params.a} onChange={(e) => setParams({ ...params, a: e.target.value })} className="w-[35%] text-right" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="b" className="w-[60%] text-right mb-0">b</Label>
                <Input id="b" type="number" step="0.01" value={params.b} onChange={(e) => setParams({ ...params, b: e.target.value })} className="w-[35%] text-right" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="c" className="w-[60%] text-right mb-0">c</Label>
                <Input id="c" type="number" value={params.c} onChange={(e) => setParams({ ...params, c: e.target.value })} className="w-[35%] text-right" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="d" className="w-[60%] text-right mb-0">d</Label>
                <Input id="d" type="number" value={params.d} onChange={(e) => setParams({ ...params, d: e.target.value })} className="w-[35%] text-right" />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Label htmlFor="rest" className="w-[60%] text-right mb-0">V<sub>rest</sub></Label>
                <div className="flex items-center gap-2 w-[35%]">
                  <Input id="rest" type="number" value={params.rest} onChange={(e) => setParams({ ...params, rest: e.target.value })} className="w-full text-right" />
                  <span className="text-slate-500 text-sm">mV</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="threshold" className="w-[60%] text-right mb-0">V<sub>th</sub></Label>
                <div className="flex items-center gap-2 w-[35%]">
                  <Input id="threshold" type="number" value={params.threshold} onChange={(e) => setParams({ ...params, threshold: e.target.value })} className="w-full text-right" />
                  <span className="text-slate-500 text-sm">mV</span>
                </div>
              </div>
              {neuronType === 'LIF' && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="tau" className="w-[60%] text-right mb-0">τ</Label>
                  <div className="flex items-center gap-2 w-[35%]">
                    <Input id="tau" type="number" step="0.1" value={params.tau} onChange={(e) => setParams({ ...params, tau: e.target.value })} className="w-full text-right" />
                    <span className="text-slate-500 text-sm">ms</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label htmlFor="tau_refrac" className="w-[60%] text-right mb-0">τ<sub>refrac</sub></Label>
                <div className="flex items-center gap-2 w-[35%]">
                  <Input id="tau_refrac" type="number" step="0.1" value={params.tau_refrac} onChange={(e) => setParams({ ...params, tau_refrac: e.target.value })} className="w-full text-right" />
                  <span className="text-slate-500 text-sm">ms</span>
                </div>
              </div>
            </>
          )}
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
