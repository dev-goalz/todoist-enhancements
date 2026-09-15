import { useEffect, useMemo, useState } from 'react';
import { IconSprite } from './components/IconSprite';
import { Icon } from './components/Icon';
import { Sidebar } from './components/Sidebar';
import { DragProvider } from './components/dnd/DragProvider';
import { Composer } from './components/overlays/Composer';
import { TaskDetail } from './components/overlays/TaskDetail';
import { Issues } from './components/overlays/Issues';
import { Search } from './components/overlays/Search';
import { InsightsPanel } from './components/overlays/InsightsPanel';
import { ProjectSheet, type ProjectSheetTarget } from './components/overlays/ProjectSheet';
import { Unestimated } from './components/overlays/Unestimated';
import { ConfirmProvider } from './components/overlays/Confirm';
import { WeekView } from './views/WeekView';
import { UpcomingView } from './views/UpcomingView';
import { SimpleListView } from './views/SimpleListView';
import { ProjectView } from './views/ProjectView';
import { LabelsView } from './views/LabelsView';
import { InsightsView } from './views/InsightsView';
import { SettingsView } from './views/SettingsView';
import { ConnectView } from './views/ConnectView';
import { useStore } from './store/store';
import { useT } from './hooks/useT';
import { useData } from './hooks/useData';
import { navigate, useRoute, type Route } from './hooks/useRoute';
import { rootItems } from './store/selectors';
import { detectConflicts } from './domain/conflicts';
import { hasLabel, somedayItems, upcomingItems, weekItems } from './domain/views';
import { effectiveEstimate } from './domain/estimates';
import type { TranslationKey } from './i18n';

