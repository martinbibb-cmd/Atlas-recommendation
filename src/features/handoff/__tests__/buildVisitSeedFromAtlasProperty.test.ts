/**
 * buildVisitSeedFromAtlasProperty.test.ts
 *
 * Tests for buildVisitSeedFromAtlasProperty().
 *
 * Coverage:
 *   1. Full address fields → formatted address string
 *   2. Only postcode → address is just postcode
 *   3. No address and no postcode → address is undefined
 *   4. UPRN present → used as reference
 *   5. reference field present (no uprn) → used as reference
 *   6. Neither uprn nor reference → propertyId used as reference
 *   7. readyForSimulation completeness → statusHint is 'ready_for_simulation'
 *   8. Property status 'survey_in_progress' → statusHint is 'survey_in_progress'
 *   9. Property status 'report_ready' → statusHint is 'ready_for_simulation'
 *  10. Incomplete property + non-ready completeness → statusHint is 'draft'
 *  11. displayTitle matches formatted address
 *  12. displayTitle falls back to postcode when no address lines
 *  13. displayTitle is undefined when no address data at all
 */

import { describe, it, expect } from 'vitest';
import { buildVisitSeedFromAtlasProperty } from '../importer/buildVisitSeedFromAtlasProperty';
import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { AtlasPropertyCompletenessSummary } from '../../atlasProperty/types/atlasPropertyAdapter.types';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function fv<T>(value: T) {
  return { value, source: 'engineer_entered' as const, confidence: 'medium' as const };
}

function makeCompleteness(overrides?: Partial<AtlasPropertyCompletenessSummary>): AtlasPropertyCompletenessSummary {
  return {
    readyForSimulation: true,
    sections: {
      property: true,
      household: true,
      currentSystem: true,
      building: false,
      heatLoss: true,
      hydraulics: true,
    },
    missingFields: [],
    highConfidenceFields: [],
    ...overrides,
  };
}

const BASE_PROPERTY: AtlasPropertyV1 = {
  version: '1.0',
  propertyId: 'prop_visit_seed_test',
  createdAt: '2024-06-01T10:00:00Z',
  updatedAt: '2024-06-01T10:00:00Z',
  status: 'draft',
  sourceApps: ['atlas_mind'],
  property: {
    address1: '10 Downing Street',
    town: 'London',
    postcode: 'SW1A 2AA',
  },
  capture: { sessionId: 'session_01' },
  building: {
    floors: [], rooms: [], zones: [], boundaries: [],
    openings: [], emitters: [], systemComponents: [],
  },
  household: {
    composition: {
      adultCount: fv(2),
      childCount0to4: fv(0),
      childCount5to10: fv(0),
      childCount11to17: fv(0),
      youngAdultCount18to25AtHome: fv(0),
    },
    hotWaterUsage: { bathPresent: fv(true) },
  },
  currentSystem: { family: fv('combi'), dhwType: fv('combi') },
  evidence: { photos: [], voiceNotes: [], textNotes: [], qaFlags: [], timeline: [] },
};

// ─── 1. Full address → formatted string ──────────────────────────────────────

describe('buildVisitSeedFromAtlasProperty — address formatting', () => {
  it('combines address1, town, and postcode into a comma-separated string', () => {
    const seed = buildVisitSeedFromAtlasProperty(BASE_PROPERTY, makeCompleteness());
    expect(seed.address).toBe('10 Downing Street, London, SW1A 2AA');
  });

  it('includes address2 when present', () => {
    const prop: AtlasPropertyV1 = {
      ...BASE_PROPERTY,
      property: {
        address1: '10 Downing Street',
        address2: 'Flat 1',
        town: 'London',
        postcode: 'SW1A 2AA',
      },
    };
    const seed = buildVisitSeedFromAtlasProperty(prop, makeCompleteness());
    expect(seed.address).toBe('10 Downing Street, Flat 1, London, SW1A 2AA');
  });
});

// ─── 2. Only postcode ─────────────────────────────────────────────────────────

describe('buildVisitSeedFromAtlasProperty — postcode-only address', () => {
  it('returns just the postcode when no address lines or town are set', () => {
    const prop: AtlasPropertyV1 = {
      ...BASE_PROPERTY,
      property: { postcode: 'SW1A 1AA' },
    };
    const seed = buildVisitSeedFromAtlasProperty(prop, makeCompleteness());
    expect(seed.address).toBe('SW1A 1AA');
  });
});

// ─── 3. No address data ───────────────────────────────────────────────────────

