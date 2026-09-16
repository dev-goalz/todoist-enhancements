import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { TaskActions } from './TaskActions';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { toDisplayPriority, type Item } from '@/domain/types';
import { effectiveEstimate, formatDuration } from '@/domain/estimates';
import { deadlineDate, dueDate, formatRelativeDay, formatTime, hasTime, isOverdue, isToday, overdueBy } from '@/domain/dates';
import { markerStyle } from '@/domain/colors';
import { renderInlineMarkdown } from '@/domain/markdown';

/**
 * Whether rows draw the subtasks nested under them.
 *
 * "Show subtasks" is a per-view filter, and a row three components deep has no
 * way of knowing which view it is in. A context carries the answer down instead
 * of a boolean being handed through every list, group and board column on the
 * way — the rows never had to know, and now they still do not.
 */
/**
 * How long a finished task stays on screen before it goes.
 *
 * Long enough to see the tick land and read it as "yes, that one", short
 * enough that nobody waits for it. Instant removal makes a mis-click
 * indistinguishable from a correct one: the row is simply gone and you are
 * left wondering which one you hit.
 */
const COMPLETION_LINGER_MS = 420;

const ShowSubtasks = createContext(true);

export const SubtasksProvider = ShowSubtasks.Provider;

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
  const picked = useStore((s) => s.selection.includes(item.id));
  const toggleSelection = useStore((s) => s.toggleSelection);
  const showSubtasks = useContext(ShowSubtasks);

  const [expanded, setExpanded] = useState(true);
  /** Ticked here, not yet ticked at Todoist: the pause between the two. */
  const [settling, setSettling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /* Re-opening a task needs no pause — nothing disappears — so only the
     completing direction waits. A second click while it is waiting is ignored
     rather than queueing a second toggle that would undo the first. */
  const complete = () => {
    if (item.checked) { void toggleTask(item.id); return; }
    if (settling) return;
    setSettling(true);
    timer.current = setTimeout(() => { void toggleTask(item.id); }, COMPLETION_LINGER_MS);
  };

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

  /* A tag carries a colour in Todoist, so it carries it here too. The task
     stores names, and the colour lives on the label, which is the lookup. */
  const labelColours = useMemo(() => {
    const byName = new Map<string, string>();
    for (const label of Object.values(snapshot.labels)) byName.set(label.name, label.color);
    return byName;
  }, [snapshot.labels]);

  return (
    <>
      <div
        className={`task${settling ? ' done settling' : ''}${picked ? ' picked' : ''}`}
        role="button"
        tabIndex={0}
        data-depth={depth > 0 ? depth : undefined}
        style={depth > 0 ? ({ '--depth': depth } as React.CSSProperties) : undefined}
        aria-selected={picked || undefined}
        /* Cmd (or Ctrl) and a click picks the row out instead of opening it:
           the same gesture every file list has used for thirty years, and the
           only one that does not cost the plain click its meaning. */
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            toggleSelection(item.id);
            return;
          }
          onOpen(item.id);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (e.metaKey || e.ctrlKey) { toggleSelection(item.id); return; }
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
          aria-checked={item.checked || settling}
          aria-label={t('task.complete')}
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            complete();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              complete();
            }
          }}
        >
          <Icon name="check" />
        </span>

        <span className="tmain">
          <span className="ttitle">{item.content}</span>

          {item.description && (
            /* The row shows the formatted line, not the Markdown syntax. */
            <span
              className="tdesc"
              dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(item.description) }}
            />
          )}

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
              <span className="tag" key={label} style={markerStyle(labelColours.get(label))}>
                <Icon name="tag" size="sm" />
                {label}
              </span>
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
          {showSubtasks && openChildren.length > 0 && (
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

      {showSubtasks && expanded &&
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
