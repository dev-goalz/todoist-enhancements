import { useEffect, useState } from 'react';
import { fetchCompleted } from '@/api/completed';
import { useStore } from '@/store/store';
import { buildDemoCompleted } from '@/demo/demoData';
import type { CompletedItem } from '@/domain/types';

export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Reads completed tasks for a period, and for the period before it.
 *
 * History is fetched on demand rather than kept in sync: it only changes at
 * the moment a task is completed, and Insights is the only place that needs it.
 *
 * The window asked for is twice the period, because every chart that compares
 * "this month" to "last month" would otherwise need a second round trip to say
 * anything. The result is split at the period boundary before it is returned.
 */
export function useCompleted(period: Period, enabled: boolean) {
  const connected = useStore((s) => s.connected);
  const demo = useStore((s) => s.demo);
  const locale = useStore((s) => s.prefs.locale);
  const [data, setData] = useState<CompletedItem[]>([]);
  const [previous, setPrevious] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !connected) return;

    const controller = new AbortController();
    const now = new Date();
    const since = new Date(now);

    if (period === 'day') since.setHours(0, 0, 0, 0);
    else if (period === 'week') since.setDate(now.getDate() - 7);
    else if (period === 'month') since.setMonth(now.getMonth() - 1);
    else if (period === 'quarter') since.setMonth(now.getMonth() - 3);
    else since.setFullYear(now.getFullYear() - 1);

    // The preceding window of the same length, for the comparison marks.
    const cutoff = since.getTime();
    const previousSince = new Date(cutoff - (now.getTime() - cutoff));

    const split = (items: CompletedItem[]) => {
      const current: CompletedItem[] = [];
      const earlier: CompletedItem[] = [];
      for (const item of items) {
        (new Date(item.completed_at).getTime() >= cutoff ? current : earlier).push(item);
      }
      setData(current);
      setPrevious(earlier);
    };

    if (demo) {
      split(buildDemoCompleted(locale).filter(
        (c) => new Date(c.completed_at).getTime() >= previousSince.getTime(),
      ));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchCompleted(previousSince, now, controller.signal)
      .then(split)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'unknown');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [period, enabled, connected, demo, locale]);

  return { data, previous, loading, error };
}
