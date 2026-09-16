import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { SubtasksProvider } from '@/components/TaskRow';
import { DisplayMenu } from '@/components/DisplayMenu';
import { TaskGroup } from '@/components/TaskGroup';
import { ModeSurface } from '@/components/ModeSurface';
import { Icon } from '@/components/Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import { viewPrefs } from '@/store/prefs';
import { applyFilters, rootItems, sortItems } from '@/store/selectors';
import { upcomingItems } from '@/domain/views';
import { summariseLoad } from '@/domain/load';
import { dueDate, daysBetween, formatRelativeDay, toApiDate } from '@/domain/dates';
import { addDays, startOfDay } from 'date-fns';

interface UpcomingViewProps {
  onOpen: (id: string) => void;
  onInsights: () => void;
  onUnestimated: () => void;
  onAddTaskTo: (placement: { projectId?: string; sectionId?: string; date?: string }) => void;
}

/** How many day columns the board shows at once. */

/**
 * Upcoming — strictly future dates, fifteen days at a time.
 *
 * The day columns double as drop targets: moving a task between them is how a
 * date gets changed without opening anything.
 */
function UpcomingBody({ onOpen, onInsights, onUnestimated, onAddTaskTo }: UpcomingViewProps) {
  const { t, locale } = useT();
  const { snapshot, items, childrenOf } = useData();
  const prefs = useStore((s) => s.prefs);
  const current = viewPrefs(prefs, 'upcoming');
  const [horizon, setHorizon] = useState(prefs.upcomingHorizonDays);

  const scoped = useMemo(() => {
    const roots = rootItems(items);
    const future = upcomingItems(roots);
    const limit = startOfDay(addDays(new Date(), horizon));
    const withinHorizon = future.filter((item) => {
      const d = dueDate(item);
      return d !== null && startOfDay(d) <= limit;
    });
    return applyFilters(withinHorizon, current.filters, snapshot, childrenOf);
  }, [items, horizon, current.filters, snapshot, childrenOf]);

  // Upcoming spans many days, so a single capacity percentage would be
  // meaningless here. The header shows counts and time only.
  const load = useMemo(
    () => summariseLoad(scoped, childrenOf, null),
    [scoped, childrenOf],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, typeof scoped>();
    for (const item of scoped) {
      const d = dueDate(item);
      if (!d) continue;
      const key = toApiDate(d);
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [scoped]);

  const days = useMemo(
    () => daysBetween(startOfDay(addDays(new Date(), 1)), startOfDay(addDays(new Date(), horizon))),
    [horizon],
  );

  const columns = days
    .map((day) => ({
      id: toApiDate(day),
      title: formatRelativeDay(day, locale),
      items: sortItems(byDay.get(toApiDate(day)) ?? [], current.sort, childrenOf),
      dropTarget: { kind: 'day' as const, date: day },
      capacityMinutes: prefs.dailyCapacity[day.getDay()],
    }))
    .filter((column) => column.items.length > 0 || current.mode === 'board');


  return (
    <div className="page">
      <PageHeader
        title={t('nav.upcoming')}
        actions={
          <>
            <DisplayMenu
              viewKey="upcoming"
              modes={['list', 'board']}
              groups={['day', 'week', 'month', 'project', 'priority', 'label', 'none']}
            />
            <button className="btn accent" onClick={onInsights}>
              <Icon name="trend" />
              {t('toolbar.insights')}
            </button>
          </>
        }
        load={load}
        onOpenUnestimated={load.unestimatedCount > 0 ? onUnestimated : undefined}
      />


      {current.mode === 'board' ? (
        <ModeSurface
          items={scoped}
          childrenOf={childrenOf}
          mode="board"
          group="day"
          sort={current.sort}
          onOpen={onOpen}
          boardColumns={columns}
        />
      ) : current.group === 'none' || current.group === 'day' ? (
        <div className="mode">
          {columns.map((column) => (
            <TaskGroup
              key={column.id}
              title={column.title}
              items={column.items}
              childrenOf={childrenOf}
              onOpen={onOpen}
              dropTarget={{ kind: 'day', date: new Date(`${column.id}T00:00:00`) }}
              onAddTask={() => onAddTaskTo({ date: column.id })}
            />
          ))}
          {scoped.length === 0 && <p className="empty">{t('task.noTasks')}</p>}
        </div>
      ) : (
        <ModeSurface
          items={scoped}
          childrenOf={childrenOf}
          mode="list"
          group={current.group}
          sort={current.sort}
          onOpen={onOpen}
        />
      )}

      <div style={{ marginTop: 'var(--s5)', display: 'flex', justifyContent: 'center' }}>
        <button className="btn" onClick={() => setHorizon((h) => h + 15)}>
          <Icon name="caret" />
          {t('nav.upcoming')} +15
        </button>
      </div>
    </div>
  );
}

export function UpcomingView(props: UpcomingViewProps) {
  const prefs = useStore((s) => s.prefs);
  return (
    <SubtasksProvider value={viewPrefs(prefs, 'upcoming').filters.showSubtasks}>
      <UpcomingBody {...props} />
    </SubtasksProvider>
  );
}
