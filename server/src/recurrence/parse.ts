import type { Weekday } from './calendar';
import { LEXICONS, type Lexicon } from './lexicon';

/**
 * Reading a recurring due date such as "every mon, fri at 9am".
 *
 * Supported, in English, Dutch and French:
 *   every day / daily / every N days / every other day
 *   every workday (weekday) / every N workdays / every weekend
 *   every week / weekly / every N weeks / every <weekday>[, <weekday>...] / every other <weekday>
 *   every month / monthly / every N months / every quarter / quarterly
 *   every 15th / every 1, 15 / every last day   (days of the month)
 *   every year / yearly / every jan 14 / every 14 jan[, 14 apr...]
 *   "every!" to count from the completion date
 *   at <time>, starting <date>, until / ending <date>
 *
 * Anything else (hours, workday ordinals, "every 2nd monday", holidays, "for 3
 * weeks") is reported as unsupported rather than guessed.
 */

export type MonthDay = number | 'last';

export type Pattern =
  | { unit: 'day'; interval: number }
  | { unit: 'workday'; interval: number }
  /** An empty list means the weekday of the current occurrence. */
  | { unit: 'week'; interval: number; weekdays: Weekday[] }
  /** An empty list means the day of the month of the current occurrence. */
  | { unit: 'month'; interval: number; days: MonthDay[] }
  /** An empty list means the date of the current occurrence. */
  | { unit: 'year'; interval: number; dates: Array<{ month: number; day: number }> };

export interface Rule {
  pattern: Pattern;
  /** "every!": the next date counts from completion, not from the current due date. */
  fromCompletion: boolean;
  /** HH:MM:SS, when the string names a time. */
  time?: string;
  /** A date string as written, resolved against "today" by the caller. */
  starting?: DateSpec;
  until?: DateSpec;
}

export type DateSpec = { month: number; day: number; year?: number };

export type ParseResult =
  | { kind: 'recurring'; rule: Rule }
  | { kind: 'unsupported' }
  | { kind: 'not-recurring' };

const WEEKDAY_NUMBERS: Record<string, Weekday> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
const MONTH_NUMBERS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const TIME_WORDS: Record<string, string> = {
  noon: '12:00:00', morning: '09:00:00', afternoon: '12:00:00', evening: '19:00:00', night: '22:00:00',
};
const LEADING_WORDS = new Set(['every', 'every!', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']);

type Token =
  | { t: 'word'; v: string }
  | { t: 'num'; v: number }
  | { t: 'ord'; v: number }
  | { t: 'time'; v: string }
  | { t: 'iso'; v: DateSpec }
  | { t: 'comma' };

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/,/g, ' , ').replace(/\s+/g, ' ').trim();
}

function lex(text: string, lexicon: Lexicon): Token[] {
  let source = ` ${normalize(text)} `;
  for (const [phrase, canonical] of Object.entries(lexicon.phrases)) {
    source = source.split(` ${phrase} `).join(` ${canonical} `);
  }

  const tokens: Token[] = [];
  const words = source.trim().split(' ');
  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    if (!word) continue;
    if (word === ',') { tokens.push({ t: 'comma' }); continue; }

    let strict = false;
    if (word.endsWith('!')) { strict = true; word = word.slice(0, -1); }

    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(word);
    if (iso) { tokens.push({ t: 'iso', v: { year: +iso[1], month: +iso[2], day: +iso[3] } }); continue; }

    // "9am", "9:30pm", "21:00", "9h30", "9u"; a bare "9 pm" is joined here too.
    const next = words[i + 1];
    const meridiem = next === 'am' || next === 'pm' ? next : '';
    const time = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/.exec(word + meridiem)
      ?? /^(\d{1,2})[hu](\d{2})?$/.exec(word);
    if (time && (time[2] !== undefined || time[3] !== undefined || /[hu]/.test(word))) {
      let hour = Number(time[1]);
      const suffix = time[3];
      if (suffix === 'pm' && hour < 12) hour += 12;
      if (suffix === 'am' && hour === 12) hour = 0;
      if (hour > 23 || Number(time[2] ?? 0) > 59) return [{ t: 'word', v: '?' }];
      tokens.push({ t: 'time', v: `${String(hour).padStart(2, '0')}:${time[2] ?? '00'}:00` });
      if (meridiem) i++;
      continue;
    }

    if (/^\d{1,4}$/.test(word)) { tokens.push({ t: 'num', v: Number(word) }); continue; }
    const ordinal = lexicon.ordinal.exec(word) ?? /^(\d{1,2})(?:st|nd|rd|th)$/.exec(word);
    if (ordinal) { tokens.push({ t: 'ord', v: Number(ordinal[1]) }); continue; }

    const canonical = lexicon.words[word] ?? LEXICONS.en.words[word];
    if (canonical === undefined) return [{ t: 'word', v: '?' }];
    for (const piece of canonical.split(' ').filter(Boolean)) {
      tokens.push({ t: 'word', v: strict && piece === 'every' ? 'every!' : piece });
    }
  }
  return tokens;
}

