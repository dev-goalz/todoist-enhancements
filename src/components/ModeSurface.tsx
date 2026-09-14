import { useMemo, useState } from 'react';
import { TaskGroup } from './TaskGroup';
import { DraggableTask } from './dnd/DraggableTask';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { toDisplayPriority, type DisplayMode, type GroupKey, type Item, type SortKey } from '@/domain/types';
import { groupItems, sortItems } from '@/store/selectors';
import { dueDate, formatRelativeDay, toApiDate } from '@/domain/dates';
import { addDays, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { Droppable } from './dnd/Droppable';
import type { DropTarget } from '@/domain/dnd';
import type { TranslationKey } from '@/i18n';

interface ModeSurfaceProps {
  items: Item[];
  childrenOf: (id: string) => Item[];
  mode: DisplayMode;
  group: GroupKey;
  sort: SortKey;
  onOpen: (id: string) => void;
  showProject?: boolean;
  /** Board columns come from sections when a project supplies them. */
  boardColumns?: Array<{ id: string; title: string; items: Item[]; dropTarget?: DropTarget }>;
}

/**
 * Renders the same set of tasks the way the current mode asks for.
 *
 * List is the mode for scanning and administering, Board shows columns, and
 * Calendar places dated work on a month grid. A task carries the same
 * information and the same hover controls in every one of them.
 */
export function ModeSurface(props: ModeSurfaceProps) {
  const { mode } = props;
  if (mode === 'board') return <BoardSurface {...props} />;
  if (mode === 'calendar') return <CalendarSurface {...props} />;
  return <ListSurface {...props} />;
}

function useGrouped(props: ModeSurfaceProps) {
  const { t, locale } = useT();
  const snapshot = useStore((s) => s.snapshot);
  const { items, group, sort, childrenOf } = props;

  return useMemo(() => {
    const sorted = sortItems(items, sort, childrenOf);
    return groupItems(sorted, group, snapshot, {
      none: t('common.none'),
      noProject: t('nav.inbox'),
      noSection: t('group.noSection'),
      noEstimate: t('metrics.noEstimates'),
      noLabel: t('common.none'),
      priority: (p) => t(`common.p${p}` as TranslationKey),
      day: (d) => (d ? formatRelativeDay(d, locale) : t('common.none')),
    });
  }, [items, group, sort, childrenOf, snapshot, t, locale]);
}

function ListSurface(props: ModeSurfaceProps) {
  const { t } = useT();
  const groups = useGrouped(props);

  if (props.items.length === 0) {
    return <p className="empty">{t('task.noTasks')}</p>;
  }

  return (
    <div className="mode">
      {groups.map((group) => (
        <TaskGroup
          key={group.key}
          title={group.title || undefined}
          items={group.items}
          childrenOf={props.childrenOf}
          onOpen={props.onOpen}
          showProject={props.showProject}
        />
      ))}
    </div>
  );
}

function BoardSurface(props: ModeSurfaceProps) {
  const { t } = useT();
  const groups = useGrouped(props);
  // Columns derived from a grouping are not drop destinations: dropping onto
  // "priority" or "tag" has no single unambiguous meaning.
  const columns: NonNullable<ModeSurfaceProps['boardColumns']> =
    props.boardColumns ??
    groups.map((g) => ({ id: g.key, title: g.title || t('common.all'), items: g.items }));

  if (columns.length === 0) return <p className="empty">{t('task.noTasks')}</p>;

  return (
    <div className="mode">
      <div className={`board${props.group === 'day' ? ' days' : ''}`}>
        {columns.map((column) => {
          const body = (isOver: boolean) => (
            <section className={`col${isOver ? ' dropping' : ''}`}>
            <div className="chead">
              <div className="chead-title">
                <strong>{column.title}</strong>
                <small>{t('metrics.tasks', { count: column.items.length })}</small>
              </div>
            </div>
            {column.items.map((item) => (
              <DraggableTask
                key={item.id}
                item={item}
                childrenOf={props.childrenOf}
                onOpen={props.onOpen}
                showProject={props.showProject}
              />
            ))}
            {column.items.length === 0 && <p className="empty">{t('group.empty')}</p>}
            </section>
          );

          return column.dropTarget ? (
            <Droppable target={column.dropTarget} key={column.id}>
              {({ isOver }) => body(isOver)}
            </Droppable>
          ) : (
            <div key={column.id}>{body(false)}</div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarSurface(props: ModeSurfaceProps) {
  const { t, locale } = useT();
  const startDay = useStore((s) => s.snapshot.user?.start_day ?? 1);
  const [monthCursor] = useState(() => startOfMonth(new Date()));

  const weekStartsOn = (startDay % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const gridStart = startOfWeek(monthCursor, { weekStartsOn });

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of props.items) {
      const d = dueDate(item);
      if (!d) continue;
      const key = toApiDate(d);
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [props.items]);

  const cells = Array.from({ length: 42 }, (_, i) => startOfDay(addDays(gridStart, i)));
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short' })
      .format(addDays(gridStart, i)),
  );

  return (
    <div className="mode">
      <div className="calgrid">
        {weekdayNames.map((name) => (
          <div className="calhead" key={name}>{name}</div>
        ))}
        {cells.map((day) => {
          const dayItems = byDay.get(toApiDate(day)) ?? [];
          const outside = !isSameMonth(day, monthCursor);
          const today = isSameDay(day, new Date());
          return (
            <div
              className={`calcell${outside ? ' other' : ''}${today ? ' today' : ''}`}
              key={day.toISOString()}
            >
              <span className="caldate">{day.getDate()}</span>
              <div style={{ display: 'grid', gap: 2, alignContent: 'start' }}>
                {dayItems.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    className={`calchip p${toDisplayPriority(item.priority)}`}
                    onClick={() => props.onOpen(item.id)}
                    title={item.content}
                  >
                    {item.content}
                  </button>
                ))}
                {dayItems.length > 4 && (
                  <span className="caldate">+{dayItems.length - 4}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {props.items.length === 0 && <p className="empty">{t('task.noTasks')}</p>}
    </div>
  );
}
