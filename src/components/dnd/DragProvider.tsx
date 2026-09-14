import { useState, type ReactNode } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import type { Modifier } from '@dnd-kit/core';
import { useStore } from '@/store/store';
import { decodeTarget, dropMutation } from '@/domain/dnd';
import { updateItem, moveItem } from '@/api/commands';
import type { Item } from '@/domain/types';

/**
 * Puts the preview under the pointer by its left edge rather than its centre.
 *
 * Centred, the card covers the cursor and you cannot see what you are aiming
 * at; anchored left, the pointer leads and the destination stays readable.
 */
const anchorLeftOfCursor: Modifier = ({
  activatorEvent, activeNodeRect, draggingNodeRect, transform,
}) => {
  if (!draggingNodeRect || !activeNodeRect || !activatorEvent) return transform;
  const { clientX, clientY } = activatorEvent as PointerEvent;
  return {
    ...transform,
    x: transform.x + clientX - activeNodeRect.left - 12,
    y: transform.y + clientY - activeNodeRect.top - draggingNodeRect.height / 2,
  };
};

/**
 * Drag and drop across the whole app.
 *
 * A drop is translated by the rules in `domain/dnd`, applied optimistically,
 * and offered back as an undo, because dragging is easy to do by accident.
 */
export function DragProvider({ children }: { children: ReactNode }) {
  const snapshot = useStore((s) => s.snapshot);
  const apply = useStore((s) => s.apply);
  const toast = useStore((s) => s.toast);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const setDragging = useStore((s) => s.setDragging);
  const moveSection = useStore((s) => s.moveSection);

  // A short distance threshold keeps a plain click on a task from starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setDraggingId(id);
    // Sections are not tasks, so the "a task is in flight" flag stays down.
    setDragging(id.startsWith('section:') ? null : id);
  }

  async function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    setDraggingId(null);
    setDragging(null);
    if (!event.over) return;

    /* A section is dragged whole, into a slot between two others. It is not a
       task and none of the task rules apply to it. */
    if (activeId.startsWith('section:')) {
      const overId = String(event.over.id);
      if (!overId.startsWith('slot:')) return;
      await moveSection(activeId.slice('section:'.length), Number(overId.split(':')[2]));
      return;
    }

    const item = snapshot.items[activeId];
    const target = decodeTarget(String(event.over.id));
    if (!item || !target) return;

    const mutation = dropMutation(item, target);
    if (!mutation) return;

    // Captured before the change so the undo can put every field back.
    const before = {
      due: item.due,
      labels: item.labels,
      project_id: item.project_id,
      section_id: item.section_id,
    };

    const patch = (fields: Record<string, unknown>) => (snap: typeof snapshot) => ({
      ...snap,
      items: { ...snap.items, [item.id]: { ...snap.items[item.id], ...fields } as Item },
    });

    if (mutation.update) {
      await apply([updateItem(item.id, mutation.update)], patch(mutation.update));
    } else if (mutation.move) {
      await apply([moveItem(item.id, mutation.move)], patch(mutation.move));
    }

    toast(item.content, () => {
      void apply([updateItem(item.id, before)], patch(before));
    });
  }

  const dragging = draggingId && !draggingId.startsWith('section:')
    ? snapshot.items[draggingId]
    : null;
  const draggingSection = draggingId?.startsWith('section:')
    ? snapshot.sections[draggingId.slice('section:'.length)]
    : null;

  return (
    /* Collisions are decided by where the cursor is, not by which droppable a
       row overlaps most. A task row is as wide as the page, so by area it
       always beat the narrow sidebar destinations: dropping onto Inbox,
       Upcoming or Someday simply never registered. The overlay already snaps
       to the cursor, so this is also what the drag looks like. */
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {children}
      {/* Without a modifier the preview stays at the row's original position
          instead of following the pointer. */}
      <DragOverlay dropAnimation={null} modifiers={[anchorLeftOfCursor]}>
        {dragging && <div className="dragoverlay">{dragging.content}</div>}
        {draggingSection && (
          <div className="dragoverlay section">{draggingSection.name || '—'}</div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
