import { create } from 'zustand';
import { auth } from '@/api/auth';
import { ApiError, NotConnectedError } from '@/api/client';
import { applySync, sync } from '@/api/sync';
import {
  sendCommands, type Command,
  addItem, completeItem, deleteItem, moveItem, newUuid,
  uncompleteItem, updateItem,
} from '@/api/commands';
import * as idb from '@/db/idb';
import {
  emptySnapshot, toTodoistPriority,
  type DisplayPriority, type Item, type Snapshot, type ViewPrefs,
} from '@/domain/types';
import { detectLocale, type Locale } from '@/i18n';
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

  /* Lifecycle */
  init: () => Promise<void>;
  connect: (token: string) => Promise<boolean>;
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

  /* Toasts */
  toast: (message: string, undo?: () => void) => void;
  dismissToast: (id: string) => void;
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

  async disconnect() {
    await auth.disconnect();
    await idb.clearAll();
    set({
      connected: false,
      snapshot: emptySnapshot(),
      prefs: defaultPreferences(get().prefs.locale),
      pendingCount: 0,
      syncState: 'idle',
    });
  },

  async refresh(full = false) {
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
  },

  /**
   * Applies a change everywhere at once: on screen immediately, in the outbox
   * so it survives a reload, and at Todoist. A failure rolls the screen back
   * rather than leaving it showing something Todoist never accepted.
   */
  async apply(commands, optimistic) {
    const before = get().snapshot;
    const after = optimistic(before);
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
      const merged = applySync(get().snapshot, response);
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

    await get().apply([addItem(args, tempId)], (snapshot) => ({
      ...snapshot,
      items: { ...snapshot.items, [tempId]: optimisticItem },
    }));
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

  toast(message, undo) {
    const entry: Toast = { id: newUuid(), message, undo };
    set({ toasts: [...get().toasts, entry] });
    setTimeout(() => get().dismissToast(entry.id), undo ? 8000 : 4000);
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
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
