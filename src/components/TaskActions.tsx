import { useEffect, useRef, useState } from 'react';
import { addDays, nextMonday } from 'date-fns';
import { Icon } from './Icon';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { parseDurationInput, withEstimate, effectiveEstimate } from '@/domain/estimates';
import { toApiDate } from '@/domain/dates';
import type { Item } from '@/domain/types';

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
  const [menu, setMenu] = useState<'none' | 'schedule' | 'more' | 'estimate'>('none');
  const [draft, setDraft] = useState('');
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

  function commitEstimate() {
    setMenu('none');
    const parsed = parseDurationInput(draft);
    if (parsed === null && draft.trim() !== '') return;
    void updateTask(item.id, { labels: withEstimate(item.labels, parsed) });
  }

  return (
    <span className="trow-actions" ref={ref} onClick={(e) => e.stopPropagation()}>
      {menu === 'estimate' ? (
        <input
          className="estinput"
          autoFocus
          value={draft}
          placeholder={t('task.estimatePlaceholder')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEstimate}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEstimate();
            if (e.key === 'Escape') setMenu('none');
          }}
        />
      ) : (
        <button
          aria-label={t('task.setEstimate')}
          title={t('task.setEstimate')}
          onClick={() => {
            setDraft(minutes !== null && !computed ? String(minutes) : '');
            setMenu('estimate');
          }}
        >
          <Icon name="clock" size="sm" />
        </button>
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
              // Deleting is irreversible in this app, so it is always confirmed.
              if (window.confirm(t('task.deleteConfirm', { name: item.content }))) {
                void removeTask(item.id);
              }
            }}
          >
            <span><Icon name="close" size="sm" /> {t('task.delete')}</span>
          </button>
        </div>
      )}
    </span>
  );
}
