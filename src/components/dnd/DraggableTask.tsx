import { useDraggable } from '@dnd-kit/core';
import { TaskRow } from '../TaskRow';
import type { Item } from '@/domain/types';

interface DraggableTaskProps {
  item: Item;
  childrenOf: (id: string) => Item[];
  onOpen: (id: string) => void;
  showProject?: boolean;
}

/**
 * A task row that can be picked up.
 *
 * Only the handle starts a drag, so the row itself stays clickable and the
 * list stays scrollable on touch.
 */
export function DraggableTask({ item, childrenOf, onOpen, showProject }: DraggableTaskProps) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: item.id });

  return (
    <div ref={setNodeRef} className={`taskwrap${isDragging ? ' dragging' : ''}`}>
      <TaskRow
        item={item}
        childrenOf={childrenOf}
        onOpen={onOpen}
        showProject={showProject}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
