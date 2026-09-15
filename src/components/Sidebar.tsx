import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import { navigate, type Route } from '@/hooks/useRoute';
import { projectCounts, projectTree, rootItems, type ProjectNode } from '@/store/selectors';
import { hasLabel, somedayItems, upcomingItems, weekItems } from '@/domain/views';
import { markerStyle, avatarUrl } from '@/domain/colors';
import { IS_SELF_HOSTED } from '@/api/client';
import { firstName, karmaStanding } from '@/domain/karma';
import type { ViewId } from '@/domain/types';
import type { DropTarget } from '@/domain/dnd';
import type { TranslationKey } from '@/i18n';
import { SyncStatus } from './SyncStatus';
import { Droppable } from './dnd/Droppable';
import { ProjectRowSortable } from './dnd/ProjectRowSortable';
import { COFFEE_URL, FEEDBACK_URL } from '@/app-info';
import { ProjectMenu } from './ProjectMenu';
import type { ProjectSheetTarget } from './overlays/ProjectSheet';

interface SidebarProps {
  route: Route;
  onAddTask: () => void;
  onSearch: () => void;
  onIssues: () => void;
  /** Opens the project sheet, to create one here or to edit that one. */
  onProjectSheet: (target: ProjectSheetTarget) => void;
  issuesCount: number;
  /**
   * 'rail' is the column beside the app. 'sheet' is the same thing shown as a
   * page on a phone, where there is no room for a column: it ignores the
   * collapsed preference, which belongs to the rail, and drops the control
   * that sets it.
   */
  variant?: 'rail' | 'sheet';
}

