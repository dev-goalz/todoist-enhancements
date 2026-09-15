import type { Locale } from '@/i18n';
import type { ViewId } from '@/domain/types';
import { defaultViewPrefs, type ViewPrefs } from '@/domain/types';
import { defaultConflictSettings, type ConflictSettings } from '@/domain/conflicts';
import { defaultCapacity, type DailyCapacity } from '@/domain/load';

/** The views that make sense as a landing page: no view that needs an id. */
export const HOME_VIEWS = [
  'week', 'inbox', 'upcoming', 'someday', 'dashboard', 'insights', 'labels',
] as const satisfies readonly ViewId[];

export type HomeView = (typeof HOME_VIEWS)[number];

/**
 * How much room a list gives each task.
 *
 * Comfortable is the layout the product was designed at. Compact tightens the
 * space around things without touching the things themselves: the same type at
 * the same size, the same information on every row, and the same targets to
 * press. It is a shorter page, not a smaller one.
 */
export const DENSITIES = ['comfortable', 'compact'] as const;
export type Density = (typeof DENSITIES)[number];

export const isDensity = (value: unknown): value is Density =>
  typeof value === 'string' && (DENSITIES as readonly string[]).includes(value);

/** Light, dark, or whatever the device is set to. */
export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const isTheme = (value: unknown): value is Theme =>
  typeof value === 'string' && (THEMES as readonly string[]).includes(value);

export const isHomeView = (value: unknown): value is HomeView =>
  typeof value === 'string' && (HOME_VIEWS as readonly string[]).includes(value);

/** Everything the user can tune. Stored on the device, never on a server. */
export interface Preferences {
  locale: Locale;
  /** Where the app opens when no destination is in the address bar. */
  homepage: HomeView;
  /**
   * Reads a date out of a task's name as you type it.
   *
   * Only the date: `#project`, `p1` and `@tag` are explicit syntax the user
   * typed on purpose, and they keep working whatever this is set to.
   */
  naturalDates: boolean;
  hour12: boolean;
  dailyCapacity: DailyCapacity;
  weeklyCapacityOverride: number | null;
  showQuickGroup: boolean;
  conflicts: ConflictSettings;
  sidebarCollapsed: boolean;
  /** How much room a list gives each task. */
  density: Density;
  /** The colour scheme; "system" follows the device. */
  theme: Theme;
  /** Filters, grouping, sorting and mode are remembered per view. */
  views: Record<string, ViewPrefs>;
  upcomingHorizonDays: number;
}

export const defaultPreferences = (locale: Locale): Preferences => ({
  locale,
  homepage: 'week',
  naturalDates: true,
  hour12: false,
  dailyCapacity: defaultCapacity(),
  weeklyCapacityOverride: null,
  showQuickGroup: true,
  conflicts: defaultConflictSettings(),
  sidebarCollapsed: false,
  density: 'comfortable',
  theme: 'system',
  views: {},
  upcomingHorizonDays: 15,
});

/** Reads the preferences for one view, falling back to the defaults. */
export const viewPrefs = (prefs: Preferences, viewKey: string): ViewPrefs =>
  prefs.views[viewKey] ?? defaultViewPrefs();

/**
 * Merges stored preferences over the defaults so a version that adds a new
 * setting does not lose the user's existing choices or crash on a missing key.
 */
export function hydratePreferences(stored: unknown, locale: Locale): Preferences {
  const base = defaultPreferences(locale);
  if (!stored || typeof stored !== 'object') return base;
  const s = stored as Partial<Preferences>;
  return {
    ...base,
    ...s,
    dailyCapacity: Array.isArray(s.dailyCapacity) && s.dailyCapacity.length === 7
      ? (s.dailyCapacity as DailyCapacity)
      : base.dailyCapacity,
    conflicts: { ...base.conflicts, ...(s.conflicts ?? {}) },
    // A homepage stored by an older build may name a view that no longer exists.
    homepage: isHomeView(s.homepage) ? s.homepage : base.homepage,
    density: isDensity(s.density) ? s.density : base.density,
    theme: isTheme(s.theme) ? s.theme : base.theme,
    views: s.views ?? {},
  };
}
