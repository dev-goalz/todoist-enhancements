import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Overlay } from './Overlay';
import { Icon, type IconName } from '../Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { navigate } from '@/hooks/useRoute';
import { markerStyle } from '@/domain/colors';

interface SearchProps {
  open: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
}

/** One row of the result list, whatever kind of thing it points at. */
interface Hit {
  key: string;
  heading?: string;
  icon?: IconName;
  marker?: ReactNode;
  title: string;
  detail?: string;
  run: () => void;
}

/**
 * Global search across tasks, projects and tags, run over the local mirror.
 *
 * The list is driven from the keyboard: the field keeps focus, the arrows move
 * a cursor through the results and Enter opens the one under it. A palette you
 * have to reach for the mouse in the middle of is not a palette.
 */
export function Search({ open, onClose, onOpen }: SearchProps) {
  const { t } = useT();
  const { snapshot, items } = useData();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { setQuery(''); setCursor(0); }
  }, [open]);

  const hits: Hit[] = useMemo(() => {
    const go = (run: () => void) => () => { run(); onClose(); };
    const q = query.trim().toLowerCase();

    if (!q) {
      return [
        { key: 'go-week', heading: t('search.quickAccess'), icon: 'week' as IconName,
          title: t('nav.week'), run: go(() => navigate('week')) },
        { key: 'go-upcoming', icon: 'upcoming' as IconName,
          title: t('nav.upcoming'), run: go(() => navigate('upcoming')) },
        { key: 'go-dashboard', icon: 'trend' as IconName,
          title: t('nav.dashboard'), run: go(() => navigate('dashboard')) },
        { key: 'go-logbook', icon: 'tasks' as IconName,
          title: t('insights.logbook'), run: go(() => navigate('insights', 'logbook')) },
        { key: 'go-settings', icon: 'settings' as IconName,
          title: t('nav.settings'), run: go(() => navigate('settings')) },
      ];
    }

    const tasks = items
      .filter((i) => i.content.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
      .slice(0, 12)
      .map((item, index): Hit => ({
        key: `task-${item.id}`,
        heading: index === 0 ? t('search.tasks') : undefined,
        icon: 'tasks',
        title: item.content,
        detail: snapshot.projects[item.project_id]?.name ?? '',
        run: go(() => onOpen(item.id)),
      }));

    const projects = Object.values(snapshot.projects)
      .filter((p) => !p.is_archived && !p.is_deleted && p.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((project, index): Hit => ({
        key: `project-${project.id}`,
        heading: index === 0 ? t('search.projects') : undefined,
        marker: <span className="hash" style={markerStyle(project.color)}>#</span>,
        title: project.name,
        run: go(() => navigate('project', project.id)),
      }));

    const labels = Object.values(snapshot.labels)
      .filter((l) => l.name.toLowerCase().includes(q) && !l.name.startsWith('est-'))
      .slice(0, 6)
      .map((label, index): Hit => ({
        key: `label-${label.id}`,
        heading: index === 0 ? t('search.labels') : undefined,
        icon: 'tag',
        title: label.name,
        run: go(() => navigate('label', label.name)),
      }));

    return [...tasks, ...projects, ...labels];
  }, [query, items, snapshot, onOpen, onClose, t]);

  // A new query invalidates wherever the cursor was.
  useEffect(() => { setCursor(0); }, [query]);

  // Keep the row under the cursor on screen while the arrows move it.
  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const empty = query.trim() !== '' && hits.length === 0;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (hits.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => (c + 1) % hits.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => (c - 1 + hits.length) % hits.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      hits[Math.min(cursor, hits.length - 1)]?.run();
    }
  };

  return (
    <Overlay open={open} onClose={onClose} label={t('nav.search')} size="search">
      <div className="searchfield">
        <Icon name="search" />
        <input
          type="search"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={t('nav.search')}
          aria-activedescendant={hits[cursor]?.key}
          autoFocus
        />
        <kbd>Esc</kbd>
      </div>

      <div className="sresults" ref={listRef} role="listbox">
        {hits.map((hit, index) => (
          <div key={hit.key}>
            {hit.heading && <h4>{hit.heading}</h4>}
            <button
              id={hit.key}
              role="option"
              aria-selected={index === cursor}
              onMouseEnter={() => setCursor(index)}
              onClick={hit.run}
            >
              {hit.marker ?? (hit.icon && <Icon name={hit.icon} />)}
              <span>
                <strong>{hit.title}</strong>
                {hit.detail && <small>{hit.detail}</small>}
              </span>
            </button>
          </div>
        ))}

        {empty && <p className="empty">{t('search.noResults')}</p>}
      </div>

      <div className="searchfoot">
        <span><kbd>↑</kbd><kbd>↓</kbd> {t('search.hintMove')}</span>
        <span><kbd>↵</kbd> {t('search.hintOpen')}</span>
      </div>
    </Overlay>
  );
}