export function Sidebar({
  route, onAddTask, onSearch, onIssues, onProjectSheet, issuesCount, variant = 'rail',
}: SidebarProps) {
  const { t } = useT();
  const { snapshot, items } = useData();
  const sheet = variant === 'sheet';
  const collapsed = useStore((s) => s.prefs.sidebarCollapsed) && !sheet;
  const setPrefs = useStore((s) => s.setPrefs);
  const disconnect = useStore((s) => s.disconnect);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  /** The project row whose action menu is open, and the button it hangs from. */
  const [rowMenu, setRowMenu] = useState<{ key: string; anchor: HTMLElement } | null>(null);

  const roots = useMemo(() => rootItems(items), [items]);
  const inboxId = snapshot.user?.inbox_project_id;

  const counts = useMemo(() => {
    return {
      inbox: inboxId ? roots.filter((i) => i.project_id === inboxId).length : 0,
      week: weekItems(roots).length,
      upcoming: upcomingItems(roots).length,
      someday: somedayItems(roots).length,
      byProject: projectCounts(roots),
    };
  }, [roots, inboxId]);

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

  /* A menu that only closes by pressing its own button is a menu that follows
     you around the app. Anywhere else, and Escape, put it away. */
  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));

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
    return <Droppable target={dropTarget} scope="nav">{({ isOver }) => button(isOver)}</Droppable>;
  };

  const tagItem = (name: string, color: string, count?: number) => (
    <Droppable target={{ kind: 'label', label: name }} scope="nav" key={`tag-${name}`}>
      {({ isOver }) => (
        <button
          className={`navitem${isOver ? ' dropping' : ''}`}
          aria-current={route.view === 'label' && route.id === name ? 'page' : undefined}
          onClick={() => navigate('label', name)}
        >
          <Icon name="tag" className="taglabel" style={markerStyle(color, false)} />
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
            <Icon name="project" />
            <span className="label">{project.name}</span>
            <Icon name={isOpen ? 'caret-up' : 'caret'} size="sm" className="disclose" />
          </button>
          {isOpen && children.map((child) => projectNode(child, keyPrefix, depth + 1))}
        </div>
      );
    }

    const rowKey = `${keyPrefix}${project.id}`;
    const count = counts.byProject.get(project.id) ?? 0;
    const menuOpen = rowMenu?.key === rowKey;
    const childrenOpen = openFolders[project.id] ?? true;

    const row = (
      <Droppable
        target={{ kind: 'project', projectId: project.id }}
        /* A favourite project also appears under its workspace, so the two
           rows must not claim the same droppable id. */
        scope={`nav-${keyPrefix || 'tree'}`}
        key={rowKey}
      >
        {({ isOver }) => (
          /* A row, not a button: the actions live beside the destination and a
             button cannot legally contain another one. */
          <ProjectRowSortable
            projectId={project.id}
            sortable={keyPrefix === ''}
            className={menuOpen ? ' menuopen' : ''}
          >
            <button
              className={`navitem${isOver ? ' dropping' : ''}`}
              style={depth > 0 ? { paddingLeft: `${8 + depth * 16}px` } : undefined}
              aria-current={route.view === 'project' && route.id === project.id ? 'page' : undefined}
              onClick={() => navigate('project', project.id)}
            >
              <span className="hash" style={markerStyle(project.color)}>#</span>
              <span className="label">{project.name}</span>
            </button>

            {/* The count gives up its place to the actions under the pointer,
                which is where Todoist puts them and where the eye looks. */}
            <span className="navend">
              {count > 0 && <span className="count">{count}</span>}
              <button
                className="navmore"
                aria-label={t('project.actions')}
                title={t('project.actions')}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={(event) =>
                  setRowMenu(menuOpen ? null : { key: rowKey, anchor: event.currentTarget })}
              >
                <Icon name="more" size="sm" />
              </button>
            </span>

            {/* A project that holds projects discloses them, the way a folder
                does. Without this its children were built, counted, and never
                drawn: nested projects simply were not in the sidebar. */}
            {children.length > 0 && (
              <button
                className="navtwist"
                aria-expanded={childrenOpen}
                aria-label={project.name}
                onClick={() => setOpenFolders((prev) => ({ ...prev, [project.id]: !childrenOpen }))}
              >
                <Icon name={childrenOpen ? 'caret-up' : 'caret'} size="sm" />
              </button>
            )}

            {menuOpen && (
              <ProjectMenu
                project={project}
                anchor={rowMenu?.anchor ?? null}
                onClose={() => setRowMenu(null)}
                onEdit={() => onProjectSheet({ mode: 'edit', projectId: project.id })}
                /* Only in the tree. A favourite is the same project shown a
                   second time, and "above" and "below" name positions in the
                   list it actually lives in, not in this one. */
                onAddAbove={keyPrefix !== '' ? undefined : () => onProjectSheet({
                  mode: 'create',
                  workspaceId: project.workspace_id ?? null,
                  anchor: { siblingId: project.id, position: 'above' },
                })}
                onAddBelow={keyPrefix !== '' ? undefined : () => onProjectSheet({
                  mode: 'create',
                  workspaceId: project.workspace_id ?? null,
                  anchor: { siblingId: project.id, position: 'below' },
                })}
              />
            )}
          </ProjectRowSortable>
        )}
      </Droppable>
    );

    if (children.length === 0) return row;
    return (
      <div key={`${rowKey}-tree`}>
        {row}
        {childrenOpen && children.map((child) => projectNode(child, keyPrefix, depth + 1))}
      </div>
    );
  };

  return (
    <aside className={`sidebar${sheet ? ' sidebar-sheet' : ''}`}>
      <div className="side-top" ref={menuRef}>
        <button
          className="profile"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="avatar">
            {avatar
              ? <img src={avatar} alt="" width={30} height={30} referrerPolicy="no-referrer" />
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
            <button onClick={() => { setMenuOpen(false); navigate('insights'); }}>
              <Icon name="trend" />
              {t('nav.dashboard')}
            </button>
            <button onClick={() => { setMenuOpen(false); navigate('insights', 'logbook'); }}>
              <Icon name="tasks" />
              {t('insights.logbook')}
            </button>
            <button onClick={() => { setMenuOpen(false); navigate('settings'); }}>
              <Icon name="settings" />
              {t('nav.settings')}
            </button>
            <hr />
            <button onClick={() => window.open(FEEDBACK_URL, '_blank', 'noopener,noreferrer')}>
              <Icon name="comment" />
              {t('nav.feedback')}
            </button>
            <button onClick={() => window.open(COFFEE_URL, '_blank', 'noopener,noreferrer')}>
              <Icon name="coffee" />
              {t('nav.coffee')}
            </button>
            <hr />
            {!IS_SELF_HOSTED && (
              <button onClick={() => window.open('https://app.todoist.com', '_blank', 'noopener')}>
                <Icon name="external" />
                {t('nav.openTodoist')}
              </button>
            )}
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
          {navItem(
            'inbox', 'inbox', 'nav.inbox', counts.inbox,
            // Dropping on Inbox means filing there, which is a plain project move.
            inboxId ? { kind: 'project', projectId: inboxId } : undefined,
          )}
          {navItem('week', 'week', 'nav.week', counts.week, { kind: 'anytime' })}
          {navItem('upcoming', 'upcoming', 'nav.upcoming', counts.upcoming)}
          {navItem('someday', 'someday', 'nav.someday', counts.someday, { kind: 'someday' })}
          {navItem('review', 'check', 'nav.review', 0)}
          {navItem('labels', 'tag', 'nav.labels', 0)}
        </nav>

        {(favourites.labels.length > 0 || favourites.projects.length > 0) && (
          <SideGroup
            title={t('nav.favourites')}
            open={openGroups.favourites ?? true}
            onToggle={() => toggleGroup('favourites')}
          >
            {favourites.projects.map((p) =>
              projectNode({ project: p, children: [] }, 'fav-'))}
            {favourites.labels.map((l) =>
              tagItem(l.name, l.color, roots.filter((i) => hasLabel(i, l.name)).length))}
          </SideGroup>
        )}

        {workspaces.map((workspace) => {
          const key = workspace.workspaceId ?? 'personal';
          return (
            <SideGroup
              key={key}
              title={workspace.name ?? t('nav.myProjects')}
              open={openGroups[key] ?? true}
              onToggle={() => toggleGroup(key)}
              onAdd={() => onProjectSheet({
                mode: 'create',
                workspaceId: workspace.workspaceId,
              })}
              addLabel={t('nav.addProject')}
            >
              {workspace.roots.map((node) => projectNode(node))}
              {workspace.roots.length === 0 && (
                /* The header's add button only shows on hover, which is easy to
                   miss when there is nothing else in the group. */
                <button
                  className="navitem"
                  onClick={() => onProjectSheet({ mode: 'create', workspaceId: workspace.workspaceId })}
                >
                  <Icon name="plus" />
                  <span className="label">{t('nav.addProject')}</span>
                </button>
              )}
            </SideGroup>
          );
        })}
      </div>

      <div className="side-foot">
        <button className="addbtn" onClick={onAddTask}>
          {t('nav.addTask')}
          <Icon name="plus" />
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
            {!sheet && (
              <button
                className="iconbtn"
                aria-label={t('nav.collapseSidebar')}
                title={t('nav.collapseSidebar')}
                onClick={() => setPrefs({ sidebarCollapsed: true })}
              >
                <Icon name="sidebar" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * A titled block of the sidebar.
 *
 * The heading discloses its contents from a caret on the right, matching the
 * folders below it, and the add button only appears under the pointer so the
 * resting sidebar stays quiet.
 */
function SideGroup({
  title, open, onToggle, onAdd, addLabel, children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="side-group">
      <div className="side-head">
        <button className="side-headbtn" aria-expanded={open} onClick={onToggle}>
          <span>{title}</span>
        </button>
        {onAdd && (
          <button
            className="side-add"
            aria-label={addLabel}
            title={addLabel}
            onClick={onAdd}
          >
            <Icon name="plus" size="sm" />
          </button>
        )}
        {/* The caret ends the row, where every other disclosure in the app
            puts it; the add button sits just inside it. */}
        <button
          className="side-disclose"
          aria-expanded={open}
          aria-label={title}
          onClick={onToggle}
        >
          <Icon name={open ? 'caret-up' : 'caret'} size="sm" />
        </button>
      </div>
      {open && children}
    </section>
  );
}
