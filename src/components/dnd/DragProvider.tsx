import { useState, type ReactNode } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { useStore } from '@/store/store';
import { decodeTarget, dropMutation } from '@/domain/dnd';
import { updateItem, moveItem } from '@/api/commands';
import type { Item } from '@/domain/types';

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

  // A short distance threshold keeps a plain click on a task from starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
    setDragging(String(event.active.id));
  }

  async function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    setDragging(null);
    if (!event.over) return;

    const item = snapshot.items[String(event.active.id)];
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

  const dragging = draggingId ? snapshot.items[draggingId] : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {children}
      <DragOverlay dropAnimation={null}>
        {dragging && <div className="dragoverlay">{dragging.content}</div>}
      </DragOverlay>
    </DndContext>
  );
}
