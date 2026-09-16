import { readNaturalDate, type DateReading } from './nlp';

/**
 * The date phrases worth offering while somebody types one.
 *
 * Deliberately short, and written in the words the parser already reads, so
 * every suggestion in the list is guaranteed to produce the day it shows. The
 * parser understands a good deal more than this — "in 3 days", "12/04",
 * "3 mars" — but those are things you type, not things you pick: a list is
 * only useful while it is short enough to read at a glance.
 */
const WORDS: Record<'en' | 'fr', string[]> = {
  en: [
    'today', 'tomorrow', 'next week',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  ],
  fr: [
    "aujourd'hui", 'demain', 'semaine prochaine',
    'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
  ],
};

const fold = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface DateSuggestion {
  label: string;
  reading: DateReading;
}

/** How many fit under the field without turning it into a page of its own. */
const LIMIT = 4;

/**
 * The phrases that still start with what has been typed.
 *
 * Both languages are offered whatever the interface is set to — somebody
 * reading French may well type "tomorrow" — with the interface's own words
 * first, because those are the ones they are most likely to mean.
 */
export function dateSuggestions(typed: string, locale: 'en' | 'fr'): DateSuggestion[] {
  const query = fold(typed.trim());
  if (!query) return [];

  const other = locale === 'fr' ? 'en' : 'fr';
  const out: DateSuggestion[] = [];

  for (const word of [...WORDS[locale], ...WORDS[other]]) {
    if (!fold(word).startsWith(query)) continue;
    const reading = readNaturalDate(word);
    // A phrase the parser cannot read back is a suggestion that would lie.
    if (!reading) continue;
    out.push({ label: word, reading });
    if (out.length === LIMIT) break;
  }

  /* What was typed is already a date and is not one of the phrases above:
     "12 April" deserves to be confirmed rather than replaced by a weekday. */
  if (out.length === 0) return [];
  return out;
}
