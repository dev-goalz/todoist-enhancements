import { readNaturalDate } from './nlp';
import { readRecurrence, type RecurrenceLang } from './recurrence';
import { parseDurationInput } from './estimates';
import type { DisplayPriority, Snapshot } from './types';

/**
 * Everything a task's name is carrying, and exactly where it carries it.
 *
 * This used to be two functions in two files: one that produced the values and
 * one that produced the coloured marks behind the text. They read the same
 * string with two slightly different sets of rules, which is how a name could
 * end up marked as having a project it did not pass on, or a date shown in the
 * field that was not the date the task got. Marks and values are now the same
 * answer read once — a range is what was matched, and the value is what that
 * range meant.
 *
 * `#project`, `p1`..`p4`, `@tag` and `(25)` are syntax: they were typed on
 * purpose and are always honoured. The date is a guess made from prose, so it
 * is the only part the caller can switch off.
 *
 * Any reading can also be refused one at a time. A refusal is a range of the
 * text, not a word: "Weekly review weekly" can have its first `weekly` read as
 * plain English and its second read as a repeat rule, because what was refused
 * was those seven characters at that position and nothing else. Refused ranges
 * are blanked out for every reader, so refusing the guess the parser led with
 * lets the next candidate in the same sentence be found — refuse the `Weekly`
 * in "Weekly review every monday" and the rule becomes "every monday".
 */

export type HighlightKind =
  'date' | 'recurrence' | 'project' | 'priority' | 'label' | 'duration';

export interface Highlight {
  start: number;
  end: number;
  kind: HighlightKind;
}

/** A stretch of the name, by position in it. */
export interface TextRange {
  start: number;
  end: number;
}

export interface Shorthand {
  /** The name with every recognised phrase taken out of it. */
  content: string;
  projectId: string | null;
  priority: DisplayPriority | null;
  labels: string[];
  /** `yyyy-MM-dd`, or with a time when one was given. */
  date: string | null;
  /**
   * A repeat rule, as typed, to be sent on as `due.string`.
   *
   * Never resolved to a date here: Todoist owns what "every 3 days" lands on,
   * and computing it twice is how the two answers come to disagree.
   */
  recurrence: { string: string; lang: RecurrenceLang; fromCompletion: boolean } | null;
  /** An estimate in minutes, written in brackets: "Call Anne (25)". */
  minutes: number | null;
  /** Where each of the above sits in the original string. */
  ranges: Highlight[];
}

const fold = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');

