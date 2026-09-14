import { useMemo } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { Icon } from '@/components/Icon';
import { TaskRow } from '@/components/TaskRow';
import {
  Bars, ChartCard, RankedBars, Ring, StatTile, seriesColor,
  type BarDatum, type RankedDatum,
} from '@/components/charts';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import { useCompleted } from '@/hooks/useCompleted';
import { navigate } from '@/hooks/useRoute';
import { rootItems } from '@/store/selectors';
import { groupWeek, weekItems } from '@/domain/views';
import { summariseLoad, weeklyCapacity } from '@/domain/load';
import { summariseInsights } from '@/domain/insights';
import { effectiveEstimate, formatDuration } from '@/domain/estimates';
import { deadlineDate, formatRelativeDay } from '@/domain/dates';
import { detectConflicts, detectIncomplete } from '@/domain/conflicts';
import { markerStyle } from '@/domain/colors';

interface DashboardViewProps {
  onOpen: (id: string) => void;
  onIssues: () => void;
}

/**
 * One board answering three questions: what is today, what is in the way, and
 * how the week is trending. Numbers lead, charts support them.
 */
export function DashboardView({ onOpen, onIssues }: DashboardViewProps) {
  const { t, locale } = useT();
  const { snapshot, items, childrenOf } = useData();
  const prefs = useStore((s) => s.prefs);
  const { data: completed } = useCompleted('month', true);

  const roots = useMemo(() => rootItems(items), [items]);
  const week = useMemo(() => weekItems(roots), [roots]);
  const groups = useMemo(
    () => groupWeek(week, new Date(), prefs.showQuickGroup),
    [week, prefs.showQuickGroup],
  );

  const todayItems = [...groups.overdue, ...groups.quick, ...groups.untimed, ...groups.timed];
  const todayCapacity = prefs.dailyCapacity[new Date().getDay()];
  const todayLoad = summariseLoad(todayItems, childrenOf, todayCapacity);
  const weekLoad = summariseLoad(
    week, childrenOf, weeklyCapacity(prefs.dailyCapacity, prefs.weeklyCapacityOverride),
  );

  const summary = useMemo(
    () => summariseInsights(completed, roots, snapshot),
    [completed, roots, snapshot],
  );

  const conflicts = useMemo(
    () => detectConflicts(roots, childrenOf, prefs.conflicts),
    [roots, childrenOf, prefs.conflicts],
  );
  const unestimated = useMemo(() => detectIncomplete(roots), [roots]);

  const intl = locale === 'fr' ? 'fr-FR' : 'en-GB';

  const momentum: BarDatum[] = useMemo(() => {
    const todayKey = format(startOfDay(new Date()), 'yyyy-MM-dd');
    return summary.byDay.slice(-21).map((day) => ({
      key: day.date,
      label: new Intl.DateTimeFormat(intl, { day: 'numeric' }).format(new Date(day.date)),
      value: day.count,
      current: day.date === todayKey,
    }));
  }, [summary.byDay, intl]);

  /** Estimated minutes already committed to each of the next seven days. */
  const weekAhead: BarDatum[] = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, offset) => {
      const day = addDays(today, offset);
      const key = format(day, 'yyyy-MM-dd');
      const minutes = roots
        .filter((i) => i.due && i.due.date.slice(0, 10) === key)
        .reduce((acc, i) => acc + (effectiveEstimate(i, childrenOf).minutes ?? 0), 0);
      return {
        key,
        label: new Intl.DateTimeFormat(intl, { weekday: 'short' }).format(day),
        value: minutes,
        current: offset === 0,
      };
    });
  }, [roots, childrenOf, intl]);

  const openByProject: RankedDatum[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of roots) counts.set(item.project_id, (counts.get(item.project_id) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, value]) => ({
        key: id,
        label: snapshot.projects[id]?.name ?? '—',
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .map((row, index) => ({ ...row, color: seriesColor(index) }));
  }, [roots, snapshot.projects]);

  const deadlines = useMemo(() => {
    const limit = startOfDay(addDays(new Date(), 7));
    return roots
      .filter((i) => {
        const d = deadlineDate(i);
        return d !== null && d <= limit;
      })
      .sort((a, b) => deadlineDate(a)!.getTime() - deadlineDate(b)!.getTime())
      .slice(0, 5);
  }, [roots]);

  const pillClass = (level: string | null) =>
    `loadpill ${level === 'ok' ? 'ok' : level === 'tight' ? 'warn' : 'over'}`;

  return (
    <div className="page wide">
      <div className="phead">
        <div>
          <h1 className="ptitle">{t('dashboard.title')}</h1>
          <p className="psub">{t('week.subtitle')}</p>
        </div>
      </div>

      <div className="viewbar">
        <button className="btn accent" onClick={() => navigate('insights')}>
          <Icon name="trend" />
          {t('insights.openFull')}
        </button>
      </div>

      <div className="bento">
        <section className="card w3">
          <StatTile
            label={t('dashboard.today')}
            value={todayLoad.taskCount}
            trailing={formatDuration(todayLoad.estimatedMinutes, locale)}
            hint={
              todayLoad.percentage !== null
                ? t('dashboard.ofCapacity', {
                    percentage: todayLoad.percentage,
                    capacity: formatDuration(todayCapacity, locale),
                  })
                : undefined
            }
          />
        </section>

        <section className="card w3">
          <StatTile
            label={t('group.overdue')}
            value={groups.overdue.length}
            tone={groups.overdue.length > 0 ? 'accent' : 'neutral'}
            hint={t('insights.behindSchedule')}
          />
        </section>

        <section className="card w3">
          <StatTile
            label={t('insights.focusScore')}
            value={`${summary.focusScore}%`}
            hint={t('insights.period.month')}
          />
        </section>

        <section className="card w3">
          <StatTile
            label={t('insights.streak', { count: summary.currentStreak })}
            value={summary.currentStreak}
            hint={t('insights.activeDays') + ' · ' + summary.activeDays}
          />
        </section>

        <section className="card w8">
          <div className="chead-row">
            <div>
              <h3>{t('dashboard.today')}</h3>
              <p className="psub">{t('dashboard.todayHint')}</p>
            </div>
            {todayLoad.percentage !== null && (
              <span className={pillClass(todayLoad.level)}>{todayLoad.percentage}%</span>
            )}
          </div>
          <div className="focuslist">
            {todayItems.slice(0, 6).map((item) => (
              <TaskRow key={item.id} item={item} childrenOf={childrenOf} onOpen={onOpen} />
            ))}
            {todayItems.length === 0 && <p className="chart-empty">{t('task.noTasks')}</p>}
          </div>
        </section>

        <section className="card w4">
          <div className="chead-row">
            <div><h3>{t('dashboard.needsAttention')}</h3></div>
          </div>
          <div className="attn-list">
            <button className="attn" onClick={onIssues}>
              <span className="attn-n">{conflicts.length}</span>
              <span>{t('issues.tabConflicts')}</span>
              <Icon name="arrow-right" size="sm" />
            </button>
            <button className="attn" onClick={onIssues}>
              <span className="attn-n">{unestimated.length}</span>
              <span>{t('issues.tabToComplete')}</span>
              <Icon name="arrow-right" size="sm" />
            </button>
            <button className="attn" onClick={() => navigate('week')}>
              <span className="attn-n">{groups.overdue.length}</span>
              <span>{t('group.overdue')}</span>
              <Icon name="arrow-right" size="sm" />
            </button>
          </div>
        </section>

        <ChartCard
          title={t('dashboard.weekLoad')}
          subtitle={t('dashboard.weekAheadHint')}
          span={6}
          trailing={
            weekLoad.percentage !== null
              ? <span className={pillClass(weekLoad.level)}>{weekLoad.percentage}%</span>
              : undefined
          }
        >
          <Bars
            data={weekAhead}
            height={130}
            emptyLabel={t('task.noTasks')}
            format={(value) => formatDuration(value, locale)}
          />
        </ChartCard>

        <ChartCard
          title={t('dashboard.momentum')}
          subtitle={t('insights.completedTasks')}
          span={6}
          trailing={<span className="kpi-label">{summary.completedCount}</span>}
        >
          <Bars
            data={momentum}
            height={130}
            labelEvery={3}
            emptyLabel={t('insights.noHistory')}
            format={(value) => t('metrics.tasks', { count: value })}
          />
        </ChartCard>

        <ChartCard title={t('dashboard.openByProject')} span={6}>
          <RankedBars
            data={openByProject}
            limit={6}
            otherLabel={t('insights.otherProjects')}
            emptyLabel={t('task.noTasks')}
          />
        </ChartCard>

        <section className="card w3">
          <div className="chead-row">
            <div><h3>{t('insights.coverage')}</h3></div>
          </div>
          <Ring
            percentage={summary.estimateCoverage}
            label={t('insights.estimates')}
            caption={t('metrics.unestimated', { count: unestimated.length })}
          />
        </section>

        <section className="card w3">
          <div className="chead-row">
            <div><h3>{t('dashboard.deadlines')}</h3></div>
          </div>
          {deadlines.length === 0 ? (
            <p className="chart-empty">{t('dashboard.noDeadlines')}</p>
          ) : (
            deadlines.map((item) => {
              const d = deadlineDate(item)!;
              const project = snapshot.projects[item.project_id];
              return (
                <button className="deadlinerow" key={item.id} onClick={() => onOpen(item.id)}>
                  <span className="deadlinename">{item.content}</span>
                  <span className="deadline">{formatRelativeDay(d, locale)}</span>
                  {project && (
                    <span className="logmeta" style={markerStyle(project.color, false)}>
                      #{project.name}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
