import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { BlockCard } from '../BlockCard';
import { type BlockColor } from '../BlockCard';

export interface BlockDragData {
  nodeType: string;
  neuronType?: string;
  neuronCount?: number;
  parameters?: Record<string, unknown>;
  networkName?: string;
}

interface DraggableBlockProps {
  id: string;
  data: BlockDragData;
  color: BlockColor;
  children: React.ReactNode;
  className?: string;
}

/** Wraps BlockCard with @dnd-kit useDraggable for DnD kit drag. */
export function DraggableBlock({ id, data, color, children, className }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data,
  });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? 'opacity-40' : ''}>
      <BlockCard color={color} className={className} draggable={false}>
        {children}
      </BlockCard>
    </div>
  );
}
