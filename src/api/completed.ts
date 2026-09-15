import { request } from './client';
import type { CompletedItem } from '@/domain/types';
import { addDays, differenceInCalendarDays, min as earliest } from 'date-fns';
import { toApiDate } from '@/domain/dates';

/**
 * Reading history, for Insights.
 *
 * Todoist caps how wide a single completed-tasks query may be, so a long
 * period is walked in windows and stitched back together. Each window is also
 * paginated by cursor.
 */

const WINDOW_DAYS = 42; // stays inside the narrowest documented window
const PAGE_LIMIT = 200;
/**
 * How many windows are in the air at once.
 *
 * A year is nine windows and was nine round trips end to end, each waiting for
 * the one before it to finish — which is most of why a year of Insights took
 * as long as it did. Four at a time is several times faster and still well
 * short of anything Todoist rate-limits.
 */
const CONCURRENT_WINDOWS = 4;

interface CompletedResponse {
  items: CompletedItem[];
  next_cursor?: string | null;
}

async function fetchWindow(
  since: Date,
  until: Date,
  signal?: AbortSignal,
): Promise<CompletedItem[]> {
  const out: CompletedItem[] = [];
  let cursor: string | undefined;

  do {
    const page = await request<CompletedResponse>('/tasks/completed/by_completion_date', {
      query: {
        since: toApiDate(since),
        until: toApiDate(until),
        limit: PAGE_LIMIT,
        cursor,
      },
      signal,
    });
    out.push(...(page.items ?? []));
    cursor = page.next_cursor ?? undefined;
  } while (cursor);

  return out;
}

export async function fetchCompleted(
  since: Date,
  until: Date,
  signal?: AbortSignal,
): Promise<CompletedItem[]> {
  const span = differenceInCalendarDays(until, since);
  if (span <= WINDOW_DAYS) return fetchWindow(since, until, signal);

  // Work out every window first, then fetch them a few at a time.
  const windows: Array<{ since: Date; until: Date }> = [];
  let cursorDate = since;
  while (cursorDate < until) {
    const windowEnd = earliest([addDays(cursorDate, WINDOW_DAYS), until]);
    windows.push({ since: cursorDate, until: windowEnd });
    cursorDate = addDays(windowEnd, 1);
  }

  const results: CompletedItem[] = [];
  for (let at = 0; at < windows.length; at += CONCURRENT_WINDOWS) {
    const batch = windows.slice(at, at + CONCURRENT_WINDOWS);
    const pages = await Promise.all(
      batch.map((window) => fetchWindow(window.since, window.until, signal)),
    );
    for (const page of pages) results.push(...page);
  }

  // Windows share no boundary day, but a defensive de-duplication costs nothing.
  const seen = new Set<string>();
  return results.filter((item) => {
    const key = `${item.id}:${item.completed_at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
