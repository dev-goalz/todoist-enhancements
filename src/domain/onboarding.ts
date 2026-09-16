/**
 * Whether this account has been through the first run.
 *
 * The obvious place for this is the preferences, and the preferences are the
 * wrong place: disconnecting clears IndexedDB and resets them, so signing out
 * and back in would present the walkthrough again to somebody who has already
 * done it and already has the settings it offers to choose. Local storage
 * survives that, which is why the flag lives here rather than beside the
 * settings it is about.
 *
 * It is keyed by Todoist user id rather than being a single boolean, for the
 * other half of the same problem: a browser is not a person. A second account
 * signing in on the same machine has genuinely never seen this, and deserves
 * to be asked; the first one does not have to answer twice.
 *
 * The id is Todoist's own and is never sent anywhere — it is already in the
 * snapshot this app holds on the device.
 */

const KEY = 'onboarded';

/** Enough for every account anyone actually signs into on one machine. */
const LIMIT = 12;

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // Blocked storage, or something else writing to the same key. Either way
    // the honest answer is "no record", and the walkthrough can be skipped.
    return [];
  }
}

export function hasOnboarded(userId: string | null | undefined): boolean {
  if (!userId) return true;   // Nobody to ask yet; ask once the account is known.
  return read().includes(userId);
}

export function markOnboarded(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    const next = [userId, ...read().filter((id) => id !== userId)].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* storage may be blocked; the walkthrough simply asks again */ }
}

/** For the About section's "show me that again". */
export function forgetOnboarding(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(read().filter((id) => id !== userId)));
  } catch { /* ignored, as above */ }
}
