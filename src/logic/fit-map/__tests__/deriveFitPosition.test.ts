/**
 * deriveFitPosition.test.ts
 *
 * Tests for the deriveFitPosition adapter that maps EngineInputV2_3 to FitInputs
 * for the fit-map visualiser.
 *
 * Key fix (PR1b): occupancyCount is now used instead of occupancySignature to
 * classify demand for the fit map.  occupancySignature defaults to 'professional'
 * and is never updated from survey data, so relying on it systematically
 * undercounts demand and gives combis an unfair advantage.
 *
 * Scenarios:
 *  1. Household with occupancyCount >= 3 is classified as 'steady' regardless
 *     of occupancySignature
 *  2. Household with occupancyCount < 3 falls through to occupancySignature
 *     (shift detection still works)
 *  3. Household with occupancyCount = 0 / absent is classified as 'professional'
 *  4. Occupancy 3 with occupancySignature 'professional' (old default stuck value)
 *     still resolves to 'steady' — demonstrating the legacy-signature bug is fixed
 *  5. peakConcurrentOutlets falls back to bathroomCount when absent
 */

import { describe, it, expect } from 'vitest';
import { deriveFitPosition, FIT_MAP_STEADY_OCCUPANCY_MIN } from '../deriveFitPosition';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 1.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
};

// ─── FIT_MAP_STEADY_OCCUPANCY_MIN constant ────────────────────────────────────

describe('FIT_MAP_STEADY_OCCUPANCY_MIN', () => {
  it('is 3', () => {
    expect(FIT_MAP_STEADY_OCCUPANCY_MIN).toBe(3);
  });
});

// ─── Occupancy classification (PR1b fix) ─────────────────────────────────────

describe('deriveFitPosition — occupancy classification', () => {
  it('classifies occupancyCount >= 3 as "steady" even when occupancySignature is "professional"', () => {
    // This is the key regression guard: occupancySignature is often stuck at
    // 'professional' because the legacy field is never updated from survey data.
    // deriveFitPosition must use occupancyCount to avoid systematically under-
    // counting demand.
    const result = deriveFitPosition({
      ...BASE,
      occupancyCount: 3,
      occupancySignature: 'professional', // legacy stuck value
    });
    // With steady occupancy, x-axis gets +0.3 → x > 0 signals demand
    expect(result.x).toBeGreaterThan(0);
  });

  it('classifies occupancyCount 4 as "steady" (x contribution expected)', () => {
    const result = deriveFitPosition({
      ...BASE,
      occupancyCount: 4,
      occupancySignature: 'professional',
    });
    expect(result.x).toBeGreaterThan(0);
  });

  it('classifies occupancyCount 2 as "professional" when occupancySignature is "professional"', () => {
    const result = deriveFitPosition({
      ...BASE,
      occupancyCount: 2,
      occupancySignature: 'professional',
    });
    // No steady occupancy weight on x axis from occupancy alone
    // (no other demand factors set, so x=0)
    expect(result.x).toBe(0);
  });

  it('classifies occupancyCount 1 as "professional"', () => {
    const result = deriveFitPosition({
      ...BASE,
      occupancyCount: 1,
      occupancySignature: 'professional',
    });
    expect(result.x).toBe(0);
  });

  it('detects "shift" occupancy when occupancyCount < 3 and occupancySignature is "shift"', () => {
    // shift pattern still respected when occupancy is below steady threshold
    const result = deriveFitPosition({
      ...BASE,
      occupancyCount: 2,
      occupancySignature: 'shift',
    });
    // shift does not contribute to x or y in the current weights, so this just
    // verifies no crash and the result is defined
    expect(result).toBeDefined();
    expect(result.nearestSystem).toBeDefined();
  });

  it('treats absent occupancyCount (undefined) as 0 — not steady', () => {
    const result = deriveFitPosition({ ...BASE, occupancyCount: undefined });
    // No steady occupancy weight
    expect(result.x).toBe(0);
  });
});

// ─── Pipe fallback ────────────────────────────────────────────────────────────

describe('deriveFitPosition — pipe diameter normalisation', () => {
  it('uses 22 mm as default for an unrecognised pipe diameter', () => {
    // A pipe of 18mm is not in {15, 22, 28, 35} — should default to 22
    const result = deriveFitPosition({
      ...BASE,
      primaryPipeDiameter: 18,
    });
    // 22mm pipe does not add large-pipe y weight (< 28), so y = 0 without other factors
    expect(result.y).toBe(0);
  });

  it('uses 28mm pipe weight when primaryPipeDiameter is 28', () => {
    const result = deriveFitPosition({
      ...BASE,
      primaryPipeDiameter: 28,
    });
    // 28mm pipe adds +0.4 to y axis
    expect(result.y).toBe(0.4);
  });
});

// ─── peakConcurrentOutlets fallback ──────────────────────────────────────────

describe('deriveFitPosition — peakConcurrentOutlets fallback', () => {
  it('falls back to bathroomCount when peakConcurrentOutlets is absent', () => {
    // 2 bathrooms → 2 outlets → concurrent demand contributes to x
    const result = deriveFitPosition({
      ...BASE,
      bathroomCount: 2,
      peakConcurrentOutlets: undefined,
    });
    // peakConcurrentOutlets >= 2 adds +0.4 to x axis
    expect(result.x).toBeGreaterThanOrEqual(0.4);
  });

  it('uses explicit peakConcurrentOutlets when provided', () => {
    const withOutlets = deriveFitPosition({
      ...BASE,
      bathroomCount: 1,
      peakConcurrentOutlets: 3,
    });
    const withoutOutlets = deriveFitPosition({
      ...BASE,
      bathroomCount: 1,
      peakConcurrentOutlets: undefined,
    });
    // Explicit 3 outlets vs fallback 1 from bathroomCount → more demand
    expect(withOutlets.x).toBeGreaterThan(withoutOutlets.x);
  });
});
