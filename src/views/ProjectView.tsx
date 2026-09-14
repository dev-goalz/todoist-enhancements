import { useMemo, Fragment } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DisplayMenu } from '@/components/DisplayMenu';
import { TaskGroup } from '@/components/TaskGroup';
import { ModeSurface } from '@/components/ModeSurface';
import { EditableDescription } from '@/components/EditableDescription';
import { AddSectionLine } from '@/components/AddSectionLine';
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
  onInsights: () => void;
  onUnestimated: () => void;
  /** Adds a task straight into a section of this project. */
  onAddTaskTo: (placement: { projectId: string; sectionId?: string }) => void;
}

/**
 * A project page.
 *
 * By default the page is laid out by the project's own sections, which is how
 * the work is already organised in Todoist. Splitting it into scheduled and
 * available work stays available as an explicit grouping.
 */
export function ProjectView({
  projectId, onOpen, onInsights, onUnestimated, onAddTaskTo,
}: ProjectViewProps) {
  const { t } = useT();
  const { snapshot, items, childrenOf } = useData();
  const prefs = useStore((s) => s.prefs);
  const updateProjectFields = useStore((s) => s.updateProjectFields);
  const updateSectionFields = useStore((s) => s.updateSectionFields);
  const createSection = useStore((s) => s.createSection);

  const addSection = async (index: number) => {
    const id = await createSection(projectId, index);
    // The row does not exist until React has rendered it.
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLInputElement>(`[data-section-name="${id}"]`);
      field?.focus();
      field?.select();
    });
  };
  const viewKey = `project:${projectId}`;
  const current = viewPrefs(prefs, viewKey);

  const project = snapshot.projects[projectId];

  const scoped = useMemo(() => {
    const roots = rootItems(items).filter((i) => i.project_id === projectId);
    return applyFilters(roots, current.filters, snapshot, childrenOf);
  }, [items, projectId, current.filters, snapshot, childrenOf]);

  const load = useMemo(() => summariseLoad(scoped, childrenOf, null), [scoped, childrenOf]);

  const sections = useMemo(
    () =>
      Object.values(snapshot.sections)
        .filter((s) => s.project_id === projectId && !s.is_archived && !s.is_deleted)
        .sort((a, b) => a.section_order - b.section_order),
    [snapshot.sections, projectId],
  );

  const sorted = (list: typeof scoped) => sortItems(list, current.sort, childrenOf);

  const sectionGroups = useMemo(
    () => {
      const grouped = sections.map((section) => ({
        id: section.id,
        title: section.name,
        description: (section.description ?? '') as string | null,
        items: sorted(scoped.filter((i) => i.section_id === section.id)),
      }));

      const loose = sorted(scoped.filter((i) => !i.section_id));
      // With no sections at all there is nothing to distinguish, so the list
      // is shown plainly rather than under a "no section" heading.
      if (sections.length === 0) {
        return [{ id: 'none', title: '', description: null as string | null, items: loose }];
      }
      return [
        ...grouped,
        { id: 'none', title: t('group.noSection'), description: null as string | null, items: loose },
      ];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, scoped, current.sort, childrenOf, t],
  );

  const boardColumns = useMemo(
    () =>
      sectionGroups
        // An empty "no section" column is noise; a real section stays, because
        // an empty column of your own is still somewhere to drop work.
        .filter((group) => group.id !== 'none' || group.items.length > 0)
        .map((group) => ({
          id: group.id,
          title: group.title,
          items: group.items,
          dropTarget: {
            kind: 'section' as const,
            sectionId: group.id === 'none' ? null : group.id,
            projectId,
          },
        })),
    [sectionGroups, projectId],
  );

  if (!project) {
    return <div className="page"><p className="empty">{t('common.error')}</p></div>;
  }

  // A Kanban is only offered where sections exist to give it columns.
  const modes = sections.length > 0
    ? (['list', 'board', 'calendar'] as const)
    : (['list', 'calendar'] as const);

  return (
    <div className="page">
      <PageHeader
        title={project.name}
        subtitle={
          <EditableDescription
            value={project.description ?? ''}
            placeholder={t('project.editDescription')}
            onCommit={(next) => void updateProjectFields(projectId, { description: next })}
          />
        }
        actions={
          <>
            <DisplayMenu
              viewKey={viewKey}
              modes={[...modes]}
              groups={['none', 'scheduled', 'priority', 'label', 'estimate', 'day']}
            />
            <button className="btn accent" onClick={onInsights}>
              <Icon name="trend" />
              {t('toolbar.insights')}
            </button>
          </>
        }
        load={load}
        onOpenUnestimated={load.unestimatedCount > 0 ? onUnestimated : undefined}
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
          {sectionGroups.map((group, index) => (
            <Fragment key={group.id}>
            <AddSectionLine
              label={t('section.add')}
              onAdd={() => void addSection(index)}
            />
            <TaskGroup
              title={group.title}
              sectionId={group.id === 'none' ? undefined : group.id}
              onRename={
                group.id === 'none'
                  ? undefined
                  : (name) => void updateSectionFields(group.id, { name })
              }
              items={group.items}
              childrenOf={childrenOf}
              onOpen={onOpen}
              showProject={false}
              dropTarget={{
                kind: 'section',
                sectionId: group.id === 'none' ? null : group.id,
                projectId,
              }}
              onAddTask={() =>
                onAddTaskTo({ projectId, sectionId: group.id === 'none' ? undefined : group.id })
              }
              descriptionSlot={
                group.id === 'none' ? null : (
                  <EditableDescription
                    value={group.description ?? ''}
                    placeholder={t('section.addDescription')}
                    clampLines={2}
                    onCommit={(next) => void updateSectionFields(group.id, { description: next })}
                  />
                )
              }
            />
            </Fragment>
          ))}
          <AddSectionLine
            label={t('section.add')}
            onAdd={() => void addSection(sectionGroups.length)}
          />
          {scoped.length === 0 && <p className="empty">{t('task.noTasks')}</p>}
        </div>
      ) : current.mode === 'list' && current.group === 'scheduled' ? (
        <div className="mode">
          <TaskGroup
            title={t('section.scheduled')}
            items={sorted(scoped.filter((i) => i.due !== null))}
            childrenOf={childrenOf}
            onOpen={onOpen}
            showProject={false}
            onAddTask={() => onAddTaskTo({ projectId })}
          />
          <TaskGroup
            title={t('section.available')}
            items={sorted(scoped.filter((i) => i.due === null))}
            childrenOf={childrenOf}
            onOpen={onOpen}
            showProject={false}
            onAddTask={() => onAddTaskTo({ projectId })}
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
