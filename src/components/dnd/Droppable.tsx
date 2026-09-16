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
  /**
   * Turns the destination off for the duration of a drag it has no answer
   * for. A sidebar project row is both a destination and a position in a
   * list, and only one of those readings applies to what is in flight.
   */
  disabled?: boolean;
  children: (props: { isOver: boolean }) => ReactNode;
}

/** Marks a region as a destination, and tells its child when a task is over it. */
export function Droppable({ target, scope, disabled = false, children }: DroppableProps) {
  const { setNodeRef, isOver } = useDroppable({ id: encodeTarget(target, scope), disabled });
  return <div ref={setNodeRef}>{children({ isOver: isOver && !disabled })}</div>;
}
