import { useState } from 'react';
import { Icon } from './Icon';
import { TaskActions } from './TaskActions';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { toDisplayPriority, type Item } from '@/domain/types';
import { effectiveEstimate, formatDuration } from '@/domain/estimates';
import { deadlineDate, dueDate, formatRelativeDay, formatTime, hasTime, isOverdue, isToday, overdueBy } from '@/domain/dates';
import { markerStyle } from '@/domain/colors';

interface TaskRowProps {
  item: Item;
  childrenOf: (id: string) => Item[];
  onOpen: (id: string) => void;
  /** Subtasks render indented under their parent and hide the drag handle. */
  depth?: number;
  showProject?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

export function TaskRow({
  item, childrenOf, onOpen, depth = 0, showProject = true, dragHandleProps,
}: TaskRowProps) {
  const { t, locale } = useT();
  const snapshot = useStore((s) => s.snapshot);
  const hour12 = useStore((s) => s.prefs.hour12);
  const toggleTask = useStore((s) => s.toggleTask);

  const [expanded, setExpanded] = useState(true);

  const children = childrenOf(item.id);
  const openChildren = children.filter((c) => !c.checked);
  const doneChildren = children.length - openChildren.length;

  const { minutes, computed } = effectiveEstimate(item, childrenOf);
  const priority = toDisplayPriority(item.priority);
  const due = dueDate(item);
  const deadline = deadlineDate(item);
  const late = isOverdue(item);
  const project = snapshot.projects[item.project_id];

  // Estimate labels are shown as a duration, never as an ordinary tag.
  const visibleLabels = item.labels.filter((l) => !l.toLowerCase().startsWith('est-'));

  return (
    <>
      <div
        className="task"
        role="button"
        tabIndex={0}
        style={depth > 0 ? { marginLeft: `${depth * 26}px` } : undefined}
        onClick={() => onOpen(item.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(item.id);
          }
        }}
      >
        {depth === 0 && (
          <span className="drag" title={t('task.drag')} {...dragHandleProps}>
            <Icon name="drag" />
          </span>
        )}

        <span
          className={`check p${priority}`}
          role="checkbox"
          aria-checked={item.checked}
          aria-label={t('task.complete')}
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            void toggleTask(item.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              void toggleTask(item.id);
            }
          }}
        >
          <Icon name="check" />
        </span>

        <span className="tmain">
          <span className="ttitle">{item.content}</span>

          {item.description && <span className="tdesc">{item.description}</span>}

          <span className="meta">
            {minutes !== null && (
              <span className="est" title={computed ? t('task.computedEstimate') : undefined}>
                <Icon name="clock" />
                {formatDuration(minutes, locale)}
                {computed && '*'}
              </span>
            )}

            {due && (
              <span className={late ? 'late' : 'at'}>
                {!late && <Icon name="calendar" />}
                {formatRelativeDay(due, locale)}
                {hasTime(item.due) && ` ${formatTime(due, locale, hour12)}`}
                {late && overdueBy(item) > 0 && ` · ${overdueBy(item)}d`}
              </span>
            )}

            {item.due?.is_recurring && (
              <span
                className={`repeatdot ${late ? 'late' : isToday(item) ? 'today' : 'future'}`}
                title={item.due.string}
              >
                <Icon name="repeat" size="sm" />
              </span>
            )}

            {deadline && (
              <span className="deadline">
                <Icon name="deadline" />
                {formatRelativeDay(deadline, locale)}
              </span>
            )}

            {visibleLabels.map((label) => (
              <span className="tag" key={label}>{label}</span>
            ))}

            {showProject && project && !project.inbox_project && (
              <span className="proj" style={markerStyle(project.color, false)}>
                #{project.name}
              </span>
            )}

            {children.length > 0 && (
              <span className="subprog">
                <Icon name="subtask" />
                {t('task.subtaskProgress', { done: doneChildren, total: children.length })}
              </span>
            )}
          </span>
        </span>

        <span className="trow-end">
          {openChildren.length > 0 && (
            <button
              className="iconbtn subcaret"
              aria-expanded={expanded}
              aria-label={t('detail.subtasks')}
              title={t('detail.subtasks')}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              <Icon name={expanded ? 'caret-up' : 'caret'} size="sm" />
            </button>
          )}
          <TaskActions item={item} childrenOf={childrenOf} onOpen={onOpen} />
        </span>
      </div>

      {expanded &&
        openChildren.map((child) => (
          <TaskRow
            key={child.id}
            item={child}
            childrenOf={childrenOf}
            onOpen={onOpen}
            depth={depth + 1}
            showProject={showProject}
          />
        ))}
    </>
  );
}
