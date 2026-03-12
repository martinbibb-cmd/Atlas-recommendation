/**
 * tourStorage.test.ts
 *
 * Unit tests for the Atlas first-run tour localStorage helpers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ATLAS_TOUR_SEEN_KEY,
  hasSeenAtlasTour,
  markAtlasTourSeen,
  resetAtlasTourSeen,
} from '../tourStorage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearTourKey() {
  localStorage.removeItem(ATLAS_TOUR_SEEN_KEY);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('tourStorage', () => {
  beforeEach(() => {
    clearTourKey();
  });

  it('exports the stable storage key', () => {
    expect(ATLAS_TOUR_SEEN_KEY).toBe('atlas.tour.seen.v1');
  });

  describe('hasSeenAtlasTour', () => {
    it('returns false when the key is absent', () => {
      expect(hasSeenAtlasTour()).toBe(false);
    });

    it('returns false when the key holds an unexpected value', () => {
      localStorage.setItem(ATLAS_TOUR_SEEN_KEY, 'yes');
      expect(hasSeenAtlasTour()).toBe(false);
    });

    it('returns true when the key is "true"', () => {
      localStorage.setItem(ATLAS_TOUR_SEEN_KEY, 'true');
      expect(hasSeenAtlasTour()).toBe(true);
    });
  });

  describe('markAtlasTourSeen', () => {
    it('writes "true" to localStorage', () => {
      markAtlasTourSeen();
      expect(localStorage.getItem(ATLAS_TOUR_SEEN_KEY)).toBe('true');
    });

    it('causes hasSeenAtlasTour to return true', () => {
      markAtlasTourSeen();
      expect(hasSeenAtlasTour()).toBe(true);
    });
  });

  describe('resetAtlasTourSeen', () => {
    it('removes the key from localStorage', () => {
      markAtlasTourSeen();
      resetAtlasTourSeen();
      expect(localStorage.getItem(ATLAS_TOUR_SEEN_KEY)).toBeNull();
    });

    it('causes hasSeenAtlasTour to return false after reset', () => {
      markAtlasTourSeen();
      resetAtlasTourSeen();
      expect(hasSeenAtlasTour()).toBe(false);
    });
  });
});
