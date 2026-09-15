import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { EstimateField } from '@/components/EstimateField';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useCompleted } from '@/hooks/useCompleted';
import { useStore } from '@/store/store';
import { navigate } from '@/hooks/useRoute';
import { rootItems } from '@/store/selectors';
import { markerStyle } from '@/domain/colors';
import { formatDuration, effectiveEstimate, withEstimate } from '@/domain/estimates';
import { dueDate, formatRelativeDay } from '@/domain/dates';
import { summariseInsights } from '@/domain/insights';
import {
  Bars, ChartCard, Donut, SplitBar, seriesColor,
  type BarDatum, type SliceDatum,
} from '@/components/charts';
import { rangeFor } from '@/domain/periods';
import { format, startOfDay } from 'date-fns';
import { bucketOf } from '@/domain/views';
import { toDisplayPriority, type CompletedItem, type Item } from '@/domain/types';
import {
  buildReview, type ReviewAction, type ReviewCadence, type ReviewStep,
} from '@/domain/review';
import type { TranslationKey } from '@/i18n';

/** How long a project may go untouched before the weekly review mentions it. */
const QUIET_AFTER_DAYS = 14;

/** The destination each action stands for, in the drop table's own terms. */
const TARGETS = {
  today: { kind: 'today' },
  anytime: { kind: 'anytime' },
  someday: { kind: 'someday' },
} as const;

/** How the finished list can be ordered. */
type DoneOrder = 'date' | 'priority';

interface ReviewViewProps {
  onOpen: (id: string) => void;
}

/**
 * The daily and weekly review.
 *
 * A planning tool is only as good as the habit of looking at it, and what
 * makes that hard is that looking at everything is exhausting. This asks one
 * question at a time, in an order, with an end.
 *
 * Every answer is a change Todoist already understands, made through the same
 * rules a drag makes, so a pass through here leaves nothing behind that the
 * official app would not recognise. Nothing about the review is stored: it is
 * a way of reading what is already there.
 */
