/**
 * Reading a recurrence out of what somebody typed.
 *
 * This recognises a recurrence. It does not resolve one: no function here ever
 * works out what date "every 3 days" lands on. That is Todoist's job, it is
 * the only place that can get it right across time zones and completions, and
 * the app's part is to hand over the phrase and keep out of the way.
 *
 * Which makes the whole contract a narrow one: find the phrase, say where it
 * sits so the caller can mark and strip it, and say which language it was read
 * in so the right parser is asked for on the other end.
 *
 * The grammar is deliberately smaller than Todoist's. Every form it does not
 * cover is refused rather than guessed at, and a refusal costs the user a task
 * that keeps its name — while a wrong guess moves a whole series to a date
 * nobody asked for, silently, and only shows up weeks later. So:
 *
 *   read    every day / daily, every N days|weeks|months|years,
 *           every other <unit>, every <weekday>[, <weekday>...],
 *           every weekday|workday|weekend, every <N>th (day of the month),
 *           every <month> <N> / every <N> <month>, and "every!" on any of them
 *
 *   refuse  every 2nd monday, every last friday, times of day inside the
 *           phrase, "starting"/"until"/"for 3 weeks", holidays, and anything
 *           else with an "every" in it that the grammar above does not match
 *
 * `every` and `every!` differ in where the next occurrence is counted from —
 * the current due date, or the day it was actually completed — which is why an
 * overdue `every! 3 days` jumps to three days from today rather than filling in
 * the ones it missed. Nothing here needs to know that to pass the phrase on,
 * but the caller shows it, so it is reported.
 */

import type { TodoistDue } from './types';

export type RecurrenceLang = 'en' | 'fr';

export interface RecurrenceReading {
  /** The exact text that produced it, so the caller can mark and strip it. */
  matched: string;
  /** Where it starts in the string it was read from. */
  index: number;
  /** What to send as `due.string`, verbatim as typed. */
  string: string;
  /** The language to ask Todoist to parse `string` with. */
  lang: RecurrenceLang;
  /** True for `every!`: counted from completion rather than from the due date. */
  fromCompletion: boolean;
}

const fold = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* Each language's own words for the parts of a recurrence. The patterns below
   are built from these rather than written out per language, so a form is
   supported in both or in neither. */
interface Words {
  /** The word that opens a recurrence. `!` is handled separately. */
  every: string;
  /** "every other", where the language has a phrase for it. */
  other: string;
  day: string; week: string; month: string; year: string;
  /** Working days, and the two days that are not. */
  workday: string; weekend: string;
  /** One-word recurrences: "daily", "quotidien". */
  shorthand: Record<string, string>;
  weekdays: string[];
  months: string[];
  /** "1st", "2e" — a day of the month, not a position in one. */
  ordinal: string;
}

