import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { encodeTarget, type DropTarget } from '@/domain/dnd';

interface DroppableProps {
  target: DropTarget;
  children: (props: { isOver: boolean }) => ReactNode;
}

/** Marks a region as a destination, and tells its child when a task is over it. */
export function Droppable({ target, children }: DroppableProps) {
  const { setNodeRef, isOver } = useDroppable({ id: encodeTarget(target) });
  return <div ref={setNodeRef}>{children({ isOver })}</div>;
}
