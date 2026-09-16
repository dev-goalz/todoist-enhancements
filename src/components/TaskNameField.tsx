import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { markerStyle } from '@/domain/colors';
import {
  carryRanges, parseShorthand, type HighlightKind, type TextRange,
} from '@/domain/shorthand';
import { useStore } from '@/store/store';
import { useT } from '@/hooks/useT';
import type { Snapshot } from '@/domain/types';

/** The `@tag` or `#project` the caret is currently inside, if any. */
function tokenAtCaret(
  value: string, caret: number,
): { sigil: '@' | '#'; query: string; start: number } | null {
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
  /** The readings turned down so far, as positions in `value`. */
  refusals: TextRange[];
  /**
   * The refusals after a gesture or an edit. `refused` is set when this call
   * is a new refusal, so the caller can put back the field that reading had
   * filled in; `restored` when one is taken back.
   */
  onRefusals: (
    next: TextRange[],
    change?:
      | { kind: 'refused'; range: TextRange; reading: HighlightKind }
      | { kind: 'restored'; range: TextRange },
  ) => void;
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
  refusals, onRefusals,
}: TaskNameFieldProps) {
  const { t } = useT();
  const createLabel = useStore((s) => s.createLabel);
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);

  const { ranges } = parseShorthand(value, snapshot, naturalDates, refusals);
  const token = tokenAtCaret(value, caret);

  /**
   * The refusals that are still refusing something.
   *
   * A refusal only earns its dotted line if taking it back would put a mark
   * exactly where it sits: after enough editing around it, the parser may have
   * nothing to say about those words any more, and an underline offering to
   * restore a reading that no longer exists is a lie. Re-reading the name once
   * per refusal is cheap — there are never more than a few, and the name is one
   * line long.
   */
  const live = refusals.filter((refusal) => {
    const without = refusals.filter((other) => other !== refusal);
    return parseShorthand(value, snapshot, naturalDates, without).ranges.some(
      (mark) => mark.start === refusal.start && mark.end === refusal.end,
    );
  });

  /** Turns a reading down, and tells the caller which field it had filled. */
  const refuse = (mark: { start: number; end: number; kind: HighlightKind }) => {
    onRefusals(
      [...refusals, { start: mark.start, end: mark.end }],
      { kind: 'refused', range: { start: mark.start, end: mark.end }, reading: mark.kind },
    );
  };

  /** Takes a refusal back, so the words are read again. */
  const restore = (range: TextRange) => {
    onRefusals(
      refusals.filter((other) => other !== range),
      { kind: 'restored', range },
    );
  };

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

  /**
   * Everything the mirror draws: the marks, and the refusals under their
   * dotted line. A refusal that a new mark has grown over is left out — one
   * run of text cannot be both read and refused.
   */
  const spans: Array<TextRange & { kind?: HighlightKind; refused?: TextRange }> = [
    ...ranges.map((range) => ({ start: range.start, end: range.end, kind: range.kind })),
    ...live
      .filter((r) => !ranges.some((mark) => r.start < mark.end && r.end > mark.start))
      .map((r) => ({ start: r.start, end: r.end, refused: r })),
  ].sort((a, b) => a.start - b.start);

  const pieces: Array<{ text: string; kind?: HighlightKind; refused?: boolean }> = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) pieces.push({ text: value.slice(cursor, span.start) });
    pieces.push({
      text: value.slice(span.start, span.end),
      kind: span.kind,
      refused: span.refused !== undefined,
    });
    cursor = span.end;
  }
  if (cursor < value.length) pieces.push({ text: value.slice(cursor) });

  const track = (el: HTMLInputElement) => setCaret(el.selectionStart ?? el.value.length);

  /**
   * A click inside a marked word turns the reading off, and a click inside a
   * refused one turns it back on.
   *
   * Strictly inside: a click landing exactly at either edge is somebody
   * putting the caret beside the word, not somebody aiming at it.
   */
  const clicked = (at: number) => {
    const span = spans.find((s) => at > s.start && at < s.end);
    if (!span) return;
    if (span.refused) restore(span.refused);
    else if (span.kind) refuse({ start: span.start, end: span.end, kind: span.kind });
  };

  return (
    <div className="namefield">
      <div className="namemirror" ref={mirrorRef} aria-hidden="true">
        {pieces.map((piece, index) =>
          piece.kind || piece.refused
            ? (
              <mark
                className={`nmark ${piece.refused ? 'refused' : piece.kind}`}
                key={index}
              >
                {piece.text}
              </mark>
            )
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
        onChange={(e) => {
          /* The refusals are positions in the text being edited, so they move
             with it before anything is read from it again. */
          const next = e.target.value;
          const carried = carryRanges(refusals, value, next);
          if (carried.length !== refusals.length
            || carried.some((r, at) => r.start !== refusals[at].start)) {
            onRefusals(carried);
          }
          onChange(next);
          track(e.target);
        }}
        onSelect={(e) => track(e.currentTarget)}
        onClick={(e) => {
          track(e.currentTarget);
          clicked(e.currentTarget.selectionStart ?? 0);
        }}
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
          /* Backspace against a mark takes the reading off rather than the
             letter: the word was typed on purpose, it is the app's reading of
             it that was not wanted. A second Backspace deletes, as usual,
             because by then there is no reading left to refuse. */
          if (e.key === 'Backspace') {
            const input = e.currentTarget;
            const at = input.selectionStart ?? 0;
            if (at === input.selectionEnd) {
              const mark = ranges.find((range) => range.end === at);
              if (mark) {
                e.preventDefault();
                refuse(mark);
                return;
              }
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
