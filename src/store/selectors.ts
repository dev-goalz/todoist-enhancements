import {
  toDisplayPriority,
  type GroupKey, type Item, type Project, type Snapshot,
  type SortKey, type ViewFilters,
} from '@/domain/types';
import { estimateOf, effectiveEstimate } from '@/domain/estimates';
import { dueDate } from '@/domain/dates';
import { hasLabel, isOpen } from '@/domain/views';

/** Index of parent id to its children, built once per snapshot. */
export function childIndex(snapshot: Snapshot): Map<string, Item[]> {
  const index = new Map<string, Item[]>();
  for (const item of Object.values(snapshot.items)) {
    if (!item.parent_id || item.is_deleted) continue;
    const bucket = index.get(item.parent_id);
    if (bucket) bucket.push(item);
    else index.set(item.parent_id, [item]);
  }
  for (const bucket of index.values()) bucket.sort((a, b) => a.child_order - b.child_order);
  return index;
}

export const makeChildrenOf =
  (index: Map<string, Item[]>) =>
  (parentId: string): Item[] =>
    index.get(parentId) ?? [];

/** Every open task, with tasks living in archived projects left out. */
export function openItems(snapshot: Snapshot): Item[] {
  return Object.values(snapshot.items).filter((item) => {
    if (!isOpen(item)) return false;
    const project = snapshot.projects[item.project_id];
    return !project || (!project.is_archived && !project.is_deleted);
  });
}

/** Top-level tasks only: subtasks are rendered under their parent, not beside it. */
export const rootItems = (items: Item[]): Item[] => items.filter((i) => !i.parent_id);

export function applyFilters(
  items: Item[],
  filters: ViewFilters,
  snapshot: Snapshot,
  childrenOf: (id: string) => Item[],
): Item[] {
  return items.filter((item) => {
    if (filters.projects.length > 0 && !filters.projects.includes(item.project_id)) return false;

    if (filters.workspaces.length > 0) {
      const workspaceId = snapshot.projects[item.project_id]?.workspace_id ?? null;
      if (!workspaceId || !filters.workspaces.includes(workspaceId)) return false;
    }

    if (filters.labels.length > 0 && !filters.labels.some((l) => hasLabel(item, l))) return false;

    if (
      filters.priorities.length > 0 &&
      !filters.priorities.includes(toDisplayPriority(item.priority))
    ) {
      return false;
    }

    if (filters.estimated !== null) {
      const { minutes } = effectiveEstimate(item, childrenOf);
      if (filters.estimated && minutes === null) return false;
      if (!filters.estimated && minutes !== null) return false;
    }

    if (!filters.includeScheduled && item.due) return false;

    return true;
  });
}

export function countActiveFilters(filters: ViewFilters): number {
  let count = 0;
  if (filters.projects.length) count += 1;
  if (filters.workspaces.length) count += 1;
  if (filters.labels.length) count += 1;
  if (filters.priorities.length) count += 1;
  if (filters.estimated !== null) count += 1;
  if (!filters.includeScheduled) count += 1;
  return count;
}

export function sortItems(
  items: Item[],
  sort: SortKey,
  childrenOf: (id: string) => Item[],
): Item[] {
  const copy = [...items];
  const estimate = (i: Item) => effectiveEstimate(i, childrenOf).minutes;

  switch (sort) {
    case 'priority':
      // Todoist stores 4 as the most urgent, so the higher number comes first.
      return copy.sort((a, b) => b.priority - a.priority || a.child_order - b.child_order);
    case 'due':
      return copy.sort((a, b) => {
        const da = dueDate(a)?.getTime();
        const db = dueDate(b)?.getTime();
        // Undated tasks sink to the bottom rather than jumping to the top.
        if (da === undefined && db === undefined) return a.child_order - b.child_order;
        if (da === undefined) return 1;
        if (db === undefined) return -1;
        return da - db;
      });
    case 'added':
      return copy.sort((a, b) => (a.added_at ?? '').localeCompare(b.added_at ?? ''));
    case 'alphabetical':
      return copy.sort((a, b) => a.content.localeCompare(b.content));
    case 'estimate-asc':
    case 'estimate-desc': {
      const direction = sort === 'estimate-asc' ? 1 : -1;
      return copy.sort((a, b) => {
        const ea = estimate(a);
        const eb = estimate(b);
        if (ea === null && eb === null) return a.child_order - b.child_order;
        if (ea === null) return 1;
        if (eb === null) return -1;
        return (ea - eb) * direction;
      });
    }
    case 'manual':
    default:
      return copy.sort((a, b) => a.child_order - b.child_order);
  }
}

