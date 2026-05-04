/**
 * installationSpecificationSelectors.test.ts
 *
 * Unit tests for installationSpecificationSelectors.
 *
 * Covers:
 *   - getQuotePlanLocationsByKind
 *   - getProposedBoilerLocation
 *   - getExistingBoilerLocation
 *   - getGasMeterLocation
 *   - getCandidateFlueTerminalLocations
 *   - getRoutesByType
 *   - getQuotePlanConfidenceSummary
 *   - hasInstallationSpecificationMinimumLocations
 */

import { describe, it, expect } from 'vitest';
import {
  getQuotePlanLocationsByKind,
  getProposedBoilerLocation,
  getExistingBoilerLocation,
  getGasMeterLocation,
  getCandidateFlueTerminalLocations,
  getRoutesByType,
  getQuotePlanConfidenceSummary,
  hasInstallationSpecificationMinimumLocations,
} from '../installationSpecificationSelectors';
import type { QuoteInstallationPlanV1 } from '../QuoteInstallationPlanV1';
import type {
  QuotePlanLocationV1,
  QuotePlanCandidateRouteV1,
} from '../QuoteInstallationPlanV1';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function emptyPlan(overrides: Partial<QuoteInstallationPlanV1> = {}): QuoteInstallationPlanV1 {
  return {
    planId:    'plan-test',
    createdAt: '2026-05-01T10:00:00Z',
    currentSystem:  { family: 'unknown' },
    proposedSystem: { family: 'unknown' },
    locations:  [],
    routes:     [],
    flueRoutes: [],
    jobClassification: { jobType: 'needs_review', rationale: 'Unknown systems.' },
    generatedScope: [],
    ...overrides,
  };
}

function makeLocation(
  partial: Partial<QuotePlanLocationV1> & { kind: QuotePlanLocationV1['kind'] },
): QuotePlanLocationV1 {
  return {
    locationId:  `loc-${partial.kind}`,
    provenance:  'scan_confirmed',
    confidence:  'high',
    ...partial,
  };
}

function makeRoute(
  partial: Partial<QuotePlanCandidateRouteV1> & { routeType: QuotePlanCandidateRouteV1['routeType'] },
): QuotePlanCandidateRouteV1 {
  return {
    routeId:    `route-${partial.routeType}`,
    confidence: 'estimated',
    ...partial,
  };
}

// ─── getQuotePlanLocationsByKind ──────────────────────────────────────────────

describe('getQuotePlanLocationsByKind', () => {
  it('returns empty array when plan has no locations', () => {
    const plan = emptyPlan();
    expect(getQuotePlanLocationsByKind(plan, 'proposed_boiler')).toEqual([]);
  });

  it('returns only locations matching the requested kind', () => {
    const plan = emptyPlan({
      locations: [
        makeLocation({ kind: 'proposed_boiler' }),
        makeLocation({ kind: 'gas_meter', locationId: 'loc-gas' }),
        makeLocation({ kind: 'proposed_boiler', locationId: 'loc-boiler-2' }),
      ],
    });
    const result = getQuotePlanLocationsByKind(plan, 'proposed_boiler');
    expect(result).toHaveLength(2);
    expect(result.every((l) => l.kind === 'proposed_boiler')).toBe(true);
  });

  it('returns empty array when no location matches the kind', () => {
    const plan = emptyPlan({
      locations: [makeLocation({ kind: 'gas_meter' })],
    });
    expect(getQuotePlanLocationsByKind(plan, 'flue_terminal')).toEqual([]);
  });
});

// ─── getProposedBoilerLocation ────────────────────────────────────────────────

describe('getProposedBoilerLocation', () => {
  it('returns undefined when no proposed_boiler location exists', () => {
    const plan = emptyPlan();
    expect(getProposedBoilerLocation(plan)).toBeUndefined();
  });

  it('returns the first proposed_boiler location', () => {
    const loc = makeLocation({ kind: 'proposed_boiler' });
    const plan = emptyPlan({ locations: [loc] });
    expect(getProposedBoilerLocation(plan)).toBe(loc);
  });
});

