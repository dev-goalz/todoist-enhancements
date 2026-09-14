import { useMemo, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import { navigate, type Route } from '@/hooks/useRoute';
import { projectCounts, projectTree, rootItems, type ProjectNode } from '@/store/selectors';
import { hasLabel, somedayItems, upcomingItems, weekItems } from '@/domain/views';
import { markerStyle, avatarUrl } from '@/domain/colors';
import { firstName, karmaStanding } from '@/domain/karma';
import type { ViewId } from '@/domain/types';
import type { DropTarget } from '@/domain/dnd';
import type { TranslationKey } from '@/i18n';
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
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

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

  /** Favourites are Todoist's own star, not a separate list this app keeps. */
  const favourites = useMemo(() => {
    const labels = Object.values(snapshot.labels)
      .filter((l) => l.is_favorite && !l.name.startsWith('est-'))
      .sort((a, b) => a.item_order - b.item_order);
    const projects = Object.values(snapshot.projects)
      .filter((p) => p.is_favorite && !p.is_archived && !p.is_deleted)
      .sort((a, b) => a.child_order - b.child_order);
    return { labels, projects };
  }, [snapshot.labels, snapshot.projects]);

  const workspaces = useMemo(() => projectTree(snapshot), [snapshot]);
  const user = snapshot.user;
  const avatar = avatarUrl(user);
  const karma = karmaStanding(user?.karma);
  const initials = (user?.full_name ?? '?')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  if (collapsed) {
    return (
      <div className="expand-wrap">
        <button
          className="iconbtn"
          aria-label={t('nav.showSidebar')}
          title={t('nav.showSidebar')}
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
    labelKey: TranslationKey,
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
    <Droppable target={{ kind: 'label', label: name }} key={`tag-${name}`}>
      {({ isOver }) => (
        <button
          className={`navitem${isOver ? ' dropping' : ''}`}
          aria-current={route.view === 'label' && route.id === name ? 'page' : undefined}
          onClick={() => navigate('label', name)}
        >
          <Icon name="flag" className="taglabel" style={markerStyle(color, false)} />
          <span className="label">{name}</span>
          {count !== undefined && count > 0 && <span className="count">{count}</span>}
        </button>
      )}
    </Droppable>
  );

  /** A project row, or a folder that discloses the projects inside it. */
  const projectNode = (node: ProjectNode, keyPrefix = '', depth = 0): JSX.Element => {
    const { project, children } = node;

    if (project.is_folder) {
      const isOpen = openFolders[project.id] ?? true;
      return (
        <div key={`${keyPrefix}folder-${project.id}`}>
          <button
            className="navitem folderitem"
            aria-expanded={isOpen}
            onClick={() => setOpenFolders((prev) => ({ ...prev, [project.id]: !isOpen }))}
          >
            <Icon name={isOpen ? 'caret-up' : 'caret'} size="sm" />
            <Icon name="project" />
            <span className="label">{project.name}</span>
          </button>
          {isOpen && children.map((child) => projectNode(child, keyPrefix, depth + 1))}
        </div>
      );
    }

    return (
      <Droppable target={{ kind: 'project', projectId: project.id }} key={`${keyPrefix}${project.id}`}>
        {({ isOver }) => (
          <button
            className={`navitem${isOver ? ' dropping' : ''}`}
            style={depth > 0 ? { paddingLeft: `${8 + depth * 16}px` } : undefined}
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
  };

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
            <strong>{firstName(user?.full_name)}</strong>
            {karma ? (
              <span className="karma" title={t('karma.progress', {
                remaining: karma.remaining ?? 0,
                next: karma.next ? t(`karma.${karma.next.key}` as TranslationKey) : '',
              })}>
                <small>{t(`karma.${karma.rank.key}` as TranslationKey)}</small>
                <span className="karmabar" aria-hidden="true">
                  <i style={{ width: `${karma.progress}%` }} />
                </span>
              </span>
            ) : (
              <small>{user?.email ?? ''}</small>
            )}
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
            {favourites.projects.map((p) =>
              projectNode({ project: p, children: [] }, 'fav-'))}
            {favourites.labels.map((l) =>
              tagItem(l.name, l.color, roots.filter((i) => hasLabel(i, l.name)).length))}
          </section>
        )}

        {workspaces.map((workspace) => (
          <section className="side-group" key={workspace.workspaceId ?? 'personal'}>
            <div className="side-head">
              {/* Workspaces read as plain headings, like "My projects" above. */}
              <span>{workspace.name ?? t('nav.myProjects')}</span>
              <button aria-label={t('nav.addProject')} title={t('nav.addProject')} onClick={onAddProject}>
                <Icon name="plus" size="sm" />
              </button>
            </div>
            {workspace.roots.map((node) => projectNode(node))}
          </section>
        ))}
      </div>

      <div className="side-foot">
        <button className="addbtn" onClick={onAddTask}>
          <Icon name="plus" />
          {t('nav.addTask')}
        </button>
        {/* Status and the issues badge share the last line, baseline aligned. */}
        <div className="footrow">
          <SyncStatus />
          <div className="footicons">
            <button
              className="iconbtn issuesbtn"
              aria-label={t('issues.title')}
              title={t('issues.title')}
              onClick={onIssues}
            >
              <Icon name="warning" />
              {issuesCount > 0 && (
                <span className="badge">{issuesCount > 99 ? '99+' : issuesCount}</span>
              )}
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
      </div>
    </aside>
  );
}
