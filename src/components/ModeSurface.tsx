import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { TaskRow } from './TaskRow';
import { TaskGroup } from './TaskGroup';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { toDisplayPriority, type DisplayMode, type GroupKey, type Item, type SortKey } from '@/domain/types';
import { groupItems, sortItems } from '@/store/selectors';
import { dueDate, formatRelativeDay, toApiDate } from '@/domain/dates';
import { addDays, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
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
  boardColumns?: Array<{ id: string; title: string; items: Item[] }>;
}

/**
 * Renders the same set of tasks the way the current mode asks for.
 *
 * List is the mode for scanning and administering. Board shows columns. Focus
 * puts one task in front of everything else. Calendar places dated work on a
 * month grid.
 */
export function ModeSurface(props: ModeSurfaceProps) {
  const { mode } = props;
  if (mode === 'board') return <BoardSurface {...props} />;
  if (mode === 'focus') return <FocusSurface {...props} />;
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
  const { t, locale } = useT();
  const groups = useGrouped(props);
  const columns = props.boardColumns ?? groups.map((g) => ({
    id: g.key,
    title: g.title || t('common.all'),
    items: g.items,
  }));

  if (columns.length === 0) return <p className="empty">{t('task.noTasks')}</p>;

  return (
    <div className="mode">
      <div className={`board${props.group === 'day' ? ' days' : ''}`}>
        {columns.map((column) => (
          <section className="col" key={column.id}>
            <div className="chead">
              <div className="chead-title">
                <strong>{column.title}</strong>
                <small>{t('metrics.tasks', { count: column.items.length })}</small>
              </div>
            </div>
            {column.items.map((item) => {
              const due = dueDate(item);
              return (
                <button
                  key={item.id}
                  className="tcard"
                  onClick={() => props.onOpen(item.id)}
                >
                  <span className={`check p${toDisplayPriority(item.priority)}`} aria-hidden="true">
                    <Icon name="check" />
                  </span>
                  <span className="ttitle">{item.content}</span>
                  {due && <span className="meta"><span className="at">{formatRelativeDay(due, locale)}</span></span>}
                </button>
              );
            })}
            {column.items.length === 0 && <p className="empty">{t('group.empty')}</p>}
          </section>
        ))}
      </div>
    </div>
  );
}

function FocusSurface(props: ModeSurfaceProps) {
  const { t } = useT();
  const toggleTask = useStore((s) => s.toggleTask);
  const updateTask = useStore((s) => s.updateTask);
  const [index, setIndex] = useState(0);

  const ordered = useMemo(
    () => sortItems(props.items, props.sort, props.childrenOf),
    [props.items, props.sort, props.childrenOf],
  );

  if (ordered.length === 0) return <p className="empty">{t('task.noTasks')}</p>;

  // Finishing the last task must not leave the stage pointing past the end.
  const current = ordered[Math.min(index, ordered.length - 1)];
  const queue = ordered.slice(Math.min(index, ordered.length - 1) + 1, index + 6);
  const advance = () => setIndex((i) => Math.min(i + 1, ordered.length - 1));

  return (
    <div className="mode">
      <div className="focusstage">
        <article className="focuscard">
          <h2>{current.content}</h2>
          {current.description && <p className="tdesc">{current.description}</p>}
          <div className="focusactions">
            <button
              className="btn primary"
              onClick={() => { void toggleTask(current.id); advance(); }}
            >
              <Icon name="check" />
              {t('common.done')}
            </button>
            <button
              className="btn"
              onClick={() => {
                // Pushing to tomorrow keeps any time of day the task carried.
                void updateTask(current.id, {
                  due: { date: toApiDate(addDays(new Date(), 1)), timezone: null, string: 'tomorrow', lang: 'en', is_recurring: false },
                });
                advance();
              }}
            >
              <Icon name="arrow-right" />
              {t('common.tomorrow')}
            </button>
            <button className="btn" onClick={advance}>
              {t('toolbar.focus')} →
            </button>
            <button className="btn quiet" onClick={() => props.onOpen(current.id)}>
              <Icon name="edit" />
              {t('detail.title')}
            </button>
          </div>
        </article>

        {queue.length > 0 && (
          <div className="focusqueue">
            <h5>{t('nav.upcoming')}</h5>
            <div className="focuslist">
              {queue.map((item) => (
                <TaskRow
                  key={item.id}
                  item={item}
                  childrenOf={props.childrenOf}
                  onOpen={props.onOpen}
                  showProject={props.showProject}
                />
              ))}
            </div>
          </div>
        )}
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
