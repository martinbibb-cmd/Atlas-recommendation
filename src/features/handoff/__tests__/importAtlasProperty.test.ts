/**
 * importAtlasProperty.test.ts
 *
 * Tests for the importAtlasProperty() boundary function.
 *
 * Coverage:
 *   1. Valid AtlasPropertyV1 → returns correct result shape
 *   2. Derives engineInput via atlasPropertyToEngineInput
 *   3. Derives completeness summary
 *   4. Source defaults to 'manual_import'
 *   5. Source can be overridden to 'atlas_scan_handoff' / 'dev_fixture'
 *   6. Non-object input → throws
 *   7. Object missing version → throws
 *   8. Object missing propertyId → throws
 *   9. Object with wrong version → throws
 *  10. Minimal valid property (no derived data) → warns about heat loss / hydraulics
 *  11. Full property with all data → no warnings about missing fields
 *  12. Unknown system family → warns about system type
 *  13. Missing postcode → warns about location
 *  14. Does not mutate the input object
 *  15. null input → throws
 */

import { describe, it, expect } from 'vitest';
import { importAtlasProperty } from '../importer/importAtlasProperty';
import type { AtlasPropertyV1 } from '@atlas/contracts';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function fv<T>(value: T) {
  return { value, source: 'engineer_entered' as const, confidence: 'medium' as const };
}

const BASE_PROPERTY: AtlasPropertyV1 = {
  version: '1.0',
  propertyId: 'prop_handoff_test',
  createdAt: '2024-06-01T10:00:00Z',
  updatedAt: '2024-06-01T10:00:00Z',
  status: 'draft',
  sourceApps: ['atlas_mind'],
  property: {
    postcode: 'SW1A 1AA',
    address1: '10 Downing Street',
    town: 'London',
  },
  capture: {
    sessionId: 'session_handoff_01',
  },
  building: {
    floors: [],
    rooms: [],
    zones: [],
    boundaries: [],
    openings: [],
    emitters: [],
    systemComponents: [],
  },
  household: {
    composition: {
      adultCount:                  fv(2),
      childCount0to4:              fv(0),
      childCount5to10:             fv(0),
      childCount11to17:            fv(0),
      youngAdultCount18to25AtHome: fv(0),
    },
    occupancyPattern: fv('steady_home'),
    hotWaterUsage: {
      bathPresent: fv(true),
    },
  },
  currentSystem: {
    family: fv('combi'),
    dhwType: fv('combi'),
    heatSource: {
      ratedOutputKw: fv(28),
      installYear: fv(2018),
    },
    distribution: {
      dominantPipeDiameterMm: fv(22),
    },
  },
  evidence: {
    photos: [],
    voiceNotes: [],
    textNotes: [],
    qaFlags: [],
    timeline: [],
  },
  derived: {
    heatLoss: {
      peakWatts: { value: 7200, source: 'derived', confidence: 'medium' },
    },
    hydraulics: {
      dynamicPressureBar: { value: 2.8, source: 'measured', confidence: 'high' },
      mainsFlowLpm: { value: 16, source: 'measured', confidence: 'high' },
    },
  },
};

// ─── 1. Valid property → correct result shape ─────────────────────────────────

describe('importAtlasProperty — valid property', () => {
  it('returns an AtlasPropertyImportResult with atlasProperty, engineInput, completeness, warnings, source', () => {
    const result = importAtlasProperty(BASE_PROPERTY);
    expect(result).toHaveProperty('atlasProperty');
    expect(result).toHaveProperty('engineInput');
    expect(result).toHaveProperty('completeness');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('source');
  });

  it('atlasProperty is the same reference passed in', () => {
    const result = importAtlasProperty(BASE_PROPERTY);
    expect(result.atlasProperty).toBe(BASE_PROPERTY);
  });
});

// ─── 2. Derives engineInput ───────────────────────────────────────────────────

describe('importAtlasProperty — engineInput derivation', () => {
  it('derives postcode from property.postcode', () => {
    const result = importAtlasProperty(BASE_PROPERTY);
    expect(result.engineInput.postcode).toBe('SW1A 1AA');
  });

  it('derives heatLossWatts from derived.heatLoss.peakWatts', () => {
    const result = importAtlasProperty(BASE_PROPERTY);
    expect(result.engineInput.heatLossWatts).toBe(7200);
  });

  it('derives dynamicMainsPressure from derived.hydraulics.dynamicPressureBar', () => {
    const result = importAtlasProperty(BASE_PROPERTY);
    expect(result.engineInput.dynamicMainsPressure).toBe(2.8);
  });

  it('derives currentHeatSourceType from currentSystem.family', () => {
    const result = importAtlasProperty(BASE_PROPERTY);
    expect(result.engineInput.currentHeatSourceType).toBe('combi');
  });
});

// ─── 3. Derives completeness ──────────────────────────────────────────────────

