import { useDroppable } from '@dnd-kit/core';
import { useStore } from '@/store/store';
import { canNest, nestTargetId } from '@/domain/dnd';

/**
 * Makes a task row somewhere to put another task as its subtask.
 *
 * The target only opens while a task is being dragged out to the right, so a
 * straight drag still reaches the group behind. A row that cannot take the
 * task stays a target but never lights up, and the drop onto it does nothing:
 * falling through to the group would move the task somewhere nobody aimed.
 */
export function useNestTarget(itemId: string, enabled: boolean) {
  const nesting = useStore((s) => s.nesting);
  const open = useStore((s) => enabled && s.nesting && s.draggingTaskId !== null);
  const allowed = useStore((s) => (
    open && s.draggingTaskId !== null && canNest(s.snapshot.items, s.draggingTaskId, itemId)
  ));
  const { setNodeRef, isOver } = useDroppable({ id: nestTargetId(itemId), disabled: !open });
  return { setNestRef: setNodeRef, nestOver: isOver && nesting && allowed };
}
