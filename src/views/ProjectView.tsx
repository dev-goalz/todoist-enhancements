import { useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Toolbar } from '@/components/Toolbar';
import { TaskGroup } from '@/components/TaskGroup';
import { ModeSurface } from '@/components/ModeSurface';
import { Icon } from '@/components/Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import { viewPrefs } from '@/store/prefs';
import { applyFilters, rootItems, sortItems } from '@/store/selectors';
import { summariseLoad } from '@/domain/load';

interface ProjectViewProps {
  projectId: string;
  onOpen: (id: string) => void;
  onAddTask: () => void;
  onInsights: () => void;
}

/**
 * A project page.
 *
 * Two collapsible groups lead by default: what is already scheduled, and what
 * is available to pick up. Sections become board columns when the user
 * switches modes, which is the only place a Kanban actually means something.
 */
export function ProjectView({ projectId, onOpen, onAddTask, onInsights }: ProjectViewProps) {
  const { t } = useT();
  const { snapshot, items, childrenOf } = useData();
  const prefs = useStore((s) => s.prefs);
  const viewKey = `project:${projectId}`;
  const current = viewPrefs(prefs, viewKey);

  const project = snapshot.projects[projectId];

  const scoped = useMemo(() => {
    const roots = rootItems(items).filter((i) => i.project_id === projectId);
    return applyFilters(roots, current.filters, snapshot, childrenOf);
  }, [items, projectId, current.filters, snapshot, childrenOf]);

  const load = useMemo(
    () => summariseLoad(scoped, childrenOf, null),
    [scoped, childrenOf],
  );

  const sections = useMemo(
    () =>
      Object.values(snapshot.sections)
        .filter((s) => s.project_id === projectId && !s.is_archived && !s.is_deleted)
        .sort((a, b) => a.section_order - b.section_order),
    [snapshot.sections, projectId],
  );

  const scheduled = sortItems(scoped.filter((i) => i.due !== null), current.sort, childrenOf);
  const available = sortItems(scoped.filter((i) => i.due === null), current.sort, childrenOf);

  const boardColumns = useMemo(
    () => [
      ...sections.map((section) => ({
        id: section.id,
        title: section.name,
        items: sortItems(
          scoped.filter((i) => i.section_id === section.id),
          current.sort,
          childrenOf,
        ),
      })),
      {
        id: 'none',
        title: t('group.noSection'),
        items: sortItems(scoped.filter((i) => !i.section_id), current.sort, childrenOf),
      },
    ],
    [sections, scoped, current.sort, childrenOf, t],
  );

  if (!project) {
    return <div className="page"><p className="empty">{t('common.error')}</p></div>;
  }

  // A Kanban is only offered where sections exist to give it columns.
  const modes = sections.length > 0
    ? (['list', 'board', 'focus', 'calendar'] as const)
    : (['list', 'focus', 'calendar'] as const);

  return (
    <div className="page wide">
      <PageHeader
        title={project.name}
        subtitle={project.description || undefined}
        load={load}
        actions={
          <>
            <button className="btn primary" onClick={onAddTask}>
              <Icon name="plus" />
              {t('nav.addTask')}
            </button>
            <button className="btn" onClick={onInsights}>
              <Icon name="trend" />
              {t('toolbar.insights')}
            </button>
          </>
        }
      />

      <Toolbar
        viewKey={viewKey}
        modes={[...modes]}
        groups={['none', 'section', 'priority', 'label', 'estimate', 'day']}
        onInsights={onInsights}
      />

      {current.mode === 'board' ? (
        <ModeSurface
          items={scoped}
          childrenOf={childrenOf}
          mode="board"
          group="section"
          sort={current.sort}
          onOpen={onOpen}
          showProject={false}
          boardColumns={boardColumns}
        />
      ) : current.mode === 'list' && current.group === 'none' ? (
        <div className="mode">
          <TaskGroup
            title={t('group.scheduled')}
            items={scheduled}
            childrenOf={childrenOf}
            onOpen={onOpen}
            showProject={false}
          />
          <TaskGroup
            title={t('group.available')}
            items={available}
            childrenOf={childrenOf}
            onOpen={onOpen}
            showProject={false}
          />
          {scoped.length === 0 && <p className="empty">{t('task.noTasks')}</p>}
        </div>
      ) : (
        <ModeSurface
          items={scoped}
          childrenOf={childrenOf}
          mode={current.mode}
          group={current.group}
          sort={current.sort}
          onOpen={onOpen}
          showProject={false}
        />
      )}
    </div>
  );
}
