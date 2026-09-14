import type { Locale } from '@/i18n';
import { defaultViewPrefs, type ViewPrefs } from '@/domain/types';
import { defaultConflictSettings, type ConflictSettings } from '@/domain/conflicts';
import { defaultCapacity, type DailyCapacity } from '@/domain/load';

/** Everything the user can tune. Stored on the device, never on a server. */
export interface Preferences {
  locale: Locale;
  hour12: boolean;
  dailyCapacity: DailyCapacity;
  weeklyCapacityOverride: number | null;
  showQuickGroup: boolean;
  conflicts: ConflictSettings;
  sidebarCollapsed: boolean;
  /** Filters, grouping, sorting and mode are remembered per view. */
  views: Record<string, ViewPrefs>;
  upcomingHorizonDays: number;
}

export const defaultPreferences = (locale: Locale): Preferences => ({
  locale,
  hour12: false,
  dailyCapacity: defaultCapacity(),
  weeklyCapacityOverride: null,
  showQuickGroup: true,
  conflicts: defaultConflictSettings(),
  sidebarCollapsed: false,
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
    views: s.views ?? {},
  };
}
