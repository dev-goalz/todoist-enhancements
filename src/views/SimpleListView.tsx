import { useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { SubtasksProvider } from '@/components/TaskRow';
import { DisplayMenu } from '@/components/DisplayMenu';
import { ModeSurface } from '@/components/ModeSurface';
import { TaskGroup } from '@/components/TaskGroup';
import { Icon } from '@/components/Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import { viewPrefs } from '@/store/prefs';
import { applyFilters, rootItems } from '@/store/selectors';
import { somedayItems, hasLabel } from '@/domain/views';
import { summariseLoad } from '@/domain/load';
import type { TranslationKey } from '@/i18n';
import type { Item } from '@/domain/types';

interface SimpleListViewProps {
  kind: 'someday' | 'inbox' | 'label';
  labelName?: string;
  onOpen: (id: string) => void;
  onInsights: () => void;
  onUnestimated: () => void;
  onAddTaskTo: (placement: { projectId?: string; sectionId?: string; date?: string }) => void;
}

/**
 * The pages whose content is one flat selection: Someday, Inbox, and any tag
 * page such as Quick, Automation or Waiting.
 *
 * Someday deliberately shows no capacity percentage: a backlog has no deadline
 * to measure itself against.
 */
function SimpleListBody({
  kind, labelName, onOpen, onInsights, onUnestimated, onAddTaskTo,
}: SimpleListViewProps) {
  const { t } = useT();
  const { snapshot, items, childrenOf } = useData();
  const prefs = useStore((s) => s.prefs);
  const viewKey = kind === 'label' ? `label:${labelName}` : kind;
  const current = viewPrefs(prefs, viewKey);

  const scoped = useMemo(() => {
    const roots = rootItems(items);
    let selection: Item[];

    if (kind === 'someday') {
      selection = somedayItems(roots);
    } else if (kind === 'inbox') {
      const inboxId = snapshot.user?.inbox_project_id;
      selection = inboxId ? roots.filter((i) => i.project_id === inboxId) : [];
    } else {
      selection = labelName ? roots.filter((i) => hasLabel(i, labelName)) : [];
    }

    return applyFilters(selection, current.filters, snapshot, childrenOf);
  }, [items, kind, labelName, current.filters, snapshot, childrenOf]);

  const load = useMemo(
    () => summariseLoad(scoped, childrenOf, null),
    [scoped, childrenOf],
  );

  const title = kind === 'label' ? (labelName ?? '') : t(`nav.${kind}` as TranslationKey);

  return (
    <div className="page">
      <PageHeader
        title={title}
        actions={
          <>
            <DisplayMenu
              viewKey={viewKey}
              modes={['list', 'board']}
              groups={['none', 'project', 'priority', 'label', 'estimate']}
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


      {kind === 'someday' && current.mode === 'list' && current.group === 'none' ? (
        <div className="mode">
          <TaskGroup
            items={scoped}
            childrenOf={childrenOf}
            onOpen={onOpen}
            dropTarget={{ kind: 'someday' }}
            onAddTask={() => onAddTaskTo({})}
          />
        </div>
      ) : (
        <ModeSurface
          items={scoped}
          childrenOf={childrenOf}
          mode={current.mode}
          group={current.group}
          sort={current.sort}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

export function SimpleListView(props: SimpleListViewProps) {
  const prefs = useStore((s) => s.prefs);
  const viewKey = props.kind === 'label' ? `label:${props.labelName}` : props.kind;
  return (
    <SubtasksProvider value={viewPrefs(prefs, viewKey).filters.showSubtasks}>
      <SimpleListBody {...props} />
    </SubtasksProvider>
  );
}
