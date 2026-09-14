import { create } from 'zustand';
import { auth } from '@/api/auth';
import { ApiError, NotConnectedError } from '@/api/client';
import { applySync, sync } from '@/api/sync';
import {
  sendCommands, command, type Command,
  addItem, completeItem, deleteItem, moveItem, newUuid,
  uncompleteItem, updateItem,
} from '@/api/commands';
import * as idb from '@/db/idb';
import {
  emptySnapshot, toTodoistPriority,
  type DisplayPriority, type Item, type Snapshot, type ViewPrefs,
} from '@/domain/types';
import { detectLocale, type Locale } from '@/i18n';
import { buildDemoSnapshot } from '@/demo/demoData';
import {
  defaultPreferences, hydratePreferences, viewPrefs as readViewPrefs,
  type Preferences,
} from './prefs';

const PREFS_KEY = 'preferences';
/** How often the app asks Todoist what changed while the tab is in the foreground. */
const POLL_INTERVAL_MS = 45_000;

export type SyncState = 'idle' | 'loading' | 'syncing' | 'error' | 'offline';

export interface Toast {
  id: string;
  message: string;
  /** When set, the toast offers an undo that runs this. */
  undo?: () => void;
}

interface AppState {
  ready: boolean;
  connected: boolean;
  snapshot: Snapshot;
  prefs: Preferences;
  syncState: SyncState;
  syncError: string | null;
  pendingCount: number;
  toasts: Toast[];
  /** The task currently being dragged, so empty drop zones can reveal themselves. */
  draggingTaskId: string | null;
  /** True while a made-up account is loaded; nothing is sent to Todoist. */
  demo: boolean;

  /* Lifecycle */
  init: () => Promise<void>;
  connect: (token: string) => Promise<boolean>;
  startDemo: () => void;
  disconnect: () => Promise<void>;
  refresh: (full?: boolean) => Promise<void>;
  startPolling: () => () => void;

  /* Preferences */
  setPrefs: (patch: Partial<Preferences>) => void;
  setViewPrefs: (viewKey: string, patch: Partial<ViewPrefs>) => void;
  setLocale: (locale: Locale) => void;

  /* Mutations */
  apply: (commands: Command[], optimistic: (snapshot: Snapshot) => Snapshot) => Promise<void>;
  updateTask: (id: string, args: Record<string, unknown>) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  createTask: (args: Record<string, unknown>) => Promise<void>;
  moveTask: (id: string, target: { project_id?: string; section_id?: string | null }) => Promise<void>;
  setTaskLabels: (id: string, labels: string[]) => Promise<void>;
  setTaskPriority: (id: string, priority: DisplayPriority) => Promise<void>;
  setLabelFavourite: (id: string, favourite: boolean) => Promise<void>;
  skipOccurrence: (id: string) => Promise<void>;
  createProject: (name: string, color: string) => Promise<void>;
  updateProjectFields: (id: string, args: Record<string, unknown>) => Promise<void>;
  updateSectionFields: (id: string, args: Record<string, unknown>) => Promise<void>;
  /** Creates a section at `index` and hands back its id, so the caller can focus its name. */
  createSection: (projectId: string, index: number) => Promise<string>;
  /** Moves a section, and the tasks in it, to a new position in its project. */
  moveSection: (id: string, index: number) => Promise<void>;
  /** Deletes a section. Todoist deletes the tasks inside it with it. */
  removeSection: (id: string) => Promise<void>;

  /* Toasts */
  toast: (message: string, undo?: () => void) => void;
  dismissToast: (id: string) => void;
  setDragging: (id: string | null) => void;
}

