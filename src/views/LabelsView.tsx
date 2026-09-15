import { useMemo } from 'react';
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import { navigate } from '@/hooks/useRoute';
import { rootItems } from '@/store/selectors';
import { hasLabel } from '@/domain/views';
import { markerStyle } from '@/domain/colors';
import type { Label } from '@/domain/types';

/**
 * Every tag on the account, in the order Todoist keeps them.
 *
 * Favourites are Todoist's own star, not a separate list this app keeps, so
 * starring here pins the tag in both products at once. The order is Todoist's
 * too: drag a tag and the sidebar's favourites follow.
 */
export function LabelsView() {
  const { t } = useT();
  const { snapshot, items } = useData();
  const updateLabelFavourite = useStore((s) => s.setLabelFavourite);
  const reorderLabels = useStore((s) => s.reorderLabels);

  const roots = useMemo(() => rootItems(items), [items]);

  const labels = useMemo(
    () =>
      Object.values(snapshot.labels)
        .filter((l) => !l.is_deleted && !l.name.startsWith('est-'))
        .sort((a, b) => a.item_order - b.item_order),
    [snapshot.labels],
  );

  /* This list has its own drag context: the one around the app moves tasks
     between destinations, and a tag being reordered is neither. */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = labels.findIndex((l) => l.id === active.id);
    const to = labels.findIndex((l) => l.id === over.id);
    if (from < 0 || to < 0) return;
    void reorderLabels(arrayMove(labels, from, to).map((l) => l.id));
  };

  return (
    <div className="page">
      <div className="phead">
        <div className="phead-text">
          <h1 className="ptitle">{t('nav.labels')}</h1>
          {labels.length > 1 && <p className="psub">{t('labels.orderHint')}</p>}
        </div>
      </div>

      {labels.length === 0 ? (
        <p className="empty">{t('labels.none')}</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={labels.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <div className="mode taglist">
              {labels.map((label) => (
                <TagRow
                  key={label.id}
                  label={label}
                  count={roots.filter((i) => hasLabel(i, label.name)).length}
                  onToggleFavourite={() => void updateLabelFavourite(label.id, !label.is_favorite)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function TagRow({
  label, count, onToggleFavourite,
}: {
  label: Label;
  count: number;
  onToggleFavourite: () => void;
}) {
  const { t } = useT();
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id: label.id });

  return (
    <div
      ref={setNodeRef}
      className={`tagcard${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        className="tagcard-grip"
        aria-label={t('labels.reorder')}
        title={t('labels.reorder')}
        {...attributes}
        {...listeners}
      >
        <Icon name="drag" size="sm" />
      </button>

      <button className="tagcard-open" onClick={() => navigate('label', label.name)}>
        <span className="tagcard-mark" style={markerStyle(label.color)}>
          <Icon name="tag" />
        </span>
        <span className="tagcard-text">
          <strong>{label.name}</strong>
          <small>{t('metrics.tasks', { count })}</small>
        </span>
      </button>

      <button
        className={`tagcard-star${label.is_favorite ? ' on' : ''}`}
        aria-pressed={label.is_favorite}
        aria-label={label.is_favorite ? t('labels.unfavourite') : t('labels.favourite')}
        title={label.is_favorite ? t('labels.unfavourite') : t('labels.favourite')}
        onClick={onToggleFavourite}
      >
        <Icon name="star" />
      </button>
    </div>
  );
}