// ─── getExistingBoilerLocation ────────────────────────────────────────────────

describe('getExistingBoilerLocation', () => {
  it('returns undefined when no existing_boiler location exists', () => {
    expect(getExistingBoilerLocation(emptyPlan())).toBeUndefined();
  });

  it('returns the first existing_boiler location', () => {
    const loc = makeLocation({ kind: 'existing_boiler' });
    const plan = emptyPlan({ locations: [loc] });
    expect(getExistingBoilerLocation(plan)).toBe(loc);
  });
});

// ─── getGasMeterLocation ──────────────────────────────────────────────────────

describe('getGasMeterLocation', () => {
  it('returns undefined when no gas_meter location exists', () => {
    expect(getGasMeterLocation(emptyPlan())).toBeUndefined();
  });

  it('returns the first gas_meter location', () => {
    const loc = makeLocation({ kind: 'gas_meter' });
    const plan = emptyPlan({ locations: [loc] });
    expect(getGasMeterLocation(plan)).toBe(loc);
  });
});

// ─── getCandidateFlueTerminalLocations ────────────────────────────────────────

describe('getCandidateFlueTerminalLocations', () => {
  it('returns empty array when no flue_terminal locations exist', () => {
    expect(getCandidateFlueTerminalLocations(emptyPlan())).toEqual([]);
  });

  it('returns all flue_terminal locations', () => {
    const loc1 = makeLocation({ kind: 'flue_terminal', locationId: 'ft-1' });
    const loc2 = makeLocation({ kind: 'flue_terminal', locationId: 'ft-2' });
    const plan = emptyPlan({
      locations: [loc1, makeLocation({ kind: 'gas_meter' }), loc2],
    });
    const result = getCandidateFlueTerminalLocations(plan);
    expect(result).toHaveLength(2);
    expect(result.every((l) => l.kind === 'flue_terminal')).toBe(true);
  });
});

// ─── getRoutesByType ──────────────────────────────────────────────────────────

describe('getRoutesByType', () => {
  it('returns empty array when no routes exist', () => {
    expect(getRoutesByType(emptyPlan(), 'gas_supply')).toEqual([]);
  });

  it('returns only routes matching the requested type', () => {
    const gasRoute = makeRoute({ routeType: 'gas_supply' });
    const coldRoute = makeRoute({ routeType: 'cold_water_supply', routeId: 'r-cold' });
    const plan = emptyPlan({ routes: [gasRoute, coldRoute] });
    const result = getRoutesByType(plan, 'gas_supply');
    expect(result).toHaveLength(1);
    expect(result[0].routeType).toBe('gas_supply');
  });
});

// ─── getQuotePlanConfidenceSummary ────────────────────────────────────────────

