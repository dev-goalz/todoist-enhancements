import { ESTIMATE_PREFIX, type Item } from './types';

/**
 * An estimate is the label `est-<positive integer>`, where the integer is a
 * number of minutes. Any positive value is accepted; there is no fixed grid.
 */

export interface EstimateReading {
  /** Minutes, or null when the task carries no estimate at all. */
  minutes: number | null;
  /** Every `est-*` label found, valid or not, in the order Todoist returned them. */
  raw: string[];
  /** True when more than one `est-*` label is present. */
  multiple: boolean;
  /** True when an `est-*` label is present but its value is not a positive integer. */
  invalid: boolean;
}

const ESTIMATE_RE = new RegExp(`^${ESTIMATE_PREFIX}(.+)$`, 'i');

/** Reads the estimate carried by a set of labels, reporting conflicts rather than guessing. */
export function readEstimate(labels: string[]): EstimateReading {
  const raw = labels.filter((l) => ESTIMATE_RE.test(l));
  if (raw.length === 0) return { minutes: null, raw, multiple: false, invalid: false };

  const parsed = raw.map((label) => {
    const value = label.match(ESTIMATE_RE)![1];
    // Only a bare positive integer is a valid stored estimate.
    if (!/^\d+$/.test(value)) return null;
    const n = Number.parseInt(value, 10);
    return n > 0 ? n : null;
  });

  const valid = parsed.filter((n): n is number => n !== null);
  return {
    minutes: valid.length > 0 ? valid[0] : null,
    raw,
    multiple: raw.length > 1,
    invalid: valid.length !== raw.length,
  };
}

export const estimateOf = (item: Item): number | null => readEstimate(item.labels).minutes;

/**
 * Parses what a human types into minutes. Accepts "12", "12 min", "1 h",
 * "1h15", "75 min", "1:30", "2h". Returns null when nothing sensible is found.
 */
export function parseDurationInput(input: string): number | null {
  const s = input.trim().toLowerCase().replace(',', '.');
  if (!s) return null;

  // "1:30" / "1h30" / "1 h 15" — hours and minutes together.
  const hm = s.match(/^(\d+)\s*(?:h|:|hour|hours|heure|heures)\s*(\d{1,2})?\s*(?:m|min|minute|minutes)?$/);
  if (hm) {
    const hours = Number.parseInt(hm[1], 10);
    const mins = hm[2] ? Number.parseInt(hm[2], 10) : 0;
    if (mins >= 60) return null;
    const total = hours * 60 + mins;
    return total > 0 ? total : null;
  }

  // "1.5h" — fractional hours.
  const fractional = s.match(/^(\d*\.?\d+)\s*(?:h|hour|hours|heure|heures)$/);
  if (fractional) {
    const total = Math.round(Number.parseFloat(fractional[1]) * 60);
    return total > 0 ? total : null;
  }

  // "45", "45 min", "45m".
  const minutes = s.match(/^(\d+)\s*(?:m|min|mins|minute|minutes)?$/);
  if (minutes) {
    const total = Number.parseInt(minutes[1], 10);
    return total > 0 ? total : null;
  }

  return null;
}

/** Turns minutes into the label the task should carry. */
export const estimateLabel = (minutes: number): string => `${ESTIMATE_PREFIX}${Math.round(minutes)}`;

/** Replaces every `est-*` label with a single one, or strips them when minutes is null. */
export function withEstimate(labels: string[], minutes: number | null): string[] {
  const kept = labels.filter((l) => !ESTIMATE_RE.test(l));
  return minutes === null ? kept : [...kept, estimateLabel(minutes)];
}

/** "1 h 15", "45 min", "2 h". The separator keeps the mockup's typography. */
export function formatDuration(minutes: number, locale: 'en' | 'fr' = 'en'): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const hourUnit = 'h';
  const minuteUnit = locale === 'fr' ? 'min' : 'min';
  if (h === 0) return `${m} ${minuteUnit}`;
  if (m === 0) return `${h} ${hourUnit}`;
  return `${h} ${hourUnit} ${String(m).padStart(2, '0')}`;
}

/**
 * The estimate that counts towards a total.
 *
 * The parent's own estimate wins. Without one, the sum of estimated children
 * stands in as a computed estimate. Children are looked up through `childrenOf`.
 */
export function effectiveEstimate(
  item: Item,
  childrenOf: (parentId: string) => Item[],
): { minutes: number | null; computed: boolean } {
  const own = estimateOf(item);
  if (own !== null) return { minutes: own, computed: false };

  const children = childrenOf(item.id).filter((c) => !c.checked);
  const sum = children.reduce((acc, c) => acc + (estimateOf(c) ?? 0), 0);
  return sum > 0 ? { minutes: sum, computed: true } : { minutes: null, computed: false };
}
