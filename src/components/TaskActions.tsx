import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, nextMonday } from 'date-fns';
import { Icon } from './Icon';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { useConfirm } from './overlays/Confirm';
import { withEstimate, effectiveEstimate } from '@/domain/estimates';
import { EstimateField } from './EstimateField';
import { DateField } from './DateField';
import { formatDayOrName, toApiDate } from '@/domain/dates';
import { readNaturalDate } from '@/domain/nlp';
import { dateSuggestions, type DateSuggestion } from '@/domain/dateWords';
import { weekLabel } from '@/domain/types';
import { markerStyle } from '@/domain/colors';
import { dropMutation, type DropTarget } from '@/domain/dnd';
import { updateItem, moveItem } from '@/api/commands';
import type { Item, Snapshot } from '@/domain/types';

/** Two words that are the same word once accents and case are set aside. */
const sameWord = (a: string, b: string): boolean =>
  a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  === b.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
  const { t, locale } = useT();
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const skipOccurrence = useStore((s) => s.skipOccurrence);
  const confirm = useConfirm();
  const snapshot = useStore((s) => s.snapshot);
  const apply = useStore((s) => s.apply);
  const toast = useStore((s) => s.toast);
  const dateFormat = useStore((s) => s.prefs.dateFormat);
  const [menu, setMenu] = useState<'none' | 'schedule' | 'more' | 'estimate' | 'move'>('none');
  /** What has been typed into the schedule field, before it is a date. */
  const [typed, setTyped] = useState('');
  /** Which suggestion the keyboard is on; -1 means "what I typed". */
  const [pick, setPick] = useState(-1);
  const ref = useRef<HTMLSpanElement>(null);

  // A menu that opens holding the last thing typed into it is a menu lying
  // about what it will do if you press Enter.
  useEffect(() => { if (menu !== 'schedule') { setTyped(''); setPick(-1); } }, [menu]);

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

  /**
   * The date somebody typed, read the way the composer reads one.
   *
   * Three shortcuts answer most days and a calendar answers the rest, but
   * neither answers "next sunday" as fast as typing it. The field is the first
   * thing in the menu and has the focus, so the whole gesture is: click, type,
   * Enter.
   */
  const reading = useMemo(() => (typed.trim() ? readNaturalDate(typed) : null), [typed]);

  /* What the words could still turn into. Narrowing as you type is the whole
     point: "to" is both today and tomorrow, "tom" is only one of them. */
  const suggestions = useMemo(() => dateSuggestions(typed, locale), [typed, locale]);
  const chosen = pick >= 0 ? suggestions[pick] : undefined;

  function commitTyped(override?: DateSuggestion) {
    const reading = override?.reading ?? chosen?.reading ?? currentReading();
    if (!reading) return;
    setMenu('none');
    setTyped('');

    const iso = reading.date;
    const before = { due: item.due, labels: item.labels };
    const update = {
      due: {
        date: iso,
        timezone: item.due?.timezone ?? null,
        string: iso,
        lang: item.due?.lang ?? 'en',
        is_recurring: item.due?.is_recurring ?? false,
      },
      /* A real date and the week tag on the same task is the contradiction the
         app reports rather than resolves, so giving it a day takes the tag off
         — exactly as every other way of dating a task here does. */
      labels: item.labels.filter((l) => l.toLowerCase() !== weekLabel().toLowerCase()),
    };
    const patch = (fields: Record<string, unknown>) => (snap: Snapshot): Snapshot => ({
      ...snap,
      items: { ...snap.items, [item.id]: { ...snap.items[item.id], ...fields } as Item },
    });

    void apply([updateItem(item.id, update)], patch(update)).then(() => {
      toast(
        t('task.movedTo', {
          destination: formatDayOrName(new Date(iso.slice(0, 10)), locale, dateFormat),
        }),
        () => { void apply([updateItem(item.id, before)], patch(before)); },
      );
    });
  }

  /** The reading the field currently stands for, so the commit path has one. */
  function currentReading() { return reading; }

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
        <div className="popover rowmenu schedulemenu" role="menu">
          {/* Typing is the fastest way to say "next sunday", so it is the
              first thing here and it already has the caret. */}
          <input
            className="schedulefield"
            autoFocus
            value={typed}
            placeholder={t('task.typeDate')}
            aria-label={t('task.schedule')}
            onChange={(e) => { setTyped(e.target.value); setPick(-1); }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'ArrowDown' && suggestions.length > 0) {
                e.preventDefault();
                setPick((at) => (at + 1) % suggestions.length);
                return;
              }
              if (e.key === 'ArrowUp' && suggestions.length > 0) {
                e.preventDefault();
                setPick((at) => (at <= 0 ? suggestions.length - 1 : at - 1));
                return;
              }
              if (e.key === 'Enter') { e.preventDefault(); commitTyped(); }
              if (e.key === 'Escape') setMenu('none');
            }}
          />

          {/* Not a dropdown covering the menu: a row of words under the field,
              each carrying the day it would produce. */}
          {typed.trim() !== '' && (
            suggestions.length > 0 ? (
              <div className="schedulesuggest">
                {suggestions.map((option, at) => (
                  <button
                    key={option.label}
                    className={`chip${at === pick ? ' on' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); commitTyped(option); }}
                    onMouseEnter={() => setPick(at)}
                  >
                    {option.label}
                    {/* The day it produces, unless the word already is the
                        day: "demain — Demain" says one thing twice. */}
                    {(() => {
                      const day = formatDayOrName(
                        new Date(option.reading.date.slice(0, 10)), locale, dateFormat,
                      );
                      return sameWord(day, option.label) ? null : <small>{day}</small>;
                    })()}
                  </button>
                ))}
              </div>
            ) : (
              <p className={`schedulepreview${reading ? '' : ' none'}`}>
                {reading
                  ? formatDayOrName(new Date(reading.date.slice(0, 10)), locale, dateFormat)
                  : t('task.dateNotRead')}
              </p>
            )
          )}

          <button
            className="opt"
            onClick={() => void moveTo({ kind: 'today' }, t('common.today'))}
          >
            <span><Icon name="week" size="sm" /> {t('common.today')}</span>
          </button>
          <button
            className="opt"
            onClick={() =>
              void moveTo({ kind: 'day', date: addDays(new Date(), 1) }, t('common.tomorrow'))}
          >
            <span><Icon name="arrow-right" size="sm" /> {t('common.tomorrow')}</span>
          </button>
          <button
            className="opt"
            onClick={() =>
              void moveTo({ kind: 'day', date: nextMonday(new Date()) }, t('task.nextWeek'))}
          >
            <span><Icon name="upcoming" size="sm" /> {t('task.nextWeek')}</span>
          </button>

          {/* And a calendar, for a date it is easier to point at than to
              name. The same one the composer uses, so picking a date from a
              row and picking one while writing the task are the same control
              rather than two that drifted apart. */}
          <div className="rowmenu-date">
            <DateField
              value={item.due?.date.slice(0, 10) ?? ''}
              label={t('task.schedule')}
              placeholder={t('task.pickDate')}
              onChange={(next) => {
                if (!next) { schedule(null); return; }
                const day = new Date(`${next}T00:00:00`);
                void moveTo({ kind: 'day', date: day }, formatDayOrName(day, locale, dateFormat));
              }}
            />
          </div>

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