export interface Group {
  key: string;
  /** Already-translated title, or a translation key the caller resolves. */
  title: string;
  items: Item[];
}

export function groupItems(
  items: Item[],
  group: GroupKey,
  snapshot: Snapshot,
  labels: {
    none: string;
    noProject: string;
    noSection: string;
    noEstimate: string;
    noLabel: string;
    priority: (p: number) => string;
    day: (d: Date | null) => string;
  },
): Group[] {
  if (group === 'none') return [{ key: 'all', title: '', items }];

  const buckets = new Map<string, { title: string; items: Item[] }>();
  const push = (key: string, title: string, item: Item) => {
    const bucket = buckets.get(key);
    if (bucket) bucket.items.push(item);
    else buckets.set(key, { title, items: [item] });
  };

  for (const item of items) {
    switch (group) {
      case 'project': {
        const project: Project | undefined = snapshot.projects[item.project_id];
        push(item.project_id, project?.name ?? labels.noProject, item);
        break;
      }
      case 'section': {
        const section = item.section_id ? snapshot.sections[item.section_id] : undefined;
        push(item.section_id ?? 'none', section?.name ?? labels.noSection, item);
        break;
      }
      case 'workspace': {
        const workspaceId = snapshot.projects[item.project_id]?.workspace_id ?? 'personal';
        const workspace = snapshot.workspaces[workspaceId ?? ''];
        push(workspaceId ?? 'personal', workspace?.name ?? labels.none, item);
        break;
      }
      case 'priority': {
        const p = toDisplayPriority(item.priority);
        push(`p${p}`, labels.priority(p), item);
        break;
      }
      case 'label': {
        const own = item.labels.filter((l) => !l.startsWith('est-'));
        if (own.length === 0) push('none', labels.noLabel, item);
        else for (const label of own) push(label, label, item);
        break;
      }
      case 'estimate': {
        const minutes = estimateOf(item);
        push(minutes === null ? 'none' : String(minutes), minutes === null ? labels.noEstimate : `${minutes} min`, item);
        break;
      }
      case 'day':
      case 'week':
      case 'month': {
        const d = dueDate(item);
        const key = d ? bucketDateKey(d, group) : 'none';
        push(key, labels.day(d), item);
        break;
      }
      default:
        push('all', '', item);
    }
  }

  const result = [...buckets.entries()].map(([key, value]) => ({ key, ...value }));
  // Date groups must read chronologically; every other grouping keeps insertion order.
  if (group === 'day' || group === 'week' || group === 'month') {
    result.sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.key.localeCompare(b.key)));
  }
  return result;
}

function bucketDateKey(date: Date, group: 'day' | 'week' | 'month'): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  if (group === 'month') return `${y}-${m}`;
  if (group === 'week') {
    const week = Math.ceil((date.getDate() + new Date(y, date.getMonth(), 1).getDay()) / 7);
    return `${y}-${m}-w${week}`;
  }
  return `${y}-${m}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Projects ordered for the sidebar, grouped by the workspace they belong to. */
export function projectsByWorkspace(snapshot: Snapshot): Array<{
  workspaceId: string | null;
  name: string | null;
  projects: Project[];
}> {
  const groups = new Map<string, Project[]>();

  for (const project of Object.values(snapshot.projects)) {
    if (project.is_archived || project.is_deleted || project.inbox_project) continue;
    const key = project.workspace_id ?? 'personal';
    const bucket = groups.get(key);
    if (bucket) bucket.push(project);
    else groups.set(key, [project]);
  }

  return [...groups.entries()]
    .map(([key, projects]) => ({
      workspaceId: key === 'personal' ? null : key,
      name: key === 'personal' ? null : (snapshot.workspaces[key]?.name ?? null),
      projects: projects.sort((a, b) => a.child_order - b.child_order),
    }))
    // The personal workspace always leads, matching Todoist's own ordering.
    .sort((a, b) => (a.workspaceId === null ? -1 : b.workspaceId === null ? 1 : 0));
}

/** How many open tasks each project holds, for the sidebar counters. */
export function projectCounts(items: Item[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.project_id, (counts.get(item.project_id) ?? 0) + 1);
  }
  return counts;
}
