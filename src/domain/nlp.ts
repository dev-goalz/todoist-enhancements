import { toApiDate } from './dates';

/**
 * Reading a date out of what somebody typed.
 *
 * This is deliberately a short list of phrases people actually use rather than
 * a general date grammar: anything it is not sure about it leaves alone, so a
 * task called "Call mum about March" keeps its name. The caller can switch it
 * off entirely, which is why it is a separate pass from `#project`, `p1` and
 * `@tag` — those are explicit syntax, not a guess.
 */

export interface DateReading {
  /** `yyyy-MM-dd`, or with `THH:mm:ss` when a time of day was given. */
  date: string;
  /** The exact text that produced it, so the caller can strip it. */
  matched: string;
  /** True when the phrase carried a time as well as a day. */
  hasTime: boolean;
}

const WEEKDAYS: Record<'en' | 'fr', string[]> = {
  en: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
};

const MONTHS: Record<'en' | 'fr', string[]> = {
  en: ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
};

const fold = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const addDays = (from: Date, days: number): Date => {
  const out = new Date(from);
  out.setDate(out.getDate() + days);
  return out;
};

/** A time of day appearing anywhere in the phrase: "at 14:00", "2pm", "à 9h30". */
function readTime(text: string): { hours: number; minutes: number; matched: string } | null {
  const ampm = text.match(/\b(?:at|à|a)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (ampm) {
    let hours = Number(ampm[1]) % 12;
    if (ampm[3].toLowerCase() === 'pm') hours += 12;
    return { hours, minutes: Number(ampm[2] ?? 0), matched: ampm[0] };
  }
  const hm = text.match(/\b(?:at|à|a)?\s*(\d{1,2})\s*[h:]\s*(\d{2})?\b/i);
  if (hm) {
    const hours = Number(hm[1]);
    if (hours > 23) return null;
    return { hours, minutes: Number(hm[2] ?? 0), matched: hm[0] };
  }
  return null;
}

/**
 * Finds a date phrase in `raw`.
 *
 * Returns null when nothing is recognised, which is the common case and the
 * one that must never do damage.
 */
export function readNaturalDate(raw: string, now = new Date()): DateReading | null {
  const text = fold(raw);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const found = (day: Date, matched: string): DateReading => {
    const time = readTime(raw);
    if (!time) return { date: toApiDate(day), matched, hasTime: false };
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${toApiDate(day)}T${pad(time.hours)}:${pad(time.minutes)}:00`,
      matched: `${matched} ${time.matched}`.trim(),
      hasTime: true,
    };
  };

  // "today" / "tomorrow" / the day after
  const plain: Array<[RegExp, number]> = [
    [/\b(today|aujourd'?hui|auj)\b/, 0],
    [/\b(tomorrow|demain)\b/, 1],
    [/\b(after tomorrow|apres-demain|apres demain)\b/, 2],
  ];
  for (const [pattern, offset] of plain) {
    const match = text.match(pattern);
    if (match) return found(addDays(today, offset), match[0]);
  }

  // "next week" / "la semaine prochaine" — the coming Monday
  const nextWeek = text.match(/\b(next week|semaine prochaine|la semaine prochaine)\b/);
  if (nextWeek) {
    return found(addDays(today, ((8 - today.getDay()) % 7) || 7), nextWeek[0]);
  }

  // "in 3 days" / "dans 2 semaines"
  const relative = text.match(/\b(?:in|dans)\s+(\d{1,3})\s*(day|days|jour|jours|week|weeks|semaine|semaines)\b/);
  if (relative) {
    const count = Number(relative[1]);
    const weeks = relative[2].startsWith('week') || relative[2].startsWith('semaine');
    return found(addDays(today, count * (weeks ? 7 : 1)), relative[0]);
  }

  // A weekday name, in either language: the next one that is not today.
  for (const names of Object.values(WEEKDAYS)) {
    for (let index = 0; index < names.length; index += 1) {
      const name = fold(names[index]);
      const match = text.match(new RegExp(`\\b(?:next |prochain |le )?${name}\\b`));
      if (!match) continue;
      const delta = ((index - today.getDay() + 7) % 7) || 7;
      return found(addDays(today, delta), match[0]);
    }
  }

  // "10 sept", "3 mars", "sept 10" — the next occurrence of that calendar day.
  const monthNames = [...MONTHS.en, ...MONTHS.fr];
  for (let index = 0; index < monthNames.length; index += 1) {
    const full = fold(monthNames[index]);
    const stem = full.slice(0, 3);
    const month = index % 12;
    const dayFirst = text.match(new RegExp(`\\b(\\d{1,2})\\s+${stem}[a-z]*\\.?`));
    const monthFirst = text.match(new RegExp(`\\b${stem}[a-z]*\\.?\\s+(\\d{1,2})\\b`));
    const match = dayFirst ?? monthFirst;
    if (!match) continue;
    const dayOfMonth = Number(match[1]);
    if (dayOfMonth < 1 || dayOfMonth > 31) continue;
    let day = new Date(today.getFullYear(), month, dayOfMonth);
    if (day < today) day = new Date(today.getFullYear() + 1, month, dayOfMonth);
    if (day.getMonth() !== month) continue;   // 31 February and friends
    return found(day, match[0]);
  }

  // "12/03" and "12/03/2026", read day-first as both interface languages do.
  const numeric = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numeric) {
    const dayOfMonth = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    const year = numeric[3]
      ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3])
      : today.getFullYear();
    const day = new Date(year, month, dayOfMonth);
    if (day.getMonth() === month && day.getDate() === dayOfMonth) {
      const future = !numeric[3] && day < today
        ? new Date(year + 1, month, dayOfMonth)
        : day;
      return found(future, numeric[0]);
    }
  }

  return null;
}

/** Removes the phrase the reading came from, leaving a clean task name. */
export function stripReading(raw: string, reading: DateReading): string {
  const escaped = reading.matched.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return raw
    .replace(new RegExp(escaped, 'i'), ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
