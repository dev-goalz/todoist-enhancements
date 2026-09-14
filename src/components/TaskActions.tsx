import { useEffect, useRef, useState } from 'react';
import { addDays, nextMonday } from 'date-fns';
import { Icon } from './Icon';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { useConfirm } from './overlays/Confirm';
import { withEstimate, effectiveEstimate } from '@/domain/estimates';
import { EstimateField } from './EstimateField';
import { toApiDate } from '@/domain/dates';
import { markerStyle } from '@/domain/colors';
import { dropMutation, type DropTarget } from '@/domain/dnd';
import { updateItem, moveItem } from '@/api/commands';
import type { Item, Snapshot } from '@/domain/types';

interface TaskActionsProps {
  item: Item;
  childrenOf: (id: string) => Item[];
  onOpen: (id: string) => void;
}

/**
 * The controls that appear on a row when the pointer is over it.
 *
 * Each one is an icon with a real label and tooltip, so nothing depends on the
 * reader guessing what a glyph does.
 */
export function TaskActions({ item, childrenOf, onOpen }: TaskActionsProps) {
  const { t } = useT();
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const skipOccurrence = useStore((s) => s.skipOccurrence);
  const confirm = useConfirm();
  const snapshot = useStore((s) => s.snapshot);
  const apply = useStore((s) => s.apply);
  const toast = useStore((s) => s.toast);
  const [menu, setMenu] = useState<'none' | 'schedule' | 'more' | 'estimate' | 'move'>('none');
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (menu === 'none') return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu('none');
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu('none'); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const { minutes, computed } = effectiveEstimate(item, childrenOf);

  /* Moving a task means moving it to another project. Where it sits in time is
     the schedule menu's business, which is the button next to this one. */
  const projects = Object.values(snapshot.projects)
    .filter((p) => !p.is_deleted && !p.is_archived && !p.is_folder)
    .sort((a, b) => a.child_order - b.child_order);

  /**
   * Sends the task to a view.
   *
   * The destination decides the change, using the same table drag and drop
   * uses, so dropping onto "anytime this week" and choosing it from this menu
   * do exactly the same thing.
   */
  async function moveTo(target: DropTarget, destination: string) {
    setMenu('none');
    const mutation = dropMutation(item, target);
    if (!mutation) return;

    const before = { due: item.due, labels: item.labels };
    const patch = (fields: Record<string, unknown>) => (snap: Snapshot): Snapshot => ({
      ...snap,
      items: { ...snap.items, [item.id]: { ...snap.items[item.id], ...fields } as Item },
    });

    if (mutation.update) {
      await apply([updateItem(item.id, mutation.update)], patch(mutation.update));
    } else if (mutation.move) {
      await apply([moveItem(item.id, mutation.move)], patch(mutation.move));
    }

    toast(t('task.movedTo', { destination }), () => {
      void apply([updateItem(item.id, before)], patch(before));
    });
  }

  function schedule(date: Date | null) {
    setMenu('none');
    void updateTask(item.id, {
      due: date
        ? {
            date: toApiDate(date),
            timezone: item.due?.timezone ?? null,
            string: toApiDate(date),
            lang: item.due?.lang ?? 'en',
            is_recurring: item.due?.is_recurring ?? false,
          }
        : null,
    });
  }

  return (
    <span className="trow-actions" ref={ref} onClick={(e) => e.stopPropagation()}>
      {menu === 'estimate' ? (
        <EstimateField
          autoFocus
          minutes={computed ? null : minutes}
          onCancel={() => setMenu('none')}
          onCommit={(value) => {
            setMenu('none');
            void updateTask(item.id, { labels: withEstimate(item.labels, value) });
          }}
        />
      ) : (
        <>
          <button
            aria-label={t('detail.title')}
            title={t('detail.title')}
            onClick={() => onOpen(item.id)}
          >
            <Icon name="edit" size="sm" />
          </button>
          <button
            aria-label={t('task.setEstimate')}
            title={t('task.setEstimate')}
            onClick={() => setMenu('estimate')}
          >
            <Icon name="clock" size="sm" />
          </button>
        </>
      )}

      <button
        aria-label={t('task.schedule')}
        title={t('task.schedule')}
        aria-expanded={menu === 'schedule'}
        onClick={() => setMenu(menu === 'schedule' ? 'none' : 'schedule')}
      >
        <Icon name="calendar" size="sm" />
      </button>

      <button
        aria-label={t('task.moveToProject')}
        title={t('task.moveToProject')}
        aria-expanded={menu === 'move'}
        onClick={() => setMenu(menu === 'move' ? 'none' : 'move')}
      >
        <Icon name="project" size="sm" />
      </button>

      <button
        aria-label={t('task.moreActions')}
        title={t('task.moreActions')}
        aria-expanded={menu === 'more'}
        onClick={() => setMenu(menu === 'more' ? 'none' : 'more')}
      >
        <Icon name="more" size="sm" />
      </button>

      {menu === 'schedule' && (
        <div className="popover rowmenu" role="menu">
          <h5>{t('task.schedule')}</h5>
          <button className="opt" onClick={() => schedule(new Date())}>
            <span><Icon name="week" size="sm" /> {t('common.today')}</span>
          </button>
          <button className="opt" onClick={() => schedule(addDays(new Date(), 1))}>
            <span><Icon name="arrow-right" size="sm" /> {t('common.tomorrow')}</span>
          </button>
          <button className="opt" onClick={() => schedule(nextMonday(new Date()))}>
            <span><Icon name="upcoming" size="sm" /> {t('task.nextWeek')}</span>
          </button>

          {item.due?.is_recurring && (
            <>
              <hr />
              <button
                className="opt"
                onClick={() => { setMenu('none'); void skipOccurrence(item.id); }}
              >
                <span><Icon name="repeat" size="sm" /> {t('task.nextOccurrence')}</span>
              </button>
              <p className="menuhint">{t('task.nextOccurrenceHint')}</p>
            </>
          )}

          {item.due && (
            <>
              <hr />
              <button className="opt" onClick={() => schedule(null)}>
                <span><Icon name="close" size="sm" /> {t('task.removeDate')}</span>
              </button>
            </>
          )}
        </div>
      )}

      {menu === 'move' && (
        <div className="popover rowmenu movemenu" role="menu">
          <h5>{t('task.moveToProject')}</h5>
          {projects.map((project) => (
            <button
              key={project.id}
              className="opt"
              aria-checked={project.id === item.project_id}
              onClick={() =>
                void moveTo({ kind: 'project', projectId: project.id }, project.name)}
            >
              <span>
                <span className="hash" style={markerStyle(project.color)}>#</span>
                {project.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {menu === 'more' && (
        <div className="popover rowmenu" role="menu">
          <button className="opt" onClick={() => { setMenu('none'); onOpen(item.id); }}>
            <span><Icon name="edit" size="sm" /> {t('detail.title')}</span>
          </button>
          <button
            className="opt"
            onClick={() => {
              setMenu('none');
              window.open(`https://app.todoist.com/app/task/${item.id}`, '_blank', 'noopener');
            }}
          >
            <span><Icon name="external" size="sm" /> {t('task.openInTodoist')}</span>
          </button>
          <hr />
          <button
            className="opt danger"
            onClick={() => {
              setMenu('none');
              // Deleting is irreversible here, so it is always confirmed.
              void confirm({
                title: t('task.deleteTitle'),
                body: t('task.deleteConfirm', { name: item.content }),
                confirmLabel: t('task.delete'),
                destructive: true,
              }).then((ok) => { if (ok) void removeTask(item.id); });
            }}
          >
            <span><Icon name="close" size="sm" /> {t('task.delete')}</span>
          </button>
        </div>
      )}
    </span>
  );
}
