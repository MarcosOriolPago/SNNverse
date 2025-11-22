import React from 'react';
import { ArrowRightFromLine } from 'lucide-react';
import { C } from '../../styles/main';

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
      className={`p-3 mb-4 rounded-md cursor-grab active:cursor-grabbing transition-all flex items-center justify-between ${STYLES.colors.secondary} ${STYLES.boxShadow.medium}`}
      draggable
      onDragStart={(event) => onDragStart(event)}
    >
      <div className="flex items-center gap-2">
        <ArrowRightFromLine className="text-[#0ea5e9]" />
        <span className={`${C.fontSize.medium} ${C.colors.text}`}>Python Input (FX)</span>
      </div>
    </div>
  );
};

export default DraggableInput;
