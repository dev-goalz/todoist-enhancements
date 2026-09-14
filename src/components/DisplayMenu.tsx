import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { Select } from './Select';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { viewPrefs } from '@/store/prefs';
import { countActiveFilters } from '@/store/selectors';
import {
  defaultFilters, type DisplayMode, type DisplayPriority,
  type GroupKey, type SortKey,
} from '@/domain/types';
import { markerStyle } from '@/domain/colors';
import type { TranslationKey } from '@/i18n';

interface DisplayMenuProps {
  viewKey: string;
  modes: DisplayMode[];
  groups: GroupKey[];
}

const MODE_ICON: Record<DisplayMode, IconName> = {
  list: 'list',
  board: 'board',
  calendar: 'calendar',
  focus: 'stack',
};

/**
 * One control for how a page is shown.
 *
 * Todoist puts presentation, grouping, sorting and filtering behind a single
 * "Display" button rather than a row of separate ones, and the count on the
 * button says how many choices differ from the defaults.
 */
export function DisplayMenu({ viewKey, modes, groups }: DisplayMenuProps) {
  const { t } = useT();
  const prefs = useStore((s) => s.prefs);
  const setViewPrefs = useStore((s) => s.setViewPrefs);
  const snapshot = useStore((s) => s.snapshot);
  const current = viewPrefs(prefs, viewKey);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
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

  // How many settings this view carries beyond the defaults.
  const changed =
    countActiveFilters(current.filters) +
    (current.group !== 'none' ? 1 : 0) +
    (current.sort !== 'manual' ? 1 : 0) +
    (current.mode !== 'list' ? 1 : 0);

  const tags = Object.values(snapshot.labels).filter((l) => !l.name.startsWith('est-'));

  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  const setFilters = (patch: Partial<typeof current.filters>) =>
    setViewPrefs(viewKey, { filters: { ...current.filters, ...patch } });

  return (
    <div className="displaywrap" ref={ref}>
      <button
        className="btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="sliders" />
        {t('toolbar.display')}
        {changed > 0 && <span className="displaycount">{changed}</span>}
      </button>

      {open && (
        <div className="popover displaypanel" role="dialog" aria-label={t('toolbar.display')}>
          <div className="panelhead">
            <h5>{t('toolbar.presentation')}</h5>
            <button
              className="resetbtn"
              onClick={() =>
                setViewPrefs(viewKey, {
                  mode: 'list', group: 'none', sort: 'manual', filters: defaultFilters(),
                })
              }
            >
              {t('toolbar.resetAll')}
            </button>
          </div>

          <div className="segmented">
            {modes.map((mode) => (
              <button
                key={mode}
                aria-pressed={current.mode === mode}
                title={t(`toolbar.${mode}` as TranslationKey)}
                onClick={() => setViewPrefs(viewKey, { mode })}
              >
                <Icon name={MODE_ICON[mode]} size="sm" />
                <small>{t(`toolbar.${mode}` as TranslationKey)}</small>
              </button>
            ))}
          </div>

          {/* Two questions, two selects, drawn the way every other select in
              the app is drawn. */}
          <div className="panelgrid">
            <Select
              label={t('toolbar.group')}
              value={current.group}
              onChange={(value) => setViewPrefs(viewKey, { group: value as GroupKey })}
              options={groups.map((group) => ({
                value: group,
                label: t(`group.${group}` as TranslationKey),
              }))}
            />
            <Select
              label={t('toolbar.sortBy')}
              value={current.sort}
              onChange={(value) => setViewPrefs(viewKey, { sort: value as SortKey })}
              options={sorts.map((sort) => ({
                value: sort,
                label: t(`sort.${sort}` as TranslationKey),
              }))}
            />
          </div>

          <hr />

          {/* Filters are toggles you can see the state of at a glance, rather
              than a column of checkboxes to read one by one. */}
          <h5>{t('filter.priorities')}</h5>
          <div className="chiprow">
            {([1, 2, 3, 4] as const).map((p) => (
              <button
                key={p}
                className="chip"
                aria-pressed={current.filters.priorities.includes(p)}
                onClick={() =>
                  setFilters({ priorities: toggleIn(current.filters.priorities, p as DisplayPriority) })
                }
              >
                <span className="flagdot" style={{ background: `var(--p${p})` }} />
                P{p}
              </button>
            ))}
          </div>

          {tags.length > 0 && (
            <>
              <h5>{t('filter.labels')}</h5>
              <div className="chiprow scroll">
                {tags.map((label) => (
                  <button
                    key={label.id}
                    className="chip"
                    aria-pressed={current.filters.labels.includes(label.name)}
                    onClick={() => setFilters({ labels: toggleIn(current.filters.labels, label.name) })}
                  >
                    <Icon name="tag" size="sm" style={markerStyle(label.color, false)} />
                    {label.name}
                  </button>
                ))}
              </div>
            </>
          )}

          <h5>{t('filter.estimated')}</h5>
          <div className="segmented small">
            {([null, true, false] as const).map((value) => (
              <button
                key={String(value)}
                aria-pressed={current.filters.estimated === value}
                onClick={() => setFilters({ estimated: value })}
              >
                <small>
                  {value === null
                    ? t('filter.any')
                    : value
                      ? t('filter.isEstimated')
                      : t('filter.isUnestimated')}
                </small>
              </button>
            ))}
          </div>

          <hr />
          <div className="panelrow">
            <span>{t('filter.includeScheduled')}</span>
            <button
              className="switch"
              role="switch"
              aria-checked={current.filters.includeScheduled}
              aria-label={t('filter.includeScheduled')}
              onClick={() => setFilters({ includeScheduled: !current.filters.includeScheduled })}
            />
          </div>
          <div className="panelrow">
            <span>{t('filter.showSubtasks')}</span>
            <button
              className="switch"
              role="switch"
              aria-checked={current.filters.showSubtasks}
              aria-label={t('filter.showSubtasks')}
              onClick={() => setFilters({ showSubtasks: !current.filters.showSubtasks })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
