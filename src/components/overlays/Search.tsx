import { useMemo, useState } from 'react';
import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { navigate } from '@/hooks/useRoute';

interface SearchProps {
  open: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
}

/** Global search across tasks, projects and tags, run over the local mirror. */
export function Search({ open, onClose, onOpen }: SearchProps) {
  const { t } = useT();
  const { snapshot, items } = useData();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { tasks: [], projects: [], labels: [] };

    return {
      tasks: items
        .filter((i) =>
          i.content.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
        .slice(0, 12),
      projects: Object.values(snapshot.projects)
        .filter((p) => !p.is_archived && !p.is_deleted && p.name.toLowerCase().includes(q))
        .slice(0, 6),
      labels: Object.values(snapshot.labels)
        .filter((l) => l.name.toLowerCase().includes(q) && !l.name.startsWith('est-'))
        .slice(0, 6),
    };
  }, [query, items, snapshot]);

  const empty = query.trim() !== '' &&
    results.tasks.length === 0 && results.projects.length === 0 && results.labels.length === 0;

  return (
    <Overlay open={open} onClose={onClose} label={t('nav.search')} size="search">
      <div className="searchfield">
        <Icon name="search" />
        <input
          type="search"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('nav.search')}
        />
        <kbd>Esc</kbd>
      </div>

      <div className="sresults">
        {query.trim() === '' && (
          <>
            <h4>{t('search.quickAccess')}</h4>
            <button onClick={() => { navigate('week'); onClose(); }}>
              <Icon name="week" />
              <span><strong>{t('nav.week')}</strong></span>
            </button>
            <button onClick={() => { navigate('upcoming'); onClose(); }}>
              <Icon name="upcoming" />
              <span><strong>{t('nav.upcoming')}</strong></span>
            </button>
            <button onClick={() => { navigate('dashboard'); onClose(); }}>
              <Icon name="dashboard" />
              <span><strong>{t('nav.dashboard')}</strong></span>
            </button>
          </>
        )}

        {results.tasks.length > 0 && (
          <>
            <h4>{t('search.tasks')}</h4>
            {results.tasks.map((item) => (
              <button key={item.id} onClick={() => { onOpen(item.id); onClose(); }}>
                <Icon name="tasks" />
                <span>
                  <strong>{item.content}</strong>
                  <small>{snapshot.projects[item.project_id]?.name ?? ''}</small>
                </span>
              </button>
            ))}
          </>
        )}

        {results.projects.length > 0 && (
          <>
            <h4>{t('search.projects')}</h4>
            {results.projects.map((project) => (
              <button key={project.id} onClick={() => { navigate('project', project.id); onClose(); }}>
                <span className="hash">#</span>
                <span><strong>{project.name}</strong></span>
              </button>
            ))}
          </>
        )}

        {results.labels.length > 0 && (
          <>
            <h4>{t('search.labels')}</h4>
            {results.labels.map((label) => (
              <button key={label.id} onClick={() => { navigate('label', label.name); onClose(); }}>
                <Icon name="flag" />
                <span><strong>{label.name}</strong></span>
              </button>
            ))}
          </>
        )}

        {empty && <p className="empty">{t('search.noResults')}</p>}
      </div>
    </Overlay>
  );
}
