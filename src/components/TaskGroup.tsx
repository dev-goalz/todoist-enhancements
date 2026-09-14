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
  /** Adds a task straight into this section. */
  onAddTask?: () => void;
  /** An accent for the sections that carry meaning: late, and quick. */
  accent?: 'late' | 'quick';
  /** An editable description rendered under the heading. */
  descriptionSlot?: ReactNode;
  /** When set, the whole group accepts tasks dropped onto it. */
  dropTarget?: DropTarget;
  /** A real section can be renamed in place; a derived grouping cannot. */
  sectionId?: string;
  onRename?: (name: string) => void;
}

export function TaskGroup({
  title, items, childrenOf, onOpen, tint, description, actions,
  showProject = true, defaultCollapsed = false, dropTarget, onAddTask, accent,
  descriptionSlot, sectionId, onRename,
}: TaskGroupProps) {
  const { t, locale } = useT();
  const dragging = useStore((s) => s.draggingTaskId !== null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // An empty derived grouping is noise. A real section is not: it is somewhere
  // you chose to make, and a section you just created has to be visible before
  // it can be named or filled.
  if (items.length === 0 && !sectionId && !(dropTarget && dragging)) return null;

  const totalMinutes = items.reduce(
    (acc, item) => acc + (effectiveEstimate(item, childrenOf).minutes ?? 0),
    0,
  );

  // The meaning stays in the heading's colour rather than a panel behind it.
  const mark = accent ?? tint;
  const className = `group${mark === 'late' ? ' accent-late' : mark === 'quick' ? ' accent-quick' : ''}`;

  const body = (isOver: boolean) => (
    <section className={`${className}${isOver ? ' dropping' : ''}`}>
      {/* A section just created has no name yet, and it is the heading that
          carries the field you name it in. */}
      {(title || sectionId) && (
        <div className="gheadblock">
        <div className="ghead">
          <button
            className="gtoggle"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
          >
            {onRename && sectionId ? (
              <input
                className="gname gnamefield"
                data-section-name={sectionId}
                defaultValue={title}
                placeholder={t('section.untitled')}
                aria-label={t('section.name')}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next !== title) onRename(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                  if (e.key === 'Escape') { e.currentTarget.value = title ?? ''; e.currentTarget.blur(); }
                }}
              />
            ) : (
              <span className="gname">{title}</span>
            )}
            {totalMinutes > 0 && <span className="gtime">{formatDuration(totalMinutes, locale)}</span>}
          </button>
          {actions && <span className="gactions">{actions}</span>}
          <span className="gcount">{items.length}</span>
          {/* The disclosure caret ends the row, as it does in the sidebar. */}
          <button
            className="gdisclose"
            aria-expanded={!collapsed}
            aria-label={title}
            onClick={() => setCollapsed((v) => !v)}
          >
            <Icon name={collapsed ? 'caret' : 'caret-up'} size="sm" />
          </button>
        </div>

        {/* A description belongs to its heading, so it sits inside the block
            the rule closes rather than adrift underneath it. */}
        {description && !collapsed && <p className="gdesc">{description}</p>}
        {descriptionSlot && !collapsed && <div className="gdesc">{descriptionSlot}</div>}
        </div>
      )}

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

      {!collapsed && onAddTask && (
        <button className="addline sectionadd" onClick={onAddTask}>
          <Icon name="plus" size="sm" />
          {t('nav.addTaskHere')}
        </button>
      )}
    </section>
  );

  if (!dropTarget) return body(false);
  return <Droppable target={dropTarget}>{({ isOver }) => body(isOver)}</Droppable>;
}
