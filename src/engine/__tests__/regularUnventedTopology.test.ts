/**
 * regularUnventedTopology.test.ts
 *
 * Regression tests for the regular-boiler + unvented-cylinder topology bug.
 *
 * Root cause addressed:
 *   Atlas was incorrectly mapping `currentHeatSourceType === 'regular'` to the
 *   `open_vented` topology regardless of `dhwStorageType`.  A regular (heat-only)
 *   boiler can serve either a vented (tank-fed) or an unvented (mains-pressure)
 *   cylinder — the cylinder topology must not be inferred from the boiler type alone.
 *
 * Survey scenario:
 *   Regular boiler + unvented cylinder, flat (no loft), 2 bathrooms, 3 occupants.
 *   Measured full-bore flow: 8 L/min at 0 bar back-pressure.
 *   Retained flow at 2 bar: 3 L/min.
 *
 * Expected:
 *   - Verdict label says "Regular boiler with unvented cylinder" (not "System boiler",
 *     not "tank-fed hot water", not "gravity-fed").
 *   - Combi is NOT the recommended family (low retained mains flow, 2 bathrooms).
 *   - Mixergy is NOT recommended from bathrooms alone — at least 2 qualifying
 *     signals required.
 *   - "What this avoids" does not echo the selected topology back.
 */

import { describe, it, expect } from 'vitest';
import { runEngine } from '../Engine';
import { buildRecommendationVerdict, buildCustomerPresentation } from '../recommendation/buildRecommendationVerdict';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Canonical test input ────────────────────────────────────────────────────

/**
 * Real-world surveyed scenario:
 *   Regular boiler + unvented cylinder in a flat (no loft space).
 *   Full-bore flow 8 L/min at 0 bar; retained 3 L/min at ~2 bar.
 *   Two bathrooms, 3 occupants.
 */
const REGULAR_UNVENTED_FLAT_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  // ── Heat source ───────────────────────────────────────────────────────────
  currentHeatSourceType: 'regular',
  // ── Hot water topology — unvented (mains-pressure) cylinder ──────────────
  dhwStorageType: 'unvented',
  coldWaterSource: 'mains_true',
  // ── Mains measurements (full-bore cup test + retained at 2 bar) ──────────
  // Full-bore test: 8 L/min at near-zero back-pressure.
  // The retained flow of 3 L/min at ~2 bar comes from a second reading;
  // we model it here as the dynamic measurement for the engine.
  mainsDynamicFlowLpm: 8,
  dynamicMainsPressure: 0,   // full-bore open-tap test (0 bar back-pressure)
  mainsPressureRecorded: true,
  mainsDynamicFlowLpmKnown: true,
  // ── Property ─────────────────────────────────────────────────────────────
  bathroomCount: 2,
  occupancySignature: 'professional',
  highOccupancy: false,
  loftTankSpace: 'none',    // flat — no loft for header tanks
  availableSpace: 'ok',
  // ── Heating ──────────────────────────────────────────────────────────────
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 5000,
  radiatorCount: 8,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  // ── Preferences ──────────────────────────────────────────────────────────
  preferCombi: false,
};

// ─── Topology inference tests ─────────────────────────────────────────────────

