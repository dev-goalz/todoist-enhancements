import { useState, type ReactNode } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragMoveEvent, type DragStartEvent,
} from '@dnd-kit/core';
import type { Modifier } from '@dnd-kit/core';
import { useStore } from '@/store/store';
import { canNest, decodeNestTarget, decodeTarget, dropMutation, moveArgs } from '@/domain/dnd';
import { siblingOrder } from '@/store/selectors';
import { SUBTASK_DRAG_PREFIX } from '@/components/TaskRow';
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
 * What is being dragged, and what will take it.
 *
 * Four different things are dragged in this app and they are not
 * interchangeable: a task goes to a destination, a section into a slot, a
 * sidebar project onto another row, a subtask onto one of its siblings. They
 * all share one drag context, so every droppable in the app is a candidate for
 * every drag — and a drop is decided by where the pointer is, which means a
 * region of the page behind a dialog can win a drop aimed at a row inside it.
 * Each drag is therefore only offered what it could possibly mean.
 */
const dragKind = (id: string): 'subtask' | 'section' | 'project' | 'task' =>
  (id.startsWith('subtask:') ? 'subtask'
    : id.startsWith('section:') ? 'section'
      : id.startsWith('project-row:') ? 'project' : 'task');

const dropKind = (id: string): 'subtask' | 'slot' | 'project' | 'target' =>
  (id.startsWith('subtask:') ? 'subtask'
    : id.startsWith('slot:') ? 'slot'
      : id.startsWith('project-row:') ? 'project' : 'target');

const ACCEPTS: Record<ReturnType<typeof dragKind>, Array<ReturnType<typeof dropKind>>> = {
  subtask: ['subtask'],
  section: ['slot'],
  /* A sidebar row is both a position in the list and a project destination,
     and a project dragged onto either means the same landing. */
  project: ['project', 'target'],
  task: ['target'],
};

/**
 * Where the pointer is, among the places this drag could actually land.
 *
 * Collisions are decided by the cursor rather than by overlap, because a task
 * row is as wide as the page and by area it always beat the narrow sidebar
 * destinations.
 */
const collisionsForKind: CollisionDetection = (args) => {
  const accepted = ACCEPTS[dragKind(String(args.active.id))];
  const hits = pointerWithin(args).filter(
    (collision) => accepted.includes(dropKind(String(collision.id))),
  );
  /* A row that takes a subtask lies inside the droppable of its group, so the
     pointer is within both; the row is the narrower, deliberate answer. */
  const rows = hits.filter((c) => decodeNestTarget(String(c.id)) !== null);
  return rows.length ? rows : hits;
};

/**
 * When the last drag ended, for the click that a browser fires on a drop.
 *
 * A pointer that goes down and comes up inside the same element produces a
 * click, drag or no drag, so a card dropped back where it started would open.
 */
export const dragClock = {
  endedAt: 0,
  justEnded: () => Date.now() - dragClock.endedAt < 250,
};

/**
 * How far right a sidebar project, or a task row, has to be dragged before the
 * drop nests it rather than reordering or moving it.
 *
 * The same gesture means two things, told apart by direction: straight down
 * the list moves it, out to the right puts it inside. It is the indent every
 * outliner uses, and it costs no second handle and no modifier key.
 */
export const NEST_THRESHOLD_PX = 28;

