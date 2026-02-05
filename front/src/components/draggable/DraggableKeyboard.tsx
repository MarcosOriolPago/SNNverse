import React from 'react';
import { Keyboard } from 'lucide-react';

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
        <div
            className="group flex items-center justify-between px-lg py-md mb-md rounded-lg bg-slate-800/40 backdrop-blur-sm border border-slate-400/10 text-text-muted cursor-grab transition-smooth relative shadow-xs hover:bg-slate-800/80 hover:border-purple-400/50 hover:text-slate-100 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(168,85,247,0.15)] active:cursor-grabbing active:scale-[0.98] active:shadow-xs"
            draggable
            onDragStart={(event) => onDragStart(event)}
        >
            <div className="flex items-center gap-md">
                <Keyboard className="w-[1.1rem] h-[1.1rem] text-slate-500 transition-slow group-hover:text-purple group-hover:drop-shadow-[0_0_4px_rgba(168,85,247,0.5)]" />
                <span className="text-md font-medium tracking-[0.01em]">Keyboard Input</span>
            </div>
        </div>
    );
};

export default DraggableKeyboard;