describe('getQuotePlanConfidenceSummary', () => {
  it('returns no_locations when plan has no locations', () => {
    const summary = getQuotePlanConfidenceSummary(emptyPlan());
    expect(summary.overallConfidence).toBe('no_locations');
    expect(summary.totalLocations).toBe(0);
  });

  it('returns high when all locations are high confidence', () => {
    const plan = emptyPlan({
      locations: [
        makeLocation({ kind: 'proposed_boiler', confidence: 'high' }),
        makeLocation({ kind: 'gas_meter', confidence: 'high', locationId: 'loc-gas' }),
      ],
    });
    const summary = getQuotePlanConfidenceSummary(plan);
    expect(summary.overallConfidence).toBe('high');
    expect(summary.totalLocations).toBe(2);
  });

  it('returns medium when at least one location is medium', () => {
    const plan = emptyPlan({
      locations: [
        makeLocation({ kind: 'proposed_boiler', confidence: 'high' }),
        makeLocation({ kind: 'gas_meter', confidence: 'medium', locationId: 'loc-gas' }),
      ],
    });
    expect(getQuotePlanConfidenceSummary(plan).overallConfidence).toBe('medium');
  });

  it('returns low when at least one location is low', () => {
    const plan = emptyPlan({
      locations: [
        makeLocation({ kind: 'proposed_boiler', confidence: 'high' }),
        makeLocation({ kind: 'gas_meter', confidence: 'low', locationId: 'loc-gas' }),
      ],
    });
    expect(getQuotePlanConfidenceSummary(plan).overallConfidence).toBe('low');
  });

  it('returns needs_verification when any location has needs_verification confidence', () => {
    const plan = emptyPlan({
      locations: [
        makeLocation({ kind: 'proposed_boiler', confidence: 'high' }),
        makeLocation({
          kind: 'gas_meter',
          confidence: 'needs_verification',
          locationId: 'loc-gas',
        }),
      ],
    });
    expect(getQuotePlanConfidenceSummary(plan).overallConfidence).toBe('needs_verification');
  });

  it('counts inferred and confirmed provenances correctly', () => {
    const plan = emptyPlan({
      locations: [
        makeLocation({ kind: 'proposed_boiler', provenance: 'scan_inferred', confidence: 'needs_verification' }),
        makeLocation({ kind: 'gas_meter', provenance: 'scan_confirmed', confidence: 'high', locationId: 'loc-gas' }),
        makeLocation({ kind: 'existing_boiler', provenance: 'scan_inferred', confidence: 'medium', locationId: 'loc-ex' }),
      ],
    });
    const summary = getQuotePlanConfidenceSummary(plan);
    expect(summary.inferredCount).toBe(2);
    expect(summary.confirmedCount).toBe(1);
    expect(summary.needsReviewCount).toBe(1);
    expect(summary.totalLocations).toBe(3);
  });
});

// ─── hasInstallationSpecificationMinimumLocations ──────────────────────────────────────────

describe('hasInstallationSpecificationMinimumLocations', () => {
  it('returns false when plan has no locations', () => {
    expect(hasInstallationSpecificationMinimumLocations(emptyPlan())).toBe(false);
  });

  it('returns false when only a boiler location exists (no gas meter)', () => {
    const plan = emptyPlan({
      locations: [makeLocation({ kind: 'proposed_boiler' })],
    });
    expect(hasInstallationSpecificationMinimumLocations(plan)).toBe(false);
  });

  it('returns false when only a gas_meter exists (no boiler)', () => {
    const plan = emptyPlan({
      locations: [makeLocation({ kind: 'gas_meter' })],
    });
    expect(hasInstallationSpecificationMinimumLocations(plan)).toBe(false);
  });

  it('returns true when proposed_boiler and gas_meter are both present', () => {
    const plan = emptyPlan({
      locations: [
        makeLocation({ kind: 'proposed_boiler' }),
        makeLocation({ kind: 'gas_meter', locationId: 'loc-gas' }),
      ],
    });
    expect(hasInstallationSpecificationMinimumLocations(plan)).toBe(true);
  });

  it('returns true when existing_boiler and gas_meter are both present', () => {
    const plan = emptyPlan({
      locations: [
        makeLocation({ kind: 'existing_boiler' }),
        makeLocation({ kind: 'gas_meter', locationId: 'loc-gas' }),
      ],
    });
    expect(hasInstallationSpecificationMinimumLocations(plan)).toBe(true);
  });

  it('returns true even when boiler location has needs_verification confidence', () => {
    const plan = emptyPlan({
      locations: [
        makeLocation({
          kind:       'proposed_boiler',
          confidence: 'needs_verification',
          provenance: 'scan_inferred',
        }),
        makeLocation({ kind: 'gas_meter', locationId: 'loc-gas' }),
      ],
    });
    expect(hasInstallationSpecificationMinimumLocations(plan)).toBe(true);
  });
});