const EN: Words = {
  every: '(?:every|each)',
  other: 'other',
  day: 'days?', week: 'weeks?', month: 'months?', year: 'years?',
  workday: '(?:weekdays?|workdays?|working days?)',
  weekend: 'weekends?',
  shorthand: { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year', annually: 'year' },
  weekdays: ['sunday|sun', 'monday|mon', 'tuesday|tues|tue', 'wednesday|weds|wed',
    'thursday|thurs|thur|thu', 'friday|fri', 'saturday|sat'],
  months: ['january|jan', 'february|feb', 'march|mar', 'april|apr', 'may', 'june|jun',
    'july|jul', 'august|aug', 'september|sept|sep', 'october|oct', 'november|nov',
    'december|dec'],
  ordinal: '(\\d{1,2})(?:st|nd|rd|th)',
};

const FR: Words = {
  every: '(?:tous les|toutes les|chaque)',
  other: 'deux',
  day: 'jours?', week: 'semaines?', month: 'mois', year: '(?:ans?|annees?)',
  workday: '(?:jours? ouvres?|jours? ouvrables?)',
  weekend: '(?:week-?ends?)',
  shorthand: { quotidien: 'day', hebdomadaire: 'week', mensuel: 'month', annuel: 'year' },
  weekdays: ['dimanches?|dim', 'lundis?|lun', 'mardis?|mar', 'mercredis?|mer',
    'jeudis?|jeu', 'vendredis?|ven', 'samedis?|sam'],
  months: ['janvier|janv', 'fevrier|fevr', 'mars', 'avril|avr', 'mai', 'juin',
    'juillet|juil', 'aout', 'septembre|sept', 'octobre|oct', 'novembre|nov',
    'decembre|dec'],
  ordinal: '(\\d{1,2})(?:er|eme|e)',
};

const LANGS: Array<[RecurrenceLang, Words]> = [['en', EN], ['fr', FR]];

/**
 * Forms the grammar deliberately will not read.
 *
 * Checked before anything else, and on the phrase as a whole: several of these
 * begin with something the grammar *can* read — "every monday" is the opening
 * of "every 2nd monday" — so matching greedily and hoping would produce a
 * recurrence that means something other than what was typed.
 */
const REFUSED = [
  // A weekday counted within the month: "every 2nd monday", "every last friday".
  /\b(?:\d{1,2}(?:st|nd|rd|th)|first|second|third|fourth|last|premier|deuxieme|dernier|derniere)\s+(?:sun|mon|tues?|wed|thur?s?|fri|sat|dim|lun|mar|mer|jeu|ven|sam)/,
  // A bound on the series. Todoist reads these; we would have to show them.
  /\b(?:starting|ending|until|from|for the next|a partir|jusqu|pendant)\b/,
  /\bfor \d+\s+(?:days?|weeks?|months?)\b/,
  // A time of day inside the recurrence: it belongs to the date field, and
  // reading it here would put the same information in two places.
  /\b(?:at|a)\s*\d{1,2}\s*(?::\d{2}|[h.]\d{2}|h\b|am\b|pm\b)/,
  /\b\d{1,2}\s*(?:am|pm)\b/,
  /\b(?:noon|midnight|morning|afternoon|evening|midi|minuit|matin|soir)\b/,
  // Anything resting on a calendar we do not have.
  /\b(?:holiday|holidays|workday after|ferie|feries)\b/,
];

/**
 * Finds a recurrence in `raw`.
 *
 * Returns null when there is none, and also when there is one the grammar
 * refuses — the caller cannot tell the two apart and must not: both mean
 * "leave this text alone".
 */
export function readRecurrence(raw: string): RecurrenceReading | null {
  const text = fold(raw);

  for (const [lang, w] of LANGS) {
    const reading = readIn(raw, text, lang, w);
    if (reading) return reading;
  }
  return null;
}

function readIn(
  raw: string, text: string, lang: RecurrenceLang, w: Words,
): RecurrenceReading | null {
  /* The trailing boundary is load-bearing. "mon" is Monday and also the first
     three letters of "month", so without it "every month" reads as a weekday
     and a task that repeats monthly quietly becomes one that repeats on
     Mondays. The same holds for "mar" against "mars" in French. */
  const weekday = `(?:${w.weekdays.join('|')})\\b`;
  const month = `(?:${w.months.join('|')})\\b`;
  const unit = `(?:${w.day}|${w.week}|${w.month}|${w.year})\\b`;
  // `every!` is the same word with a bang on it, in both languages.
  const every = `${w.every}(!)?`;

  /* In order. The first that matches wins, so the longer forms — a list of
     weekdays, a date in a month — come before the ones that are a prefix of
     them. */
  const forms = [
    // every 3 days, every 2 weeks, tous les 3 jours
    `${every}\\s+\\d{1,3}\\s+${unit}`,
    // every other week, tous les deux jours
    `${every}\\s+${w.other}\\s+${unit}`,
    // every mon, wed, fri — the list is greedy so it takes all of them
    `${every}\\s+${weekday}(?:\\s*(?:,|and|et)\\s*${weekday})*`,
    // every 14 jan, every jan 14
    `${every}\\s+\\d{1,2}\\s+${month}`,
    `${every}\\s+${month}\\s+\\d{1,2}`,
    // every 15th, tous les 15
    `${every}\\s+${w.ordinal}`,
    `${every}\\s+\\d{1,2}(?!\\s*\\d)(?!\\s*${unit})`,
    // every weekday, every weekend
    `${every}\\s+(?:${w.workday}|${w.weekend})`,
    // every day, every week, every month, every year
    `${every}\\s+${unit}`,
  ];

  for (const form of forms) {
    const match = text.match(new RegExp(`\\b${form}`, 'i'));
    if (!match) continue;
    if (REFUSED.some((pattern) => pattern.test(text))) return null;
    return {
      matched: raw.slice(match.index!, match.index! + match[0].length),
      index: match.index!,
      string: raw.slice(match.index!, match.index! + match[0].length).trim(),
      lang,
      fromCompletion: match[1] === '!',
    };
  }

  // "daily", "weekly", "quotidien" — one word, no "every" in front of it.
  for (const [word] of Object.entries(w.shorthand)) {
    const match = text.match(new RegExp(`\\b${word}\\b`, 'i'));
    if (!match) continue;
    if (REFUSED.some((pattern) => pattern.test(text))) return null;
    return {
      matched: raw.slice(match.index!, match.index! + match[0].length),
      index: match.index!,
      string: raw.slice(match.index!, match.index! + match[0].length).trim(),
      lang,
      fromCompletion: false,
    };
  }

  return null;
}

/**
 * Moving a single occurrence without ending the series.
 *
 * `due.string` is what Todoist treats as the truth, so sending a plain date in
 * it for a task that repeats replaces the rule with that one date and the
 * series stops — quietly, and for good. Every path in the app that gives a
 * task a day comes through here: the schedule menu, the three shortcuts, a
 * drop onto a column, the bulk bar. The rule goes back unchanged and only the
 * date moves, so this occurrence lands where it was put and the next one still
 * arrives.
 *
 * The time of day is kept too. A task due at 09:00 dragged to tomorrow is due
 * at 09:00 tomorrow, not at midnight — unless the new date names its own time,
 * which is the one case where the caller has been told otherwise.
 */
export function dueForDate(
  existing: TodoistDue | null | undefined,
  date: string,
  fallbackLang = 'en',
): TodoistDue {
  const carriesTime = date.includes('T');
  const previousTime = !carriesTime && existing?.date.includes('T')
    ? existing.date.slice(existing.date.indexOf('T'))
    : '';
  const full = `${date}${previousTime}`;
  const recurring = existing?.is_recurring === true && !!existing.string;

  return {
    date: full,
    timezone: existing?.timezone ?? null,
    // The rule, not the date, whenever there is a rule to keep.
    string: recurring ? existing!.string : full,
    lang: existing?.lang ?? fallbackLang,
    is_recurring: recurring,
  };
}
