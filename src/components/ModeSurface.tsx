import { useMemo } from 'react';
import { TaskGroup } from './TaskGroup';
import { DraggableTask } from './dnd/DraggableTask';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import type { DisplayMode, GroupKey, Item, SortKey } from '@/domain/types';
import { groupItems, sortItems } from '@/store/selectors';
import { formatRelativeDay } from '@/domain/dates';
import { Droppable } from './dnd/Droppable';
import type { DropTarget } from '@/domain/dnd';
import type { TranslationKey } from '@/i18n';

interface ModeSurfaceProps {
  items: Item[];
  childrenOf: (id: string) => Item[];
  mode: DisplayMode;
  group: GroupKey;
  sort: SortKey;
  onOpen: (id: string) => void;
  showProject?: boolean;
  /** Board columns come from sections when a project supplies them. */
  boardColumns?: Array<{ id: string; title: string; items: Item[]; dropTarget?: DropTarget }>;
}

/**
 * Renders the same set of tasks the way the current mode asks for.
 *
 * List is the mode for scanning and administering, Board shows columns, and
 * Calendar places dated work on a month grid. A task carries the same
 * information and the same hover controls in every one of them.
 */
export function ModeSurface(props: ModeSurfaceProps) {
  const { mode } = props;
  if (mode === 'board') return <BoardSurface {...props} />;
  return <ListSurface {...props} />;
}

function useGrouped(props: ModeSurfaceProps) {
  const { t, locale } = useT();
  const snapshot = useStore((s) => s.snapshot);
  const { items, group, sort, childrenOf } = props;

  return useMemo(() => {
    const sorted = sortItems(items, sort, childrenOf);
    return groupItems(sorted, group, snapshot, {
      none: t('common.none'),
      noProject: t('nav.inbox'),
      noSection: t('group.noSection'),
      noEstimate: t('metrics.noEstimates'),
      noLabel: t('common.none'),
      priority: (p) => t(`common.p${p}` as TranslationKey),
      day: (d) => (d ? formatRelativeDay(d, locale) : t('common.none')),
    });
  }, [items, group, sort, childrenOf, snapshot, t, locale]);
}

function ListSurface(props: ModeSurfaceProps) {
  const { t } = useT();
  const groups = useGrouped(props);

  if (props.items.length === 0) {
    return <p className="empty">{t('task.noTasks')}</p>;
  }

  return (
    <div className="mode">
      {groups.map((group) => (
        <TaskGroup
          key={group.key}
          title={group.title || undefined}
          items={group.items}
          childrenOf={props.childrenOf}
          onOpen={props.onOpen}
          showProject={props.showProject}
        />
      ))}
    </div>
  );
}

function BoardSurface(props: ModeSurfaceProps) {
  const { t } = useT();
  const groups = useGrouped(props);
  // Columns derived from a grouping are not drop destinations: dropping onto
  // "priority" or "tag" has no single unambiguous meaning.
  const columns: NonNullable<ModeSurfaceProps['boardColumns']> =
    props.boardColumns ??
    groups.map((g) => ({ id: g.key, title: g.title || t('common.all'), items: g.items }));

  if (columns.length === 0) return <p className="empty">{t('task.noTasks')}</p>;

  return (
    /* Columns need more room than a reading measure allows. */
    <div className="mode wide">
      <div className={`board${props.group === 'day' ? ' days' : ''}`}>
        {columns.map((column) => {
          const body = (isOver: boolean) => (
            <section className={`col${isOver ? ' dropping' : ''}`}>
            <div className="chead">
              <div className="chead-title">
                <strong>{column.title}</strong>
                <small>{t('metrics.tasks', { count: column.items.length })}</small>
              </div>
            </div>
            {column.items.map((item) => (
              <DraggableTask
                key={item.id}
                item={item}
                childrenOf={props.childrenOf}
                onOpen={props.onOpen}
                showProject={props.showProject}
              />
            ))}
            {column.items.length === 0 && <p className="empty">{t('group.empty')}</p>}
            </section>
          );

          return column.dropTarget ? (
            <Droppable target={column.dropTarget} key={column.id}>
              {({ isOver }) => body(isOver)}
            </Droppable>
          ) : (
            <div key={column.id}>{body(false)}</div>
          );
        })}
      </div>
    </div>
  );
}
