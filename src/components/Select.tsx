import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { markerStyle } from '@/domain/colors';

export interface SelectOption {
  value: string;
  label: string;
  /** A Todoist colour name, drawn as the project marker beside the label. */
  marker?: string;
}

interface SelectProps {
  /** Printed above the control. Omit it when the row already names the setting. */
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Used as the accessible name when no visible label is printed. */
  ariaLabel?: string;
  /** Shown when nothing matches the current value. */
  placeholder?: string;
}

/**
 * A select drawn entirely by us.
 *
 * It used to keep a native `<select>` underneath and paint a face on top,
 * which was a reasonable trade until you actually clicked one: macOS opens its
 * own list, in its own type, at its own size, in the middle of a dialog this
 * app drew — and the seam is the only thing you see. So the list is ours too.
 *
 * What the native control was giving us is rebuilt rather than dropped: arrow
 * keys and Home/End move the highlight, typing jumps to a match, Enter
 * chooses, Escape closes, and the list is drawn into the document so no
 * scrolling box can clip it.
 */
export function Select({
  label, value, options, onChange, ariaLabel, placeholder,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });

  const current = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  // Opening starts on what is already chosen, not at the top of the list.
  useEffect(() => {
    if (!open) return;
    const at = options.findIndex((option) => option.value === value);
    setActive(at < 0 ? 0 : at);
  }, [open, options, value]);

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current?.getBoundingClientRect();
    if (!button) return;
    const height = listRef.current?.offsetHeight ?? 240;
    const margin = 8;
    const below = button.bottom + 4;
    const top = below + height > window.innerHeight - margin
      ? Math.max(margin, button.top - height - 4)
      : below;
    setPosition({ top, left: button.left, width: button.width });
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (listRef.current?.contains(event.target as Node)) return;
      if (buttonRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', dismiss);
    window.addEventListener('resize', () => setOpen(false));
    window.addEventListener('scroll', () => setOpen(false), true);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      window.removeEventListener('resize', () => setOpen(false));
      window.removeEventListener('scroll', () => setOpen(false), true);
    };
  }, [open]);

  // The highlighted row is kept in view as the highlight moves.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function choose(at: number) {
    const option = options[at];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  /** Typing a letter jumps to the next option starting with it. */
  function typeAhead(key: string) {
    const now = Date.now();
    typed.current.text = now - typed.current.at > 600 ? key : typed.current.text + key;
    typed.current.at = now;
    const query = typed.current.text.toLowerCase();
    const from = typed.current.text.length === 1 ? active + 1 : active;
    for (let step = 0; step < options.length; step += 1) {
      const at = (from + step) % options.length;
      if (options[at].label.toLowerCase().startsWith(query)) {
        setActive(at);
        return;
      }
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); return; }
    if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); choose(active); return; }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((at) => (at + 1) % options.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((at) => (at - 1 + options.length) % options.length);
      return;
    }
    if (event.key === 'Home') { event.preventDefault(); setActive(0); return; }
    if (event.key === 'End') { event.preventDefault(); setActive(options.length - 1); return; }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) typeAhead(event.key);
  }

  const list = open && (
    <div
      className="popover listbox"
      role="listbox"
      aria-label={ariaLabel ?? label}
      ref={listRef}
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        minWidth: position?.width,
        visibility: position ? undefined : 'hidden',
      }}
    >
      {options.map((option, at) => (
        <button
          key={option.value}
          type="button"
          role="option"
          aria-selected={option.value === value}
          data-active={at === active || undefined}
          className={`opt${at === active ? ' active' : ''}`}
          onMouseEnter={() => setActive(at)}
          onMouseDown={(event) => { event.preventDefault(); choose(at); }}
        >
          {option.marker !== undefined && (
            <span className="hash" style={markerStyle(option.marker)}>#</span>
          )}
          <span className="listbox-label">{option.label}</span>
          {option.value === value && <Icon name="check" size="sm" />}
        </button>
      ))}
    </div>
  );

  return (
    <span className="fselect">
      {label && <span className="fselect-label">{label}</span>}
      <button
        type="button"
        ref={buttonRef}
        className={`fselect-face${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        {current?.marker !== undefined && (
          <span className="hash" style={markerStyle(current.marker)}>#</span>
        )}
        <span className="fselect-value">{current?.label ?? placeholder ?? ''}</span>
        <Icon name="caret" size="sm" />
      </button>
      {list && createPortal(list, document.body)}
    </span>
  );
}
