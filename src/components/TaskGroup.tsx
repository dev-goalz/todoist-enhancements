import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { DraggableTask } from './dnd/DraggableTask';
import { Droppable } from './dnd/Droppable';
import type { DropTarget } from '@/domain/dnd';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { formatDuration, effectiveEstimate } from '@/domain/estimates';
import type { Item } from '@/domain/types';

interface TaskGroupProps {
  title?: string;
  items: Item[];
  childrenOf: (id: string) => Item[];
  onOpen: (id: string) => void;
  /** Extra visual weight for Behind schedule and Quick. */
  tint?: 'late' | 'quick';
  description?: string;
  actions?: ReactNode;
  showProject?: boolean;
  defaultCollapsed?: boolean;
  /** When set, the whole group accepts tasks dropped onto it. */
  dropTarget?: DropTarget;
}

export function TaskGroup({
  title, items, childrenOf, onOpen, tint, description, actions,
  showProject = true, defaultCollapsed = false, dropTarget,
}: TaskGroupProps) {
  const { t, locale } = useT();
  const dragging = useStore((s) => s.draggingTaskId !== null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // An empty section is noise. It reappears only while a task is in flight,
  // so it can still be used as a destination.
  if (items.length === 0 && !(dropTarget && dragging)) return null;

  const totalMinutes = items.reduce(
    (acc, item) => acc + (effectiveEstimate(item, childrenOf).minutes ?? 0),
    0,
  );

  const className = `group${tint === 'late' ? ' tinted-late' : tint === 'quick' ? ' tinted-quick' : ''}`;

  const body = (isOver: boolean) => (
    <section className={`${className}${isOver ? ' dropping' : ''}`}>
      {title && (
        <div className="ghead">
          <button
            className="gtoggle"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
          >
            <Icon name={collapsed ? 'caret' : 'caret-up'} size="sm" />
            <span className="gname">{title}</span>
            {totalMinutes > 0 && <span className="gtime">{formatDuration(totalMinutes, locale)}</span>}
          </button>
          {actions && <span className="gactions">{actions}</span>}
          <span className="gcount">{items.length}</span>
        </div>
      )}

      {description && !collapsed && <p className="gdesc">{description}</p>}

      {!collapsed &&
        items.map((item) => (
          <DraggableTask
            key={item.id}
            item={item}
            childrenOf={childrenOf}
            onOpen={onOpen}
            showProject={showProject}
          />
        ))}

      {!collapsed && items.length === 0 && <p className="empty">{t('group.empty')}</p>}
    </section>
  );

  if (!dropTarget) return body(false);
  return <Droppable target={dropTarget}>{({ isOver }) => body(isOver)}</Droppable>;
}
