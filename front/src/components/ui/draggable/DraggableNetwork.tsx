import React from 'react';
import { Settings, GripVertical } from 'lucide-react';
import { BlockCard } from '../BlockCard';

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
        <BlockCard
            onDragStart={(event) => onDragStart(event, 'network')}
            color="blue"
        >
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-md">
                    <GripVertical size={14} className="w-[1.1rem] h-[1.1rem] transition-all duration-300 text-slate-600 mr-xs" />
                    <Settings className="w-[1.1rem] h-[1.1rem] transition-all duration-300 text-blue-400 group-hover:text-blue-300 group-hover:drop-shadow-[0_0_6px_rgba(96,165,250,0.6)] group-hover:scale-110 group-hover:rotate-90" />
                    <span className="text-md font-medium tracking-[0.01em] truncate max-w-[120px]" title={name}>{name}</span>
                </div>
                <div className="text-[10px] bg-slate-700/60 px-2 py-0.5 rounded-sm text-slate-400 font-semibold">
                    BLOCK
                </div>
            </div>
        </BlockCard>
    );
};

export default DraggableNetwork;
