import React from 'react';
import { Activity } from 'lucide-react';
import { BlockCard } from '../BlockCard';

const DraggableOutput = ({ isCollapsed }: { isCollapsed: boolean }) => {

    const onDragStart = (event: React.DragEvent) => {
        const nodeData = {
            nodeType: 'output-display',
        };
        event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
        event.dataTransfer.effectAllowed = 'move';
    };

    if (isCollapsed) return null;

    return (
        <BlockCard
            onDragStart={(event) => onDragStart(event)}
            color="green"
        >
            <div className="flex items-center gap-md">
                <Activity className="w-[1.1rem] h-[1.1rem] text-slate-500 transition-all duration-300 group-hover:text-green-400 group-hover:drop-shadow-[0_0_6px_rgba(74,222,128,0.6)] group-hover:scale-110" />
                <span className="text-md font-medium tracking-[0.01em]">Signal Monitor</span>
            </div>
        </BlockCard>
    );
};

export default DraggableOutput;
