import React from 'react';
import { Keyboard } from 'lucide-react';
import { BlockCard } from '../BlockCard';

const DraggableKeyboard = ({ isCollapsed }: { isCollapsed: boolean }) => {

    const onDragStart = (event: React.DragEvent) => {
        const nodeData = {
            nodeType: 'keyboard',
        };
        event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
        event.dataTransfer.effectAllowed = 'move';
    };

    if (isCollapsed) return null;

    return (
        <BlockCard
            onDragStart={(event) => onDragStart(event)}
            color="purple"
        >
            <div className="flex items-center gap-md">
                <Keyboard className="w-[1.1rem] h-[1.1rem] text-slate-500 transition-all duration-300 group-hover:text-purple-400 group-hover:drop-shadow-[0_0_6px_rgba(168,85,247,0.6)] group-hover:scale-110" />
                <span className="text-md font-medium tracking-[0.01em]">Keyboard Input</span>
            </div>
        </BlockCard>
    );
};

export default DraggableKeyboard;
