import { useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DisplayMenu } from '@/components/DisplayMenu';
import { TaskGroup } from '@/components/TaskGroup';
import { ModeSurface } from '@/components/ModeSurface';
import { Icon } from '@/components/Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import { viewPrefs } from '@/store/prefs';
import { applyFilters, rootItems, sortItems } from '@/store/selectors';
import { groupWeek, weekItems } from '@/domain/views';
import { summariseLoad, weeklyCapacity } from '@/domain/load';
import { toApiDate } from '@/domain/dates';

interface WeekViewProps {
  onOpen: (id: string) => void;
  onInsights: () => void;
  onUnestimated: () => void;
}

/**
 * My week — the home of the product.
 *
 * Today comes first, in the fixed order the spec sets: behind schedule, quick,
 * untimed, then timed. Anytime this week follows, holding the flexible work
 * that carries the `week` label but no day.
 */
export function WeekView({ onOpen, onInsights, onUnestimated }: WeekViewProps) {
  const { t } = useT();
  const { snapshot, items, childrenOf } = useData();
  const prefs = useStore((s) => s.prefs);
  const updateTask = useStore((s) => s.updateTask);
  const toast = useStore((s) => s.toast);
  const current = viewPrefs(prefs, 'week');

  const scoped = useMemo(() => {
    const roots = rootItems(items);
    return applyFilters(weekItems(roots), current.filters, snapshot, childrenOf);
  }, [items, current.filters, snapshot, childrenOf]);

  const groups = useMemo(
    () => groupWeek(scoped, new Date(), prefs.showQuickGroup),
    [scoped, prefs.showQuickGroup],
  );

  const capacity = weeklyCapacity(prefs.dailyCapacity, prefs.weeklyCapacityOverride);
  const load = useMemo(
    () => summariseLoad(scoped, childrenOf, capacity),
    [scoped, childrenOf, capacity],
  );

  async function rescheduleOverdue() {
    const affected = groups.overdue;
    if (affected.length === 0) return;
    // Moving several tasks at once is worth confirming, and the wording says
    // exactly where they land.
    if (!window.confirm(t('task.rescheduleAllConfirm', { count: affected.length }))) return;

    const today = toApiDate(new Date());
    for (const item of affected) {
      // Moving to today drops the `week` label, which would otherwise put the
      // same task in two groups at once.
      await updateTask(item.id, {
        due: {
          date: today,
          timezone: item.due?.timezone ?? null,
          string: 'today',
          lang: item.due?.lang ?? 'en',
          is_recurring: item.due?.is_recurring ?? false,
        },
        labels: item.labels.filter((l) => l.toLowerCase() !== 'week'),
      });
    }
    toast(t('group.rescheduleAll'));
  }

  const sortedGroup = (list: typeof scoped) => sortItems(list, current.sort, childrenOf);

  return (
    <div className="page">
      <PageHeader
        title={t('nav.week')}
        subtitle={t('week.subtitle')}
        load={load}
        onOpenUnestimated={load.unestimatedCount > 0 ? onUnestimated : undefined}
        actions={
          <button className="btn" onClick={onInsights}>
            <Icon name="trend" />
            {t('toolbar.insights')}
          </button>
        }
      />

      <div className="viewbar">
        <DisplayMenu
          viewKey="week"
          modes={['list', 'board']}
          groups={['none', 'project', 'priority', 'label', 'estimate']}
        />
      </div>

      {current.mode === 'list' && current.group === 'none' ? (
        <div className="mode">
          <TaskGroup
            title={t('group.overdue')}
            items={sortedGroup(groups.overdue)}
            childrenOf={childrenOf}
            onOpen={onOpen}
            tint="late"
            dropTarget={{ kind: 'today' }}
            actions={
              <button
                className="btn sm linklike"
                onClick={() => void rescheduleOverdue()}
                title={t('group.rescheduleAllHint')}
              >
                {t('group.rescheduleAll')}
              </button>
            }
          />

          {prefs.showQuickGroup && (
            <TaskGroup
              title={t('group.quick')}
              items={sortedGroup(groups.quick)}
              childrenOf={childrenOf}
              onOpen={onOpen}
              tint="quick"
              dropTarget={{ kind: 'today' }}
            />
          )}

          <TaskGroup
            title={t('group.untimed')}
            items={sortedGroup(groups.untimed)}
            childrenOf={childrenOf}
            onOpen={onOpen}
            dropTarget={{ kind: 'today' }}
          />

          <TaskGroup
            title={t('group.timed')}
            items={groups.timed}
            childrenOf={childrenOf}
            onOpen={onOpen}
          />

          <TaskGroup
            title={t('group.anytime')}
            items={sortedGroup(groups.anytime)}
            childrenOf={childrenOf}
            onOpen={onOpen}
            description={t('anytime.subtitle')}
            dropTarget={{ kind: 'anytime' }}
          />

          {scoped.length === 0 && <p className="empty">{t('task.noTasks')}</p>}
        </div>
      ) : (
        <ModeSurface
          items={scoped}
          childrenOf={childrenOf}
          mode={current.mode}
          group={current.group}
          sort={current.sort}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}
