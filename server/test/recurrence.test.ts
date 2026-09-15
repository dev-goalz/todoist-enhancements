import { describe, expect, it } from 'vitest';
import { firstDueDate, parseRecurrence, rollForward, UnsupportedRecurrence } from '../src/recurrence';
import type { TodoistDue } from '../src/wire';

// Tuesday 15 September 2026, mid-morning.
const NOW = new Date('2026-09-15T10:00:00Z');

const due = (string: string, date: string, extra: Partial<TodoistDue> = {}): TodoistDue => ({
  date, string, lang: 'en', timezone: null, is_recurring: true, ...extra,
});
const roll = (string: string, date: string, extra: Partial<TodoistDue> = {}) =>
  rollForward(due(string, date, extra), 'UTC', NOW)?.date ?? null;

describe('rollForward', () => {
  it.each([
    ['every day', '2026-09-15', '2026-09-16'],
    ['daily', '2026-09-15', '2026-09-16'],
    ['every day', '2026-09-01', '2026-09-16'], // overdue: only future dates
    ['every 3 days', '2026-09-10', '2026-09-16'],
    ['every other day', '2026-09-15', '2026-09-17'],
    ['every! 3 days', '2026-09-01', '2026-09-18'], // counts from today
    ['every workday', '2026-09-18', '2026-09-21'], // Friday to Monday
    ['every weekday', '2026-09-16', '2026-09-17'],
    ['every 2 workdays', '2026-09-17', '2026-09-21'],
    ['every weekend', '2026-09-19', '2026-09-20'],
    ['every mon, fri', '2026-09-18', '2026-09-21'],
    ['every monday and wednesday', '2026-09-21', '2026-09-23'],
    ['every other fri', '2026-09-18', '2026-10-02'],
    ['every week', '2026-09-15', '2026-09-22'],
    ['weekly', '2026-08-04', '2026-09-22'], // overdue by weeks
    ['every 2 weeks', '2026-09-15', '2026-09-29'],
    ['every month', '2026-09-30', '2026-10-30'],
    ['every 15th', '2026-09-15', '2026-10-15'],
    ['every 1, 15', '2026-09-15', '2026-10-01'],
    ['every 1st and 15th', '2026-10-01', '2026-10-15'],
    ['every last day', '2026-09-30', '2026-10-31'],
    ['every 31', '2026-10-31', '2026-11-30'],
    ['every quarter', '2026-09-15', '2026-12-15'],
    ['every 3 months', '2026-01-10', '2026-10-10'], // overdue: the next quarter date to come
    ['every! month', '2026-08-01', '2026-10-15'],
    ['every jan 14, 14 jul', '2027-01-14', '2027-07-14'],
    ['every year', '2028-02-29', '2029-02-28'],
    ['yearly', '2025-12-25', '2026-12-25'],
  ])('%s from %s moves to %s', (string, from, to) => {
    expect(roll(string, from)).toBe(to);
  });

  it('keeps a floating time exactly as written', () => {
    expect(roll('every day at 9am', '2026-09-15T09:00:00')).toBe('2026-09-16T09:00:00');
    expect(roll('every day at 9am', '2026-09-15T09:00:00.000000')).toBe('2026-09-16T09:00:00.000000');
  });

  it('gives a plain date the time its string names', () => {
    expect(roll('every mon, fri at 20:00', '2026-09-18')).toBe('2026-09-21T20:00:00');
  });

  it('keeps the wall-clock time of a fixed-zone date across a DST change', () => {
    // 09:00 in Amsterdam is 07:00Z in summer and 08:00Z after the clocks go back on 25 October.
    const next = rollForward(
      due('every day at 9am', '2026-10-24T07:00:00.000000Z', { timezone: 'Europe/Amsterdam' }),
      'UTC',
      NOW,
    );
    expect(next).toMatchObject({ date: '2026-10-25T08:00:00.000000Z', timezone: 'Europe/Amsterdam' });
  });

  it('keeps the string, language and timezone', () => {
    expect(rollForward(due('every day', '2026-09-15'), 'UTC', NOW)).toEqual(due('every day', '2026-09-16'));
  });

  it('ends a series after its until date', () => {
    expect(roll('every day until 2026-09-15', '2026-09-15')).toBeNull();
    expect(roll('everyday ending sep 20', '2026-09-19')).toBe('2026-09-20');
    expect(roll('everyday ending sep 20', '2026-09-20')).toBeNull();
  });

  it('reads "today" in the user\'s timezone', () => {
    // 23:30 UTC on the 15th is already the 16th in Amsterdam, so the 16th is not in the future.
    const late = new Date('2026-09-15T23:30:00Z');
    expect(rollForward(due('every day', '2026-09-15'), 'Europe/Amsterdam', late)?.date).toBe('2026-09-17');
    expect(rollForward(due('every day', '2026-09-15'), 'UTC', late)?.date).toBe('2026-09-16');
  });

  it('reads Dutch and French', () => {
    expect(roll('elke maandag', '2026-09-21', { lang: 'nl' })).toBe('2026-09-28');
    expect(roll('elke 2 weken', '2026-09-15', { lang: 'nl' })).toBe('2026-09-29');
    expect(roll('om de week', '2026-09-15', { lang: 'nl' })).toBe('2026-09-29');
    expect(roll('elke werkdag om 9:00', '2026-09-18', { lang: 'nl' })).toBe('2026-09-21T09:00:00');
    expect(roll('dagelijks', '2026-09-15', { lang: 'nl' })).toBe('2026-09-16');
    expect(roll('tous les lundis', '2026-09-21', { lang: 'fr' })).toBe('2026-09-28');
    expect(roll('tous les 2 jours', '2026-09-15', { lang: 'fr' })).toBe('2026-09-17');
    expect(roll('chaque mois', '2026-09-15', { lang: 'fr' })).toBe('2026-10-15');
    expect(roll('tous les jours à 9h', '2026-09-15', { lang: 'fr' })).toBe('2026-09-16T09:00:00');
  });

  it('refuses a string it cannot read instead of guessing', () => {
    for (const string of ['every hour', 'every 2nd monday', 'every last workday', 'every 12 hours starting at 9pm', 'every day for 3 weeks']) {
      expect(() => rollForward(due(string, '2026-09-15'), 'UTC', NOW), string).toThrow(UnsupportedRecurrence);
    }
  });
});

describe('parseRecurrence', () => {
  it('tells one-off dates from recurring ones', () => {
    expect(parseRecurrence('tomorrow').kind).toBe('not-recurring');
    expect(parseRecurrence('2026-09-20').kind).toBe('not-recurring');
    expect(parseRecurrence('today', 'fr').kind).toBe('not-recurring');
    expect(parseRecurrence('every hour').kind).toBe('unsupported');
    expect(parseRecurrence('every mon, fri at 20:00')).toEqual({
      kind: 'recurring',
      rule: { pattern: { unit: 'week', interval: 1, weekdays: [1, 5] }, fromCompletion: false, time: '20:00:00' },
    });
  });
});

describe('firstDueDate', () => {
  it('finds the first date of a new series', () => {
    expect(firstDueDate('every monday', 'en', 'UTC', NOW)).toBe('2026-09-21');
    expect(firstDueDate('every day', 'en', 'UTC', NOW)).toBe('2026-09-15');
    expect(firstDueDate('every workday starting sep 19', 'en', 'UTC', NOW)).toBe('2026-09-21');
    expect(firstDueDate('every day at 9am', 'en', 'UTC', NOW)).toBe('2026-09-15T09:00:00');
    expect(firstDueDate('every day until 2026-01-01', 'en', 'UTC', NOW)).toBeNull();
  });
});
