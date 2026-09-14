import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { useT } from '@/hooks/useT';
import { formatDuration } from '@/domain/estimates';
import type { LoadSummary } from '@/domain/load';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  load: LoadSummary;
  /** Opens the list of tasks on this page that have no estimate. */
  onOpenUnestimated?: () => void;
}

/**
 * The line every page shares: what this page is, how much is on it, and
 * whether that fits. The percentage only appears where capacity means
 * something, which the caller decides by passing it or not.
 */
export function PageHeader({
  title, subtitle, load, onOpenUnestimated,
}: PageHeaderProps) {
  const { t, locale } = useT();

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="ptitle">{title}</h1>
          {subtitle && <p className="psub">{subtitle}</p>}
        </div>

      </div>

      <div className="metrics">
        <span className="metric">
          <Icon name="tasks" size="sm" />
          <b>{load.taskCount}</b> {t('metrics.taskWord', { count: load.taskCount })}
        </span>

        {load.estimatedMinutes > 0 && (
          <>
            <span className="sep">·</span>
            <span className="metric">
              <Icon name="clock" size="sm" />
              <b>{formatDuration(load.estimatedMinutes, locale)}</b>{' '}
              {t('metrics.estimatedWord')}
            </span>
          </>
        )}

        {load.percentage !== null && (
          <>
            <span className="sep">·</span>
            <span
              className={`loadpill ${load.level === 'ok' ? 'ok' : load.level === 'tight' ? 'warn' : 'over'}`}
              title={t('metrics.loadTooltip')}
            >
              {load.percentage}%
            </span>
          </>
        )}

        {load.unestimatedCount > 0 && (
          <>
            <span className="sep">·</span>
            {onOpenUnestimated ? (
              <button
                className="metric metric-link"
                onClick={onOpenUnestimated}
                title={t('issues.toComplete')}
              >
                {t('metrics.unestimated', { count: load.unestimatedCount })}
              </button>
            ) : (
              <span className="metric" style={{ color: 'var(--faint)' }}>
                {t('metrics.unestimated', { count: load.unestimatedCount })}
              </span>
            )}
          </>
        )}
      </div>
    </>
  );
}