export function parseShorthand(
  raw: string, snapshot: Snapshot, naturalDates: boolean, refused: TextRange[] = [],
): Shorthand {
  const ranges: Highlight[] = [];
  const claim = (start: number, length: number, kind: HighlightKind) =>
    ranges.push({ start, end: start + length, kind });

  /** Whether a candidate covers ground the caller has already turned down. */
  const isRefused = (start: number, length: number) =>
    refused.some((r) => start < r.end && start + length > r.start);

  let projectId: string | null = null;
  let priority: DisplayPriority | null = null;
  const labels: string[] = [];
  let minutes: number | null = null;

  /* Each reader takes the first candidate it has not been turned down on, so
     refusing one occurrence hands the reading to the next rather than giving
     the name no project at all. */
  for (const project of raw.matchAll(/#([\p{L}\p{N}_-]+)/gu)) {
    if (isRefused(project.index!, project[0].length)) continue;
    const wanted = fold(project[1]);
    const found = Object.values(snapshot.projects).find(
      (p) => !p.is_deleted && !p.is_archived && fold(p.name) === wanted,
    );
    if (!found) continue;
    projectId = found.id;
    claim(project.index!, project[0].length, 'project');
    break;
  }

  for (const flag of raw.matchAll(/\bp([1-4])\b/gi)) {
    if (isRefused(flag.index!, flag[0].length)) continue;
    priority = Number(flag[1]) as DisplayPriority;
    claim(flag.index!, flag[0].length, 'priority');
    break;
  }

  for (const label of raw.matchAll(/@([\p{L}\p{N}_-]+)/gu)) {
    if (isRefused(label.index!, label[0].length)) continue;
    labels.push(label[1]);
    claim(label.index!, label[0].length, 'label');
  }

  /* An estimate in brackets. Anything `parseDurationInput` understands goes
     inside them — (25), (1h30), (90 min) — and anything it does not is left
     alone, because brackets in a task name are usually just brackets. */
  for (const bracket of raw.matchAll(/\(([^)]{1,12})\)/g)) {
    if (isRefused(bracket.index!, bracket[0].length)) continue;
    const value = parseDurationInput(bracket[1]);
    if (value === null) continue;
    minutes = value;
    claim(bracket.index!, bracket[0].length, 'duration');
    break;
  }

  /* The recurrence is read before the date and out of the same text, because
     the two compete for the same words: "every monday" contains a weekday the
     date reader would otherwise take for next Monday, dating the task once
     instead of repeating it forever. Claiming the range first settles it. */
  let recurrence: Shorthand['recurrence'] = null;
  if (naturalDates) {
    const repeat = readRecurrence(mask(raw, [...ranges, ...refused]));
    if (repeat) {
      recurrence = {
        string: repeat.string, lang: repeat.lang, fromCompletion: repeat.fromCompletion,
      };
      claim(repeat.index, repeat.matched.length, 'recurrence');
    }
  }

  let date: string | null = null;
  if (naturalDates) {
    /* The date is read from what the explicit syntax has not already claimed,
       blanked out rather than removed so every index still points at the same
       character of the original string. */
    const masked = mask(raw, [...ranges, ...refused]);
    const reading = readNaturalDate(masked);
    if (reading) {
      const at = masked.toLowerCase().indexOf(reading.matched.toLowerCase());
      if (at >= 0) {
        date = reading.date;
        claim(at, reading.matched.length, 'date');
      }
    }
  }

  const clean = dedupe(ranges);
  return {
    content: strip(raw, clean),
    projectId, priority, labels, date, recurrence, minutes,
    ranges: clean,
  };
}

/**
 * Carries refusals across an edit of the text they point into.
 *
 * A refusal is held as a position, so every keystroke before it would leave it
 * pointing at the wrong word. The edit is found as the one stretch that differs
 * between the two strings: ranges before it are untouched, ranges after it
 * shift by what the edit added or removed, and a range the edit reached into is
 * dropped — its words are not the words that were refused any more, so the
 * reading deserves to be offered again.
 */
export function carryRanges(
  ranges: TextRange[], before: string, after: string,
): TextRange[] {
  if (before === after) return ranges;

  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head += 1;

  let tail = 0;
  while (
    tail < before.length - head
    && tail < after.length - head
    && before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) tail += 1;

  const editEnd = before.length - tail;
  const delta = after.length - before.length;

  return ranges.flatMap((range) => {
    if (range.end <= head) return [range];
    if (range.start >= editEnd) return [{ start: range.start + delta, end: range.end + delta }];
    return [];
  });
}

/** Overlaps would break the mirror's markup, so the earliest range wins. */
function dedupe(ranges: Highlight[]): Highlight[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const clean: Highlight[] = [];
  for (const range of sorted) {
    if (clean.length === 0 || range.start >= clean[clean.length - 1].end) clean.push(range);
  }
  return clean;
}

const mask = (raw: string, ranges: TextRange[]): string => {
  const out = raw.split('');
  for (const range of ranges) {
    for (let at = range.start; at < range.end; at += 1) out[at] = ' ';
  }
  return out.join('');
};

const strip = (raw: string, ranges: Highlight[]): string => {
  let out = '';
  let cursor = 0;
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    out += raw.slice(cursor, range.start);
    cursor = range.end;
  }
  out += raw.slice(cursor);
  return out.replace(/\s{2,}/g, ' ').trim();
};
