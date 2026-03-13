import React from 'react';
import { useDroppable } from '@dnd-kit/core';

export const CANVAS_DROP_ID = 'canvas-drop';

interface CanvasDropZoneProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** Wraps the canvas area as a droppable for DnD kit. */
export function CanvasDropZone({ children, className, style }: CanvasDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROP_ID });

  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{ ...style, position: 'relative' }}
      data-droppable={CANVAS_DROP_ID}
    >
      {children}
    </div>
  );
}
