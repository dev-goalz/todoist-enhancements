import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { viewPrefs } from '@/store/prefs';
import { countActiveFilters } from '@/store/selectors';
import { defaultFilters, type DisplayMode, type GroupKey, type SortKey } from '@/domain/types';
import type { TranslationKey } from '@/i18n';

interface ToolbarProps {
  viewKey: string;
  /** Only the modes that make sense on this page are offered. */
  modes: DisplayMode[];
  groups: GroupKey[];
  onInsights: () => void;
}

export function Toolbar({ viewKey, modes, groups, onInsights }: ToolbarProps) {
  const { t } = useT();
  const prefs = useStore((s) => s.prefs);
  const setViewPrefs = useStore((s) => s.setViewPrefs);
  const snapshot = useStore((s) => s.snapshot);
  const current = viewPrefs(prefs, viewKey);
  const [open, setOpen] = useState<'group' | 'sort' | 'filter' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sorts: SortKey[] = [
    'manual', 'priority', 'due', 'added', 'alphabetical', 'estimate-asc', 'estimate-desc',
  ];
  const activeFilters = countActiveFilters(current.filters);
  const modeIcon = { list: 'list', board: 'board', focus: 'stack', calendar: 'calendar' } as const;

  return (
    <div className="toolbar" ref={ref}>
      <button
        className={`btn${current.group === 'none' ? ' dashed' : ''}`}
        aria-expanded={open === 'group'}
        onClick={() => setOpen(open === 'group' ? null : 'group')}
      >
        <Icon name="group" />
        {current.group === 'none' ? t('toolbar.group') : t(`group.${current.group}` as TranslationKey)}
      </button>

      <button
        className="btn"
        aria-expanded={open === 'filter'}
        onClick={() => setOpen(open === 'filter' ? null : 'filter')}
      >
        <Icon name="filter" />
        {activeFilters > 0 ? t('filter.active', { count: activeFilters }) : t('toolbar.filter')}
      </button>

      <button
        className="btn"
        aria-expanded={open === 'sort'}
        onClick={() => setOpen(open === 'sort' ? null : 'sort')}
      >
        <Icon name="sort" />
        {current.sort === 'manual' ? t('toolbar.sort') : t(`sort.${current.sort}` as TranslationKey)}
      </button>

      <span className="spacer" />

      {modes.length > 1 && (
        <div className="modeswitch" role="group">
          {modes.map((mode) => (
            <button
              key={mode}
              aria-pressed={current.mode === mode}
              onClick={() => setViewPrefs(viewKey, { mode })}
            >
              <Icon name={modeIcon[mode]} size="sm" />
              {t(`toolbar.${mode}` as TranslationKey)}
            </button>
          ))}
        </div>
      )}

      <button className="btn" onClick={onInsights}>
        <Icon name="trend" />
        {t('toolbar.insights')}
      </button>

      {open === 'group' && (
        <div className="popover" style={{ top: 40, left: 0 }}>
          <h5>{t('toolbar.group')}</h5>
          {groups.map((group) => (
            <button
              key={group}
              className="opt"
              role="menuitemradio"
              aria-checked={current.group === group}
              onClick={() => { setViewPrefs(viewKey, { group }); setOpen(null); }}
            >
              {t(`group.${group}` as TranslationKey)}
              {current.group === group && <Icon name="check" size="sm" />}
            </button>
          ))}
        </div>
      )}

      {open === 'sort' && (
        <div className="popover" style={{ top: 40, left: 0 }}>
          <h5>{t('toolbar.sort')}</h5>
          {sorts.map((sort) => (
            <button
              key={sort}
              className="opt"
              role="menuitemradio"
              aria-checked={current.sort === sort}
              onClick={() => { setViewPrefs(viewKey, { sort }); setOpen(null); }}
            >
              {t(`sort.${sort}` as TranslationKey)}
              {current.sort === sort && <Icon name="check" size="sm" />}
            </button>
          ))}
        </div>
      )}

      {open === 'filter' && (
        <div className="popover" style={{ top: 40, left: 0, minWidth: 280 }}>
          <h5>{t('filter.priorities')}</h5>
          <div className="optrow" style={{ gap: 6 }}>
            {([1, 2, 3, 4] as const).map((p) => {
              const active = current.filters.priorities.includes(p);
              return (
                <button
                  key={p}
                  className="btn sm"
                  aria-pressed={active}
                  style={active ? { borderColor: 'var(--accent)', color: 'var(--accent-dark)' } : undefined}
                  onClick={() =>
                    setViewPrefs(viewKey, {
                      filters: {
                        ...current.filters,
                        priorities: active
                          ? current.filters.priorities.filter((x) => x !== p)
                          : [...current.filters.priorities, p],
                      },
                    })
                  }
                >
                  P{p}
                </button>
              );
            })}
          </div>

          <hr />
          <h5>{t('filter.estimated')}</h5>
          {([null, true, false] as const).map((value) => (
            <button
              key={String(value)}
              className="opt"
              aria-checked={current.filters.estimated === value}
              role="menuitemradio"
              onClick={() =>
                setViewPrefs(viewKey, { filters: { ...current.filters, estimated: value } })
              }
            >
              {value === null
                ? t('filter.any')
                : value
                  ? t('filter.estimatedOnly')
                  : t('filter.unestimatedOnly')}
              {current.filters.estimated === value && <Icon name="check" size="sm" />}
            </button>
          ))}

          <hr />
          <h5>{t('filter.labels')}</h5>
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            {Object.values(snapshot.labels)
              .filter((l) => !l.name.startsWith('est-'))
              .map((label) => {
                const active = current.filters.labels.includes(label.name);
                return (
                  <button
                    key={label.id}
                    className="opt"
                    aria-checked={active}
                    role="menuitemcheckbox"
                    onClick={() =>
                      setViewPrefs(viewKey, {
                        filters: {
                          ...current.filters,
                          labels: active
                            ? current.filters.labels.filter((x) => x !== label.name)
                            : [...current.filters.labels, label.name],
                        },
                      })
                    }
                  >
                    {label.name}
                    {active && <Icon name="check" size="sm" />}
                  </button>
                );
              })}
          </div>

          <hr />
          <div className="optrow">
            <span>{t('filter.includeScheduled')}</span>
            <span
              className="switch"
              role="switch"
              tabIndex={0}
              aria-checked={current.filters.includeScheduled}
              onClick={() =>
                setViewPrefs(viewKey, {
                  filters: { ...current.filters, includeScheduled: !current.filters.includeScheduled },
                })
              }
            />
          </div>
          <div className="optrow">
            <span>{t('filter.showSubtasks')}</span>
            <span
              className="switch"
              role="switch"
              tabIndex={0}
              aria-checked={current.filters.showSubtasks}
              onClick={() =>
                setViewPrefs(viewKey, {
                  filters: { ...current.filters, showSubtasks: !current.filters.showSubtasks },
                })
              }
            />
          </div>

          <hr />
          <button
            className="opt"
            onClick={() => setViewPrefs(viewKey, { filters: defaultFilters() })}
          >
            {t('filter.clear')}
          </button>
        </div>
      )}
    </div>
  );
}
