import { useEffect, useMemo, useRef, useState } from 'react';
import { TaskGroup } from './TaskGroup';
import { Icon } from './Icon';
import { DraggableTask } from './dnd/DraggableTask';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import type { DisplayMode, GroupKey, Item, SortKey } from '@/domain/types';
import { groupItems, sortItems } from '@/store/selectors';
import { formatRelativeDay } from '@/domain/dates';
import { formatDuration } from '@/domain/estimates';
import { summariseLoad } from '@/domain/load';
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
  boardColumns?: Array<{
    id: string;
    title: string;
    items: Item[];
    dropTarget?: DropTarget;
    /** A day column knows its capacity, and shows its load against it. */
    capacityMinutes?: number | null;
  }>;
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
  const { t, locale } = useT();
  const groups = useGrouped(props);
  // Columns derived from a grouping are not drop destinations: dropping onto
  // "priority" or "tag" has no single unambiguous meaning.
  const columns: NonNullable<ModeSurfaceProps['boardColumns']> =
    props.boardColumns ??
    groups.map((g) => ({ id: g.key, title: g.title || t('common.all'), items: g.items }));

  const boardRef = useRef<HTMLDivElement>(null);
  const [reach, setReach] = useState({ left: false, right: false });

  /* The arrows are shown only when the board actually overflows, and each
     one goes dark at its end. Measured from the scroll position rather than
     counted, because how many columns fit depends on the window. */
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => {
      const max = board.scrollWidth - board.clientWidth;
      setReach({ left: board.scrollLeft > 1, right: board.scrollLeft < max - 1 });
    };
    measure();
    board.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => {
      board.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [columns.length]);

  const step = (direction: -1 | 1) => {
    const board = boardRef.current;
    const first = board?.querySelector<HTMLElement>('.col');
    if (!board || !first) return;
    const gap = parseFloat(getComputedStyle(board).columnGap || '16') || 16;
    board.scrollBy({ left: direction * (first.offsetWidth + gap), behavior: 'smooth' });
  };

  if (columns.length === 0) return <p className="empty">{t('task.noTasks')}</p>;

  return (
    /* The same measure as the list: columns share the page's width and edges. */
    <div className="mode">
      {(reach.left || reach.right) && (
        <div className="boardnav">
          <span className="pager">
            <button
              className="iconbtn"
              aria-label={t('board.previous')}
              title={t('board.previous')}
              disabled={!reach.left}
              onClick={() => step(-1)}
            >
              <Icon name="arrow-left" size="sm" />
            </button>
            <button
              className="iconbtn"
              aria-label={t('board.next')}
              title={t('board.next')}
              disabled={!reach.right}
              onClick={() => step(1)}
            >
              <Icon name="arrow-right" size="sm" />
            </button>
          </span>
        </div>
      )}
      <div className={`board${props.group === 'day' ? ' days' : ''}`} ref={boardRef}>
        {columns.map((column) => {
          /* The column's own header line: time, what is still unestimated and,
             where the column is a day, how full it is. */
          const load = summariseLoad(column.items, props.childrenOf, column.capacityMinutes ?? null);
          const parts = [
            load.estimatedMinutes > 0 ? formatDuration(load.estimatedMinutes, locale) : null,
            load.unestimatedCount > 0 ? t('metrics.unestimated', { count: load.unestimatedCount }) : null,
            load.percentage !== null ? `${load.percentage} %` : null,
          ].filter((part): part is string => part !== null);
          // An empty column has nothing to measure; "0 %" under it is noise.
          if (column.items.length === 0) parts.length = 0;
          const body = (isOver: boolean) => (
            <section className={`col${isOver ? ' dropping' : ''}`}>
            <div className="chead">
              <div className="chead-title">
                <strong>{column.title}</strong>
                <small>{t('metrics.tasks', { count: column.items.length })}</small>
              </div>
            </div>
            {parts.length > 0 && (
              <p className={`cload${load.level === 'over' ? ' over' : ''}`}>{parts.join(' · ')}</p>
            )}
            {column.items.map((item) => (
              <DraggableTask
                key={item.id}
                item={item}
                childrenOf={props.childrenOf}
                onOpen={props.onOpen}
                showProject={props.showProject}
                surface="card"
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
