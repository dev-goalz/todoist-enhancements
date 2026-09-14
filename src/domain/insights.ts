import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import type { CompletedItem, Item, Snapshot } from './types';
import { toDisplayPriority } from './types';
import { estimateOf } from './estimates';

/**
 * The numbers behind Insights, computed from the completed-task history and
 * the current open tasks. Everything here is derived: nothing is stored.
 */

export interface PriorityBreakdown {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
}

export interface InsightsSummary {
  completedCount: number;
  completedMinutes: number;
  /** Completed tasks that carried no estimate, so the time above understates. */
  completedWithoutEstimate: number;
  activeCount: number;
  /** Share of open work already done, as a whole percentage. */
  progressPercentage: number;
  focusScore: number;
  priorities: PriorityBreakdown;
  byDay: Array<{ date: string; count: number }>;
  byHour: number[];
  byProject: Array<{ projectId: string; name: string; count: number }>;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  /** Share of open tasks that carry an estimate. */
  estimateCoverage: number;
}

/**
 * Focus score: the share of completed work that went to what mattered.
 *
 * Each completed task is weighted by its priority, P1 counting four times what
 * P4 counts. The score is that weighted total against the total if every task
 * had been a P1, so a week spent entirely on P1 reads 100 and one spent
 * entirely on P4 reads 25. It answers whether effort went to priorities or to
 * busy work, which is the question Rewind set out to answer.
 */
export function focusScore(items: Array<{ priority?: number }>): number {
  if (items.length === 0) return 0;
  const weights = items.map((item) => {
    // Todoist stores 4 as P1, and that is already the weight we want.
    const stored = item.priority ?? 1;
    return Math.min(4, Math.max(1, stored));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  return Math.round((total / (weights.length * 4)) * 100);
}

function countPriorities(items: Array<{ priority?: number }>): PriorityBreakdown {
  const out: PriorityBreakdown = { p1: 0, p2: 0, p3: 0, p4: 0 };
  for (const item of items) {
    const display = toDisplayPriority((item.priority ?? 1) as 1 | 2 | 3 | 4);
    out[`p${display}` as keyof PriorityBreakdown] += 1;
  }
  return out;
}

/** Consecutive days ending today (or yesterday) on which something was completed. */
function streaks(days: Set<string>, now: Date): { current: number; longest: number } {
  const sorted = [...days].sort();
  if (sorted.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = differenceInCalendarDays(new Date(sorted[i]), new Date(sorted[i - 1]));
    if (gap === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  // A streak survives today being empty until the day is over, so the count
  // walks back from today and accepts yesterday as the anchor.
  let current = 0;
  let cursor = startOfDay(now);
  if (!days.has(format(cursor, 'yyyy-MM-dd'))) {
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  while (days.has(format(cursor, 'yyyy-MM-dd'))) {
    current += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }

  return { current, longest };
}

export function summariseInsights(
  completed: CompletedItem[],
  openTasks: Item[],
  snapshot: Snapshot,
  now = new Date(),
): InsightsSummary {
  const dayCounts = new Map<string, number>();
  const hourCounts = new Array<number>(24).fill(0);
  const projectCounts = new Map<string, number>();

  let completedMinutes = 0;
  let completedWithoutEstimate = 0;

  for (const task of completed) {
    const at = new Date(task.completed_at);
    const dayKey = format(at, 'yyyy-MM-dd');
    dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);
    hourCounts[at.getHours()] += 1;
    projectCounts.set(task.project_id, (projectCounts.get(task.project_id) ?? 0) + 1);

    const minutes = task.labels ? estimateOf({ labels: task.labels } as Item) : null;
    if (minutes === null) completedWithoutEstimate += 1;
    else completedMinutes += minutes;
  }

  const estimated = openTasks.filter((i) => estimateOf(i) !== null).length;
  const total = completed.length + openTasks.length;
  const { current, longest } = streaks(new Set(dayCounts.keys()), now);

  return {
    completedCount: completed.length,
    completedMinutes,
    completedWithoutEstimate,
    activeCount: openTasks.length,
    progressPercentage: total > 0 ? Math.round((completed.length / total) * 100) : 0,
    focusScore: focusScore(completed),
    priorities: countPriorities(completed),
    byDay: [...dayCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    byHour: hourCounts,
    byProject: [...projectCounts.entries()]
      .map(([projectId, count]) => ({
        projectId,
        name: snapshot.projects[projectId]?.name ?? '—',
        count,
      }))
      .sort((a, b) => b.count - a.count),
    activeDays: dayCounts.size,
    currentStreak: current,
    longestStreak: longest,
    estimateCoverage: openTasks.length > 0
      ? Math.round((estimated / openTasks.length) * 100)
      : 0,
  };
}