describe('importAtlasProperty — completeness', () => {
  it('readyForSimulation is true for a fully-populated property', () => {
    const result = importAtlasProperty(BASE_PROPERTY);
    expect(result.completeness.readyForSimulation).toBe(true);
  });

  it('sections.property is true when postcode is set', () => {
    const result = importAtlasProperty(BASE_PROPERTY);
    expect(result.completeness.sections.property).toBe(true);
  });

  it('sections.currentSystem is true when family is known', () => {
    const result = importAtlasProperty(BASE_PROPERTY);
    expect(result.completeness.sections.currentSystem).toBe(true);
  });
});

// ─── 4. Default source is 'manual_import' ────────────────────────────────────

describe('importAtlasProperty — source', () => {
  it("defaults source to 'manual_import'", () => {
    const result = importAtlasProperty(BASE_PROPERTY);
    expect(result.source).toBe('manual_import');
  });

  it("accepts 'atlas_scan_handoff' source", () => {
    const result = importAtlasProperty(BASE_PROPERTY, 'atlas_scan_handoff');
    expect(result.source).toBe('atlas_scan_handoff');
  });

  it("accepts 'dev_fixture' source", () => {
    const result = importAtlasProperty(BASE_PROPERTY, 'dev_fixture');
    expect(result.source).toBe('dev_fixture');
  });
});

// ─── 5–9. Invalid inputs ─────────────────────────────────────────────────────

describe('importAtlasProperty — invalid inputs throw', () => {
  it('throws on null input', () => {
    expect(() => importAtlasProperty(null)).toThrow();
  });

  it('throws on non-object input (string)', () => {
    expect(() => importAtlasProperty('not-an-object')).toThrow();
  });

  it('throws on empty object', () => {
    expect(() => importAtlasProperty({})).toThrow();
  });

  it('throws when version is wrong', () => {
    expect(() => importAtlasProperty({ ...BASE_PROPERTY, version: '2.0' })).toThrow();
  });

  it('throws when propertyId is missing', () => {
    const { propertyId: _omit, ...rest } = BASE_PROPERTY;
    expect(() => importAtlasProperty(rest)).toThrow();
  });

  it('throws when building is missing', () => {
    const { building: _omit, ...rest } = BASE_PROPERTY;
    expect(() => importAtlasProperty(rest)).toThrow();
  });

  it('throws when sourceApps is not an array', () => {
    expect(() => importAtlasProperty({ ...BASE_PROPERTY, sourceApps: 'atlas_mind' })).toThrow();
  });
});

// ─── 10. Minimal property without derived data → warnings ────────────────────

describe('importAtlasProperty — warnings for missing data', () => {
  const minimalProperty: AtlasPropertyV1 = {
    ...BASE_PROPERTY,
    derived: undefined,
    building: {
      ...BASE_PROPERTY.building,
      rooms: [],
    },
  };

  it('warns about heat loss when neither peakWatts nor rooms are present', () => {
    const result = importAtlasProperty(minimalProperty);
    expect(result.warnings.some(w => w.includes('heat loss') || w.includes('building rooms'))).toBe(true);
  });

  it('warns about hydraulics when neither dynamicPressureBar nor mainsFlowLpm are present', () => {
    const result = importAtlasProperty(minimalProperty);
    expect(result.warnings.some(w => w.includes('hydraulic') || w.includes('mains-pressure'))).toBe(true);
  });
});

// ─── 11. Full property → no missing-field warnings ───────────────────────────

describe('importAtlasProperty — full property produces no missing-field warnings', () => {
  it('produces no warnings for a fully-populated property', () => {
    const result = importAtlasProperty(BASE_PROPERTY);
    // Warnings can still be present for soft concerns, but not for missing key fields
    const missingFieldWarnings = result.warnings.filter(
      w => w.includes('missing') || w.includes('No ')
    );
    expect(missingFieldWarnings).toHaveLength(0);
  });
});

// ─── 12. Unknown system family ────────────────────────────────────────────────

describe('importAtlasProperty — unknown system family warning', () => {
  it("warns when currentSystem.family is 'unknown'", () => {
    const prop = {
      ...BASE_PROPERTY,
      currentSystem: {
        ...BASE_PROPERTY.currentSystem,
        family: fv('unknown' as const),
      },
    } as unknown as AtlasPropertyV1;
    const result = importAtlasProperty(prop);
    expect(result.warnings.some(w => w.includes('system type'))).toBe(true);
  });
});

// ─── 13. Missing postcode → warns ────────────────────────────────────────────

describe('importAtlasProperty — missing postcode warning', () => {
  it('warns when postcode is absent', () => {
    const prop: AtlasPropertyV1 = {
      ...BASE_PROPERTY,
      property: {},
    };
    const result = importAtlasProperty(prop);
    expect(result.warnings.some(w => w.includes('postcode') || w.includes('location'))).toBe(true);
  });
});

// ─── 14. Does not mutate input ────────────────────────────────────────────────

describe('importAtlasProperty — immutability', () => {
  it('does not mutate the input object', () => {
    const input = JSON.parse(JSON.stringify(BASE_PROPERTY)) as AtlasPropertyV1;
    const original = JSON.stringify(input);
    importAtlasProperty(input);
    expect(JSON.stringify(input)).toBe(original);
  });
});
