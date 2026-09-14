import { useEffect, useMemo, useRef, useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { Icon } from '@/components/Icon';
import {
  Bars, ChartCard, CompareBars, Donut, RankedBars, SplitBar, StatTile, seriesColor,
  type BarDatum, type CompareDatum, type RankedDatum, type SliceDatum,
} from '@/components/charts';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useCompleted, type Period } from '@/hooks/useCompleted';
import { navigate, useRoute } from '@/hooks/useRoute';
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

  /* The initialiser above only runs on mount, so arriving from the menu while
     the page was already open left the tab where it was. */
  useEffect(() => {
    setTab(route.id === 'logbook' ? 'logbook' : 'overview');
  }, [route.id]);
  const { data: completed, previous, loading } = useCompleted(period, true);

  const roots = useMemo(() => rootItems(items), [items]);
  const summary = useMemo(
    () => summariseInsights(completed, roots, snapshot),
    [completed, roots, snapshot],
  );

  const intl = locale === 'fr' ? 'fr-FR' : 'en-GB';

  /* How this period is worth cutting up.
     A single day has no series of days in it; a year has too many to read. */
  const grain = granularityOf(period);

  /* Each bucket of the period, with the matching bucket of the period before
     it drawn as a dot. Both series share one axis; never two scales. */
  const perBucket: CompareDatum[] = useMemo(() => {
    if (grain === null) return [];
    const now = startOfDay(new Date());
    const nowKey = bucketKey(now, grain);
    const count = (items: CompletedItem[]) => {
      const map = new Map<string, number>();
      for (const item of items) {
        const key = bucketKey(new Date(item.completed_at), grain);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return map;
    };
    const current = count(completed);
    const earlier = count(previous);
    const span = spanOfDays(period);
    const buckets = bucketsIn(period, grain);

    return Array.from({ length: buckets }, (_, offset) => {
      const at = shiftBucket(now, grain, -(buckets - 1 - offset));
      const before = new Date(at.getTime() - span * 86_400_000);
      return {
        key: bucketKey(at, grain),
        label: bucketLabel(at, grain, intl),
        value: current.get(bucketKey(at, grain)) ?? 0,
        previous: earlier.get(bucketKey(before, grain)) ?? 0,
        current: bucketKey(at, grain) === nowKey,
      };
    });
  }, [completed, previous, period, grain, intl]);

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
            onClick={() => navigate('insights', value === 'logbook' ? 'logbook' : undefined)}
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

          <section className={`card focuscardv ${period === 'week' || period === 'month' ? 'w4' : 'w6'}`}>
            <h3>{t('insights.focusScore')}</h3>
            <p className="hero">{summary.focusScore}%</p>
            <SplitBar data={byPriority} />
            <p className="psub">{t('insights.focusExplainer')}</p>
          </section>

          {/* Past a month the current week is a footnote, not a headline. */}
          {(period === 'week' || period === 'month') && (
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
          )}

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

          {/* A single day has no series of days inside it. */}
          {grain !== null && (
            <ChartCard
              title={t(`insights.per_${grain}` as TranslationKey)}
              subtitle={t('insights.perBucketHint')}
              span={12}
            >
              <CompareBars
                data={perBucket}
                height={160}
                labelEvery={perBucket.length > 14 ? Math.ceil(perBucket.length / 12) : 1}
                emptyLabel={t('insights.noHistory')}
                format={(value) => String(value)}
                currentLabel={t('insights.thisPeriod')}
                previousLabel={t('insights.previousPeriod')}
              />
            </ChartCard>
          )}

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
            span={period === 'day' ? 12 : 6}
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

/** How many days one period covers. */
function spanOfDays(period: Period): number {
  if (period === 'day') return 1;
  if (period === 'week') return 7;
  if (period === 'month') return 30;
  if (period === 'quarter') return 90;
  return 365;
}

type Grain = 'day' | 'week' | 'month';

/**
 * The unit the period is read in.
 *
 * Today has no series of days inside it, so it gets none; a quarter read day
 * by day is ninety bars nobody can tell apart, and a year is three hundred
 * and sixty-five.
 */
function granularityOf(period: Period): Grain | null {
  if (period === 'day') return null;
  if (period === 'week' || period === 'month') return 'day';
  if (period === 'quarter') return 'week';
  return 'month';
}

function bucketsIn(period: Period, grain: Grain): number {
  if (grain === 'day') return spanOfDays(period);
  if (grain === 'week') return 13;
  return 12;
}

const startOfGrain = (at: Date, grain: Grain): Date => {
  if (grain === 'month') return new Date(at.getFullYear(), at.getMonth(), 1);
  if (grain === 'week') {
    const monday = new Date(at);
    monday.setDate(at.getDate() - ((at.getDay() + 6) % 7));
    return startOfDay(monday);
  }
  return startOfDay(at);
};

const bucketKey = (at: Date, grain: Grain): string =>
  format(startOfGrain(at, grain), grain === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd');

function shiftBucket(from: Date, grain: Grain, by: number): Date {
  const at = startOfGrain(from, grain);
  if (grain === 'month') return new Date(at.getFullYear(), at.getMonth() + by, 1);
  return new Date(at.getTime() + by * (grain === 'week' ? 7 : 1) * 86_400_000);
}

function bucketLabel(at: Date, grain: Grain, intl: string): string {
  if (grain === 'month') {
    return new Intl.DateTimeFormat(intl, { month: 'short' }).format(at);
  }
  if (grain === 'week') {
    return new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short' }).format(at);
  }
  return new Intl.DateTimeFormat(intl, { day: 'numeric' }).format(at);
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
  /* Several projects and several priorities at once: one of each was never
     the question anybody asked of a record. Empty means "all". */
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<number[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [filtersOpen]);

  const filtered = useMemo(
    () =>
      completed.filter((task) => {
        if (projectFilter.length > 0 && !projectFilter.includes(task.project_id)) return false;
        if (priorityFilter.length > 0
          && !priorityFilter.includes(toDisplayPriority(task.priority ?? 1))) return false;
        return true;
      }),
    [completed, projectFilter, priorityFilter],
  );

  const activeFilters = projectFilter.length + priorityFilter.length;
  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

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
        <div className="displaywrap" ref={filtersRef}>
          <button
            className="btn"
            aria-expanded={filtersOpen}
            aria-haspopup="dialog"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <Icon name="sliders" />
            {t('logbook.filters')}
            {activeFilters > 0 && <span className="displaycount">{activeFilters}</span>}
          </button>

          {filtersOpen && (
            <div className="popover displaypanel anchor-left" role="dialog" aria-label={t('logbook.filters')}>
              <div className="panelhead">
                <h5>{t('toolbar.group')}</h5>
                {activeFilters > 0 && (
                  <button
                    className="resetbtn"
                    onClick={() => { setProjectFilter([]); setPriorityFilter([]); }}
                  >
                    {t('filter.clear')}
                  </button>
                )}
              </div>

              <div className="segmented">
                {(['day', 'project', 'priority'] as const).map((value) => (
                  <button
                    key={value}
                    aria-pressed={group === value}
                    onClick={() => setGroup(value)}
                  >
                    <small>{t(`group.${value}` as TranslationKey)}</small>
                  </button>
                ))}
              </div>

              <h5>{t('filter.priorities')}</h5>
              <div className="chiprow">
                {([1, 2, 3, 4] as const).map((p) => (
                  <button
                    key={p}
                    className="chip"
                    aria-pressed={priorityFilter.includes(p)}
                    onClick={() => setPriorityFilter((list) => toggleIn(list, p as number))}
                  >
                    <span className="flagdot" style={{ background: `var(--p${p})` }} />
                    P{p}
                  </button>
                ))}
              </div>

              <h5>{t('filter.projects')}</h5>
              <div className="chiprow scroll">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    className="chip"
                    aria-pressed={projectFilter.includes(project.id)}
                    onClick={() => setProjectFilter((list) => toggleIn(list, project.id))}
                  >
                    <span className="hash" style={markerStyle(project.color)}>#</span>
                    {project.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

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
