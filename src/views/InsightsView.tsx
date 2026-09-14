import { useMemo, useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { Icon } from '@/components/Icon';
import {
  Bars, ChartCard, HourHeat, RankedBars, Ring, StatTile, seriesColor,
  type BarDatum, type RankedDatum,
} from '@/components/charts';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useCompleted, type Period } from '@/hooks/useCompleted';
import { rootItems } from '@/store/selectors';
import { summariseInsights } from '@/domain/insights';
import { formatDuration, estimateOf } from '@/domain/estimates';
import { formatRelativeDay } from '@/domain/dates';
import { markerStyle } from '@/domain/colors';
import { toDisplayPriority } from '@/domain/types';
import type { TranslationKey } from '@/i18n';

type Tab = 'overview' | 'logbook';
type LogGroup = 'day' | 'project' | 'priority';

const PERIODS: Period[] = ['day', 'week', 'month', 'quarter', 'year'];

/**
 * Insights.
 *
 * Overview answers "how did this period go" on one board; Logbook is the
 * record of what was actually finished. Everything is scoped by the period
 * picked at the top, so the two tabs always describe the same window.
 */
export function InsightsView() {
  const { t, locale } = useT();
  const { snapshot, items } = useData();
  const [period, setPeriod] = useState<Period>('week');
  const [tab, setTab] = useState<Tab>('overview');
  const { data: completed, loading } = useCompleted(period, true);

  const roots = useMemo(() => rootItems(items), [items]);
  const summary = useMemo(
    () => summariseInsights(completed, roots, snapshot),
    [completed, roots, snapshot],
  );

  const intl = locale === 'fr' ? 'fr-FR' : 'en-GB';

  const activity: BarDatum[] = useMemo(() => {
    const todayKey = format(startOfDay(new Date()), 'yyyy-MM-dd');
    // A long window is read by week; a short one day by day.
    if (period === 'year' || period === 'quarter') {
      const byWeek = new Map<string, number>();
      for (const day of summary.byDay) {
        const date = new Date(day.date);
        const key = format(date, 'yyyy-ww');
        byWeek.set(key, (byWeek.get(key) ?? 0) + day.count);
      }
      return [...byWeek.entries()].map(([key, value]) => ({
        key,
        label: key.slice(5),
        value,
      }));
    }
    return summary.byDay.map((day) => ({
      key: day.date,
      label: new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short' }).format(new Date(day.date)),
      value: day.count,
      current: day.date === todayKey,
    }));
  }, [summary.byDay, period, intl]);

  const byProject: RankedDatum[] = useMemo(
    () =>
      summary.byProject.map((entry, index) => ({
        key: entry.projectId,
        label: entry.name,
        value: entry.count,
        color: seriesColor(index),
      })),
    [summary.byProject],
  );

  const byPriority: RankedDatum[] = useMemo(() => {
    const tones = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];
    return ([1, 2, 3, 4] as const).map((p) => ({
      key: `p${p}`,
      label: t(`common.p${p}` as TranslationKey),
      value: summary.priorities[`p${p}` as 'p1'],
      color: tones[p - 1],
    }));
  }, [summary.priorities, t]);

  const remainingMinutes = useMemo(
    () => roots.reduce((acc, i) => acc + (estimateOf(i) ?? 0), 0),
    [roots],
  );

  const averagePerActiveDay = summary.activeDays > 0
    ? Math.round((summary.completedCount / summary.activeDays) * 10) / 10
    : 0;

  return (
    <div className="page wide">
      <div className="phead">
        <div>
          <h1 className="ptitle">{t('insights.title')}</h1>
          <p className="psub">{t('insights.focusExplainer')}</p>
        </div>
      </div>

      <div className="viewbar periodbar">
        {PERIODS.map((value) => (
          <button
            key={value}
            className="btn"
            aria-pressed={period === value}
            onClick={() => setPeriod(value)}
          >
            {t(`insights.period.${value}` as TranslationKey)}
          </button>
        ))}
      </div>

      <div className="tabs" role="tablist">
        {(['overview', 'logbook'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {t(`insights.${value}` as TranslationKey)}
          </button>
        ))}
      </div>

      {loading && <p className="empty">{t('insights.loading')}</p>}

      {!loading && tab === 'overview' && (
        <div className="bento">
          <section className="card w3">
            <StatTile
              label={t('insights.completedTasks')}
              value={summary.completedCount}
              hint={t('insights.perActiveDay', { value: averagePerActiveDay })}
            />
          </section>

          <section className="card w3">
            <StatTile
              label={t('insights.completedTime')}
              value={formatDuration(summary.completedMinutes, locale)}
              hint={
                summary.completedWithoutEstimate > 0
                  ? t('metrics.unestimated', { count: summary.completedWithoutEstimate })
                  : undefined
              }
            />
          </section>

          <section className="card w3">
            <StatTile
              label={t('insights.focusScore')}
              value={`${summary.focusScore}%`}
              tone="accent"
              hint={t('insights.focusExplainer')}
            />
          </section>

          <section className="card w3">
            <StatTile
              label={t('insights.activeDays')}
              value={summary.activeDays}
              hint={t('insights.streak', { count: summary.currentStreak })}
            />
          </section>

          <ChartCard
            title={t('insights.weekActivity')}
            subtitle={t('insights.completedTasks')}
            span={8}
            trailing={<span className="kpi-label">{summary.completedCount}</span>}
          >
            <Bars
              data={activity}
              height={150}
              labelEvery={activity.length > 14 ? Math.ceil(activity.length / 10) : 1}
              emptyLabel={t('insights.noHistory')}
              format={(value) => t('metrics.tasks', { count: value })}
            />
          </ChartCard>

          <section className="card w4">
            <div className="chead-row">
              <div><h3>{t('insights.coverage')}</h3><p className="psub">{t('insights.estimates')}</p></div>
            </div>
            <Ring
              percentage={summary.estimateCoverage}
              label={t('insights.coverage')}
              caption={t('insights.remaining') + ' · ' + formatDuration(remainingMinutes, locale)}
            />
          </section>

          <ChartCard title={t('insights.byProject')} span={6}>
            <RankedBars
              data={byProject}
              limit={6}
              otherLabel={t('insights.otherProjects')}
              emptyLabel={t('insights.noHistory')}
            />
          </ChartCard>

          <ChartCard title={t('insights.byPriority')} span={6}>
            <RankedBars data={byPriority} emptyLabel={t('insights.noHistory')} />
          </ChartCard>

          <ChartCard
            title={t('insights.byHour')}
            subtitle={t('insights.byHourHint')}
            span={12}
          >
            <HourHeat
              hours={summary.byHour}
              format={(value, hour) =>
                `${String(hour).padStart(2, '0')}h · ${t('metrics.tasks', { count: value })}`
              }
            />
          </ChartCard>
        </div>
      )}

      {!loading && tab === 'logbook' && (
        <Logbook completed={completed} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Logbook({ completed }: { completed: ReturnType<typeof useCompleted>['data'] }) {
  const { t, locale } = useT();
  const { snapshot } = useData();
  const [group, setGroup] = useState<LogGroup>('day');
  const [projectFilter, setProjectFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const filtered = useMemo(
    () =>
      completed.filter((task) => {
        if (projectFilter && task.project_id !== projectFilter) return false;
        if (priorityFilter && String(toDisplayPriority((task.priority ?? 1))) !== priorityFilter) {
          return false;
        }
        return true;
      }),
    [completed, projectFilter, priorityFilter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; rows: typeof filtered }>();
    for (const task of filtered) {
      const at = new Date(task.completed_at);
      let key: string;
      let title: string;

      if (group === 'project') {
        key = task.project_id;
        title = snapshot.projects[task.project_id]?.name ?? '—';
      } else if (group === 'priority') {
        const p = toDisplayPriority(task.priority ?? 1);
        key = `p${p}`;
        title = `P${p}`;
      } else {
        key = format(at, 'yyyy-MM-dd');
        title = formatRelativeDay(at, locale);
      }

      const bucket = map.get(key);
      if (bucket) bucket.rows.push(task);
      else map.set(key, { title, rows: [task] });
    }

    const entries = [...map.entries()].map(([key, value]) => ({ key, ...value }));
    // Days read newest first; the other groupings read largest first.
    return group === 'day'
      ? entries.sort((a, b) => b.key.localeCompare(a.key))
      : entries.sort((a, b) => b.rows.length - a.rows.length);
  }, [filtered, group, snapshot.projects, locale]);

  const projects = Object.values(snapshot.projects)
    .filter((p) => !p.is_deleted && !p.is_folder)
    .sort((a, b) => a.child_order - b.child_order);

  return (
    <>
      <div className="viewbar logbar">
        <label className="cfield">
          <span>{t('toolbar.group')}</span>
          <select value={group} onChange={(e) => setGroup(e.target.value as LogGroup)}>
            <option value="day">{t('group.day')}</option>
            <option value="project">{t('group.project')}</option>
            <option value="priority">{t('group.priority')}</option>
          </select>
        </label>

        <label className="cfield">
          <span>{t('filter.projects')}</span>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <label className="cfield">
          <span>{t('filter.priorities')}</span>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {([1, 2, 3, 4] as const).map((p) => (
              <option key={p} value={String(p)}>P{p}</option>
            ))}
          </select>
        </label>

        <span className="kpi-label">{t('metrics.tasks', { count: filtered.length })}</span>
      </div>

      {groups.length === 0 ? (
        <p className="empty">{t('insights.noHistory')}</p>
      ) : (
        groups.map((entry) => (
          <section className="logday" key={entry.key}>
            <h4>
              {entry.title}
              <span>{t('metrics.tasks', { count: entry.rows.length })}</span>
            </h4>
            {entry.rows.map((task) => {
              const project = snapshot.projects[task.project_id];
              const minutes = task.labels ? estimateOf({ labels: task.labels } as never) : null;
              return (
                <div className="logrow" key={`${task.id}-${task.completed_at}`}>
                  <Icon name="check" size="sm" />
                  <span>{task.content}</span>
                  {project && (
                    <span className="logmeta" style={markerStyle(project.color, false)}>
                      #{project.name}
                    </span>
                  )}
                  <span className="logmeta">
                    {minutes !== null ? formatDuration(minutes, locale) : '—'}
                  </span>
                </div>
              );
            })}
          </section>
        ))
      )}
    </>
  );
}
