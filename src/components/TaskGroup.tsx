import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { TaskRow } from './TaskRow';
import { useT } from '@/hooks/useT';
import { formatDuration, effectiveEstimate } from '@/domain/estimates';
import type { Item } from '@/domain/types';

interface TaskGroupProps {
  title?: string;
  items: Item[];
  childrenOf: (id: string) => Item[];
  onOpen: (id: string) => void;
  /** Extra visual weight for Behind schedule and Quick. */
  tint?: 'late' | 'quick';
  description?: string;
  actions?: ReactNode;
  showProject?: boolean;
  defaultCollapsed?: boolean;
}

export function TaskGroup({
  title, items, childrenOf, onOpen, tint, description, actions,
  showProject = true, defaultCollapsed = false,
}: TaskGroupProps) {
  const { t, locale } = useT();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (items.length === 0) return null;

  const totalMinutes = items.reduce(
    (acc, item) => acc + (effectiveEstimate(item, childrenOf).minutes ?? 0),
    0,
  );

  const className = `group${tint === 'late' ? ' tinted-late' : tint === 'quick' ? ' tinted-quick' : ''}`;

  return (
    <section className={className}>
      {title && (
        <div className="ghead">
          <button
            className="gtoggle"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
          >
            <Icon name={collapsed ? 'caret' : 'caret-up'} size="sm" />
            <span className="gname">{title}</span>
            {totalMinutes > 0 && <span className="gtime">{formatDuration(totalMinutes, locale)}</span>}
          </button>
          {actions && <span className="gactions">{actions}</span>}
          <span className="gcount">{items.length}</span>
        </div>
      )}

      {description && !collapsed && <p className="gdesc">{description}</p>}

      {!collapsed &&
        items.map((item) => (
          <TaskRow
            key={item.id}
            item={item}
            childrenOf={childrenOf}
            onOpen={onOpen}
            showProject={showProject}
          />
        ))}

      {!collapsed && items.length === 0 && <p className="empty">{t('group.empty')}</p>}
    </section>
  );
}