export function ReviewView({ onOpen }: ReviewViewProps) {
  const { t, locale } = useT();
  const { snapshot, items, childrenOf } = useData();
  const sendTo = useStore((s) => s.sendTo);
  const toggleTask = useStore((s) => s.toggleTask);
  const updateTask = useStore((s) => s.updateTask);

  const [cadence, setCadence] = useState<ReviewCadence>('daily');
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [doneOrder, setDoneOrder] = useState<DoneOrder>('date');

  /* The weekly pass reports what was finished, which is history and is read
     on demand. The daily pass never asks, so it never fetches. */
  const weekRange = useMemo(
    () => rangeFor('week', 0, null, snapshot.user?.start_day ?? 1),
    [snapshot.user?.start_day],
  );
  const { data: completed, loading } = useCompleted(weekRange, cadence === 'weekly');

  const roots = useMemo(() => rootItems(items), [items]);

  const steps = useMemo(
    () => buildReview(cadence, {
      roots,
      projects: snapshot.projects,
      completed,
      inboxProjectId: snapshot.user?.inbox_project_id ?? null,
      now: new Date(),
      quietAfterDays: QUIET_AFTER_DAYS,
    }),
    [cadence, roots, snapshot.projects, snapshot.user?.inbox_project_id, completed],
  );

  // Changing cadence starts the review again rather than landing mid-way.
  useEffect(() => {
    setIndex(0);
    setFinished(false);
  }, [cadence]);

  const step = steps[index];
  const last = index === steps.length - 1;

  /** The number on a step's pip: how many things it is asking about. */
  const countOf = (s: ReviewStep): number =>
    s.items.length + s.projects.length + s.completed.length;

  return (
    <div className="page review">
      <div className="reviewhead">
        <h1 className="ptitle">{t('review.title')}</h1>
        <div className="segmented small reviewcadence" role="group" aria-label={t('review.title')}>
          {(['daily', 'weekly'] as const).map((value) => (
            <button
              key={value}
              aria-pressed={cadence === value}
              onClick={() => setCadence(value)}
            >
              {t(`review.cadence.${value}` as TranslationKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Where you are, and how much is left. A review with no visible end is
          the thing people stop doing. */}
      <ol className="reviewrail">
        {steps.map((s, i) => (
          <li key={s.id}>
            <button
              className={`reviewpip${i === index && !finished ? ' current' : ''}${
                i < index || finished ? ' passed' : ''
              }${s.clear ? ' clear' : ''}`}
              aria-current={i === index && !finished ? 'step' : undefined}
              onClick={() => { setIndex(i); setFinished(false); }}
            >
              <span className="reviewpip-dot" aria-hidden="true">
                {s.clear ? <Icon name="check" size="sm" /> : <b>{countOf(s)}</b>}
              </span>
              <span className="reviewpip-label">{t(`review.step.${s.id}` as TranslationKey)}</span>
            </button>
          </li>
        ))}
      </ol>

      {finished || !step ? (
        <Done />
      ) : (
        <>
          {/* One fixed frame: the question at the top, the answer below it, and
              the same two buttons in the same place on every step of both
              cadences. What changes between steps is the content, not where
              anything is. */}
          <section className="reviewstep" key={step.id}>
            <h2>{t(`review.step.${step.id}` as TranslationKey)}</h2>
            <p className="reviewask">{t(`review.ask.${step.id}` as TranslationKey)}</p>
            <div className="reviewbody">{body()}</div>
          </section>

          <div className="reviewfoot">
            <button
              className="btn quiet"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <Icon name="arrow-left" size="sm" />
              {t('review.back')}
            </button>
            <span className="reviewcount">
              {t('review.position', { index: index + 1, total: steps.length })}
            </span>
            <button
              className="btn primary"
              onClick={() => (last ? setFinished(true) : setIndex((i) => i + 1))}
            >
              {last ? t('review.finish') : t('review.next')}
              {!last && <Icon name="arrow-right" size="sm" />}
            </button>
          </div>
        </>
      )}
    </div>
  );

  function body() {
    if (!step) return null;

    if (step.id === 'stats') return <Stats />;
    if (step.id === 'done') return <DoneList />;
    if (step.id === 'quiet') return <Quiet />;

    if (step.items.length === 0) return <Settled />;

    return (
      <div className="reviewlist">
        {step.items.map((item) => (
          <Row key={item.id} item={item} step={step} />
        ))}
      </div>
    );
  }

  /** One decision, one row. */
  function Row({ item, step: s }: { item: Item; step: ReviewStep }) {
    const project = snapshot.projects[item.project_id];
    const { minutes } = effectiveEstimate(item, childrenOf);
    const due = dueDate(item);

    /* Where the task is now, so the row can mark it. On the backlog step this
       is what makes "leave it here" read as an answer rather than as silence. */
    const bucket = bucketOf(item);
    /* The Inbox marks nothing. A task sitting there has not been filed
       anywhere yet, so "backlog" is a place it happens to fall out of the
       rules rather than a decision anyone made about it. */
    const current: ReviewAction | null = s.id === 'inbox' ? null
      : bucket === 'today' ? 'today'
        : bucket === 'anytime' ? 'anytime'
          : bucket === 'someday' ? 'someday' : null;

    return (
      <div className="reviewrow">
        {/* Sometimes the answer is that it is already done. */}
        <button
          className={`check p${toDisplayPriority(item.priority)}`}
          aria-label={t('task.complete')}
          title={t('task.complete')}
          onClick={() => void toggleTask(item.id)}
        >
          <Icon name="check" />
        </button>

        <button className="reviewname" onClick={() => onOpen(item.id)}>
          <span className="ttitle">{item.content}</span>
          <span className="meta">
            {due && (
              <span className={s.id === 'overdue' || s.id === 'slipped' ? 'late' : undefined}>
                <Icon name="calendar" />{formatRelativeDay(due, locale)}
              </span>
            )}
            {minutes !== null && (
              <span><Icon name="clock" />{formatDuration(minutes, locale)}</span>
            )}
            {project && !project.inbox_project && (
              <span className="proj" style={markerStyle(project.color, false)}>
                #{project.name}
              </span>
            )}
          </span>
        </button>

        {s.estimable ? (
          /* The thing missing here is a number, so the field is on the row and
             the row leaves the list the moment it has one. */
          <span className="reviewest">
            <EstimateField
              minutes={null}
              onCommit={(value) => {
                if (value === null) return;
                void updateTask(item.id, { labels: withEstimate(item.labels, value) });
              }}
              onAdvance={(field) => {
                const fields = Array.from(
                  field.closest('.reviewlist')?.querySelectorAll('input') ?? [],
                );
                fields[fields.indexOf(field) + 1]?.focus();
              }}
            />
          </span>
        ) : (
          <span className="reviewactions">
            {s.actions.map((action) => (
              <button
                key={action}
                className={`btn quiet${current === action ? ' on' : ''}`}
                aria-pressed={current === action}
                disabled={current === action}
                onClick={() => void sendTo(
                  item.id,
                  TARGETS[action],
                  t(`review.to.${action}` as TranslationKey),
                )}
              >
                {t(`review.to.${action}` as TranslationKey)}
              </button>
            ))}
          </span>
        )}
      </div>
    );
  }

  /** What you finished, in the order you want to read it. */
  function DoneList() {
    const ordered = useMemo(() => {
      const list = [...(step?.completed ?? [])];
      if (doneOrder === 'priority') {
        return list.sort((a, b) => {
          const left = toDisplayPriority(a.priority ?? 1);
          const right = toDisplayPriority(b.priority ?? 1);
          if (left !== right) return left - right;
          return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
        });
      }
      return list.sort(
        (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
      );
    }, [step?.completed, doneOrder]);

    if (loading && ordered.length === 0) return <p className="reviewquiet">{t('common.loading')}</p>;
    if (ordered.length === 0) return <Settled note={t('review.doneNone')} />;

    return (
      <>
        <div className="reviewtoolbar">
          <span className="reviewtally">
            {t('review.doneCount', { count: ordered.length })}
          </span>
          <div className="segmented small" role="group" aria-label={t('toolbar.sortBy')}>
            {(['date', 'priority'] as const).map((option) => (
              <button
                key={option}
                aria-pressed={doneOrder === option}
                onClick={() => setDoneOrder(option)}
              >
                {t(`review.order.${option}` as TranslationKey)}
              </button>
            ))}
          </div>
        </div>

        {/* The list scrolls, not the page under it. A week of finished work is
            a thing to read through, and reading it should not move the
            question, the rail, or the button that leaves the step. */}
        <div className="reviewlist scrolls">
          {ordered.map((done) => <DoneRow key={done.id} done={done} />)}
        </div>
      </>
    );
  }

  function DoneRow({ done }: { done: CompletedItem }) {
    const project = snapshot.projects[done.project_id];
    const priority = toDisplayPriority(done.priority ?? 1);
    return (
      <div className="reviewrow done">
        {/* A tick, not a line through it. This is a record of work, and a
            review is no place to read your own week crossed out. */}
        <span className={`check done p${priority}`} aria-hidden="true"><Icon name="check" /></span>
        <span className="reviewname as-text">
          <span className="ttitle">{done.content}</span>
          <span className="meta">
            <span>{formatRelativeDay(new Date(done.completed_at), locale)}</span>
            {project && !project.inbox_project && (
              <span className="proj" style={markerStyle(project.color, false)}>
                #{project.name}
              </span>
            )}
          </span>
        </span>
        {priority < 4 && <span className={`pflag p${priority}`}>P{priority}</span>}
      </div>
    );
  }

  /** The week in figures, drawn with the same pieces the dashboard uses. */
  function Stats() {
    const summary = useMemo(
      () => summariseInsights(step?.completed ?? [], roots, snapshot),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [step?.completed, roots, snapshot],
    );

    const byPriority: SliceDatum[] = useMemo(
      () => ([1, 2, 3, 4] as const).map((p) => ({
        key: `p${p}`,
        label: t(`common.p${p}` as TranslationKey),
        value: summary.priorities[`p${p}` as 'p1'],
        color: `var(--p${p})`,
      })),
      [summary.priorities],
    );

    const byProject: SliceDatum[] = useMemo(
      () => summary.byProject.map((entry, index) => ({
        key: entry.projectId,
        label: entry.name,
        value: entry.count,
        color: seriesColor(index),
      })),
      [summary.byProject],
    );

    /* The seven days of the week under review, in order, including the ones
       nothing was finished on — a gap is part of the shape. */
    const byDay: BarDatum[] = useMemo(() => {
      const counts = new Map(summary.byDay.map((d) => [d.date, d.count]));
      const todayKey = format(startOfDay(new Date()), 'yyyy-MM-dd');
      return Array.from({ length: 7 }, (_, offset) => {
        const day = new Date(weekRange.since.getTime() + offset * 86_400_000);
        const key = format(day, 'yyyy-MM-dd');
        return {
          key,
          label: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(day),
          value: counts.get(key) ?? 0,
          current: key === todayKey,
        };
      });
    }, [summary.byDay]);

    if (loading && summary.completedCount === 0) {
      return <p className="reviewquiet">{t('common.loading')}</p>;
    }

    return (
      <div className="bento reviewbento">
        {/* What the week amounted to, and where the effort went inside it. */}
        <section className="card w12 reviewsummary">
          <div className="reviewsummary-figs">
            <span>
              <b>{summary.completedCount}</b>
              <small>{t('review.fig.finished')}</small>
            </span>
            <span>
              <b>{formatDuration(summary.completedMinutes, locale)}</b>
              <small>{t('review.fig.time')}</small>
            </span>
            <span>
              <b>{summary.focusScore}%</b>
              <small>{t('review.fig.focus')}</small>
            </span>
          </div>
          <SplitBar data={byPriority} />
          <p className="psub">{t('review.fig.focusNote')}</p>
        </section>

        <ChartCard
          title={t('review.chart.perDay')}
          span={6}
          trailing={<span className="kpi-label">{summary.completedCount}</span>}
        >
          <Bars
            data={byDay}
            height={140}
            emptyLabel={t('review.doneNone')}
            format={(value) => t('metrics.tasks', { count: value })}
          />
        </ChartCard>

        <ChartCard title={t('review.chart.byProject')} span={6}>
          <Donut
            data={byProject}
            limit={6}
            otherLabel={t('insights.otherProjects')}
            total={summary.completedCount}
            caption={t('insights.tasks')}
            emptyLabel={t('review.doneNone')}
          />
        </ChartCard>
      </div>
    );
  }

  function Quiet() {
    if (!step || step.projects.length === 0) return <Settled />;
    return (
      <div className="reviewlist">
        {step.projects.map((project) => (
          <div className="reviewrow project" key={project.id}>
            <button
              className="reviewname as-row"
              onClick={() => navigate('project', project.id)}
            >
              <span className="hash" style={markerStyle(project.color)}>#</span>
              <span className="ttitle">{project.name}</span>
            </button>
            <span className="reviewquiet">
              {t('review.quietFor', { days: QUIET_AFTER_DAYS })}
            </span>
          </div>
        ))}
      </div>
    );
  }

  /** Nothing to settle. Which is the whole point of asking. */
  function Settled({ note }: { note?: string }) {
    return (
      <div className="reviewclear">
        <span className="reviewclear-mark" aria-hidden="true"><Icon name="check" /></span>
        <strong>{note ?? t('review.settled')}</strong>
        <span>{t(`review.clear.${step?.id ?? 'overdue'}` as TranslationKey)}</span>
      </div>
    );
  }

  function Done() {
    return (
      <section className="reviewdone">
        <span className="reviewdone-mark" aria-hidden="true"><Icon name="check" /></span>
        <h2>{t('review.doneTitle')}</h2>
        <p>{t(`review.doneBody.${cadence}` as TranslationKey)}</p>
        <div className="reviewdone-actions">
          <button className="btn primary" onClick={() => navigate('week')}>
            {t('nav.week')}
          </button>
          <button
            className="btn quiet"
            onClick={() => { setIndex(0); setFinished(false); }}
          >
            {t('review.again')}
          </button>
        </div>
      </section>
    );
  }
}
