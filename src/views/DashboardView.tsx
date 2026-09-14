import { useMemo } from 'react';
import { Icon } from '@/components/Icon';
import { TaskRow } from '@/components/TaskRow';
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
import { addDays, startOfDay } from 'date-fns';

interface DashboardViewProps {
  onOpen: (id: string) => void;
  onIssues: () => void;
}

/** One page answering: what is today, what is blocking, and how the week looks. */
export function DashboardView({ onOpen, onIssues }: DashboardViewProps) {
  const { t, locale } = useT();
  const { snapshot, items, childrenOf } = useData();
  const prefs = useStore((s) => s.prefs);
  const { data: completed } = useCompleted('week', true);

  const roots = useMemo(() => rootItems(items), [items]);
  const week = useMemo(() => weekItems(roots), [roots]);
  const groups = useMemo(() => groupWeek(week, new Date(), prefs.showQuickGroup), [week, prefs.showQuickGroup]);

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

  const deadlines = useMemo(() => {
    const limit = startOfDay(addDays(new Date(), 7));
    return roots
      .filter((i) => {
        const d = deadlineDate(i);
        return d !== null && d <= limit;
      })
      .sort((a, b) => (deadlineDate(a)!.getTime() - deadlineDate(b)!.getTime()))
      .slice(0, 6);
  }, [roots]);

  const projectProgress = useMemo(() => {
    const counts = new Map<string, { open: number; done: number; name: string }>();
    for (const item of roots) {
      const name = snapshot.projects[item.project_id]?.name ?? '—';
      const entry = counts.get(item.project_id) ?? { open: 0, done: 0, name };
      entry.open += 1;
      counts.set(item.project_id, entry);
    }
    for (const task of completed) {
      const entry = counts.get(task.project_id);
      if (entry) entry.done += 1;
    }
    return [...counts.entries()]
      .map(([id, value]) => ({
        id,
        name: value.name,
        percentage: value.open + value.done > 0
          ? Math.round((value.done / (value.open + value.done)) * 100)
          : 0,
        open: value.open,
      }))
      .sort((a, b) => b.open - a.open)
      .slice(0, 6);
  }, [roots, completed, snapshot.projects]);

  const maxDay = Math.max(1, ...summary.byDay.slice(-7).map((d) => d.count));

  return (
    <div className="page wide">
      <div className="phead">
        <div>
          <h1 className="ptitle">{t('dashboard.title')}</h1>
          <p className="psub">{t('week.subtitle')}</p>
        </div>
        <div className="pactions">
          <button className="btn" onClick={() => navigate('insights')}>
            <Icon name="trend" />
            {t('insights.openFull')}
          </button>
        </div>
      </div>

      <div className="bento">
        <section className="card w8">
          <div className="chead-row">
            <div>
              <h3>{t('dashboard.today')}</h3>
              <p className="psub">
                {t('metrics.tasks', { count: todayLoad.taskCount })} ·{' '}
                {formatDuration(todayLoad.estimatedMinutes, locale)} {t('metrics.estimatedWord')} ·{' '}
                {formatDuration(todayCapacity, locale)}
              </p>
            </div>
            {todayLoad.percentage !== null && (
              <span className={`loadpill ${todayLoad.level === 'ok' ? 'ok' : todayLoad.level === 'tight' ? 'warn' : 'over'}`}>
                {todayLoad.percentage}%
              </span>
            )}
          </div>
          <div className="focuslist">
            {todayItems.slice(0, 6).map((item) => (
              <TaskRow key={item.id} item={item} childrenOf={childrenOf} onOpen={onOpen} />
            ))}
            {todayItems.length === 0 && <p className="empty">{t('task.noTasks')}</p>}
          </div>
        </section>

        <section className="card w4">
          <div className="chead-row">
            <div>
              <h3>{t('dashboard.needsAttention')}</h3>
              <p className="psub">{t('issues.conflictsIntro')}</p>
            </div>
          </div>
          <div className="attn-list">
            <button className="attn" onClick={onIssues}>
              <span className="attn-n">{conflicts.length}</span>
              <span>{t('issues.tabConflicts')}</span>
            </button>
            <button className="attn" onClick={onIssues}>
              <span className="attn-n">{unestimated.length}</span>
              <span>{t('issues.tabToComplete')}</span>
            </button>
            <button className="attn" onClick={() => navigate('week')}>
              <span className="attn-n">{groups.overdue.length}</span>
              <span>{t('group.overdue')}</span>
            </button>
          </div>
        </section>

        <section className="card w6">
          <div className="chead-row">
            <div>
              <h3>{t('dashboard.weekLoad')}</h3>
              <p className="psub">{t('metrics.loadTooltip')}</p>
            </div>
            {weekLoad.percentage !== null && (
              <span className={`loadpill ${weekLoad.level === 'ok' ? 'ok' : weekLoad.level === 'tight' ? 'warn' : 'over'}`}>
                {weekLoad.percentage}%
              </span>
            )}
          </div>
          <div className="bar">
            <i
              className={weekLoad.level === 'tight' ? 'warn' : weekLoad.level === 'over' ? 'over' : ''}
              style={{ width: `${Math.min(100, weekLoad.percentage ?? 0)}%` }}
            />
          </div>
          <p className="psub" style={{ marginTop: 'var(--s2)' }}>
            {formatDuration(weekLoad.estimatedMinutes, locale)} ·{' '}
            {t('metrics.unestimated', { count: weekLoad.unestimatedCount })}
          </p>
        </section>

        <section className="card w6">
          <div className="chead-row">
            <div>
              <h3>{t('dashboard.momentum')}</h3>
              <p className="psub">{t('insights.weekActivity')}</p>
            </div>
            <span className="kpi-label">
              {t('metrics.tasks', { count: summary.completedCount })}
            </span>
          </div>
          <div className="bars">
            {summary.byDay.slice(-7).map((day) => (
              <i className="fill" key={day.date} style={{ height: `${Math.round((day.count / maxDay) * 100)}%` }} />
            ))}
          </div>
          <div className="barlabels">
            {summary.byDay.slice(-7).map((day) => (
              <span key={day.date}>
                {new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short' })
                  .format(new Date(day.date))}
              </span>
            ))}
          </div>
        </section>

        <section className="card w6">
          <div className="chead-row">
            <div><h3>{t('dashboard.projectProgress')}</h3></div>
          </div>
          {projectProgress.map((project) => (
            <button
              className="prow"
              key={project.id}
              onClick={() => navigate('project', project.id)}
            >
              <span>{project.name}</span>
              <span className="bar" style={{ flex: 1 }}>
                <i style={{ width: `${project.percentage}%` }} />
              </span>
              <b>{project.percentage}%</b>
            </button>
          ))}
        </section>

        <section className="card w6">
          <div className="chead-row">
            <div>
              <h3>{t('dashboard.deadlines')}</h3>
              <p className="psub">{t('insights.period.week')}</p>
            </div>
          </div>
          {deadlines.length === 0 ? (
            <p className="empty">{t('dashboard.noDeadlines')}</p>
          ) : (
            deadlines.map((item) => {
              const d = deadlineDate(item)!;
              const { minutes } = effectiveEstimate(item, childrenOf);
              return (
                <button className="prow" key={item.id} onClick={() => onOpen(item.id)}>
                  <span>{item.content}</span>
                  <span className="deadline">{formatRelativeDay(d, locale)}</span>
                  {minutes !== null && <b>{formatDuration(minutes, locale)}</b>}
                </button>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
