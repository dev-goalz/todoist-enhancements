import { useMemo } from 'react';
import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useCompleted } from '@/hooks/useCompleted';
import { navigate } from '@/hooks/useRoute';
import { summariseInsights } from '@/domain/insights';
import { effectiveEstimate, formatDuration } from '@/domain/estimates';
import { isOverdue, overdueBy } from '@/domain/dates';
import type { Item } from '@/domain/types';

interface InsightsPanelProps {
  open: boolean;
  onClose: () => void;
  /** The page this panel is summarising, named so it never lies about scope. */
  contextLabel: string;
  items: Item[];
  onOpenTask: (id: string) => void;
}

/** The contextual Insights sheet, adapted to whichever page opened it. */
export function InsightsPanel({
  open, onClose, contextLabel, items, onOpenTask,
}: InsightsPanelProps) {
  const { t, locale } = useT();
  const { snapshot, childrenOf } = useData();
  const { data: completed, loading } = useCompleted('week', open);

  const summary = useMemo(
    () => summariseInsights(completed, items, snapshot),
    [completed, items, snapshot],
  );

  const late = useMemo(
    () => items.filter((i) => isOverdue(i)).sort((a, b) => overdueBy(b) - overdueBy(a)),
    [items],
  );

  const lateMinutes = late.reduce(
    (acc, item) => acc + (effectiveEstimate(item, childrenOf).minutes ?? 0),
    0,
  );

  const weekBars = useMemo(() => {
    const last7 = summary.byDay.slice(-7);
    const max = Math.max(1, ...last7.map((d) => d.count));
    return last7.map((d) => ({ ...d, height: Math.round((d.count / max) * 100) }));
  }, [summary.byDay]);

  const maxPriority = Math.max(
    1,
    summary.priorities.p1, summary.priorities.p2,
    summary.priorities.p3, summary.priorities.p4,
  );

  return (
    <Overlay open={open} onClose={onClose} label={t('insights.title')} variant="side">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--s4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--fs-20)', fontWeight: 700 }}>{t('insights.title')}</h2>
          <p className="psub">{contextLabel}</p>
        </div>
        <button className="iconbtn" aria-label={t('common.close')} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      {late.length > 0 && (
        <div className="icard late">
          <div className="ihead">
            <div className="ikicker">{t('insights.behindSchedule')}</div>
            <strong style={{ color: 'var(--accent)', fontSize: 'var(--fs-20)' }}>{late.length}</strong>
          </div>
          <div className="latelist">
            {late.slice(0, 4).map((item) => (
              <div key={item.id} onClick={() => { onOpenTask(item.id); onClose(); }} role="button" tabIndex={0}>
                <i />
                <span>{item.content}</span>
                <time>{overdueBy(item)}d</time>
              </div>
            ))}
          </div>
          {lateMinutes > 0 && (
            <p className="psub" style={{ marginTop: 'var(--s2)' }}>
              {formatDuration(lateMinutes, locale)}
            </p>
          )}
        </div>
      )}

      <div className="icard">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)' }}>
          <div className="ring" style={{ '--ring': `${summary.progressPercentage}%`, width: 88, height: 88 } as React.CSSProperties}>
            <div><strong style={{ fontSize: 'var(--fs-20)' }}>{summary.progressPercentage}%</strong></div>
          </div>
          <div className="ilist">
            <span><strong>{summary.completedCount}</strong> {t('insights.completed')}</span>
            <span><strong>{summary.activeCount}</strong> {t('insights.active')}</span>
            <span>{t('insights.streak', { count: summary.currentStreak })}</span>
          </div>
        </div>
      </div>

      <div className="icard">
        <div className="ihead">
          <div>
            <div className="ikicker">{t('insights.focusScore')}</div>
            <div className="ibig">{summary.focusScore}%</div>
          </div>
        </div>
        <div className="priolines">
          {([1, 2, 3, 4] as const).map((p) => {
            const value = summary.priorities[`p${p}` as 'p1'];
            return (
              <div className="prioline" key={p}>
                <span>P{p}</span>
                <i style={{ '--pc': `var(--p${p})`, '--pv': `${Math.round((value / maxPriority) * 100)}%` } as React.CSSProperties} />
                <b>{value}</b>
              </div>
            );
          })}
        </div>
        <p className="psub" style={{ marginTop: 'var(--s2)' }}>{t('insights.focusExplainer')}</p>
      </div>

      <div className="icard">
        <div className="ihead">
          <div>
            <div className="ikicker">{t('insights.weekActivity')}</div>
            <div className="ibig">
              {summary.completedCount}{' '}
              <span style={{ fontSize: 'var(--fs-12)', color: 'var(--muted)', fontWeight: 500 }}>
                {t('insights.completed')}
              </span>
            </div>
          </div>
        </div>
        {loading ? (
          <p className="psub">{t('insights.loading')}</p>
        ) : weekBars.length === 0 ? (
          <p className="psub">{t('insights.noHistory')}</p>
        ) : (
          <>
            <div className="bars" style={{ height: 88 }}>
              {weekBars.map((bar) => (
                <i className="fill" key={bar.date} style={{ height: `${bar.height}%` }} />
              ))}
            </div>
            <div className="barlabels">
              {weekBars.map((bar) => (
                <span key={bar.date}>
                  {new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short' })
                    .format(new Date(bar.date))}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="icard">
        <div className="ihead">
          <div>
            <div className="ikicker">{t('insights.coverage')}</div>
            <div className="ibig">{summary.estimateCoverage}%</div>
          </div>
        </div>
      </div>

      <button
        className="btn primary"
        style={{ width: '100%', minHeight: 40, marginTop: 'var(--s2)' }}
        onClick={() => { navigate('insights'); onClose(); }}
      >
        {t('insights.openFull')}
      </button>
    </Overlay>
  );
}
