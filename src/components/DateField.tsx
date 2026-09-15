import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  addDays, addMonths, endOfMonth, format, isSameDay, isSameMonth,
  startOfDay, startOfMonth, startOfWeek,
} from 'date-fns';
import { Icon } from './Icon';
import { useT } from '@/hooks/useT';
import { toApiDate } from '@/domain/dates';
import type { TranslationKey } from '@/i18n';

interface DateFieldProps {
  /** An API date string, or empty for no date. */
  value: string;
  onChange: (next: string) => void;
  /** The accessible name, and what the field says when it is empty. */
  label: string;
  placeholder?: string;
}

/** The shortcuts, because most dates a person picks are one of these four. */
const SHORTCUTS = [
  { key: 'today', days: 0 },
  { key: 'tomorrow', days: 1 },
  { key: 'nextWeek', days: 7 },
] as const;

/**
 * Choosing a date without leaving the app.
 *
 * `<input type="date">` is a different product every place it renders: a grey
 * three-part field on one platform, a full-bleed wheel on another, and on the
 * Mac a calendar drawn in the system's own type in the middle of a dialog this
 * app drew. This is a month, four shortcuts, and a way to clear it — in the
 * app's own type, at the app's own size, everywhere.
 */
export function DateField({ value, onChange, label, placeholder }: DateFieldProps) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(parse(value) ?? new Date()));
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = parse(value);

  // Opening lands on the month being edited, not on wherever it was left.
  useEffect(() => {
    if (open) setMonth(startOfMonth(parse(value) ?? new Date()));
  }, [open, value]);

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current?.getBoundingClientRect();
    if (!button) return;
    const height = panelRef.current?.offsetHeight ?? 340;
    const width = panelRef.current?.offsetWidth ?? 280;
    const margin = 8;
    const below = button.bottom + 4;
    const top = below + height > window.innerHeight - margin
      ? Math.max(margin, button.top - height - 4)
      : below;
    const left = Math.min(
      Math.max(margin, button.left),
      Math.max(margin, window.innerWidth - width - margin),
    );
    setPosition({ top, left });
  }, [open, month]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      if (buttonRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); }
    };
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* Six weeks from the Monday on or before the first of the month: always the
     same number of rows, so the panel never changes height as you page. */
  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, offset) => addDays(first, offset));
  }, [month]);

  const weekdays = useMemo(() => {
    const first = startOfWeek(new Date(), { weekStartsOn: 1 });
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, offset) => fmt.format(addDays(first, offset)));
  }, [locale]);

  function pick(day: Date) {
    onChange(toApiDate(day));
    setOpen(false);
    buttonRef.current?.focus();
  }

  const panel = open && (
    <div
      className="popover datepanel"
      role="dialog"
      aria-label={label}
      ref={panelRef}
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        visibility: position ? undefined : 'hidden',
      }}
    >
      <div className="datepanel-quick">
        {SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut.key}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); pick(addDays(startOfDay(new Date()), shortcut.days)); }}
          >
            {t(`date.${shortcut.key}` as TranslationKey)}
          </button>
        ))}
      </div>

      <div className="datepanel-head">
        <button
          type="button"
          className="iconbtn"
          aria-label={t('date.previousMonth')}
          onMouseDown={(e) => { e.preventDefault(); setMonth((m) => addMonths(m, -1)); }}
        >
          <Icon name="arrow-left" size="sm" />
        </button>
        <strong>
          {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)}
        </strong>
        <button
          type="button"
          className="iconbtn"
          aria-label={t('date.nextMonth')}
          onMouseDown={(e) => { e.preventDefault(); setMonth((m) => addMonths(m, 1)); }}
        >
          <Icon name="arrow-right" size="sm" />
        </button>
      </div>

      <div className="datepanel-week" aria-hidden="true">
        {weekdays.map((day, at) => <span key={at}>{day}</span>)}
      </div>

      <div className="datepanel-grid">
        {days.map((day) => {
          const outside = !isSameMonth(day, month);
          const isToday = isSameDay(day, new Date());
          const isChosen = selected !== null && isSameDay(day, selected);
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={`dateday${outside ? ' outside' : ''}${isToday ? ' today' : ''}${isChosen ? ' chosen' : ''}`}
              aria-pressed={isChosen}
              onMouseDown={(e) => { e.preventDefault(); pick(day); }}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {value && (
        <button
          type="button"
          className="datepanel-clear"
          onMouseDown={(e) => { e.preventDefault(); onChange(''); setOpen(false); }}
        >
          <Icon name="close" size="sm" />
          {t('date.clear')}
        </button>
      )}
    </div>
  );

  return (
    <span className="datefield">
      <button
        type="button"
        ref={buttonRef}
        className={`fselect-face${open ? ' open' : ''}${value ? '' : ' empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="calendar" size="sm" />
        <span className="fselect-value">
          {selected
            ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
              .format(selected)
            : (placeholder ?? label)}
        </span>
        <Icon name="caret" size="sm" />
      </button>
      {panel && createPortal(panel, document.body)}
    </span>
  );
}

/** An API date string back into a date, or null when there is not one. */
function parse(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Ends the month at its last day, for callers that need the bound. */
export const lastDayOf = (month: Date): Date => endOfMonth(month);
