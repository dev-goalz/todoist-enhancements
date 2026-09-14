import { useEffect, useState } from 'react';
import { fetchCompleted } from '@/api/completed';
import { useStore } from '@/store/store';
import type { CompletedItem } from '@/domain/types';

export type Period = 'week' | 'month' | 'quarter' | 'year';

/**
 * Reads completed tasks for a period.
 *
 * History is fetched on demand rather than kept in sync: it only changes at
 * the moment a task is completed, and Insights is the only place that needs it.
 */
export function useCompleted(period: Period, enabled: boolean) {
  const connected = useStore((s) => s.connected);
  const [data, setData] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !connected) return;

    const controller = new AbortController();
    const now = new Date();
    const since = new Date(now);

    if (period === 'week') since.setDate(now.getDate() - 7);
    else if (period === 'month') since.setMonth(now.getMonth() - 1);
    else if (period === 'quarter') since.setMonth(now.getMonth() - 3);
    else since.setFullYear(now.getFullYear() - 1);

    setLoading(true);
    setError(null);

    fetchCompleted(since, now, controller.signal)
      .then((items) => setData(items))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'unknown');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [period, enabled, connected]);

  return { data, loading, error };
}
