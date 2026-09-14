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
import { WeekView } from './views/WeekView';
import { UpcomingView } from './views/UpcomingView';
import { SimpleListView } from './views/SimpleListView';
import { ProjectView } from './views/ProjectView';
import { DashboardView } from './views/DashboardView';
import { InsightsView } from './views/InsightsView';
import { SettingsView } from './views/SettingsView';
import { ConnectView } from './views/ConnectView';
import { useStore } from './store/store';
import { useT } from './hooks/useT';
import { useData } from './hooks/useData';
import { navigate, useRoute } from './hooks/useRoute';
import { rootItems } from './store/selectors';
import { detectConflicts } from './domain/conflicts';
import { weekItems } from './domain/views';
import type { TranslationKey } from './i18n';

export function App() {
  const { t } = useT();
  const ready = useStore((s) => s.ready);
  const connected = useStore((s) => s.connected);
  const init = useStore((s) => s.init);
  const startPolling = useStore((s) => s.startPolling);
  const locale = useStore((s) => s.prefs.locale);
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);

  const route = useRoute();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  useEffect(() => { void init(); }, [init]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => (connected ? startPolling() : undefined), [connected, startPolling]);

  // Keyboard shortcuts: search and quick add, the two things reached constantly.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

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
        />
      </DragProvider>

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
  route: ReturnType<typeof useRoute>;
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
}

function AppShell({
  route, openTaskId, setOpenTaskId, composerOpen, setComposerOpen,
  searchOpen, setSearchOpen, issuesOpen, setIssuesOpen,
  insightsOpen, setInsightsOpen,
}: ShellProps) {
  const { t } = useT();
  const { snapshot, items, childrenOf } = useData();
  const conflictSettings = useStore((s) => s.prefs.conflicts);

  const roots = useMemo(() => rootItems(items), [items]);
  const conflictCount = useMemo(
    () => detectConflicts(roots, childrenOf, conflictSettings).length,
    [roots, childrenOf, conflictSettings],
  );

  // The Insights panel summarises whichever page is open, never a fixed one.
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
          contextItems: roots.filter((i) =>
            i.labels.some((l) => l.toLowerCase() === route.id?.toLowerCase())),
          contextLabel: route.id ?? '',
        };
      case 'week':
        return { contextItems: weekItems(roots), contextLabel: t('nav.week') };
      default:
        return {
          contextItems: roots,
          contextLabel: t(`nav.${route.view}` as TranslationKey),
        };
    }
  }, [route, roots, snapshot.projects, t]);

  const defaultProjectId = route.view === 'project' ? route.id : undefined;

  const openTask = (id: string) => setOpenTaskId(id);
  const addTask = () => setComposerOpen(true);
  const openInsights = () => setInsightsOpen(true);

  return (
    <div className="app">
      <Sidebar
        route={route}
        onAddTask={addTask}
        onSearch={() => setSearchOpen(true)}
        onIssues={() => setIssuesOpen(true)}
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
          {route.view === 'week' && (
            <WeekView onOpen={openTask} onAddTask={addTask} onInsights={openInsights} />
          )}
          {route.view === 'upcoming' && (
            <UpcomingView onOpen={openTask} onAddTask={addTask} onInsights={openInsights} />
          )}
          {route.view === 'someday' && (
            <SimpleListView kind="someday" onOpen={openTask} onAddTask={addTask} onInsights={openInsights} />
          )}
          {route.view === 'inbox' && (
            <SimpleListView kind="inbox" onOpen={openTask} onAddTask={addTask} onInsights={openInsights} />
          )}
          {route.view === 'label' && route.id && (
            <SimpleListView
              kind="label"
              labelName={route.id}
              onOpen={openTask}
              onAddTask={addTask}
              onInsights={openInsights}
            />
          )}
          {route.view === 'project' && route.id && (
            <ProjectView
              projectId={route.id}
              onOpen={openTask}
              onAddTask={addTask}
              onInsights={openInsights}
            />
          )}
          {route.view === 'dashboard' && (
            <DashboardView onOpen={openTask} onIssues={() => setIssuesOpen(true)} />
          )}
          {route.view === 'insights' && <InsightsView />}
          {route.view === 'settings' && <SettingsView />}
        </section>

        <nav className="mobile-nav" aria-label={t('nav.projects')}>
          <button
            aria-current={route.view === 'week' ? 'page' : undefined}
            onClick={() => navigate('week')}
          >
            <Icon name="week" size="lg" />
            {t('nav.week')}
          </button>
          <button
            aria-current={route.view === 'upcoming' ? 'page' : undefined}
            onClick={() => navigate('upcoming')}
          >
            <Icon name="upcoming" size="lg" />
            {t('nav.upcoming')}
          </button>
          <button className="fab" aria-label={t('nav.addTask')} onClick={addTask}>
            {/* The stylesheet paints the round accent disc on this wrapper. */}
            <i><Icon name="plus" /></i>
          </button>
          <button
            aria-current={route.view === 'inbox' ? 'page' : undefined}
            onClick={() => navigate('inbox')}
          >
            <Icon name="inbox" size="lg" />
            {t('nav.inbox')}
          </button>
          <button
            aria-current={route.view === 'dashboard' ? 'page' : undefined}
            onClick={() => navigate('dashboard')}
          >
            <Icon name="dashboard" size="lg" />
            {t('nav.dashboard')}
          </button>
        </nav>
      </main>

      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        defaultProjectId={defaultProjectId}
      />
      <TaskDetail
        taskId={openTaskId}
        onClose={() => setOpenTaskId(null)}
        onOpen={openTask}
      />
      <Issues
        open={issuesOpen}
        onClose={() => setIssuesOpen(false)}
        onOpen={openTask}
      />
      <Search
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
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
