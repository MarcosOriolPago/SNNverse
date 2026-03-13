import React from 'react';
import { ArrowRightFromLine } from 'lucide-react';
import { DraggableBlock } from './DraggableBlock';

const DraggableSpikeFx = ({ isCollapsed }: { isCollapsed?: boolean }) => {
  if (isCollapsed) return null;

  return (
    <DraggableBlock id="spike-fx" data={{ nodeType: 'spike_fx' }} color="purple">
      <div className="flex items-center gap-md">
        <ArrowRightFromLine className="w-[1.1rem] h-[1.1rem] text-slate-500 transition-all duration-300 group-hover:text-purple-400 group-hover:drop-shadow-[0_0_6px_rgba(168,85,247,0.6)] group-hover:scale-110" />
        <span className="text-md font-medium tracking-[0.01em]">Spike FX Input</span>
      </div>
    </DraggableBlock>
  );
};

export default DraggableSpikeFx;
