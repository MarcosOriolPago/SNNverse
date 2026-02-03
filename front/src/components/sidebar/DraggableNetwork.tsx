import React from 'react';
import { Settings, GripVertical } from 'lucide-react';

interface DraggableNetworkProps {
    name: string;
    isCollapsed?: boolean;
}

const DraggableNetwork: React.FC<DraggableNetworkProps> = ({ name, isCollapsed }) => {

    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        const nodeData = {
            nodeType,
            networkName: name
        };
        event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
        event.dataTransfer.effectAllowed = 'move';
    };

    if (isCollapsed) return null;

    return (
        <div
            className="group flex items-center justify-between px-lg py-md mb-md rounded-lg bg-slate-800/40 backdrop-blur-sm border border-slate-400/10 text-text-muted cursor-grab transition-smooth relative shadow-xs hover:bg-slate-800/80 hover:border-cyan-400/50 hover:text-slate-100 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(56,189,248,0.15)] active:cursor-grabbing active:scale-[0.98] active:shadow-xs"
            draggable
            onDragStart={(event) => onDragStart(event, 'network')}
            title={`Drag to add ${name} to experiment`}
        >
            <div className="flex items-center gap-md">
                <GripVertical size={14} className="w-[1.1rem] h-[1.1rem] transition-slow text-slate-600 mr-xs" />
                <Settings className="w-[1.1rem] h-[1.1rem] transition-slow text-purple-400" /> {/* Distinguish network blocks */}
                <span className="text-md font-medium tracking-[0.01em] truncate max-w-[120px]">{name}</span>
            </div>
            <div className="text-[10px] bg-bg-tertiary px-xs rounded-sm text-slate-500">
                BLOCK
            </div>
        </div>
    );
};

export default DraggableNetwork;
