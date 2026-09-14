/**
 * Todoist karma.
 *
 * Karma accumulates as tasks are completed and unlocks a series of named
 * ranks. The thresholds below are Todoist's own, and the last rank has no
 * ceiling, so progress there is reported as complete.
 */

export interface KarmaRank {
  key: string;
  /** Karma needed to reach this rank. */
  from: number;
  /** Karma needed to reach the next one, or null at the top. */
  to: number | null;
}

export const KARMA_RANKS: KarmaRank[] = [
  { key: 'beginner', from: 0, to: 500 },
  { key: 'novice', from: 500, to: 2500 },
  { key: 'intermediate', from: 2500, to: 5000 },
  { key: 'professional', from: 5000, to: 7500 },
  { key: 'expert', from: 7500, to: 10000 },
  { key: 'master', from: 10000, to: 20000 },
  { key: 'grandmaster', from: 20000, to: 50000 },
  { key: 'enlightened', from: 50000, to: null },
];

export interface KarmaStanding {
  rank: KarmaRank;
  next: KarmaRank | null;
  karma: number;
  /** How far through the current rank, 0 to 100. */
  progress: number;
  /** Karma still needed to reach the next rank, or null at the top. */
  remaining: number | null;
}

export function karmaStanding(karma: number | null | undefined): KarmaStanding | null {
  if (karma === null || karma === undefined || Number.isNaN(karma)) return null;

  const index = KARMA_RANKS.findIndex(
    (rank) => karma >= rank.from && (rank.to === null || karma < rank.to),
  );
  const rank = KARMA_RANKS[index === -1 ? KARMA_RANKS.length - 1 : index];
  const next = rank.to === null ? null : (KARMA_RANKS[KARMA_RANKS.indexOf(rank) + 1] ?? null);

  if (rank.to === null) {
    return { rank, next: null, karma, progress: 100, remaining: null };
  }

  const span = rank.to - rank.from;
  const progress = Math.max(0, Math.min(100, Math.round(((karma - rank.from) / span) * 100)));
  return { rank, next, karma, progress, remaining: Math.max(0, rank.to - karma) };
}

/** The part of a full name shown in the sidebar. */
export const firstName = (fullName: string | null | undefined): string =>
  (fullName ?? '').trim().split(/\s+/)[0] || '—';
