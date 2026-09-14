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

  const results: CompletedItem[] = [];
  let cursorDate = since;
  while (cursorDate < until) {
    const windowEnd = earliest([addDays(cursorDate, WINDOW_DAYS), until]);
    results.push(...(await fetchWindow(cursorDate, windowEnd, signal)));
    cursorDate = addDays(windowEnd, 1);
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
