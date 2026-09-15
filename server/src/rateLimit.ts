/**
 * Counts failed sign-ins per key and says when to stop listening.
 *
 * Kept in memory: a restart forgets it, which is fine for slowing down
 * password guessing against a single server.
 */
export class FailureLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly max = 10,
    private readonly windowMs = 15 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  private recent(key: string): number[] {
    const since = this.now() - this.windowMs;
    const kept = (this.failures.get(key) ?? []).filter((at) => at > since);
    if (kept.length > 0) this.failures.set(key, kept);
    else this.failures.delete(key);
    return kept;
  }

  isBlocked(key: string): boolean {
    return this.recent(key).length >= this.max;
  }

  fail(key: string): void {
    this.failures.set(key, [...this.recent(key), this.now()]);
  }

  succeed(key: string): void {
    this.failures.delete(key);
  }
}