class Unsupported extends Error {}

/** Reads a due string. The language's own words are tried, with English as a fallback. */
export function parseRecurrence(text: string, lang = 'en'): ParseResult {
  const lexicon = LEXICONS[lang] ?? LEXICONS.en;
  const tokens = lex(text, lexicon);
  const first = tokens[0];
  if (!first || first.t !== 'word' || !LEADING_WORDS.has(first.v)) {
    // Without a leading "every", it is a one-off date, unless the words were
    // unknown and the string could still be a recurrence in another form.
    return /\b(every|each|elke|iedere|chaque|tous|toutes)\b/.test(normalize(text))
      ? { kind: 'unsupported' }
      : { kind: 'not-recurring' };
  }
  try {
    return { kind: 'recurring', rule: new Parser(tokens).rule() };
  } catch (error) {
    if (error instanceof Unsupported) return { kind: 'unsupported' };
    throw error;
  }
}

class Parser {
  private i = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(offset = 0): Token | undefined { return this.tokens[this.i + offset]; }
  private isWord(v: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token?.t === 'word' && token.v === v;
  }
  private fail(): never { throw new Unsupported(); }

  rule(): Rule {
    const lead = this.tokens[this.i++] as { t: 'word'; v: string };
    const rule: Rule = { pattern: { unit: 'day', interval: 1 }, fromCompletion: lead.v === 'every!' };

    const adverbs: Record<string, Pattern> = {
      daily: { unit: 'day', interval: 1 },
      weekly: { unit: 'week', interval: 1, weekdays: [] },
      monthly: { unit: 'month', interval: 1, days: [] },
      quarterly: { unit: 'month', interval: 3, days: [] },
      yearly: { unit: 'year', interval: 1, dates: [] },
    };
    rule.pattern = adverbs[lead.v] ?? this.afterEvery();

    while (this.i < this.tokens.length) this.modifier(rule);
    return rule;
  }

  private afterEvery(): Pattern {
    let interval = 1;
    if (this.isWord('other')) { interval = 2; this.i++; }
    const count = this.peek();
    const unitAfterCount = this.peek(1);
    if (count?.t === 'num' && unitAfterCount?.t === 'word'
      && ['day', 'workday', 'week', 'month', 'quarter', 'year'].includes(unitAfterCount.v)) {
      if (count.v < 1) this.fail();
      interval = count.v;
      this.i++;
    }

    const token = this.peek();
    if (token?.t === 'word') {
      switch (token.v) {
        case 'day': this.i++; return { unit: 'day', interval };
        case 'workday': this.i++; return { unit: 'workday', interval };
        case 'weekend':
          this.i++;
          if (interval !== 1) this.fail();
          return { unit: 'week', interval: 1, weekdays: [6, 0] };
        case 'week': this.i++; return { unit: 'week', interval, weekdays: [] };
        case 'month': this.i++; return { unit: 'month', interval, days: [] };
        case 'quarter': this.i++; return { unit: 'month', interval: interval * 3, days: [] };
        case 'year': this.i++; return { unit: 'year', interval, dates: [] };
      }
      if (token.v in WEEKDAY_NUMBERS) return { unit: 'week', interval, weekdays: this.weekdayList() };
      if (token.v in MONTH_NUMBERS) return { unit: 'year', interval, dates: this.yearDateList() };
    }
    if (token?.t === 'num' || token?.t === 'ord' || this.isWord('last')) {
      if (interval !== 1) this.fail();
      const isYearly = this.peek(1)?.t === 'word' && (this.peek(1) as { v: string }).v in MONTH_NUMBERS;
      return isYearly
        ? { unit: 'year', interval: 1, dates: this.yearDateList() }
        : { unit: 'month', interval: 1, days: this.monthDayList() };
    }
    return this.fail();
  }