export function App() {
  const { t } = useT();
  const ready = useStore((s) => s.ready);
  const connected = useStore((s) => s.connected);
  const init = useStore((s) => s.init);
  const startPolling = useStore((s) => s.startPolling);
  const locale = useStore((s) => s.prefs.locale);
  const homepage = useStore((s) => s.prefs.homepage);
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);

  const route = useRoute();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  /* Not a boolean: what the sheet was opened to do — create one here, or edit
     that one — is carried by the open state itself. */
  const [projectSheet, setProjectSheet] = useState<ProjectSheetTarget>(null);
  const [unestimatedOpen, setUnestimatedOpen] = useState(false);
  /** Where a newly composed task should land, when it was added from a section. */
  const [placement, setPlacement] = useState<ComposerPlacement>({});

  useEffect(() => { void init(); }, [init]);

  /* The address bar wins, always — a shared or reopened link must land where
     it says. The homepage only fills in when there is nothing to obey. */
  useEffect(() => {
    if (ready && !window.location.hash.replace(/^#\/?/, '')) navigate(homepage);
  }, [ready, homepage]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => (connected ? startPolling() : undefined), [connected, startPolling]);

  // Search and quick add are reached constantly, so both have a shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (!typing && e.key === 'q') {
        e.preventDefault();
        setComposerOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) {
    return (
      <>
        <IconSprite />
        <div className="connect"><p className="empty">{t('common.loading')}</p></div>
      </>
    );
  }

  if (!connected) {
    return (
      <>
        <IconSprite />
        <ConnectView />
      </>
    );
  }

  return (
    <>
      <IconSprite />
      <ConfirmProvider>
        <DragProvider>
          <AppShell
            route={route}
            openTaskId={openTaskId}
            setOpenTaskId={setOpenTaskId}
            composerOpen={composerOpen}
            setComposerOpen={setComposerOpen}
            searchOpen={searchOpen}
            setSearchOpen={setSearchOpen}
            issuesOpen={issuesOpen}
            setIssuesOpen={setIssuesOpen}
            insightsOpen={insightsOpen}
            setInsightsOpen={setInsightsOpen}
            projectSheet={projectSheet}
            setProjectSheet={setProjectSheet}
            unestimatedOpen={unestimatedOpen}
            setUnestimatedOpen={setUnestimatedOpen}
            placement={placement}
            setPlacement={setPlacement}
          />
        </DragProvider>
      </ConfirmProvider>

      {toasts.length > 0 && (
        <div className="toasts">
          {toasts.map((toast) => (
            <div className="toast" key={toast.id}>
              <span>{toast.message}</span>
              {toast.undo && (
                <button onClick={() => { toast.undo?.(); dismissToast(toast.id); }}>
                  {t('common.undo')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

interface ShellProps {
  route: Route;
  openTaskId: string | null;
  setOpenTaskId: (id: string | null) => void;
  composerOpen: boolean;
  setComposerOpen: (open: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  issuesOpen: boolean;
  setIssuesOpen: (open: boolean) => void;
  insightsOpen: boolean;
  setInsightsOpen: (open: boolean) => void;
  projectSheet: ProjectSheetTarget;
  setProjectSheet: (target: ProjectSheetTarget) => void;
  unestimatedOpen: boolean;
  setUnestimatedOpen: (open: boolean) => void;
  placement: ComposerPlacement;
  setPlacement: (placement: ComposerPlacement) => void;
}

export interface ComposerPlacement {
  projectId?: string;
  sectionId?: string;
  date?: string;
}

function AppShell({
  route, openTaskId, setOpenTaskId, composerOpen, setComposerOpen,
  searchOpen, setSearchOpen, issuesOpen, setIssuesOpen,
  insightsOpen, setInsightsOpen, projectSheet, setProjectSheet,
  unestimatedOpen, setUnestimatedOpen, placement, setPlacement,
}: ShellProps) {
  const { t } = useT();
  const { snapshot, items, childrenOf } = useData();
  const conflictSettings = useStore((s) => s.prefs.conflicts);
  const demo = useStore((s) => s.demo);
  const sidebarCollapsed = useStore((s) => s.prefs.sidebarCollapsed);
  const leaveDemo = useStore((s) => s.disconnect);

  const roots = useMemo(() => rootItems(items), [items]);
  const conflictCount = useMemo(
    () => detectConflicts(roots, childrenOf, conflictSettings).length,
    [roots, childrenOf, conflictSettings],
  );

  /** Whatever the page in front is showing, so the dialogs never describe another one. */
  const { contextItems, contextLabel } = useMemo(() => {
    switch (route.view) {
      case 'project': {
        const project = route.id ? snapshot.projects[route.id] : undefined;
        return {
          contextItems: roots.filter((i) => i.project_id === route.id),
          contextLabel: project?.name ?? t('nav.projects'),
        };
      }
      case 'label':
        return {
          contextItems: route.id ? roots.filter((i) => hasLabel(i, route.id!)) : [],
          contextLabel: route.id ?? '',
        };
      case 'week':
        return { contextItems: weekItems(roots), contextLabel: t('nav.week') };
      case 'upcoming':
        return { contextItems: upcomingItems(roots), contextLabel: t('nav.upcoming') };
      case 'someday':
        return { contextItems: somedayItems(roots), contextLabel: t('nav.someday') };
      case 'inbox': {
        const inboxId = snapshot.user?.inbox_project_id;
        return {
          contextItems: inboxId ? roots.filter((i) => i.project_id === inboxId) : [],
          contextLabel: t('nav.inbox'),
        };
      }
      default:
        return { contextItems: roots, contextLabel: t(`nav.${route.view}` as TranslationKey) };
    }
  }, [route, roots, snapshot.projects, snapshot.user?.inbox_project_id, t]);

  const unestimatedItems = useMemo(
    () => contextItems.filter((i) => effectiveEstimate(i, childrenOf).minutes === null),
    [contextItems, childrenOf],
  );

  const openTask = (id: string) => setOpenTaskId(id);
  const addTask = () => {
    setPlacement(route.view === 'project' && route.id ? { projectId: route.id } : {});
    setComposerOpen(true);
  };
  const addTaskTo = (next: ComposerPlacement) => {
    setPlacement(next);
    setComposerOpen(true);
  };
  const openInsights = () => setInsightsOpen(true);
  const openUnestimated = () => setUnestimatedOpen(true);
  const viewProps = {
    onOpen: openTask,
    onInsights: openInsights,
    onUnestimated: openUnestimated,
    onAddTaskTo: addTaskTo,
    onProjectSheet: setProjectSheet,
  };

  return (
    <div className={`app${demo ? ' demo' : ''}${sidebarCollapsed ? ' collapsed' : ''}`}>
      {demo && (
        <div className="demobanner" role="status">
          <Icon name="warning" size="sm" />
          <span>{t('demo.banner')}</span>
          <button onClick={() => void leaveDemo()}>{t('demo.exit')}</button>
        </div>
      )}
      <Sidebar
        route={route}
        onAddTask={addTask}
        onSearch={() => setSearchOpen(true)}
        onIssues={() => setIssuesOpen(true)}
        onProjectSheet={setProjectSheet}
        issuesCount={conflictCount}
      />

      <main className="workspace">
        <header className="mobile-top">
          <button className="iconbtn" aria-label={t('nav.openNavigation')} onClick={() => navigate('week')}>
            <Icon name="sidebar" />
          </button>
          <strong>{contextLabel}</strong>
          <button className="iconbtn" aria-label={t('nav.search')} onClick={() => setSearchOpen(true)}>
            <Icon name="search" />
          </button>
        </header>

        <section className="screen active">
          {route.view === 'week' && <WeekView {...viewProps} />}
          {route.view === 'upcoming' && <UpcomingView {...viewProps} />}
          {route.view === 'someday' && <SimpleListView kind="someday" {...viewProps} />}
          {route.view === 'inbox' && <SimpleListView kind="inbox" {...viewProps} />}
          {route.view === 'label' && route.id && (
            <SimpleListView kind="label" labelName={route.id} {...viewProps} />
          )}
          {route.view === 'labels' && <LabelsView />}
          {route.view === 'project' && route.id && (
            <ProjectView projectId={route.id} {...viewProps} />
          )}
          {route.view === 'insights' && <InsightsView />}
          {route.view === 'settings' && <SettingsView />}
        </section>

        <nav className="mobile-nav" aria-label={t('nav.projects')}>
          <button
            aria-current={route.view === 'inbox' ? 'page' : undefined}
            onClick={() => navigate('inbox')}
          >
            <Icon name="inbox" size="lg" />
            {t('nav.inbox')}
          </button>
          <button
            aria-current={route.view === 'week' ? 'page' : undefined}
            onClick={() => navigate('week')}
          >
            <Icon name="week" size="lg" />
            {t('nav.week')}
          </button>
          <button className="fab" aria-label={t('nav.addTask')} onClick={addTask}>
            {/* The stylesheet paints the round accent disc on this wrapper. */}
            <i><Icon name="plus" /></i>
          </button>
          <button
            aria-current={route.view === 'upcoming' ? 'page' : undefined}
            onClick={() => navigate('upcoming')}
          >
            <Icon name="upcoming" size="lg" />
            {t('nav.upcoming')}
          </button>
          <button
            aria-current={route.view === 'someday' ? 'page' : undefined}
            onClick={() => navigate('someday')}
          >
            <Icon name="someday" size="lg" />
            {t('nav.someday')}
          </button>
        </nav>
      </main>

      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        defaultProjectId={placement.projectId}
        defaultSectionId={placement.sectionId}
        defaultDate={placement.date}
      />
      <TaskDetail
        taskId={openTaskId}
        onClose={() => setOpenTaskId(null)}
        onOpen={openTask}
      />
      <Issues open={issuesOpen} onClose={() => setIssuesOpen(false)} onOpen={openTask} />
      <Search open={searchOpen} onClose={() => setSearchOpen(false)} onOpen={openTask} />
      <ProjectSheet target={projectSheet} onClose={() => setProjectSheet(null)} />
      <Unestimated
        open={unestimatedOpen}
        onClose={() => setUnestimatedOpen(false)}
        items={unestimatedItems}
        onOpen={openTask}
      />
      <InsightsPanel
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        contextLabel={contextLabel}
        items={contextItems}
        onOpenTask={openTask}
      />
    </div>
  );
}
