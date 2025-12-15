import React from 'react';
import { Activity } from 'lucide-react';
import '../../styles/draggable.css';

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
        <div
            className="draggable-item"
            draggable
            onDragStart={(event) => onDragStart(event)}
        >
            <div className="icon-text-container">
                <Activity className="icon" />
                <span className="text">Signal Monitor</span>
            </div>
        </div>
    );
};

export default DraggableOutput;