describe('buildVisitSeedFromAtlasProperty — empty property identity', () => {
  it('returns undefined address when property identity is empty', () => {
    const prop: AtlasPropertyV1 = {
      ...BASE_PROPERTY,
      property: {},
    };
    const seed = buildVisitSeedFromAtlasProperty(prop, makeCompleteness());
    expect(seed.address).toBeUndefined();
  });
});

// ─── 4. UPRN present → reference ─────────────────────────────────────────────

describe('buildVisitSeedFromAtlasProperty — reference derivation', () => {
  it('uses uprn as reference when present', () => {
    const prop: AtlasPropertyV1 = {
      ...BASE_PROPERTY,
      property: { ...BASE_PROPERTY.property, uprn: '100023336956' },
    };
    const seed = buildVisitSeedFromAtlasProperty(prop, makeCompleteness());
    expect(seed.reference).toBe('100023336956');
  });

  it('uses property.reference when uprn is absent', () => {
    const prop: AtlasPropertyV1 = {
      ...BASE_PROPERTY,
      property: { ...BASE_PROPERTY.property, reference: 'JOB-2024-001' },
    };
    const seed = buildVisitSeedFromAtlasProperty(prop, makeCompleteness());
    expect(seed.reference).toBe('JOB-2024-001');
  });

  it('falls back to propertyId when neither uprn nor reference are set', () => {
    const prop: AtlasPropertyV1 = {
      ...BASE_PROPERTY,
      property: { postcode: 'SW1A 1AA' },
    };
    const seed = buildVisitSeedFromAtlasProperty(prop, makeCompleteness());
    expect(seed.reference).toBe('prop_visit_seed_test');
  });
});

// ─── 5–9. Status hints ────────────────────────────────────────────────────────

describe('buildVisitSeedFromAtlasProperty — statusHint', () => {
  it("is 'ready_for_simulation' when completeness.readyForSimulation is true", () => {
    const seed = buildVisitSeedFromAtlasProperty(BASE_PROPERTY, makeCompleteness({ readyForSimulation: true }));
    expect(seed.statusHint).toBe('ready_for_simulation');
  });

  it("is 'survey_in_progress' when property status is survey_in_progress regardless of completeness", () => {
    const prop: AtlasPropertyV1 = { ...BASE_PROPERTY, status: 'survey_in_progress' };
    const completeness = makeCompleteness({ readyForSimulation: false });
    const seed = buildVisitSeedFromAtlasProperty(prop, completeness);
    expect(seed.statusHint).toBe('survey_in_progress');
  });

  it("is 'ready_for_simulation' when property status is 'report_ready'", () => {
    const prop: AtlasPropertyV1 = { ...BASE_PROPERTY, status: 'report_ready' };
    const seed = buildVisitSeedFromAtlasProperty(prop, makeCompleteness());
    expect(seed.statusHint).toBe('ready_for_simulation');
  });

  it("is 'ready_for_simulation' when property status is 'simulation_ready'", () => {
    const prop: AtlasPropertyV1 = { ...BASE_PROPERTY, status: 'simulation_ready' };
    const seed = buildVisitSeedFromAtlasProperty(prop, makeCompleteness());
    expect(seed.statusHint).toBe('ready_for_simulation');
  });

  it("is 'draft' when property is draft and completeness is not ready", () => {
    const completeness = makeCompleteness({ readyForSimulation: false });
    const seed = buildVisitSeedFromAtlasProperty(BASE_PROPERTY, completeness);
    expect(seed.statusHint).toBe('draft');
  });
});

// ─── 11–13. displayTitle ─────────────────────────────────────────────────────

describe('buildVisitSeedFromAtlasProperty — displayTitle', () => {
  it('matches the formatted address when address fields are present', () => {
    const seed = buildVisitSeedFromAtlasProperty(BASE_PROPERTY, makeCompleteness());
    expect(seed.displayTitle).toBe(seed.address);
  });

  it('falls back to postcode when no address lines', () => {
    const prop: AtlasPropertyV1 = {
      ...BASE_PROPERTY,
      property: { postcode: 'SW1A 1AA' },
    };
    const seed = buildVisitSeedFromAtlasProperty(prop, makeCompleteness());
    expect(seed.displayTitle).toBe('SW1A 1AA');
  });

  it('is undefined when no address data at all', () => {
    const prop: AtlasPropertyV1 = {
      ...BASE_PROPERTY,
      property: {},
    };
    const seed = buildVisitSeedFromAtlasProperty(prop, makeCompleteness());
    expect(seed.displayTitle).toBeUndefined();
  });
});