/** Writes the snapshot to the device without blocking the interface. */
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(snapshot: Snapshot) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => void idb.saveSnapshot(snapshot), 400);
}

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  connected: false,
  snapshot: emptySnapshot(),
  prefs: defaultPreferences(detectLocale()),
  syncState: 'idle',
  syncError: null,
  pendingCount: 0,
  toasts: [],
  draggingTaskId: null,
  demo: false,

  async init() {
    const [storedPrefs, snapshot, queue] = await Promise.all([
      idb.loadPrefs<Preferences>(PREFS_KEY),
      idb.loadSnapshot(),
      idb.readQueue(),
    ]);

    const prefs = hydratePreferences(storedPrefs, detectLocale());
    const connected = auth.isConnected();

    // Show the cached copy immediately, then reconcile with Todoist.
    set({ prefs, snapshot, connected, ready: true, pendingCount: queue.length });

    if (connected) {
      void get().refresh(snapshot.syncToken === '*');
    }
  },

  async connect(token: string) {
    set({ syncState: 'loading', syncError: null });
    await auth.set(token);
    try {
      const response = await sync('*');
      const snapshot = applySync(emptySnapshot(), response);
      set({ connected: true, snapshot, syncState: 'idle' });
      void idb.saveSnapshot(snapshot);
      return true;
    } catch (error) {
      await auth.disconnect();
      set({
        connected: false,
        syncState: 'error',
        syncError: error instanceof ApiError && error.isAuthError ? 'invalid' : 'offline',
      });
      return false;
    }
  },

  startDemo() {
    set({
      demo: true,
      connected: true,
      ready: true,
      syncState: 'idle',
      snapshot: buildDemoSnapshot(get().prefs.locale),
      pendingCount: 0,
    });
  },

  async disconnect() {
    await auth.disconnect();
    await idb.clearAll();
    set({
      connected: false,
      demo: false,
      snapshot: emptySnapshot(),
      prefs: defaultPreferences(get().prefs.locale),
      pendingCount: 0,
      syncState: 'idle',
    });
  },

  async refresh(full = false) {
    if (get().demo) return;
    if (!auth.isConnected()) return;
    if (get().syncState === 'syncing') return;

    set({ syncState: 'syncing', syncError: null });

    try {
      // Anything queued offline goes out first, so the server state the app
      // reads back already includes it and cannot overwrite it.
      await flushQueue(get, set);

      const token = full ? '*' : get().snapshot.syncToken;
      const response = await sync(token);
      const snapshot = applySync(full ? emptySnapshot() : get().snapshot, response);
      set({ snapshot, syncState: 'idle' });
      schedulePersist(snapshot);
    } catch (error) {
      if (error instanceof NotConnectedError) {
        set({ connected: false, syncState: 'idle' });
        return;
      }
      const offline = !navigator.onLine || !(error instanceof ApiError);
      set({
        syncState: offline ? 'offline' : 'error',
        syncError: error instanceof Error ? error.message : 'unknown',
      });
      if (error instanceof ApiError && error.isAuthError) {
        set({ connected: false });
        await auth.disconnect();
      }
    }
  },

  startPolling() {
    const tick = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void get().refresh();
    };
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    // Coming back to the tab or back online is the moment the user most
    // expects to see fresh data, so both trigger an immediate read.
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
    window.addEventListener('focus', tick);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', tick);
      window.removeEventListener('focus', tick);
    };
  },

  setPrefs(patch) {
    const prefs = { ...get().prefs, ...patch };
    set({ prefs });
    void idb.savePrefs(PREFS_KEY, prefs);
  },

  setViewPrefs(viewKey, patch) {
    const current = readViewPrefs(get().prefs, viewKey);
    const prefs = {
      ...get().prefs,
      views: { ...get().prefs.views, [viewKey]: { ...current, ...patch } },
    };
    set({ prefs });
    void idb.savePrefs(PREFS_KEY, prefs);
  },

  setLocale(locale) {
    get().setPrefs({ locale });
    document.documentElement.lang = locale;
    // The demo account is written in the interface language, so switching
    // language rebuilds it rather than leaving half the screen translated.
    if (get().demo) set({ snapshot: buildDemoSnapshot(locale) });
  },

  /**
   * Applies a change everywhere at once: on screen immediately, in the outbox
   * so it survives a reload, and at Todoist. A failure rolls the screen back
   * rather than leaving it showing something Todoist never accepted.
   */
  async apply(commands, optimistic) {
    const before = get().snapshot;
    const after = optimistic(before);

    if (get().demo) {
      // A demo account is a sandbox: changes show, and stop there.
      set({ snapshot: after });
      return;
    }

    set({ snapshot: after });
    schedulePersist(after);

    await idb.enqueue(commands);
    set({ pendingCount: get().pendingCount + commands.length });

    if (!navigator.onLine) {
      set({ syncState: 'offline' });
      return;
    }

    try {
      const { response, failures } = await sendCommands(after.syncToken, commands);
      let merged = applySync(get().snapshot, response);

      // Todoist returns the real id for each temp id it accepted. The
      // placeholder must go, or the created task shows twice.
      const mapping = response.temp_id_mapping ?? {};
      const tempIds = Object.keys(mapping);
      if (tempIds.length > 0) {
        const items = { ...merged.items };
        const projects = { ...merged.projects };
        for (const tempId of tempIds) {
          delete items[tempId];
          delete projects[tempId];
        }
        merged = { ...merged, items, projects };
      }

      set({ snapshot: merged, syncState: 'idle' });
      schedulePersist(merged);

      await idb.dequeue(commands.map((c) => c.uuid));
      set({ pendingCount: Math.max(0, get().pendingCount - commands.length) });

      if (failures.length > 0) {
        set({ snapshot: before });
        schedulePersist(before);
        get().toast(failures[0].error);
      }
    } catch (error) {
      if (navigator.onLine && error instanceof ApiError && !error.isAuthError) {
        // Todoist refused the change outright, so the screen must not keep it.
        set({ snapshot: before, syncState: 'error' });
        schedulePersist(before);
        await idb.dequeue(commands.map((c) => c.uuid));
        set({ pendingCount: Math.max(0, get().pendingCount - commands.length) });
      } else {
        // Network trouble: the change stays queued and goes out on the next sync.
        set({ syncState: 'offline' });
      }
    }
  },

  async updateTask(id, args) {
    await get().apply([updateItem(id, args)], (snapshot) => patchItem(snapshot, id, args));
  },

  async toggleTask(id) {
    const item = get().snapshot.items[id];
    if (!item) return;
    const checked = !item.checked;
    const command = checked ? completeItem(id) : uncompleteItem(id);
    await get().apply([command], (snapshot) => patchItem(snapshot, id, { checked }));
  },

  async removeTask(id) {
    await get().apply([deleteItem(id)], (snapshot) => {
      const items = { ...snapshot.items };
      delete items[id];
      return { ...snapshot, items };
    });
  },

  async createTask(args) {
    const tempId = newUuid();
    // The task appears at once under a temporary id; the sync response that
    // follows carries the real one and replaces it.
    const optimisticItem: Item = {
      id: tempId,
      user_id: get().snapshot.user?.id ?? '',
      project_id: String(args.project_id ?? get().snapshot.user?.inbox_project_id ?? ''),
      section_id: (args.section_id as string) ?? null,
      parent_id: (args.parent_id as string) ?? null,
      content: String(args.content ?? ''),
      description: String(args.description ?? ''),
      priority: (args.priority as 1 | 2 | 3 | 4) ?? 1,
      due: (args.due as Item['due']) ?? null,
      deadline: (args.deadline as Item['deadline']) ?? null,
      duration: null,
      labels: (args.labels as string[]) ?? [],
      child_order: 0,
      day_order: -1,
      collapsed: false,
      checked: false,
      is_deleted: false,
      added_at: new Date().toISOString(),
      completed_at: null,
      updated_at: new Date().toISOString(),
      responsible_uid: null,
    };

    /* Subtasks go out in the same batch, pointing at the parent's temp id.
       Todoist resolves a temp id used as an argument inside one call, so the
       whole tree is created in a single round trip and can never half-exist. */
    const subtasks = (args.subtasks as string[] | undefined) ?? [];
    const { subtasks: _ignored, ...parentArgs } = args;

    const children = subtasks.map((content) => ({
      tempId: newUuid(),
      args: {
        content,
        project_id: parentArgs.project_id,
        parent_id: tempId,
      },
    }));

    const optimisticChildren: Record<string, Item> = {};
    for (const child of children) {
      optimisticChildren[child.tempId] = {
        ...optimisticItem,
        id: child.tempId,
        parent_id: tempId,
        content: String(child.args.content),
        description: '',
        priority: 1,
        due: null,
        deadline: null,
        labels: [],
      };
    }

    await get().apply(
      [addItem(parentArgs, tempId), ...children.map((c) => addItem(c.args, c.tempId))],
      (snapshot) => ({
        ...snapshot,
        items: { ...snapshot.items, [tempId]: optimisticItem, ...optimisticChildren },
      }),
    );
  },

  async moveTask(id, target) {
    await get().apply([moveItem(id, target)], (snapshot) => patchItem(snapshot, id, target));
  },

  async setTaskLabels(id, labels) {
    await get().updateTask(id, { labels });
  },

  async setTaskPriority(id, priority) {
    await get().updateTask(id, { priority: toTodoistPriority(priority) });
  },

  /**
   * Advances a recurring task to its next occurrence.
   *
   * Todoist has no skip command: closing a recurring task is what rolls the
   * series forward, which is exactly what the menu offers here.
   */
  async skipOccurrence(id) {
    const item = get().snapshot.items[id];
    if (!item?.due?.is_recurring) return;
    await get().apply([command('item_close', { id })], (snapshot) => snapshot);
    await get().refresh();
  },

  async setLabelFavourite(id, favourite) {
    await get().apply(
      [command('label_update', { id, is_favorite: favourite })],
      (snapshot) => {
        const label = snapshot.labels[id];
        if (!label) return snapshot;
        return {
          ...snapshot,
          labels: { ...snapshot.labels, [id]: { ...label, is_favorite: favourite } },
        };
      },
    );
  },

  async createProject(name, color) {
    const tempId = newUuid();
    await get().apply(
      [{ type: 'project_add', uuid: newUuid(), args: { name, color }, temp_id: tempId }],
      (snapshot) => ({
        ...snapshot,
        projects: {
          ...snapshot.projects,
          [tempId]: {
            id: tempId, name, color, parent_id: null,
            child_order: Object.keys(snapshot.projects).length,
            is_archived: false, is_deleted: false, is_favorite: false,
            workspace_id: null,
          },
        },
      }),
    );
  },

  async updateProjectFields(id, args) {
    await get().apply([command('project_update', { id, ...args })], (snapshot) => {
      const project = snapshot.projects[id];
      if (!project) return snapshot;
      return { ...snapshot, projects: { ...snapshot.projects, [id]: { ...project, ...args } } };
    });
  },

  async createSection(projectId, index) {
    const tempId = newUuid();

    /* The new section takes the clicked position, and everything from there
       down moves one place. Giving it the same order as an existing section
       and hoping the sort works it out is how it ended up at the bottom. */
    const existing = Object.values(get().snapshot.sections)
      .filter((s) => s.project_id === projectId && !s.is_archived && !s.is_deleted)
      .sort((a, b) => a.section_order - b.section_order);

    const shifted = existing.slice(index);
    const commands = [
      {
        type: 'section_add',
        uuid: newUuid(),
        temp_id: tempId,
        args: { name: '', project_id: projectId, section_order: index },
      },
      ...shifted.map((section, offset) =>
        command('section_update', { id: section.id, section_order: index + offset + 1 })),
    ];

    await get().apply(commands, (snapshot) => {
      const sections = { ...snapshot.sections };
      shifted.forEach((section, offset) => {
        sections[section.id] = { ...section, section_order: index + offset + 1 };
      });
      sections[tempId] = {
        id: tempId, project_id: projectId, name: '',
        section_order: index, is_archived: false, is_deleted: false,
      };
      return { ...snapshot, sections };
    });

    return tempId;
  },

  async moveSection(id, index) {
    const snapshot = get().snapshot;
    const section = snapshot.sections[id];
    if (!section) return;

    const others = Object.values(snapshot.sections)
      .filter((s) => s.project_id === section.project_id && s.id !== id
        && !s.is_archived && !s.is_deleted)
      .sort((a, b) => a.section_order - b.section_order);

    // The order the list should end up in, then one command per section that
    // actually moved — a whole-list rewrite would churn every row.
    const ordered = [...others.slice(0, index), section, ...others.slice(index)];
    const changed = ordered
      .map((s, order) => ({ section: s, order }))
      .filter(({ section: s, order }) => s.section_order !== order);
    if (changed.length === 0) return;

    await get().apply(
      changed.map(({ section: s, order }) =>
        command('section_update', { id: s.id, section_order: order })),
      (snap) => {
        const sections = { ...snap.sections };
        for (const { section: s, order } of changed) {
          sections[s.id] = { ...sections[s.id], section_order: order };
        }
        return { ...snap, sections };
      },
    );
  },

  async removeSection(id) {
    await get().apply([command('section_delete', { id })], (snapshot) => {
      const sections = { ...snapshot.sections };
      delete sections[id];
      // The tasks go with it, as they do in Todoist.
      const items = Object.fromEntries(
        Object.entries(snapshot.items).filter(([, item]) => item.section_id !== id),
      );
      return { ...snapshot, sections, items };
    });
  },

  async updateSectionFields(id, args) {
    await get().apply([command('section_update', { id, ...args })], (snapshot) => {
      const section = snapshot.sections[id];
      if (!section) return snapshot;
      return { ...snapshot, sections: { ...snapshot.sections, [id]: { ...section, ...args } } };
    });
  },

  toast(message, undo) {
    const entry: Toast = { id: newUuid(), message, undo };
    set({ toasts: [...get().toasts, entry] });
    setTimeout(() => get().dismissToast(entry.id), undo ? 8000 : 4000);
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  setDragging(id) {
    set({ draggingTaskId: id });
  },
}));

/** Applies a field change to one task in the snapshot. */
function patchItem(snapshot: Snapshot, id: string, args: Record<string, unknown>): Snapshot {
  const item = snapshot.items[id];
  if (!item) return snapshot;
  return { ...snapshot, items: { ...snapshot.items, [id]: { ...item, ...args } as Item } };
}

/** Sends everything waiting in the outbox, oldest first. */
async function flushQueue(
  get: () => AppState,
  set: (patch: Partial<AppState>) => void,
): Promise<void> {
  const queue = await idb.readQueue();
  if (queue.length === 0) return;

  const commands: Command[] = queue.map(({ queuedAt: _q, attempts: _a, ...cmd }) => cmd);
  try {
    const { response } = await sendCommands(get().snapshot.syncToken, commands);
    const merged = applySync(get().snapshot, response);
    set({ snapshot: merged });
    await idb.dequeue(commands.map((c) => c.uuid));
    set({ pendingCount: 0 });
  } catch {
    // Still unreachable or refused; the queue is left alone and retried later.
  }
}
