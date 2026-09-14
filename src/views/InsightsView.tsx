import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useCompleted, type Period } from '@/hooks/useCompleted';
import { rootItems } from '@/store/selectors';
import { summariseInsights } from '@/domain/insights';
import { formatDuration, estimateOf } from '@/domain/estimates';
import { somedayItems } from '@/domain/views';
import { formatRelativeDay } from '@/domain/dates';
import type { TranslationKey } from '@/i18n';

type Tab = 'overview' | 'logbook' | 'activity' | 'projects' | 'priorities' | 'estimates' | 'backlog';

/**
 * The full Insights space, in the spirit of Todoist Rewind: what was done,
 * when, on what, and whether the effort went where it mattered.
 */
export function InsightsView() {
  const { t, locale } = useT();
  const { snapshot, items } = useData();
  const [period, setPeriod] = useState<Period>('month');
  const [tab, setTab] = useState<Tab>('overview');
  const { data: completed, loading } = useCompleted(period, true);

  const roots = useMemo(() => rootItems(items), [items]);
  const summary = useMemo(
    () => summariseInsights(completed, roots, snapshot),
    [completed, roots, snapshot],
  );

  const maxDay = Math.max(1, ...summary.byDay.map((d) => d.count));
  const maxHour = Math.max(1, ...summary.byHour);
  const maxProject = Math.max(1, ...summary.byProject.map((p) => p.count));
  const backlog = useMemo(() => somedayItems(roots), [roots]);

  const tabs: Tab[] = [
    'overview', 'logbook', 'activity', 'projects', 'priorities', 'estimates', 'backlog',
  ];
  const tabKey: Record<Tab, TranslationKey> = {
    overview: 'insights.overview',
    logbook: 'insights.logbook',
    activity: 'insights.activity',
    projects: 'insights.projects',
    priorities: 'insights.priorities',
    estimates: 'insights.estimates',
    backlog: 'insights.backlog',
  };

  return (
    <div className="page wide">
      <div className="phead">
        <div>
          <h1 className="ptitle">{t('insights.title')}</h1>
          <p className="psub">{t('insights.focusExplainer')}</p>
        </div>
        <div className="pactions">
          {(['week', 'month', 'quarter', 'year'] as const).map((value) => (
            <button
              key={value}
              className={`btn${period === value ? ' primary' : ''}`}
              onClick={() => setPeriod(value)}
            >
              {t(`insights.period.${value}` as TranslationKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {tabs.map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {t(tabKey[value])}
          </button>
        ))}
      </div>

      {loading && <p className="empty">{t('insights.loading')}</p>}

      {!loading && tab === 'overview' && (
        <div className="bento">
          <section className="card w4">
            <div className="kpi-label">{t('insights.completedTasks')}</div>
            <div className="kpi-value">{summary.completedCount}</div>
          </section>
          <section className="card w4">
            <div className="kpi-label">{t('insights.completedTime')}</div>
            <div className="kpi-value">{formatDuration(summary.completedMinutes, locale)}</div>
            {summary.completedWithoutEstimate > 0 && (
              <p className="psub">
                {t('metrics.unestimated', { count: summary.completedWithoutEstimate })}
              </p>
            )}
          </section>
          <section className="card w4">
            <div className="kpi-label">{t('insights.focusScore')}</div>
            <div className="kpi-value">{summary.focusScore}%</div>
          </section>
          <section className="card w4">
            <div className="kpi-label">{t('insights.activeDays')}</div>
            <div className="kpi-value">{summary.activeDays}</div>
            <p className="psub">{t('insights.streak', { count: summary.currentStreak })}</p>
          </section>
          <section className="card w4">
            <div className="kpi-label">{t('insights.coverage')}</div>
            <div className="kpi-value">{summary.estimateCoverage}%</div>
          </section>
          <section className="card w4">
            <div className="kpi-label">{t('insights.active')}</div>
            <div className="kpi-value">{summary.activeCount}</div>
          </section>
        </div>
      )}

      {!loading && tab === 'activity' && (
        <div className="bento">
          <section className="card w12">
            <div className="chead-row"><div><h3>{t('insights.weekActivity')}</h3></div></div>
            {summary.byDay.length === 0 ? (
              <p className="empty">{t('insights.noHistory')}</p>
            ) : (
              <>
                <div className="bars">
                  {summary.byDay.map((day) => (
                    <i
                      className="fill"
                      key={day.date}
                      title={`${day.date}: ${day.count}`}
                      style={{ height: `${Math.round((day.count / maxDay) * 100)}%` }}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
          <section className="card w12">
            <div className="chead-row"><div><h3>{t('insights.activity')}</h3></div></div>
            <div className="bars">
              {summary.byHour.map((count, hour) => (
                <i
                  className="fill"
                  key={hour}
                  title={`${hour}h: ${count}`}
                  style={{ height: `${Math.round((count / maxHour) * 100)}%` }}
                />
              ))}
            </div>
            <div className="barlabels">
              {summary.byHour.map((_, hour) => (
                <span key={hour}>{hour % 6 === 0 ? hour : ''}</span>
              ))}
            </div>
          </section>
        </div>
      )}

      {!loading && tab === 'projects' && (
        <div className="bento">
          <section className="card w12">
            <div className="chead-row"><div><h3>{t('insights.byProject')}</h3></div></div>
            {summary.byProject.length === 0 ? (
              <p className="empty">{t('insights.noHistory')}</p>
            ) : (
              summary.byProject.map((project) => (
                <div className="prow" key={project.projectId}>
                  <span>{project.name}</span>
                  <span className="bar">
                    <i style={{ width: `${Math.round((project.count / maxProject) * 100)}%` }} />
                  </span>
                  <b>{project.count}</b>
                </div>
              ))
            )}
          </section>
        </div>
      )}

      {!loading && tab === 'priorities' && (
        <div className="bento">
          <section className="card w12">
            <div className="chead-row"><div><h3>{t('insights.byPriority')}</h3></div></div>
            <div className="priolines">
              {([1, 2, 3, 4] as const).map((p) => {
                const value = summary.priorities[`p${p}` as 'p1'];
                const max = Math.max(1, summary.priorities.p1, summary.priorities.p2, summary.priorities.p3, summary.priorities.p4);
                return (
                  <div className="prioline" key={p}>
                    <span>P{p}</span>
                    <i style={{ '--pc': `var(--p${p})`, '--pv': `${Math.round((value / max) * 100)}%` } as React.CSSProperties} />
                    <b>{value}</b>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {!loading && tab === 'estimates' && (
        <div className="bento">
          <section className="card w6">
            <div className="kpi-label">{t('insights.coverage')}</div>
            <div className="kpi-value">{summary.estimateCoverage}%</div>
            <p className="psub">
              {t('metrics.unestimated', {
                count: roots.filter((i) => estimateOf(i) === null).length,
              })}
            </p>
          </section>
          <section className="card w6">
            <div className="kpi-label">{t('insights.remaining')}</div>
            <div className="kpi-value">
              {formatDuration(
                roots.reduce((acc, i) => acc + (estimateOf(i) ?? 0), 0),
                locale,
              )}
            </div>
          </section>
        </div>
      )}

      {!loading && tab === 'backlog' && (
        <div className="bento">
          <section className="card w12">
            <div className="chead-row">
              <div>
                <h3>{t('insights.backlog')}</h3>
                <p className="psub">{t('someday.subtitle')}</p>
              </div>
              <span className="kpi-label">{t('metrics.tasks', { count: backlog.length })}</span>
            </div>
            {backlog.slice(0, 25).map((item) => (
              <div className="prow" key={item.id}>
                <span>{item.content}</span>
                <span className="psub">{snapshot.projects[item.project_id]?.name ?? ''}</span>
                <b>{estimateOf(item) !== null ? formatDuration(estimateOf(item)!, locale) : '—'}</b>
              </div>
            ))}
          </section>
        </div>
      )}

      {!loading && tab === 'logbook' && (
        <div className="bento">
          <section className="card w12">
            <div className="chead-row">
              <div><h3>{t('insights.logbook')}</h3></div>
              <span className="kpi-label">{t('metrics.tasks', { count: completed.length })}</span>
            </div>
            {completed.length === 0 ? (
              <p className="empty">{t('insights.noHistory')}</p>
            ) : (
              completed.slice(0, 120).map((task) => (
                <div className="prow" key={`${task.id}-${task.completed_at}`}>
                  <span>
                    <Icon name="check" size="sm" /> {task.content}
                  </span>
                  <span className="psub">{snapshot.projects[task.project_id]?.name ?? ''}</span>
                  <b>{formatRelativeDay(new Date(task.completed_at), locale)}</b>
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </div>
  );
}
