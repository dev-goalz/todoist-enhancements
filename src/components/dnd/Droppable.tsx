import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { encodeTarget, type DropTarget } from '@/domain/dnd';

interface DroppableProps {
  target: DropTarget;
  /**
   * Distinguishes two places that offer the same destination — the sidebar's
   * "My week" and the page's "Anytime this week" are both `anytime`, and a
   * droppable registry keyed by id would keep only one of them.
   */
  scope?: string;
  children: (props: { isOver: boolean }) => ReactNode;
}

/** Marks a region as a destination, and tells its child when a task is over it. */
export function Droppable({ target, scope, children }: DroppableProps) {
  const { setNodeRef, isOver } = useDroppable({ id: encodeTarget(target, scope) });
  return <div ref={setNodeRef}>{children({ isOver })}</div>;
}