describe('Regression — regular boiler with unvented cylinder topology', () => {
  it('does NOT recommend combi as the primary family (low retained flow, 2 bathrooms)', () => {
    const result = runEngine(REGULAR_UNVENTED_FLAT_INPUT);
    const verdict = buildRecommendationVerdict(result, REGULAR_UNVENTED_FLAT_INPUT);

    expect(verdict.recommendedFamily).not.toBe('combi');
  });

  it('recommended label contains "Regular boiler" (not "System boiler")', () => {
    const result = runEngine(REGULAR_UNVENTED_FLAT_INPUT);
    const verdict = buildRecommendationVerdict(result, REGULAR_UNVENTED_FLAT_INPUT);

    expect(verdict.recommendedLabel?.toLowerCase()).toContain('regular boiler');
    expect(verdict.recommendedLabel?.toLowerCase()).not.toContain('system boiler');
  });

  it('recommended label contains "unvented" (not "tank-fed")', () => {
    const result = runEngine(REGULAR_UNVENTED_FLAT_INPUT);
    const verdict = buildRecommendationVerdict(result, REGULAR_UNVENTED_FLAT_INPUT);

    expect(verdict.recommendedLabel?.toLowerCase()).toContain('unvented');
    expect(verdict.recommendedLabel?.toLowerCase()).not.toContain('tank-fed');
  });

  it('verdict headline does not mention open-vented, gravity-fed, or header-tank phrasing', () => {
    const result = runEngine(REGULAR_UNVENTED_FLAT_INPUT);
    const verdict = buildRecommendationVerdict(result, REGULAR_UNVENTED_FLAT_INPUT);
    const presentation = buildCustomerPresentation(verdict);

    const headline = (presentation.verdictHeadline ?? '').toLowerCase();
    expect(headline).not.toContain('tank-fed');
    expect(headline).not.toContain('gravity');
    expect(headline).not.toContain('header tank');
    expect(headline).not.toContain('open-vented');
    expect(headline).not.toContain('open vented');
  });

  it('"What this avoids" does not describe the selected topology as something that was avoided', () => {
    const result = runEngine(REGULAR_UNVENTED_FLAT_INPUT);
    const verdict = buildRecommendationVerdict(result, REGULAR_UNVENTED_FLAT_INPUT);

    // The verdict label is "Regular boiler with unvented cylinder".
    // The avoids section must not contain this same label (which would mean
    // Atlas is recommending X while simultaneously claiming to have avoided X).
    const avoidLabels = verdict.whatThisAvoids.map(s => s.toLowerCase());
    const recLabel = (verdict.recommendedLabel ?? '').toLowerCase();

    if (recLabel) {
      const echoesSelected = avoidLabels.some(a => a.startsWith(recLabel));
      expect(echoesSelected).toBe(false);
    }
  });
});

// ─── Mixergy suppression tests ────────────────────────────────────────────────

describe('Regression — Mixergy suppression for simple two-bathroom case', () => {
  it('does NOT recommend Mixergy from bathroomCount === 2 alone (no extra qualifying signals)', () => {
    const result = runEngine(REGULAR_UNVENTED_FLAT_INPUT);

    // Mixergy must not be the recommended cylinder type when the only signal
    // is bathroomCount === 2 and there are no other qualifying signals.
    expect(result.storedDhwV1?.recommended.type).not.toBe('mixergy');
  });

  it('DOES recommend Mixergy when space is tight AND solar PV is planned (two signals)', () => {
    const input: EngineInputV2_3 = {
      ...REGULAR_UNVENTED_FLAT_INPUT,
      availableSpace: 'tight',   // signal 1: confirmed space constraint
      pvStatus: 'planned',       // signal 2: solar PV committed
    };
    const result = runEngine(input);

    expect(result.storedDhwV1?.recommended.type).toBe('mixergy');
  });

  it('does NOT recommend Mixergy with only one qualifying signal (space tight, no PV)', () => {
    const input: EngineInputV2_3 = {
      ...REGULAR_UNVENTED_FLAT_INPUT,
      availableSpace: 'tight',   // single signal — not enough
      pvStatus: 'none',
    };
    const result = runEngine(input);

    expect(result.storedDhwV1?.recommended.type).not.toBe('mixergy');
  });

  it('DOES recommend Mixergy when space is tight AND high occupancy (two signals)', () => {
    const input: EngineInputV2_3 = {
      ...REGULAR_UNVENTED_FLAT_INPUT,
      availableSpace: 'tight',   // signal 1
      highOccupancy: true,       // signal 2
    };
    const result = runEngine(input);

    expect(result.storedDhwV1?.recommended.type).toBe('mixergy');
  });
});

// ─── Topology inference — regular + vented remains open_vented ───────────────

describe('Regression — regular + vented cylinder still uses open_vented physics', () => {
  it('regular boiler with vented cylinder uses the tank-fed / open_vented physics path', () => {
    const input: EngineInputV2_3 = {
      ...REGULAR_UNVENTED_FLAT_INPUT,
      dhwStorageType: 'vented',
      loftTankSpace: 'ok',   // has loft space for header tanks
      coldWaterSource: 'loft_tank',
    };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);

    // Regular + vented should NOT say "Regular boiler with unvented cylinder"
    expect(verdict.recommendedLabel?.toLowerCase()).not.toContain('unvented cylinder');
  });
});