/** A dragged item's task id, whether it was picked up as a row or a subtask. */
const taskIdOf = (activeId: string): string =>
  activeId.startsWith(SUBTASK_DRAG_PREFIX) ? activeId.slice(SUBTASK_DRAG_PREFIX.length) : activeId;

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
  const reorderProjects = useStore((s) => s.reorderProjects);
  const reorderSubtasks = useStore((s) => s.reorderSubtasks);
  const setDraggingSection = useStore((s) => s.setDraggingSection);
  const nestProject = useStore((s) => s.nestProject);
  const setNesting = useStore((s) => s.setNesting);
  const setDraggingProject = useStore((s) => s.setDraggingProject);
  /** A subtask pulled out to the left: on release it becomes a task of its own. */
  const [outdenting, setOutdenting] = useState(false);

  // A short distance threshold keeps a plain click on a task from starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const isSection = id.startsWith('section:');
    const isProject = id.startsWith('project-row:');
    const isSubtask = id.startsWith('subtask:');
    setDraggingId(id);
    /* None of these is a task being filed somewhere, so the "a task is in
       flight" flag stays down and the empty drop zones stay closed. A subtask
       being reordered is moving inside its parent, not out of it. */
    setDragging(isSection || isProject || isSubtask ? null : taskIdOf(id));
    setDraggingSection(isSection ? id.slice('section:'.length) : null);
    setDraggingProject(isProject ? id.slice('project-row:'.length) : null);
  }

  /* The indent has to be visible while it is being made, not discovered on
     release, so the row under the pointer is told what the drop would mean. */
  function onDragMove(event: DragMoveEvent) {
    const id = String(event.active.id);
    if (id.startsWith('section:')) return;
    setNesting(event.delta.x >= NEST_THRESHOLD_PX);
    setOutdenting(id.startsWith(SUBTASK_DRAG_PREFIX) && event.delta.x <= -NEST_THRESHOLD_PX);
  }

  async function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    dragClock.endedAt = Date.now();
    setDraggingId(null);
    setDragging(null);
    setDraggingSection(null);
    const nesting = useStore.getState().nesting;
    setNesting(false);
    setOutdenting(false);
    setDraggingProject(null);

    /* Pulled out to the left, a subtask leaves its parent and stays where it
       is otherwise: same project, same section, now at the top level. The
       pointer may well be over nothing by then, so this comes first. */
    if (activeId.startsWith(SUBTASK_DRAG_PREFIX) && outdenting) {
      const sub = snapshot.items[taskIdOf(activeId)];
      if (sub?.parent_id && !(event.over && decodeNestTarget(String(event.over.id)))) {
        await promoteTask(sub);
        return;
      }
    }
    if (!event.over) return;

    /* A section is dragged whole, into a slot between two others. It is not a
       task and none of the task rules apply to it. */
    if (activeId.startsWith('section:')) {
      const overId = String(event.over.id);
      if (!overId.startsWith('slot:')) return;
      await moveSection(activeId.slice('section:'.length), Number(overId.split(':')[2]));
      return;
    }

    /* A subtask dragged in the task panel is reordered among its siblings, and
       goes nowhere else: the panel is one parent's list of children. */
    if (activeId.startsWith('subtask:')) {
      const overId = String(event.over.id);
      if (!overId.startsWith('subtask:')) return;
      const from = activeId.slice('subtask:'.length);
      const to = overId.slice('subtask:'.length);
      if (from === to) return;

      const parentId = snapshot.items[from]?.parent_id;
      if (!parentId || snapshot.items[to]?.parent_id !== parentId) return;

      const siblings = Object.values(snapshot.items)
        .filter((child) => child.parent_id === parentId && !child.is_deleted)
        .sort((a, b) => a.child_order - b.child_order)
        .map((child) => child.id);

      const at = siblings.indexOf(from);
      const onto = siblings.indexOf(to);
      if (at < 0 || onto < 0) return;
      const next = [...siblings];
      next.splice(onto, 0, ...next.splice(at, 1));
      await reorderSubtasks(next);
      return;
    }

    /* A project dragged in the sidebar is reordered among its own siblings.
       It is not a destination for anything and it does not move between
       workspaces: the ids come from one list and go back as that list. */
    if (activeId.startsWith('project-row:')) {
      const overId = String(event.over.id);
      /* A sidebar row is two things at once: somewhere to file a task, and a
         position in a list. While a project is in flight only the second
         reading applies, so a landing on either id means the same place. */
      const over = overId.startsWith('project-row:')
        ? overId.slice('project-row:'.length)
        : decodeTarget(overId)?.kind === 'project'
          ? (decodeTarget(overId) as { kind: 'project'; projectId: string }).projectId
          : null;
      if (!over) return;
      const from = activeId.slice('project-row:'.length);
      if (from === over) return;

      /* Dragged out to the right: the row it landed on becomes its parent.
         A folder needs no such gesture — putting projects inside it is the
         only thing a folder is for, so landing on one is enough. */
      if (nesting || snapshot.projects[over]?.is_folder) {
        await nestProject(from, over);
        return;
      }

      const siblings = siblingOrder(snapshot, from);
      const at = siblings.indexOf(from);
      const to = siblings.indexOf(over);
      if (at < 0 || to < 0) return;
      const next = [...siblings];
      next.splice(to, 0, ...next.splice(at, 1));
      await reorderProjects(next);
      return;
    }

    const item = snapshot.items[taskIdOf(activeId)];
    const parentId = decodeNestTarget(String(event.over.id));
    if (item && parentId) {
      await nestTask(item, parentId);
      return;
    }

    const target = decodeTarget(String(event.over.id));
    if (!item || !target) return;

    const mutation = dropMutation(item, target);
    if (!mutation) return;

    // Captured before the change so the undo can put every field back.
    const before = {
      parent_id: item.parent_id,
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
      // A move to a project or a section lands at its top level.
      await apply([moveItem(item.id, moveArgs(mutation.move))], patch({ ...mutation.move, parent_id: null }));
    }

    /* A move is undone by a move. `item_update` does not take a project or a
       section, so undoing a drop between columns used to put the card back on
       screen and leave it where it was dropped on the server. */
    const undo = !mutation.move
      ? updateItem(item.id, { due: before.due, labels: before.labels })
      : before.parent_id
        ? moveItem(item.id, { parent_id: before.parent_id })
        : moveItem(item.id, moveArgs({ project_id: before.project_id, section_id: before.section_id }));
    toast(item.content, () => {
      void apply([undo], patch(before));
    });
  }

  /* Dropped indented onto another row: the task becomes its subtask, and
     follows it into its project and section, taking its own subtasks along. */
  async function nestTask(item: Item, parentId: string) {
    const parent = snapshot.items[parentId];
    if (!parent || !canNest(snapshot.items, item.id, parent.id)) return;

    const below = new Set<string>();
    for (let grew = true; grew;) {
      grew = false;
      for (const other of Object.values(snapshot.items)) {
        if (other.parent_id && (other.parent_id === item.id || below.has(other.parent_id)) && !below.has(other.id)) {
          below.add(other.id);
          grew = true;
        }
      }
    }

    const place = (fields: Pick<Item, 'parent_id' | 'project_id' | 'section_id'>) =>
      (snap: typeof snapshot) => {
        const items = { ...snap.items, [item.id]: { ...snap.items[item.id], ...fields } };
        for (const id of below) {
          items[id] = { ...items[id], project_id: fields.project_id, section_id: fields.section_id };
        }
        return { ...snap, items };
      };

    const before = { parent_id: item.parent_id, project_id: item.project_id, section_id: item.section_id };
    await apply(
      [moveItem(item.id, { parent_id: parent.id })],
      place({ parent_id: parent.id, project_id: parent.project_id, section_id: parent.section_id }),
    );

    // Moving to a project or a section puts a task back at its top level.
    const undo = before.parent_id
      ? moveItem(item.id, { parent_id: before.parent_id })
      : moveItem(item.id, moveArgs({ project_id: before.project_id, section_id: before.section_id }));
    toast(item.content, () => {
      void apply([undo], place(before));
    });
  }

  async function promoteTask(item: Item) {
    const parentId = item.parent_id;
    if (!parentId) return;
    const patch = (parent_id: string | null) => (snap: typeof snapshot) => ({
      ...snap,
      items: { ...snap.items, [item.id]: { ...snap.items[item.id], parent_id } },
    });
    await apply(
      [moveItem(item.id, moveArgs({ project_id: item.project_id, section_id: item.section_id }))],
      patch(null),
    );
    toast(item.content, () => {
      void apply([moveItem(item.id, { parent_id: parentId })], patch(parentId));
    });
  }

  const dragging = draggingId?.startsWith('subtask:')
    ? snapshot.items[draggingId.slice('subtask:'.length)]
    : draggingId && !draggingId.startsWith('section:')
      ? snapshot.items[taskIdOf(draggingId)]
      : null;
  const draggingSection = draggingId?.startsWith('section:')
    ? snapshot.sections[draggingId.slice('section:'.length)]
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionsForKind}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {children}
      {/* Without a modifier the preview stays at the row's original position
          instead of following the pointer. */}
      <DragOverlay dropAnimation={null} modifiers={[anchorLeftOfCursor]}>
        {dragging && (
          <div className={`dragoverlay${outdenting ? ' outdent' : ''}`}>{dragging.content}</div>
        )}
        {draggingSection && (
          <div className="dragoverlay section">{draggingSection.name || '—'}</div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
