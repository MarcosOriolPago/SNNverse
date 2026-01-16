import React from 'react';
import { Settings, GripVertical } from 'lucide-react';
import '../../styles/draggable.css';

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
            className="draggable-item network-item"
            draggable
            onDragStart={(event) => onDragStart(event, 'network')}
            title={`Drag to add ${name} to experiment`}
        >
            <div className="icon-text-container">
                <GripVertical size={14} className="icon text-slate-600 mr-1" />
                <Settings className="icon text-purple-400" /> {/* Distinguish network blocks */}
                <span className="text truncate max-w-120">{name}</span>
            </div>
            <div className="draggable-badge">
                BLOCK
            </div>
        </div>
    );
};

export default DraggableNetwork;