  /** Skips a comma or "and" between list items; false at the end of the list. */
  private listSeparator(isItem: () => boolean): boolean {
    let offset = 0;
    while (this.peek(offset)?.t === 'comma' || this.isWord('and', offset)) offset++;
    if (offset === 0) return false;
    const save = this.i;
    this.i += offset;
    if (isItem()) return true;
    this.i = save;
    return false;
  }

  private weekdayList(): Weekday[] {
    const isWeekday = () => { const t = this.peek(); return t?.t === 'word' && t.v in WEEKDAY_NUMBERS; };
    const days: Weekday[] = [];
    do {
      const token = this.peek() as { v: string };
      days.push(WEEKDAY_NUMBERS[token.v]);
      this.i++;
    } while (this.listSeparator(isWeekday));
    return [...new Set(days)];
  }

  private monthDayList(): MonthDay[] {
    const isDay = () => { const t = this.peek(); return t?.t === 'num' || t?.t === 'ord' || this.isWord('last'); };
    const days: MonthDay[] = [];
    do {
      const token = this.peek()!;
      if (token.t === 'word') {
        // Only "last day"; "last friday" and the like are not supported.
        this.i++;
        if (!this.isWord('day')) this.fail();
        this.i++;
        days.push('last');
      } else {
        const day = (token as { v: number }).v;
        if (day < 1 || day > 31) this.fail();
        this.i++;
        if (this.peek()?.t === 'word' && (this.isWord('workday') || (this.peek() as { v: string }).v in WEEKDAY_NUMBERS)) {
          this.fail();
        }
        days.push(day);
      }
    } while (this.listSeparator(isDay));
    // "every 15th of the month"
    if (this.isWord('month')) this.i++;
    return days;
  }

  private yearDateList(): Array<{ month: number; day: number }> {
    const dates: Array<{ month: number; day: number }> = [];
    const isDate = () => {
      const a = this.peek(); const b = this.peek(1);
      const isMonth = (t?: Token) => t?.t === 'word' && t.v in MONTH_NUMBERS;
      const isNum = (t?: Token) => t?.t === 'num' || t?.t === 'ord';
      return (isNum(a) && isMonth(b)) || (isMonth(a) && isNum(b));
    };
    if (!isDate()) this.fail();
    do {
      const spec = this.dayAndMonth();
      dates.push({ month: spec.month, day: spec.day });
    } while (this.listSeparator(isDate));
    return dates;
  }

  /** "14 jan" or "jan 14", with an optional year after it. */
  private dayAndMonth(): DateSpec {
    const a = this.peek(); const b = this.peek(1);
    let day: number; let month: number;
    if ((a?.t === 'num' || a?.t === 'ord') && b?.t === 'word' && b.v in MONTH_NUMBERS) {
      day = a.v; month = MONTH_NUMBERS[b.v];
    } else if (a?.t === 'word' && a.v in MONTH_NUMBERS && (b?.t === 'num' || b?.t === 'ord')) {
      day = b.v; month = MONTH_NUMBERS[a.v];
    } else {
      return this.fail();
    }
    this.i += 2;
    if (day < 1 || day > 31) this.fail();
    const year = this.peek();
    if (year?.t === 'num' && year.v >= 1000) { this.i++; return { day, month, year: year.v }; }
    return { day, month };
  }

  private dateSpec(): DateSpec {
    const token = this.peek();
    if (token?.t === 'iso') { this.i++; return token.v; }
    return this.dayAndMonth();
  }

  private modifier(rule: Rule): void {
    const token = this.peek()!;
    if (token.t === 'comma') { this.i++; return; }
    if (token.t === 'time') { this.i++; rule.time = token.v; return; }
    if (token.t === 'word') {
      if (token.v in TIME_WORDS) { this.i++; rule.time = TIME_WORDS[token.v]; return; }
      if (token.v === 'at') {
        this.i++;
        const time = this.peek();
        if (time?.t === 'time') { this.i++; rule.time = time.v; return; }
        if (time?.t === 'num' && time.v <= 23) { this.i++; rule.time = `${String(time.v).padStart(2, '0')}:00:00`; return; }
        if (time?.t === 'word' && time.v in TIME_WORDS) { this.i++; rule.time = TIME_WORDS[time.v]; return; }
        this.fail();
      }
      if (token.v === 'starting') { this.i++; rule.starting = this.dateSpec(); return; }
      if (token.v === 'until') { this.i++; rule.until = this.dateSpec(); return; }
    }
    this.fail();
  }
}
