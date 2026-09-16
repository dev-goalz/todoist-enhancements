import { readNaturalDate } from './nlp';
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
 */

export type HighlightKind = 'date' | 'project' | 'priority' | 'label' | 'duration';

export interface Highlight {
  start: number;
  end: number;
  kind: HighlightKind;
}

export interface Shorthand {
  /** The name with every recognised phrase taken out of it. */
  content: string;
  projectId: string | null;
  priority: DisplayPriority | null;
  labels: string[];
  /** `yyyy-MM-dd`, or with a time when one was given. */
  date: string | null;
  /** An estimate in minutes, written in brackets: "Call Anne (25)". */
  minutes: number | null;
  /** Where each of the above sits in the original string. */
  ranges: Highlight[];
}

const fold = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');

export function parseShorthand(
  raw: string, snapshot: Snapshot, naturalDates: boolean,
): Shorthand {
  const ranges: Highlight[] = [];
  const claim = (start: number, length: number, kind: HighlightKind) =>
    ranges.push({ start, end: start + length, kind });

  let projectId: string | null = null;
  let priority: DisplayPriority | null = null;
  const labels: string[] = [];
  let minutes: number | null = null;

  const project = raw.match(/#([\p{L}\p{N}_-]+)/u);
  if (project) {
    const wanted = fold(project[1]);
    const found = Object.values(snapshot.projects).find(
      (p) => !p.is_deleted && !p.is_archived && fold(p.name) === wanted,
    );
    if (found) {
      projectId = found.id;
      claim(project.index!, project[0].length, 'project');
    }
  }

  const flag = raw.match(/\bp([1-4])\b/i);
  if (flag) {
    priority = Number(flag[1]) as DisplayPriority;
    claim(flag.index!, flag[0].length, 'priority');
  }

  for (const label of raw.matchAll(/@([\p{L}\p{N}_-]+)/gu)) {
    labels.push(label[1]);
    claim(label.index!, label[0].length, 'label');
  }

  /* An estimate in brackets. Anything `parseDurationInput` understands goes
     inside them — (25), (1h30), (90 min) — and anything it does not is left
     alone, because brackets in a task name are usually just brackets. */
  for (const bracket of raw.matchAll(/\(([^)]{1,12})\)/g)) {
    const value = parseDurationInput(bracket[1]);
    if (value === null) continue;
    minutes = value;
    claim(bracket.index!, bracket[0].length, 'duration');
    break;
  }

  let date: string | null = null;
  if (naturalDates) {
    /* The date is read from what the explicit syntax has not already claimed,
       blanked out rather than removed so every index still points at the same
       character of the original string. */
    const masked = mask(raw, ranges);
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
    projectId, priority, labels, date, minutes,
    ranges: clean,
  };
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

const mask = (raw: string, ranges: Highlight[]): string => {
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
