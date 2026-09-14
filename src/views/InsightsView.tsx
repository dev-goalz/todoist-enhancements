import { useMemo, useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import {
  Bars, ChartCard, CompareBars, Donut, RankedBars, SplitBar, StatTile, seriesColor,
  type BarDatum, type CompareDatum, type RankedDatum, type SliceDatum,
} from '@/components/charts';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useCompleted, type Period } from '@/hooks/useCompleted';
import { useRoute } from '@/hooks/useRoute';
import { rootItems } from '@/store/selectors';
import { summariseInsights } from '@/domain/insights';
import { formatDuration, estimateOf } from '@/domain/estimates';
import { formatRelativeDay } from '@/domain/dates';
import { markerStyle } from '@/domain/colors';
import { toDisplayPriority, type CompletedItem } from '@/domain/types';
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
  // The address bar can name the tab, so the sidebar can link straight to the
  // logbook rather than landing on the overview and asking for a second click.
  const route = useRoute();
  const [tab, setTab] = useState<Tab>(route.id === 'logbook' ? 'logbook' : 'overview');
  const { data: completed, previous, loading } = useCompleted(period, true);

  const roots = useMemo(() => rootItems(items), [items]);
  const summary = useMemo(
    () => summariseInsights(completed, roots, snapshot),
    [completed, roots, snapshot],
  );

  const intl = locale === 'fr' ? 'fr-FR' : 'en-GB';

  /* Each day of the period, with the matching day of the period before it
     drawn as a dot. Both series share one axis; they are never two scales. */
  const perDay: CompareDatum[] = useMemo(() => {
    const todayKey = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const earlier = countByDay(previous);
    const current = countByDay(completed);

    const days = spanOfDays(period);
    const shift = days;                        // the same slot, one period back
    const today = startOfDay(new Date());

    return Array.from({ length: days }, (_, offset) => {
      const day = new Date(today.getTime() - (days - 1 - offset) * 86_400_000);
      const key = format(day, 'yyyy-MM-dd');
      const before = format(new Date(day.getTime() - shift * 86_400_000), 'yyyy-MM-dd');
      return {
        key,
        label: new Intl.DateTimeFormat(intl, { day: 'numeric' }).format(day),
        value: current.get(key) ?? 0,
        previous: earlier.get(before) ?? 0,
        current: key === todayKey,
      };
    });
  }, [completed, previous, period, intl]);

  /* The current calendar week, starting on the day the Todoist account does,
     so the axis reads M T W T F S S rather than "the last seven days". */
  const weekActivity: BarDatum[] = useMemo(() => {
    const today = startOfDay(new Date());
    const todayKey = format(today, 'yyyy-MM-dd');
    const counts = countByDay(completed);
    const startDay = snapshot.user?.start_day ?? 1;
    const back = (today.getDay() - (startDay % 7) + 7) % 7;
    const first = new Date(today.getTime() - back * 86_400_000);

    return Array.from({ length: 7 }, (_, offset) => {
      const day = new Date(first.getTime() + offset * 86_400_000);
      const key = format(day, 'yyyy-MM-dd');
      return {
        key,
        label: new Intl.DateTimeFormat(intl, { weekday: 'narrow' }).format(day),
        value: counts.get(key) ?? 0,
        current: key === todayKey,
      };
    });
  }, [completed, intl, snapshot.user]);

  const byHour: BarDatum[] = useMemo(
    () =>
      summary.byHour.map((value, hour) => ({
        key: String(hour),
        label: `${hour}h`,
        value,
      })),
    [summary.byHour],
  );

  const byProject: SliceDatum[] = useMemo(
    () =>
      summary.byProject.map((entry, index) => ({
        key: entry.projectId,
        label: entry.name,
        value: entry.count,
        color: seriesColor(index),
      })),
    [summary.byProject],
  );

  /* Priority is a fixed set of states, not an open list of series, so it keeps
     Todoist's own four colours — including the deliberate grey of P4 — and
     every slice is named in the legend rather than left to its hue. */
  const byPriority: SliceDatum[] = useMemo(
    () =>
      ([1, 2, 3, 4] as const).map((p) => ({
        key: `p${p}`,
        label: t(`common.p${p}` as TranslationKey),
        value: summary.priorities[`p${p}` as 'p1'],
        color: `var(--p${p})`,
      })),
    [summary.priorities, t],
  );

  const byLabel: RankedDatum[] = useMemo(
    () =>
      summary.byLabel.map((entry, index) => ({
        key: entry.untagged ? '__none__' : entry.label,
        label: entry.untagged ? t('insights.noLabel') : `@${entry.label}`,
        value: entry.count,
        color: entry.untagged ? 'var(--faint)' : seriesColor(index),
      })),
    [summary.byLabel, t],
  );

  const perActiveDay = summary.activeDays > 0
    ? Math.round((summary.completedCount / summary.activeDays) * 10) / 10
    : 0;

  const tasksLabel = (count: number) => t('metrics.tasks', { count });

  return (
    <div className="page wide">
      <div className="phead">
        <div>
          <h1 className="ptitle">{t('insights.title')}</h1>
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
          <section className="card w12 summary">
            <div className="summary-head">
              <h3>{t('insights.summary')}</h3>
              <strong>
                {t('insights.completedShare', { percentage: summary.progressPercentage })}
              </strong>
            </div>
            <div className="summary-stats">
              <div className="sstat completed">
                <Icon name="check" size="sm" />
                <strong>{summary.completedCount}</strong>
                <span>{t('insights.statCompleted')}</span>
              </div>
              <div className="sstat active">
                <Icon name="tasks" size="sm" />
                <strong>{summary.activeCount}</strong>
                <span>{t('insights.statActive')}</span>
              </div>
              <div className="sstat streak">
                <Icon name="trend" size="sm" />
                <strong>{summary.currentStreak}</strong>
                <span>{t('insights.statStreak', { count: summary.currentStreak })}</span>
              </div>
            </div>
          </section>

          <section className="card w4 focuscardv">
            <h3>{t('insights.focusScore')}</h3>
            <p className="hero">{summary.focusScore}%</p>
            <SplitBar data={byPriority} />
            <p className="psub">{t('insights.focusExplainer')}</p>
          </section>

          <ChartCard
            title={t('insights.weekActivity')}
            subtitle={t('insights.completedTasks')}
            span={8}
            trailing={<span className="kpi-label">{summary.completedCount}</span>}
          >
            <Bars
              data={weekActivity}
              height={150}
              emptyLabel={t('insights.noHistory')}
              format={tasksLabel}
            />
          </ChartCard>

          <section className="card w3">
            <StatTile
              label={t('insights.completedTasks')}
              value={summary.completedCount}
              hint={t('insights.activeDays') + ' · ' + summary.activeDays}
            />
          </section>

          <section className="card w3">
            <StatTile
              label={t('insights.tasksPerDay')}
              value={perActiveDay}
              hint={t('insights.tasksPerDayHint')}
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
              label={t('insights.coverage')}
              value={`${summary.estimateCoverage}%`}
              hint={
                t('insights.remaining') + ' · '
                + formatDuration(
                  roots.reduce((acc, i) => acc + (estimateOf(i) ?? 0), 0),
                  locale,
                )
              }
            />
          </section>

          <ChartCard
            title={t('insights.perDay')}
            subtitle={t('insights.perDayHint')}
            span={12}
          >
            <CompareBars
              data={perDay}
              height={160}
              labelEvery={perDay.length > 14 ? Math.ceil(perDay.length / 12) : 1}
              emptyLabel={t('insights.noHistory')}
              format={(value) => String(value)}
              currentLabel={t('insights.thisPeriod')}
              previousLabel={t('insights.previousPeriod')}
            />
          </ChartCard>

          <ChartCard title={t('insights.byProject')} span={6}>
            <Donut
              data={byProject}
              limit={6}
              otherLabel={t('insights.otherProjects')}
              total={summary.completedCount}
              caption={t('insights.tasks')}
              emptyLabel={t('insights.noHistory')}
            />
          </ChartCard>

          <ChartCard title={t('insights.byPriority')} span={6}>
            <Donut
              data={byPriority}
              total={`${summary.focusScore}%`}
              caption={t('insights.focusScore')}
              emptyLabel={t('insights.noHistory')}
            />
          </ChartCard>

          <ChartCard
            title={t('insights.dayActivity')}
            subtitle={t('insights.dayActivityHint')}
            span={6}
          >
            <Bars
              data={byHour}
              height={140}
              labelEvery={3}
              emptyLabel={t('insights.noHistory')}
              format={tasksLabel}
            />
          </ChartCard>

          <ChartCard title={t('insights.byLabel')} span={6}>
            <RankedBars
              data={byLabel}
              limit={7}
              otherLabel={t('insights.otherProjects')}
              emptyLabel={t('insights.noHistory')}
            />
          </ChartCard>
        </div>
      )}

      {!loading && tab === 'logbook' && <Logbook completed={completed} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** How many days one period covers, for the day-by-day comparison. */
function spanOfDays(period: Period): number {
  if (period === 'day') return 1;
  if (period === 'week') return 7;
  if (period === 'month') return 30;
  if (period === 'quarter') return 90;
  return 365;
}

function countByDay(items: CompletedItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = format(new Date(item.completed_at), 'yyyy-MM-dd');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/* ------------------------------------------------------------------ */

function Logbook({ completed }: { completed: CompletedItem[] }) {
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
        <Select
          label={t('toolbar.group')}
          value={group}
          onChange={(value) => setGroup(value as LogGroup)}
          options={[
            { value: 'day', label: t('group.day') },
            { value: 'project', label: t('group.project') },
            { value: 'priority', label: t('group.priority') },
          ]}
        />

        <Select
          label={t('filter.projects')}
          value={projectFilter}
          onChange={setProjectFilter}
          options={[
            { value: '', label: t('common.all') },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />

        <Select
          label={t('filter.priorities')}
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={[
            { value: '', label: t('common.all') },
            ...([1, 2, 3, 4] as const).map((p) => ({ value: String(p), label: `P${p}` })),
          ]}
        />

        <span className="kpi-label">{t('metrics.tasks', { count: filtered.length })}</span>
      </div>

      {groups.length === 0 ? (
        <p className="empty">{t('insights.noHistory')}</p>
      ) : (
        <div className="logbook">
          {groups.map((entry) => (
            <section className="logday" key={entry.key}>
              <h4>
                {entry.title}
                <span className="gcount">{entry.rows.length}</span>
              </h4>
              {entry.rows.map((task) => {
                const project = snapshot.projects[task.project_id];
                const minutes = task.labels ? estimateOf({ labels: task.labels } as never) : null;
                const priority = toDisplayPriority(task.priority ?? 1);
                return (
                  <div className="logrow" key={`${task.id}-${task.completed_at}`}>
                    <span className={`logtick p${priority}`}><Icon name="check" size="sm" /></span>
                    <span className="logname">{task.content}</span>
                    {project && (
                      <span className="logmeta" style={markerStyle(project.color, false)}>
                        #{project.name}
                      </span>
                    )}
                    <span className="logmeta time">
                      {minutes !== null ? formatDuration(minutes, locale) : '—'}
                    </span>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
