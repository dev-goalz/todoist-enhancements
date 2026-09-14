import { useMemo } from 'react';
import { useStore } from '@/store/store';
import { childIndex, makeChildrenOf, openItems } from '@/store/selectors';
import type { Item } from '@/domain/types';

/**
 * The derived reading of the snapshot every view needs: the open tasks, and a
 * way to reach a task's children. Recomputed only when the snapshot changes.
 */
export function useData() {
  const snapshot = useStore((s) => s.snapshot);

  return useMemo(() => {
    const index = childIndex(snapshot);
    const childrenOf = makeChildrenOf(index);
    const items = openItems(snapshot);
    const byId = (id: string): Item | undefined => snapshot.items[id];
    return { snapshot, items, childrenOf, byId, childIndex: index };
  }, [snapshot]);
}
