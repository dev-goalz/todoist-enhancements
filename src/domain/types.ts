/**
 * Todoist resource shapes as returned by the v1 Sync API, plus the product-level
 * types layered on top of them.
 *
 * Naming follows the mapping fixed in the spec:
 *   product "list"    -> Todoist project
 *   product "group"   -> Todoist section
 *   product "context" -> Todoist workspace
 *   product "tag"     -> Todoist label
 */

/** Todoist stores priority inverted: 4 is the most urgent (P1), 1 the least (P4). */
export type TodoistPriority = 1 | 2 | 3 | 4;
/** The product speaks in P1..P4, which is what the user sees everywhere. */
export type DisplayPriority = 1 | 2 | 3 | 4;

export interface TodoistDue {
  date: string; // "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss(Z)"
  timezone: string | null;
  string: string;
  lang: string;
  is_recurring: boolean;
}

export interface TodoistDeadline {
  date: string; // always a plain "YYYY-MM-DD"
  lang: string;
}

export interface TodoistDuration {
  amount: number;
  unit: 'minute' | 'day';
}

export interface Item {
  id: string;
  user_id: string;
  project_id: string;
  section_id: string | null;
  parent_id: string | null;
  content: string;
  description: string;
  priority: TodoistPriority;
  due: TodoistDue | null;
  deadline: TodoistDeadline | null;
  duration: TodoistDuration | null;
  labels: string[];
  child_order: number;
  day_order: number;
  collapsed: boolean;
  checked: boolean;
  is_deleted: boolean;
  added_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  responsible_uid: string | null;
  note_count?: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  parent_id: string | null;
  child_order: number;
  is_archived: boolean;
  is_deleted: boolean;
  is_favorite: boolean;
  inbox_project?: boolean;
  view_style?: string;
  workspace_id?: string | null;
  /** Todoist folders are projects that hold others rather than tasks. */
  is_folder?: boolean;
  collapsed?: boolean;
}

export interface Section {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  section_order: number;
  is_archived: boolean;
  is_deleted: boolean;
  collapsed?: boolean;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  item_order: number;
  is_deleted: boolean;
  is_favorite: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  logo_big?: string | null;
}

export interface Collaborator {
  id: string;
  email: string;
  full_name: string;
  image_id: string | null;
}

export interface Note {
  id: string;
  item_id: string | null;
  project_id: string | null;
  content: string;
  posted_at: string;
  posted_uid: string;
  is_deleted: boolean;
  file_attachment: {
    file_name?: string;
    file_type?: string;
    file_url?: string;
    file_size?: number;
  } | null;
}

export interface Reminder {
  id: string;
  item_id: string;
  type: 'relative' | 'absolute' | 'location';
  due: TodoistDue | null;
  minute_offset?: number;
  is_deleted: boolean;
}

export interface TodoistUser {
  id: string;
  email: string;
  full_name: string;
  inbox_project_id: string;
  tz_info: { timezone: string; hours: number; minutes: number; is_dst: number };
  start_day: number; // 1 = Monday .. 7 = Sunday
  premium_status?: string;
  is_premium?: boolean;
  lang?: string;
  image_id?: string | null;
  avatar_big?: string | null;
  karma?: number | null;
  karma_trend?: string | null;
}

/** A completed task as returned by the completed-tasks endpoints. */
export interface CompletedItem {
  id: string;
  task_id?: string;
  user_id: string;
  project_id: string;
  section_id: string | null;
  content: string;
  completed_at: string;
  labels?: string[];
  priority?: TodoistPriority;
  note_count?: number;
}

/** Everything the app keeps about the account, kept in memory and mirrored to IndexedDB. */
export interface Snapshot {
  items: Record<string, Item>;
  projects: Record<string, Project>;
  sections: Record<string, Section>;
  labels: Record<string, Label>;
  workspaces: Record<string, Workspace>;
  collaborators: Record<string, Collaborator>;
  notes: Record<string, Note>;
  reminders: Record<string, Reminder>;
  user: TodoistUser | null;
  syncToken: string;
  syncedAt: number | null;
}

export const emptySnapshot = (): Snapshot => ({
  items: {},
  projects: {},
  sections: {},
  labels: {},
  workspaces: {},
  collaborators: {},
  notes: {},
  reminders: {},
  user: null,
  syncToken: '*',
  syncedAt: null,
});

/** Todoist priority 4 means P1. This converts in both directions. */
export const toDisplayPriority = (p: TodoistPriority): DisplayPriority =>
  (5 - p) as DisplayPriority;
export const toTodoistPriority = (p: DisplayPriority): TodoistPriority =>
  (5 - p) as TodoistPriority;

/** The technical labels the product reads. These are never translated. */
export const SYSTEM_LABELS = {
  week: 'week',
  quick: 'quick',
  automation: 'automation',
  waiting: 'waiting',
} as const;

export const ESTIMATE_PREFIX = 'est-';

/** The bucket a task falls into, decided by the display-priority rules in the spec. */
export type Bucket = 'overdue' | 'today' | 'upcoming' | 'anytime' | 'someday';

export type ViewId =
  | 'inbox'
  | 'week'
  | 'upcoming'
  | 'someday'
  | 'dashboard'
  | 'settings'
  | 'project'
  | 'label'
  | 'labels'
  | 'insights';

export type DisplayMode = 'list' | 'board' | 'focus';

export type GroupKey =
  /** What the page groups by when the user has chosen nothing: sections in a
   *  project, the fixed week layout in My week, flat elsewhere. */
  | 'none'
  | 'scheduled'
  | 'day'
  | 'week'
  | 'month'
  | 'workspace'
  | 'project'
  | 'section'
  | 'priority'
  | 'label'
  | 'estimate';

export type SortKey =
  | 'manual'
  | 'priority'
  | 'due'
  | 'added'
  | 'alphabetical'
  | 'estimate-asc'
  | 'estimate-desc';

export interface ViewFilters {
  workspaces: string[];
  projects: string[];
  labels: string[];
  priorities: DisplayPriority[];
  /** null = no estimate filter, true = estimated only, false = unestimated only */
  estimated: boolean | null;
  includeScheduled: boolean;
  showSubtasks: boolean;
}

export const defaultFilters = (): ViewFilters => ({
  workspaces: [],
  projects: [],
  labels: [],
  priorities: [],
  estimated: null,
  includeScheduled: true,
  showSubtasks: true,
});

export interface ViewPrefs {
  mode: DisplayMode;
  group: GroupKey;
  sort: SortKey;
  filters: ViewFilters;
}

export const defaultViewPrefs = (): ViewPrefs => ({
  mode: 'list',
  group: 'none',
  sort: 'manual',
  filters: defaultFilters(),
});
