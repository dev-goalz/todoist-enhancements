import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useCompleted } from '@/hooks/useCompleted';
import { useStore } from '@/store/store';
import { navigate } from '@/hooks/useRoute';
import { rootItems } from '@/store/selectors';
import { markerStyle } from '@/domain/colors';
import { formatDuration, effectiveEstimate } from '@/domain/estimates';
import { dueDate, formatRelativeDay } from '@/domain/dates';
import { summariseLoad, weeklyCapacity } from '@/domain/load';
import { rangeFor } from '@/domain/periods';
import { toDisplayPriority, type Item } from '@/domain/types';
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

interface ReviewViewProps {
  onOpen: (id: string) => void;
}

/**
 * The daily and weekly review.
 *
 * A planning tool is only as good as the habit of looking at it, and what
 * makes that hard is that looking at everything is exhausting. This asks one
 * question at a time, in an order, with an end: the late work, then the
 * unfiled, then what is actually committed, then what today holds. When the
 * last question is answered the review says so and stops.
 *
 * Every answer is a change Todoist already understands, made through the same
 * rules a drag makes, so a pass through here leaves nothing behind that the
 * official app would not recognise.
 */
export function ReviewView({ onOpen }: ReviewViewProps) {
  const { t, locale } = useT();
  const { snapshot, items, childrenOf } = useData();
  const prefs = useStore((s) => s.prefs);
  const [cadence, setCadence] = useState<ReviewCadence>('daily');
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  /* The weekly pass reports what was finished, which is history and is read
     on demand. The daily pass never asks, so it never fetches. */
  const weekRange = useMemo(
    () => rangeFor('week', 0, null, snapshot.user?.start_day ?? 1),
    [snapshot.user?.start_day],
  );
  const { data: completed } = useCompleted(weekRange, cadence === 'weekly');

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

  return (
    <div className="page review">
      <div className="phead">
        <div className="phead-text">
          <h1 className="ptitle">{t('review.title')}</h1>
          <div className="psub">{t(`review.intro.${cadence}` as TranslationKey)}</div>
        </div>
        <div className="pactions">
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
                {s.clear ? <Icon name="check" size="sm" /> : <b>{count(s)}</b>}
              </span>
              <span className="reviewpip-label">{t(`review.step.${s.id}` as TranslationKey)}</span>
            </button>
          </li>
        ))}
      </ol>

      {finished || !step ? (
        <Done cadence={cadence} onRestart={() => { setIndex(0); setFinished(false); }} />
      ) : (
        <>
          <section className="reviewstep" key={step.id}>
            <h2>{t(`review.step.${step.id}` as TranslationKey)}</h2>
            <p className="reviewask">{t(`review.ask.${step.id}` as TranslationKey)}</p>

            <StepBody step={step} onOpen={onOpen} />
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

  /** The number on a step's pip: how many things it is asking about. */
  function count(s: ReviewStep): number {
    return s.items.length + s.projects.length + s.completed.length;
  }

  function StepBody({ step: s, onOpen: open }: { step: ReviewStep; onOpen: (id: string) => void }) {
    if (s.id === 'today' || s.id === 'ahead') {
      return <Load step={s} />;
    }

    if (s.id === 'quiet') {
      if (s.projects.length === 0) return <Settled />;
      return (
        <div className="reviewlist">
          {s.projects.map((project) => (
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

    if (s.id === 'done') {
      if (s.completed.length === 0) return <Settled note={t('review.doneNone')} />;
      return (
        <>
          <p className="reviewtally">
            {t('review.doneCount', { count: s.completed.length })}
          </p>
          <div className="reviewlist">
            {s.completed.slice(0, 40).map((done) => {
              const project = snapshot.projects[done.project_id];
              return (
                <div className="reviewrow done" key={done.id}>
                  <span className="check done" aria-hidden="true"><Icon name="check" /></span>
                  <span className="reviewname as-text">
                    <span className="ttitle">{done.content}</span>
                  </span>
                  {project && !project.inbox_project && (
                    <span className="proj" style={markerStyle(project.color, false)}>
                      #{project.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      );
    }

    if (s.items.length === 0) return <Settled />;

    return (
      <div className="reviewlist">
        {s.items.map((item) => (
          <Row key={item.id} item={item} actions={s.actions} onOpen={open} />
        ))}
      </div>
    );
  }

  /** One decision, one row. */
  function Row({
    item, actions, onOpen: open,
  }: { item: Item; actions: ReviewAction[]; onOpen: (id: string) => void }) {
    const sendTo = useStore((s) => s.sendTo);
    const project = snapshot.projects[item.project_id];
    const { minutes } = effectiveEstimate(item, childrenOf);
    const due = dueDate(item);

    return (
      <div className="reviewrow">
        <span className={`check p${toDisplayPriority(item.priority)}`} aria-hidden="true">
          <Icon name="check" />
        </span>

        <button className="reviewname" onClick={() => open(item.id)}>
          <span className="ttitle">{item.content}</span>
          <span className="meta">
            {due && <span className="late"><Icon name="calendar" />{formatRelativeDay(due, locale)}</span>}
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

        {/* The whole review is these three buttons. Everything else is context
            for pressing one of them. */}
        <span className="reviewactions">
          {actions.map((action) => (
            <button
              key={action}
              className="btn quiet small"
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
      </div>
    );
  }

  /** The load steps report a number rather than asking for a decision. */
  function Load({ step: s }: { step: ReviewStep }) {
    const daily = prefs.dailyCapacity;
    const capacity = s.id === 'today'
      ? daily[new Date().getDay()]
      : weeklyCapacity(daily, prefs.weeklyCapacityOverride);
    const load = summariseLoad(s.items, childrenOf, capacity);

    return (
      <div className="reviewload">
        <div className="reviewload-fig">
          <b>{load.taskCount}</b>
          <small>{t('metrics.taskWord', { count: load.taskCount })}</small>
        </div>
        <div className="reviewload-fig">
          <b>{formatDuration(load.estimatedMinutes, locale)}</b>
          <small>{t('metrics.estimatedWord')}</small>
        </div>
        {load.percentage !== null && (
          <div className="reviewload-fig">
            <b className={`loadpill ${
              load.level === 'ok' ? 'ok' : load.level === 'tight' ? 'warn' : 'over'
            }`}>{load.percentage}%</b>
            <small>{t('review.ofCapacity')}</small>
          </div>
        )}
        {load.unestimatedCount > 0 && (
          <div className="reviewload-fig">
            <b>{load.unestimatedCount}</b>
            <small>{t('metrics.unestimatedWord')}</small>
          </div>
        )}
      </div>
    );
  }

  function Settled({ note }: { note?: string }) {
    return (
      <p className="reviewsettled">
        <Icon name="check" size="sm" />
        {note ?? t('review.settled')}
      </p>
    );
  }

  function Done({ cadence: c, onRestart }: { cadence: ReviewCadence; onRestart: () => void }) {
    return (
      <section className="reviewdone">
        <span className="reviewdone-mark" aria-hidden="true"><Icon name="check" /></span>
        <h2>{t('review.doneTitle')}</h2>
        <p>{t(`review.doneBody.${c}` as TranslationKey)}</p>
        <div className="reviewdone-actions">
          <button className="btn primary" onClick={() => navigate('week')}>
            {t('nav.week')}
          </button>
          <button className="btn quiet" onClick={onRestart}>{t('review.again')}</button>
        </div>
      </section>
    );
  }
}
