import { useEffect, useState } from 'react';
import { fetchCompleted } from '@/api/completed';
import { useStore } from '@/store/store';
import { buildDemoCompleted } from '@/demo/demoData';
import { previousRange, type Range } from '@/domain/periods';
import type { CompletedItem } from '@/domain/types';

/**
 * Reads completed tasks for a range, and for the range of the same length
 * before it.
 *
 * History is fetched on demand rather than kept in sync: it only changes at
 * the moment a task is completed, and Insights is the only place that needs it.
 *
 * The window asked for is twice the range, because every chart that compares
 * "this month" to "last month" would otherwise need a second round trip to say
 * anything. The result is split at the range's start before it is returned.
 */
export function useCompleted(range: Range, enabled: boolean) {
  const connected = useStore((s) => s.connected);
  const demo = useStore((s) => s.demo);
  const locale = useStore((s) => s.prefs.locale);
  const [data, setData] = useState<CompletedItem[]>([]);
  const [previous, setPrevious] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dates are compared by value: a fresh object with the same instant is the
  // same request, and must not fetch again.
  const sinceMs = range.since.getTime();
  const untilMs = range.until.getTime();

  useEffect(() => {
    if (!enabled || !connected) return;

    const controller = new AbortController();
    const current = { since: new Date(sinceMs), until: new Date(untilMs) };
    const earlier = previousRange(current);

    const split = (items: CompletedItem[]) => {
      const inside: CompletedItem[] = [];
      const before: CompletedItem[] = [];
      for (const item of items) {
        const at = new Date(item.completed_at).getTime();
        if (at > untilMs) continue;
        if (at >= sinceMs) inside.push(item);
        else if (at >= earlier.since.getTime()) before.push(item);
      }
      setData(inside);
      setPrevious(before);
    };

    if (demo) {
      split(buildDemoCompleted(locale));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchCompleted(earlier.since, current.until, controller.signal)
      .then(split)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'unknown');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [sinceMs, untilMs, enabled, connected, demo, locale]);

  return { data, previous, loading, error };
}
