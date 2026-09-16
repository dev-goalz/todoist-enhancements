import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { DateField } from './DateField';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { useConfirm } from './overlays/Confirm';
import { markerStyle } from '@/domain/colors';
import { toDisplayPriority, toTodoistPriority, type DisplayPriority } from '@/domain/types';
import type { DropTarget } from '@/domain/dnd';

/**
 * One button in the bar, and the panel it opens.
 *
 * Every property a selection can be changed by gets the same control: an icon,
 * the name of the property, and a panel above the bar — above, because the bar
 * itself is pinned to the foot of the window and a menu dropping out of it
 * would open off the bottom of the page. It closes on a click outside and on
 * Escape, and the Escape it swallows is its own: the one that clears the
 * selection belongs to the bar, and should not also throw the menu away.
 */
function BulkMenu({
  icon, label, children,
}: { icon: IconName; label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="bulkmenu" ref={ref}>
      <button className="btn sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name={icon} size="sm" />
        {label}
        <Icon name="caret" size="sm" />
      </button>
      {open && (
        <div className="popover bulkpop" role="menu" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/**
 * What to do with the tasks you picked out.
 *
 * It exists only while something is selected, and it stays in one place at the
 * foot of the window rather than following the rows around: a bar that moves
 * is a bar you have to find again after every change. Each button is the same
 * change the drop table already defines, applied to the whole set as one
 * request with one undo — the selection was one decision, so taking it back
 * should be one too.
 *
 * One button per property rather than a row of date shortcuts: a date was the
 * only thing a selection could be given, so moving fifteen tasks to a project,
 * or taking one tag off all of them, meant opening fifteen tasks.
 */
export function BulkBar() {
  const { t } = useT();
  const confirm = useConfirm();
  const selection = useStore((s) => s.selection);
  const clearSelection = useStore((s) => s.clearSelection);
  const sendManyTo = useStore((s) => s.sendManyTo);
  const removeTasks = useStore((s) => s.removeTasks);
  const updateMany = useStore((s) => s.updateMany);
  const moveMany = useStore((s) => s.moveMany);
  const snapshot = useStore((s) => s.snapshot);
  const [date, setDate] = useState('');

  if (selection.length === 0) return null;

  const count = selection.length;
  const picked = selection.map((id) => snapshot.items[id]).filter(Boolean);

  const send = async (target: DropTarget, destination: string) => {
    const ids = selection;
    clearSelection();
    await sendManyTo(ids, target, destination);
  };

  const remove = async () => {
    const ids = selection;
    const ok = await confirm({
      title: t('task.deleteTitle'),
      body: t('bulk.deleteConfirm', { count: ids.length }),
      confirmLabel: t('task.delete'),
      destructive: true,
    });
    if (!ok) return;
    clearSelection();
    await removeTasks(ids);
  };

  const projects = Object.values(snapshot.projects)
    .filter((p) => !p.is_archived && !p.is_deleted && !p.is_folder)
    .sort((a, b) => a.child_order - b.child_order);

  /* Only the tags in play, plus every tag that exists: the point of the panel
     is usually to take one off, and the ones already on the selection are the
     answer to that. Estimates are labels too, and are not tags — they have a
     field of their own everywhere else in the app. */
  const tags = Object.values(snapshot.labels)
    .filter((l) => !l.is_deleted && !l.name.startsWith('est-'))
    .sort((a, b) => a.item_order - b.item_order);

  /** How many of the selected tasks carry this tag: none, some, or all. */
  const tagState = (name: string): 'none' | 'some' | 'all' => {
    const on = picked.filter((item) => item.labels.includes(name)).length;
    return on === 0 ? 'none' : on === picked.length ? 'all' : 'some';
  };

  const setTag = (name: string, on: boolean) => {
    const ids = selection;
    void updateMany(
      ids,
      (item) => {
        const has = item.labels.includes(name);
        if (has === on) return null;
        return {
          labels: on ? [...item.labels, name] : item.labels.filter((l) => l !== name),
        };
      },
      t(on ? 'bulk.tagAdded' : 'bulk.tagRemoved', { count: ids.length, name }),
    );
  };

  const setPriority = (priority: DisplayPriority) => {
    const ids = selection;
    clearSelection();
    void updateMany(
      ids,
      (item) =>
        toDisplayPriority(item.priority) === priority
          ? null
          : { priority: toTodoistPriority(priority) },
      t('bulk.prioritySet', { count: ids.length, priority: `P${priority}` }),
    );
  };

  return (
    <div className="bulkbar" role="toolbar" aria-label={t('bulk.title')}>
      <strong>{t('bulk.count', { count })}</strong>
      <span className="sep" aria-hidden="true" />

      <BulkMenu icon="calendar" label={t('bulk.date')}>
        {(close) => (
          <>
            <button
              className="opt"
              onClick={() => { close(); void send({ kind: 'today' }, t('common.today')); }}
            >
              <span>{t('review.to.today')}</span>
            </button>
            <button
              className="opt"
              onClick={() => { close(); void send({ kind: 'anytime' }, t('nav.week')); }}
            >
              <span>{t('review.to.anytime')}</span>
            </button>
            <button
              className="opt"
              onClick={() => { close(); void send({ kind: 'someday' }, t('nav.someday')); }}
            >
              <span>{t('review.to.someday')}</span>
            </button>
            <hr />
            {/* A date, rather than the three shortcuts, for the times the
                answer is neither today nor this week. */}
            <div className="bulkpop-date">
              <DateField
                value={date}
                label={t('task.schedule')}
                placeholder={t('bulk.pickDate')}
                onChange={(next) => {
                  setDate('');
                  if (!next) return;
                  close();
                  void send({ kind: 'day', date: new Date(`${next}T00:00:00`) }, next);
                }}
              />
            </div>
          </>
        )}
      </BulkMenu>

      <BulkMenu icon="project" label={t('bulk.move')}>
        {(close) => (
          <div className="bulkpop-list">
            {projects.map((project) => (
              <button
                key={project.id}
                className="opt"
                onClick={() => {
                  const ids = selection;
                  const name = project.inbox_project ? t('nav.inbox') : project.name;
                  close();
                  clearSelection();
                  void moveMany(ids, project.id, name);
                }}
              >
                <span>
                  <span className="hash" style={markerStyle(project.color)}>#</span>
                  {project.inbox_project ? t('nav.inbox') : project.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </BulkMenu>

      <BulkMenu icon="tag" label={t('bulk.labels')}>
        {() => (
          <>
            <p className="menuhint">{t('bulk.labelsHint')}</p>
            <div className="bulkpop-list">
              {tags.length === 0 && <p className="menuhint">{t('labels.none')}</p>}
              {tags.map((label) => {
                const state = tagState(label.name);
                return (
                  <label className="checkrow" key={label.id}>
                    <input
                      type="checkbox"
                      checked={state === 'all'}
                      /* Some of them, not all: the box says so rather than
                         pretending the answer is no, and clicking it puts the
                         tag on the ones that are missing it. */
                      ref={(node) => { if (node) node.indeterminate = state === 'some'; }}
                      onChange={() => setTag(label.name, state !== 'all')}
                    />
                    <Icon name="tag" size="sm" className="taglabel" style={markerStyle(label.color, false)} />
                    <span>{label.name}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </BulkMenu>

      <BulkMenu icon="flag" label={t('bulk.priority')}>
        {(close) => (
          <>
            {([1, 2, 3, 4] as const).map((p) => (
              <button
                key={p}
                className="opt"
                onClick={() => { close(); setPriority(p); }}
              >
                <span>
                  <Icon name="flag" size="sm" className={`bulkflag p${p}`} />
                  {`P${p}`}
                </span>
              </button>
            ))}
          </>
        )}
      </BulkMenu>

      <span className="sep" aria-hidden="true" />
      <button className="btn sm danger" onClick={() => void remove()}>
        <Icon name="close" size="sm" />
        {t('task.delete')}
      </button>
      <button className="btn sm quiet" onClick={clearSelection}>
        {t('bulk.clear')}
      </button>
    </div>
  );
}
