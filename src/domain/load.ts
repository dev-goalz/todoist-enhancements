import type { Item } from './types';
import { effectiveEstimate } from './estimates';

/** Capacity in minutes for each day, indexed 0 = Sunday .. 6 = Saturday. */
export type DailyCapacity = [number, number, number, number, number, number, number];

export const DEFAULT_DAILY_MINUTES = 300; // five hours

export const defaultCapacity = (): DailyCapacity => [
  DEFAULT_DAILY_MINUTES, DEFAULT_DAILY_MINUTES, DEFAULT_DAILY_MINUTES,
  DEFAULT_DAILY_MINUTES, DEFAULT_DAILY_MINUTES, DEFAULT_DAILY_MINUTES,
  DEFAULT_DAILY_MINUTES,
];

/** Weekly capacity is derived from the days, unless the user overrides it. */
export function weeklyCapacity(daily: DailyCapacity, manualOverride: number | null): number {
  if (manualOverride !== null && manualOverride > 0) return manualOverride;
  return daily.reduce((a, b) => a + b, 0);
}

export interface LoadSummary {
  taskCount: number;
  estimatedMinutes: number;
  unestimatedCount: number;
  /** Null when the view has no meaningful capacity to measure against. */
  percentage: number | null;
  level: 'ok' | 'tight' | 'over' | null;
}

/**
 * The header line: X tasks, X h X min, X % of capacity, X unestimated.
 *
 * Computed over the tasks actually displayed, after filters, so the number
 * always describes what the user is looking at.
 */
export function summariseLoad(
  items: Item[],
  childrenOf: (parentId: string) => Item[],
  capacityMinutes: number | null,
): LoadSummary {
  let estimatedMinutes = 0;
  let unestimatedCount = 0;

  for (const item of items) {
    const { minutes } = effectiveEstimate(item, childrenOf);
    if (minutes === null) unestimatedCount += 1;
    else estimatedMinutes += minutes;
  }

  if (capacityMinutes === null || capacityMinutes <= 0) {
    return {
      taskCount: items.length,
      estimatedMinutes,
      unestimatedCount,
      percentage: null,
      level: null,
    };
  }

  const percentage = Math.round((estimatedMinutes / capacityMinutes) * 100);
  // Under 80 % reads as comfortable, 80 to 100 as tight, above as over capacity.
  const level = percentage < 80 ? 'ok' : percentage <= 100 ? 'tight' : 'over';

  return { taskCount: items.length, estimatedMinutes, unestimatedCount, percentage, level };
}
