import type { ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useStore } from '@/store/store';

interface ProjectRowSortableProps {
  projectId: string;
  className?: string;
  /**
   * False for the copy of a project shown under Favourites.
   *
   * A favourite is the same project appearing twice, and two rows cannot
   * register the same drag id — the second silently replaces the first. The
   * copy is also not in a list of its own to be reordered within: its order
   * there is the tree's order.
   */
  sortable?: boolean;
  children: ReactNode;
}

/** The id a sidebar project row registers under, in both roles. */
export const projectRowId = (projectId: string): string => `project-row:${projectId}`;

/**
 * A sidebar project row that can be picked up and put down on another.
 *
 * It registers in the app's one drag context rather than opening a second: a
 * nested context would fight the first over the same pointer, and dropping a
 * task onto a project has to keep working while a project is being dragged
 * past it. The row is both a handle and a landing place, which is what makes
 * reordering feel like moving one thing rather than aiming at a gap.
 *
 * The drag starts after a short distance, so a click still selects the
 * project and a project is never reordered by accident.
 */
export function ProjectRowSortable({
  projectId, className = '', sortable = true, children,
}: ProjectRowSortableProps) {
  const id = projectRowId(projectId);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled: !sortable });
  /* A task in flight is not looking for a position in this list, it is looking
     for a project to live in — and that destination is the droppable wrapped
     around this row. Both used to stay open, the pointer landed on whichever
     of the two the collision happened to return first, and a task dropped on a
     project drew the reorder bar and went nowhere. */
  const taskDragging = useStore((s) => s.draggingTaskId !== null);
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id, disabled: !sortable || taskDragging,
  });
  const nesting = useStore((s) => s.nesting);

  if (!sortable) return <div className={`navrow${className}`}>{children}</div>;

  const landing = isOver && !isDragging && !taskDragging;

  return (
    <div
      ref={(node) => { setNodeRef(node); setDropRef(node); }}
      className={`navrow sortable${isDragging ? ' lifting' : ''}${landing ? (nesting ? ' nesting' : ' landing') : ''}${className}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

/**
 * A row that can be dropped onto but never picked up.
 *
 * A folder is a place, not a thing you reorder: it holds projects, and the
 * only useful answer to a project landing on one is to put it inside. It
 * registers under the same id a project row does, so the drop is read by the
 * same code that reads every other sidebar drop.
 */
export function ProjectDropRow({
  projectId, className = '', children,
}: {
  projectId: string;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: projectRowId(projectId) });
  const dragging = useStore((s) => s.draggingProjectId);

  return (
    <div
      ref={setNodeRef}
      className={`navrow${isOver && dragging ? ' nesting folderopen' : ''}${className}`}
    >
      {children}
    </div>
  );
}
