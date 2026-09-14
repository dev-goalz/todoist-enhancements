import { useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Toolbar } from '@/components/Toolbar';
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
  onAddTask: () => void;
  onInsights: () => void;
}

/**
 * The pages whose content is one flat selection: Someday, Inbox, and any tag
 * page such as Quick, Automation or Waiting.
 *
 * Someday deliberately shows no capacity percentage: a backlog has no deadline
 * to measure itself against.
 */
export function SimpleListView({
  kind, labelName, onOpen, onAddTask, onInsights,
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
  const subtitle = kind === 'label' ? undefined : t(`${kind}.subtitle` as TranslationKey);

  return (
    <div className="page">
      <PageHeader
        title={title}
        subtitle={subtitle}
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
        modes={['list', 'board', 'focus']}
        groups={['none', 'project', 'priority', 'label', 'estimate']}
        onInsights={onInsights}
      />

      {kind === 'someday' && current.mode === 'list' && current.group === 'none' ? (
        <div className="mode">
          <TaskGroup
            items={scoped}
            childrenOf={childrenOf}
            onOpen={onOpen}
            dropTarget={{ kind: 'someday' }}
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
