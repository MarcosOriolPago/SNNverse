import React from 'react';
import { ArrowRightFromLine } from 'lucide-react';
import '../../styles/draggable.css';

const DraggableInput = ({ isCollapsed }: { isCollapsed: boolean }) => {

  const onDragStart = (event: React.DragEvent) => {
    const nodeData = {
      nodeType: 'python-input', 
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
        <ArrowRightFromLine className="icon" />
        <span className="text">Python Input (FX)</span>
      </div>
    </div>
  );
};

export default DraggableInput;
