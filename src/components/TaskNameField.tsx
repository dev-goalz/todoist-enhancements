import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { markerStyle } from '@/domain/colors';
import { readNaturalDate } from '@/domain/nlp';
import { useStore } from '@/store/store';
import { useT } from '@/hooks/useT';
import type { Snapshot } from '@/domain/types';

export type HighlightKind = 'date' | 'project' | 'priority' | 'label';

export interface Highlight {
  start: number;
  end: number;
  kind: HighlightKind;
}

/**
 * Everything the name is carrying, with the exact text that carries it.
 *
 * The composer needs the ranges, not just the values: what it takes out of the
 * name has to be marked in the name, or the user only finds out after saving.
 */
export function highlightRanges(
  raw: string, snapshot: Snapshot, naturalDates: boolean,
): Highlight[] {
  const out: Highlight[] = [];

  const project = raw.match(/#([\p{L}\p{N}_-]+)/u);
  if (project) {
    const wanted = project[1].toLowerCase().replace(/\s+/g, '');
    const known = Object.values(snapshot.projects).some(
      (p) => p.name.toLowerCase().replace(/\s+/g, '') === wanted,
    );
    if (known) out.push({ start: project.index!, end: project.index! + project[0].length, kind: 'project' });
  }

  const priority = raw.match(/\bp([1-4])\b/i);
  if (priority) {
    out.push({ start: priority.index!, end: priority.index! + priority[0].length, kind: 'priority' });
  }

  for (const label of raw.matchAll(/@([\p{L}\p{N}_-]+)/gu)) {
    out.push({ start: label.index!, end: label.index! + label[0].length, kind: 'label' });
  }

  if (naturalDates) {
    // The date is read from what is left once the syntax is taken out, so its
    // index has to be found back in the original string.
    const reading = readNaturalDate(raw);
    if (reading) {
      const at = raw.toLowerCase().indexOf(reading.matched.toLowerCase());
      if (at >= 0) out.push({ start: at, end: at + reading.matched.length, kind: 'date' });
    }
  }

  // Overlaps would break the mirror's markup, so the earliest wins.
  const sorted = out.sort((a, b) => a.start - b.start);
  const clean: Highlight[] = [];
  for (const range of sorted) {
    if (clean.length === 0 || range.start >= clean[clean.length - 1].end) clean.push(range);
  }
  return clean;
}

/** The `@tag` or `#project` the caret is currently inside, if any. */
function tokenAtCaret(value: string, caret: number): { sigil: '@' | '#'; query: string; start: number } | null {
  const before = value.slice(0, caret);
  const match = before.match(/(^|\s)([@#])([\p{L}\p{N}_-]*)$/u);
  if (!match) return null;
  return {
    sigil: match[2] as '@' | '#',
    query: match[3].toLowerCase(),
    start: caret - match[3].length - 1,
  };
}

interface TaskNameFieldProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  placeholder: string;
  ariaLabel: string;
  snapshot: Snapshot;
  naturalDates: boolean;
}

/**
 * The composer's name field.
 *
 * What the parser will take out of the name is marked inside the name while it
 * is typed, the way Todoist does it. An `<input>` cannot hold markup, so a
 * mirror of the same text sits behind it: transparent letters, coloured
 * rounded backgrounds. The real text stays in the real input, so selection,
 * the caret and every input method keep working.
 *
 * Typing `@` or `#` opens the matching list, because the alternative is
 * remembering the names of your own projects.
 */
export function TaskNameField({
  value, onChange, onSubmit, placeholder, ariaLabel, snapshot, naturalDates,
}: TaskNameFieldProps) {
  const { t } = useT();
  const createLabel = useStore((s) => s.createLabel);
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);

  const ranges = highlightRanges(value, snapshot, naturalDates);
  const token = tokenAtCaret(value, caret);

  const options = (() => {
    if (!token) return [];
    if (token.sigil === '#') {
      return Object.values(snapshot.projects)
        .filter((p) => !p.is_archived && !p.is_deleted && !p.is_folder)
        .filter((p) => p.name.toLowerCase().includes(token.query))
        .slice(0, 6)
        .map((p) => ({
          id: p.id, name: p.name, color: p.color, sigil: '#' as const, isNew: false,
        }));
    }
    const known = Object.values(snapshot.labels)
      .filter((l) => !l.is_deleted && !l.name.startsWith('est-'))
      .filter((l) => l.name.toLowerCase().includes(token.query))
      .slice(0, 6)
      .map((l) => ({ id: l.id, name: l.name, color: l.color, sigil: '@' as const, isNew: false }));

    /* A tag you have not made yet is the common case when you are typing one:
       the list offers to make it rather than silently matching nothing. */
    const exact = Object.values(snapshot.labels).some(
      (l) => !l.is_deleted && l.name.toLowerCase() === token.query,
    );
    if (token.query && !exact) {
      known.push({
        id: '__new__', name: token.query, color: 'charcoal', sigil: '@' as const, isNew: true,
      });
    }
    return known;
  })();

  useEffect(() => { setPick(0); }, [value, caret]);

  // The mirror must follow the input's own scroll, or the marks drift off the
  // text as soon as the name is longer than the field.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    if (!input || !mirror) return;
    const sync = () => { mirror.scrollLeft = input.scrollLeft; };
    sync();
    input.addEventListener('scroll', sync);
    return () => input.removeEventListener('scroll', sync);
  }, [value]);

  const choose = (name: string, isNew = false) => {
    if (!token) return;
    // Made before it is inserted, so the tag it names exists by the time the
    // task carrying it is saved.
    if (isNew) void createLabel(name);
    const needsQuotes = /\s/.test(name);
    const inserted = `${token.sigil}${needsQuotes ? name.replace(/\s+/g, '') : name} `;
    const next = value.slice(0, token.start) + inserted + value.slice(caret);
    onChange(next);
    const position = token.start + inserted.length;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(position, position);
      setCaret(position);
    });
  };

  /** The text split into plain runs and marked runs, for the mirror. */
  const pieces: Array<{ text: string; kind?: HighlightKind }> = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) pieces.push({ text: value.slice(cursor, range.start) });
    pieces.push({ text: value.slice(range.start, range.end), kind: range.kind });
    cursor = range.end;
  }
  if (cursor < value.length) pieces.push({ text: value.slice(cursor) });

  const track = (el: HTMLInputElement) => setCaret(el.selectionStart ?? el.value.length);

  return (
    <div className="namefield">
      <div className="namemirror" ref={mirrorRef} aria-hidden="true">
        {pieces.map((piece, index) =>
          piece.kind
            ? <mark className={`nmark ${piece.kind}`} key={index}>{piece.text}</mark>
            : <span key={index}>{piece.text}</span>,
        )}
        {/* A trailing space has no width of its own and would let the last mark
            sit flush against the field's edge. */}
        <span>{'\u200b'}</span>
      </div>

      <input
        ref={inputRef}
        className="composer-name"
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus
        value={value}
        onChange={(e) => { onChange(e.target.value); track(e.target); }}
        onSelect={(e) => track(e.currentTarget)}
        onClick={(e) => track(e.currentTarget)}
        onKeyUp={(e) => track(e.currentTarget)}
        onKeyDown={(e) => {
          if (options.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setPick((p) => (p + 1) % options.length);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setPick((p) => (p - 1 + options.length) % options.length);
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              choose(options[pick].name, options[pick].isNew);
              return;
            }
            if (e.key === 'Escape') {
              e.stopPropagation();
              setCaret(-1);
              return;
            }
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
      />

      {options.length > 0 && (
        <div className="popover namepicker" role="listbox">
          {options.map((option, index) => (
            <button
              key={option.id}
              role="option"
              aria-selected={index === pick}
              onMouseDown={(e) => { e.preventDefault(); choose(option.name, option.isNew); }}
              onMouseEnter={() => setPick(index)}
            >
              {option.sigil === '#'
                ? <span className="hash" style={markerStyle(option.color)}>#</span>
                : <Icon name={option.isNew ? 'plus' : 'tag'} size="sm" className="taglabel" style={markerStyle(option.color, false)} />}
              <span>{option.name}</span>
              {option.isNew && <small className="namepicker-new">{t('labels.createNew')}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
