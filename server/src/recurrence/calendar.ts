/**
 * Calendar arithmetic on plain dates.
 *
 * A date is a whole number of days since 1970-01-01, so adding days is
 * addition and nothing is ever shifted by a timezone or a DST change.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday = 0

const DAY_MS = 86_400_000;

export function toDays(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDays(days: number): string {
  return new Date(days * DAY_MS).toISOString().slice(0, 10);
}

export function parts(days: number): { year: number; month: number; day: number } {
  const date = new Date(days * DAY_MS);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function weekday(days: number): Weekday {
  return (((days + 4) % 7) + 7) % 7 as Weekday; // 1970-01-01 was a Thursday
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** A day in a month, pulled back to the month's last day when it has fewer (31 in April is the 30th). */
export function clampedDate(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, Math.min(day, daysInMonth(year, month))) / DAY_MS);
}

/** Months since year 0, so two months can be subtracted. */
export const monthIndex = (year: number, month: number): number => year * 12 + (month - 1);

/** The Monday of the week a day falls in, as a day number. */
export const weekStart = (days: number): number => days - ((weekday(days) + 6) % 7);

export const isWorkday = (days: number): boolean => weekday(days) !== 0 && weekday(days) !== 6;

/** The local date and time of an instant in a timezone. */
export function localParts(instantMs: number, timezone: string): { date: string; time: string } {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => formatted.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
  };
}

/** The instant at which a wall-clock date and time happen in a timezone. */
export function zonedToUtc(date: string, time: string, timezone: string): number {
  const [h, mi, s] = time.split(':').map(Number);
  const asUtc = toDays(date) * DAY_MS + ((h * 60 + mi) * 60 + (s || 0)) * 1000;
  let guess = asUtc;
  // Two rounds settle the offset, including across a DST change.
  for (let i = 0; i < 2; i++) {
    const local = localParts(guess, timezone);
    const [lh, lmi, ls] = local.time.split(':').map(Number);
    const localAsUtc = toDays(local.date) * DAY_MS + ((lh * 60 + lmi) * 60 + ls) * 1000;
    guess += asUtc - localAsUtc;
  }
  return guess;
}
