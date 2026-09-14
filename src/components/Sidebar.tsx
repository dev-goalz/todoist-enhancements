import { useMemo, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import { navigate, type Route } from '@/hooks/useRoute';
import { projectCounts, projectsByWorkspace, rootItems } from '@/store/selectors';
import { hasLabel, somedayItems, upcomingItems, weekItems } from '@/domain/views';
import { markerStyle, avatarUrl } from '@/domain/colors';
import type { ViewId } from '@/domain/types';
import type { DropTarget } from '@/domain/dnd';
import { SyncStatus } from './SyncStatus';
import { Droppable } from './dnd/Droppable';

interface SidebarProps {
  route: Route;
  onAddTask: () => void;
  onSearch: () => void;
  onIssues: () => void;
  onAddProject: () => void;
  issuesCount: number;
}

export function Sidebar({
  route, onAddTask, onSearch, onIssues, onAddProject, issuesCount,
}: SidebarProps) {
  const { t } = useT();
  const { snapshot, items } = useData();
  const collapsed = useStore((s) => s.prefs.sidebarCollapsed);
  const setPrefs = useStore((s) => s.setPrefs);
  const disconnect = useStore((s) => s.disconnect);
  const [menuOpen, setMenuOpen] = useState(false);

  const roots = useMemo(() => rootItems(items), [items]);

  const counts = useMemo(() => {
    const inboxId = snapshot.user?.inbox_project_id;
    return {
      inbox: inboxId ? roots.filter((i) => i.project_id === inboxId).length : 0,
      week: weekItems(roots).length,
      upcoming: upcomingItems(roots).length,
      someday: somedayItems(roots).length,
      byProject: projectCounts(roots),
    };
  }, [roots, snapshot.user?.inbox_project_id]);

  /** Favourites come from Todoist itself: the star set on a label or a project. */
  const favourites = useMemo(() => {
    const labels = Object.values(snapshot.labels)
      .filter((l) => l.is_favorite && !l.name.startsWith('est-'))
      .sort((a, b) => a.item_order - b.item_order);
    const projects = Object.values(snapshot.projects)
      .filter((p) => p.is_favorite && !p.is_archived && !p.is_deleted)
      .sort((a, b) => a.child_order - b.child_order);
    return { labels, projects };
  }, [snapshot.labels, snapshot.projects]);

  const workspaces = useMemo(() => projectsByWorkspace(snapshot), [snapshot]);
  const user = snapshot.user;
  const avatar = avatarUrl(user);
  const initials = (user?.full_name ?? '?')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  if (collapsed) {
    return (
      <div className="expand-wrap">
        <button
          className="iconbtn"
          aria-label={t('nav.showSidebar')}
          onClick={() => setPrefs({ sidebarCollapsed: false })}
        >
          <Icon name="sidebar" />
        </button>
      </div>
    );
  }

  const navItem = (
    view: ViewId,
    icon: IconName,
    labelKey: Parameters<typeof t>[0],
    count: number,
    dropTarget?: DropTarget,
  ) => {
    const button = (isOver: boolean) => (
      <button
        className={`navitem${isOver ? ' dropping' : ''}`}
        aria-current={route.view === view ? 'page' : undefined}
        onClick={() => navigate(view)}
      >
        <Icon name={icon} />
        <span className="label">{t(labelKey)}</span>
        {count > 0 && <span className="count">{count}</span>}
      </button>
    );
    if (!dropTarget) return button(false);
    return <Droppable target={dropTarget}>{({ isOver }) => button(isOver)}</Droppable>;
  };

  const tagItem = (name: string, color: string, count?: number) => (
    <Droppable target={{ kind: 'label', label: name }} key={name}>
      {({ isOver }) => (
        <button
          className={`navitem${isOver ? ' dropping' : ''}`}
          aria-current={route.view === 'label' && route.id === name ? 'page' : undefined}
          onClick={() => navigate('label', name)}
        >
          {/* One label glyph, tinted with the colour the tag carries in Todoist. */}
          <Icon name="flag" className="taglabel" />
          <span className="label" style={markerStyle(color, false)}>{name}</span>
          {count !== undefined && count > 0 && <span className="count">{count}</span>}
        </button>
      )}
    </Droppable>
  );

  const projectItem = (
    project: { id: string; name: string; color: string },
    key?: string,
  ) => (
    <Droppable target={{ kind: 'project', projectId: project.id }} key={key ?? project.id}>
      {({ isOver }) => (
        <button
          className={`navitem${isOver ? ' dropping' : ''}`}
          aria-current={route.view === 'project' && route.id === project.id ? 'page' : undefined}
          onClick={() => navigate('project', project.id)}
        >
          <span className="hash" style={markerStyle(project.color)}>#</span>
          <span className="label">{project.name}</span>
          {(counts.byProject.get(project.id) ?? 0) > 0 && (
            <span className="count">{counts.byProject.get(project.id)}</span>
          )}
        </button>
      )}
    </Droppable>
  );

  return (
    <aside className="sidebar">
      <div className="side-top">
        <button
          className="profile"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="avatar">
            {avatar
              ? <img src={avatar} alt="" width={28} height={28} referrerPolicy="no-referrer" />
              : initials}
          </span>
          <span className="identity">
            <strong>{user?.full_name ?? '—'}</strong>
            <small>{user?.email ?? ''}</small>
          </span>
          <Icon name="caret" size="sm" />
        </button>

        {menuOpen && (
          <div className="menu" style={{ display: 'block' }}>
            <button onClick={() => { setMenuOpen(false); navigate('dashboard'); }}>
              <Icon name="dashboard" />
              {t('nav.dashboard')}
            </button>
            <button onClick={() => { setMenuOpen(false); navigate('insights'); }}>
              <Icon name="trend" />
              {t('nav.insights')}
            </button>
            <button onClick={() => { setMenuOpen(false); navigate('settings'); }}>
              <Icon name="settings" />
              {t('nav.settings')}
            </button>
            <hr />
            <button onClick={() => window.open('https://app.todoist.com', '_blank', 'noopener')}>
              <Icon name="external" />
              {t('nav.openTodoist')}
            </button>
            <button onClick={() => { setMenuOpen(false); void disconnect(); }}>
              <Icon name="logout" />
              {t('nav.signOut')}
            </button>
          </div>
        )}
      </div>

      <div className="side-scroll">
        <button className="addbtn addbtn-top" onClick={onAddTask}>
          <Icon name="plus" />
          {t('nav.addTask')}
        </button>

        <button className="searchbtn" onClick={onSearch}>
          <Icon name="search" />
          <span>{t('nav.search')}</span>
          <kbd>⌘K</kbd>
        </button>

        <nav aria-label={t('nav.projects')}>
          {navItem('inbox', 'inbox', 'nav.inbox', counts.inbox)}
          {navItem('week', 'week', 'nav.week', counts.week)}
          {navItem('upcoming', 'upcoming', 'nav.upcoming', counts.upcoming)}
          {navItem('someday', 'someday', 'nav.someday', counts.someday, { kind: 'someday' })}
          {navItem('labels', 'flag', 'nav.labels', 0)}
        </nav>

        {(favourites.labels.length > 0 || favourites.projects.length > 0) && (
          <section className="side-group">
            <div className="side-head"><span>{t('nav.favourites')}</span></div>
            {favourites.projects.map((p) => projectItem(p, `fav-${p.id}`))}
            {favourites.labels.map((l) =>
              tagItem(l.name, l.color, roots.filter((i) => hasLabel(i, l.name)).length))}
          </section>
        )}

        {workspaces.map((workspace) => (
          <section className="side-group" key={workspace.workspaceId ?? 'personal'}>
            <div className="side-head">
              <span className="ws">
                {workspace.name && (
                  <span className="wsavatar">{workspace.name.slice(0, 2).toUpperCase()}</span>
                )}
                {workspace.name ?? t('nav.myProjects')}
              </span>
              <button aria-label={t('nav.addProject')} title={t('nav.addProject')} onClick={onAddProject}>
                <Icon name="plus" size="sm" />
              </button>
            </div>
            {workspace.projects.map((project) => projectItem(project))}
          </section>
        ))}
      </div>

      <div className="side-foot">
        <SyncStatus />
        <div className="row">
          <button
            className="iconbtn issuesbtn"
            aria-label={t('issues.title')}
            title={t('issues.title')}
            onClick={onIssues}
          >
            <Icon name="warning" />
            {issuesCount > 0 && <span className="badge">{issuesCount > 99 ? '99+' : issuesCount}</span>}
          </button>
          <button
            className="iconbtn"
            aria-label={t('nav.collapseSidebar')}
            title={t('nav.collapseSidebar')}
            onClick={() => setPrefs({ sidebarCollapsed: true })}
          >
            <Icon name="sidebar" />
          </button>
        </div>
      </div>
    </aside>
  );
}
