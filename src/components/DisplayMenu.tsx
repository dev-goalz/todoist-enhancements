import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
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

const GROUP_ICON: Record<GroupKey, IconName> = {
  none: 'list',
  scheduled: 'calendar',
  day: 'calendar',
  week: 'week',
  month: 'calendar',
  workspace: 'stack',
  project: 'project',
  section: 'group',
  priority: 'flag',
  label: 'flag',
  estimate: 'clock',
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
                aria-label={t(`toolbar.${mode}` as TranslationKey)}
                onClick={() => setViewPrefs(viewKey, { mode })}
              >
                <Icon name={MODE_ICON[mode]} size="lg" />
                <small>{t(`toolbar.${mode}` as TranslationKey)}</small>
              </button>
            ))}
          </div>

          <hr />
          <h5>{t('toolbar.sort')}</h5>

          <label className="selectrow">
            <span>{t('toolbar.group')}</span>
            <span className="selectwrap">
              <Icon name={GROUP_ICON[current.group]} size="sm" />
              <select
                value={current.group}
                onChange={(e) => setViewPrefs(viewKey, { group: e.target.value as GroupKey })}
              >
                {groups.map((group) => (
                  <option key={group} value={group}>
                    {t(`group.${group}` as TranslationKey)}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="selectrow">
            <span>{t('toolbar.sortBy')}</span>
            <span className="selectwrap">
              <Icon name="sort" size="sm" />
              <select
                value={current.sort}
                onChange={(e) => setViewPrefs(viewKey, { sort: e.target.value as SortKey })}
              >
                {sorts.map((sort) => (
                  <option key={sort} value={sort}>
                    {t(`sort.${sort}` as TranslationKey)}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <hr />
          <h5>{t('toolbar.filter')}</h5>

          <fieldset className="checkgroup">
            <legend>{t('filter.priorities')}</legend>
            {([1, 2, 3, 4] as const).map((p) => (
              <label className="checkrow" key={p}>
                <input
                  type="checkbox"
                  checked={current.filters.priorities.includes(p)}
                  onChange={() =>
                    setFilters({ priorities: toggleIn(current.filters.priorities, p as DisplayPriority) })
                  }
                />
                <span className="flagdot" style={{ background: `var(--p${p})` }} />
                <span>P{p}</span>
              </label>
            ))}
          </fieldset>

          {tags.length > 0 && (
            <fieldset className="checkgroup">
              <legend>{t('filter.labels')}</legend>
              <div className="checkscroll">
                {tags.map((label) => (
                  <label className="checkrow" key={label.id}>
                    <input
                      type="checkbox"
                      checked={current.filters.labels.includes(label.name)}
                      onChange={() => setFilters({ labels: toggleIn(current.filters.labels, label.name) })}
                    />
                    <Icon name="flag" size="sm" className="taglabel" />
                    <span style={markerStyle(label.color, false)}>{label.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="checkgroup">
            <legend>{t('filter.estimated')}</legend>
            <label className="checkrow">
              <input
                type="checkbox"
                checked={current.filters.estimated === true}
                onChange={() =>
                  setFilters({ estimated: current.filters.estimated === true ? null : true })
                }
              />
              <span>{t('filter.estimatedOnly')}</span>
            </label>
            <label className="checkrow">
              <input
                type="checkbox"
                checked={current.filters.estimated === false}
                onChange={() =>
                  setFilters({ estimated: current.filters.estimated === false ? null : false })
                }
              />
              <span>{t('filter.unestimatedOnly')}</span>
            </label>
          </fieldset>

          <fieldset className="checkgroup">
            <legend>{t('toolbar.options')}</legend>
            <label className="checkrow">
              <input
                type="checkbox"
                checked={current.filters.includeScheduled}
                onChange={() => setFilters({ includeScheduled: !current.filters.includeScheduled })}
              />
              <span>{t('filter.includeScheduled')}</span>
            </label>
            <label className="checkrow">
              <input
                type="checkbox"
                checked={current.filters.showSubtasks}
                onChange={() => setFilters({ showSubtasks: !current.filters.showSubtasks })}
              />
              <span>{t('filter.showSubtasks')}</span>
            </label>
          </fieldset>
        </div>
      )}
    </div>
  );
}
