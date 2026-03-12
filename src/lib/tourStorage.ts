/**
 * tourStorage.ts
 *
 * Helpers for persisting the Atlas first-run tour "seen" state in localStorage.
 * Using a versioned key so a future redesign can bump the version and show the
 * tour again without conflicting with older flags.
 */

export const ATLAS_TOUR_SEEN_KEY = 'atlas.tour.seen.v1';

/** Returns true if the user has already completed or skipped the tour. */
export function hasSeenAtlasTour(): boolean {
  try {
    return localStorage.getItem(ATLAS_TOUR_SEEN_KEY) === 'true';
  } catch {
    // localStorage may be unavailable in some environments (e.g. private mode).
    return false;
  }
}

/** Marks the tour as seen so it does not auto-run again. */
export function markAtlasTourSeen(): void {
  try {
    localStorage.setItem(ATLAS_TOUR_SEEN_KEY, 'true');
  } catch {
    // Silently ignore write failures.
  }
}

/** Resets the "seen" flag so the tour will auto-run again on next page load. */
export function resetAtlasTourSeen(): void {
  try {
    localStorage.removeItem(ATLAS_TOUR_SEEN_KEY);
  } catch {
    // Silently ignore.
  }
}
