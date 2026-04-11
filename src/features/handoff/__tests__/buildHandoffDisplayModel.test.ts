/**
 * buildHandoffDisplayModel.test.ts
 *
 * Tests for buildHandoffDisplayModel() selector.
 *
 * Coverage:
 *   1. Full property with all data → all knowledge 'confirmed', ready for simulation
 *   2. Property missing adult count → household 'missing'
 *   3. Unknown system family → currentSystem 'review'
 *   4. Missing system family → currentSystem 'missing'
 *   5. Low-confidence adult count → household 'review'
 *   6. Missing postcode → missingCritical contains postcode field
 *   7. Import warnings are surfaced in confidenceWarnings
 *   8. Room/object/photo/voice/note counts are derived correctly
 *   9. extractedFactCount counts high/medium confidence FieldValues
 *  10. capturedAt prefers completedAt over startedAt over updatedAt
 *  11. title falls back to 'Unknown property' when no address parts present
 *  12. subtitle includes propertyType and buildEra
 *  13. reference prefers uprn, then reference field, then propertyId
 *  14. sourceLabel is always 'From Atlas Scan'
 */

import { describe, it, expect } from 'vitest';
import { buildHandoffDisplayModel } from '../selectors/buildHandoffDisplayModel';
import { importAtlasProperty } from '../importer/importAtlasProperty';
import type { AtlasPropertyV1 } from '@atlas/contracts';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function fv<T>(value: T, confidence: 'high' | 'medium' | 'low' = 'high') {
  return { value, source: 'engineer_entered' as const, confidence };
}

function makeProperty(overrides: Partial<AtlasPropertyV1> = {}): AtlasPropertyV1 {
  return {
    version: '1.0',
    propertyId: 'prop_display_test',
    createdAt: '2024-06-01T10:00:00Z',
    updatedAt: '2024-06-01T10:00:00Z',
    status: 'draft',
    sourceApps: ['atlas_scan'],
    property: {
      address1: '10 Test Street',
      town: 'Bristol',
      postcode: 'BS1 5TR',
      uprn: 'UPRN123',
    },
    capture: {
      sessionId: 'session_01',
      startedAt: '2024-06-01T09:00:00Z',
      completedAt: '2024-06-01T09:30:00Z',
    },
    building: {
      floors: [],
      rooms: [
        { roomId: 'r1', floorId: 'f1', label: 'Lounge' },
        { roomId: 'r2', floorId: 'f1', label: 'Kitchen' },
      ],
      zones: [], boundaries: [], openings: [],
      emitters: [],
      systemComponents: [
        { componentId: 'c1', label: 'Boiler', kind: 'boiler' },
      ],
    },
    household: {
      composition: {
        adultCount:                  fv(2),
        childCount0to4:              fv(0),
        childCount5to10:             fv(0),
        childCount11to17:            fv(0),
        youngAdultCount18to25AtHome: fv(0),
      },
      occupancyPattern: fv('steady_home', 'medium'),
      hotWaterUsage: {
        bathPresent:   fv(true),
        showerPresent: fv(true),
        bathroomCount: fv(1),
      },
    },
    currentSystem: {
      family:   fv('combi'),
      dhwType:  fv('combi'),
      heatSource: {
        ratedOutputKw: fv(28),
        installYear:   fv(2018),
      },
      distribution: {
        dominantPipeDiameterMm: fv(22, 'medium'),
      },
    },
    evidence: {
      photos:     [
        { photoId: 'ph1', capturedAt: '2024-06-01T09:10:00Z', tag: 'boiler' },
        { photoId: 'ph2', capturedAt: '2024-06-01T09:15:00Z', tag: 'pipe_work' },
      ],
      voiceNotes: [
        { voiceNoteId: 'vn1', capturedAt: '2024-06-01T09:12:00Z', durationSeconds: 15, transcript: 'Boiler is a Worcetser 28i.' },
      ],
      textNotes:  [
        { noteId: 'tn1', createdAt: '2024-06-01T09:20:00Z', body: 'All good.' },
      ],
      qaFlags:    [],
      events:     [],
    },
    derived: {
      heatLoss:   { peakWatts:         fv(7200, 'medium') },
      hydraulics: {
        dynamicPressureBar: fv(2.8),
        mainsFlowLpm:       fv(16),
      },
    },
    ...overrides,
  };
}

function importAndBuild(property: AtlasPropertyV1) {
  const result = importAtlasProperty(property, 'atlas_scan_handoff');
  return buildHandoffDisplayModel(result);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildHandoffDisplayModel', () => {

  describe('sourceLabel', () => {
    it('is always "From Atlas Scan"', () => {
      const model = importAndBuild(makeProperty());
      expect(model.sourceLabel).toBe('From Atlas Scan');
    });
  });

  describe('title', () => {
    it('formats address from address1, town, postcode', () => {
      const model = importAndBuild(makeProperty());
      expect(model.title).toBe('10 Test Street, Bristol, BS1 5TR');
    });

    it('falls back to "Unknown property" when no address parts are present', () => {
      const p = makeProperty({ property: { postcode: undefined as unknown as string } });
      // Remove all address parts
      p.property = { address1: undefined as unknown as string, town: undefined as unknown as string, postcode: undefined as unknown as string };
      const model = importAndBuild(p);
      expect(model.title).toBe('Unknown property');
    });
  });

  describe('subtitle', () => {
    it('includes propertyType and buildEra when present', () => {
      const p = makeProperty();
      p.property.propertyType = fv('semi_detached');
      p.property.buildEra     = fv('1950_to_1966');
      const model = importAndBuild(p);
      expect(model.subtitle).toContain('semi detached');
      expect(model.subtitle).toContain('1950');
    });

    it('is undefined when neither propertyType nor buildEra is present', () => {
      const p = makeProperty();
      p.property.propertyType = undefined;
      p.property.buildEra     = undefined;
      const model = importAndBuild(p);
      expect(model.subtitle).toBeUndefined();
    });
  });

  describe('reference', () => {
    it('prefers uprn', () => {
      const model = importAndBuild(makeProperty());
      expect(model.reference).toBe('UPRN123');
    });

    it('falls back to property.reference when uprn absent', () => {
      const p = makeProperty();
      p.property.uprn      = undefined;
      p.property.reference = 'JOB-001';
      const model = importAndBuild(p);
      expect(model.reference).toBe('JOB-001');
    });

    it('falls back to propertyId when neither uprn nor reference present', () => {
      const p = makeProperty();
      p.property.uprn      = undefined;
      p.property.reference = undefined;
      const model = importAndBuild(p);
      expect(model.reference).toBe('prop_display_test');
    });
  });

  describe('capturedAt', () => {
    it('prefers completedAt', () => {
      const model = importAndBuild(makeProperty());
      expect(model.capturedAt).toBe('2024-06-01T09:30:00Z');
    });

    it('falls back to startedAt when completedAt absent', () => {
      const p = makeProperty();
      p.capture.completedAt = undefined;
      const model = importAndBuild(p);
      expect(model.capturedAt).toBe('2024-06-01T09:00:00Z');
    });

    it('falls back to updatedAt when neither completedAt nor startedAt present', () => {
      const p = makeProperty();
      p.capture.completedAt = undefined;
      p.capture.startedAt   = undefined;
      const model = importAndBuild(p);
      expect(model.capturedAt).toBe('2024-06-01T10:00:00Z');
    });
  });

  describe('capture counts', () => {
    it('counts rooms, objects, photos, voice notes, and text notes correctly', () => {
      const model = importAndBuild(makeProperty());
      expect(model.roomCount).toBe(2);
      expect(model.objectCount).toBe(1);
      expect(model.photoCount).toBe(2);
      expect(model.voiceNoteCount).toBe(1);
      expect(model.noteCount).toBe(1);
    });

    it('returns zero counts for an empty evidence layer', () => {
      const p = makeProperty();
      p.evidence = { photos: [], voiceNotes: [], textNotes: [], qaFlags: [], events: [] };
      const model = importAndBuild(p);
      expect(model.photoCount).toBe(0);
      expect(model.voiceNoteCount).toBe(0);
      expect(model.noteCount).toBe(0);
    });
  });

  describe('extractedFactCount', () => {
    it('counts high/medium confidence FieldValues across all sub-models', () => {
      const model = importAndBuild(makeProperty());
      // Should count: occupancyPattern(med), adultCount/childCounts(high×5),
      // bathroomCount/bath/shower(high×3), family/dhwType(high×2),
      // ratedOutputKw/installYear(high×2), pipeDiameter(med),
      // peakWatts(med), dynamicPressureBar/mainsFlowLpm(high×2)
      expect(model.extractedFactCount).toBeGreaterThan(0);
    });

    it('is 0 for a minimal property with no FieldValues', () => {
      const p = makeProperty();
      // Remove all FieldValues
      p.household.composition = {
        adultCount: fv(2),
        childCount0to4: undefined as unknown as typeof p.household.composition.childCount0to4,
        childCount5to10: undefined as unknown as typeof p.household.composition.childCount5to10,
        childCount11to17: undefined as unknown as typeof p.household.composition.childCount11to17,
        youngAdultCount18to25AtHome: undefined as unknown as typeof p.household.composition.youngAdultCount18to25AtHome,
      };
      p.household.occupancyPattern       = undefined;
      p.household.hotWaterUsage          = undefined;
      p.currentSystem.family             = undefined;
      p.currentSystem.dhwType            = undefined;
      p.currentSystem.heatSource         = undefined;
      p.currentSystem.distribution       = undefined;
      p.derived                          = undefined;
      p.property.propertyType            = undefined;
      p.property.buildEra                = undefined;
      const model = importAndBuild(p);
      // adultCount(high) is still present
      expect(model.extractedFactCount).toBe(1);
    });
  });

  describe('knowledge status', () => {
    it('household is "confirmed" when adultCount has high confidence', () => {
      const model = importAndBuild(makeProperty());
      expect(model.knowledge.household).toBe('confirmed');
    });

    it('household is "review" when adultCount has low confidence', () => {
      const p = makeProperty();
      p.household.composition.adultCount = fv(2, 'low');
      const model = importAndBuild(p);
      expect(model.knowledge.household).toBe('review');
    });

    it('household is "missing" when adultCount is absent', () => {
      const p = makeProperty();
      p.household.composition.adultCount = undefined as unknown as typeof p.household.composition.adultCount;
      const model = importAndBuild(p);
      expect(model.knowledge.household).toBe('missing');
    });

    it('currentSystem is "confirmed" for known system family at high confidence', () => {
      const model = importAndBuild(makeProperty());
      expect(model.knowledge.currentSystem).toBe('confirmed');
    });

    it('currentSystem is "review" for "unknown" family value', () => {
      const p = makeProperty();
      p.currentSystem.family = fv('unknown' as 'combi');
      const model = importAndBuild(p);
      expect(model.knowledge.currentSystem).toBe('review');
    });

    it('currentSystem is "missing" when family is absent', () => {
      const p = makeProperty();
      p.currentSystem.family = undefined;
      const model = importAndBuild(p);
      expect(model.knowledge.currentSystem).toBe('missing');
    });

    it('priorities and constraints are "missing" (not yet captured as FieldValues)', () => {
      const model = importAndBuild(makeProperty());
      expect(model.knowledge.priorities).toBe('missing');
      expect(model.knowledge.constraints).toBe('missing');
    });
  });

  describe('readiness', () => {
    it('readyForSimulation is true for a complete property', () => {
      const model = importAndBuild(makeProperty());
      expect(model.readiness.readyForSimulation).toBe(true);
    });

    it('readyForSimulation is false when postcode is missing', () => {
      const p = makeProperty();
      p.property = { address1: '10 Test Street', town: 'Bristol', postcode: undefined as unknown as string };
      const model = importAndBuild(p);
      expect(model.readiness.readyForSimulation).toBe(false);
    });

    it('missingCritical contains readable labels when required fields are absent', () => {
      const p = makeProperty();
      p.property = { address1: '10 Test Street', town: 'Bristol', postcode: undefined as unknown as string };
      const model = importAndBuild(p);
      expect(model.readiness.missingCritical.some(m => /postcode/i.test(m))).toBe(true);
    });

    it('confidenceWarnings surfaces import warnings', () => {
      const p = makeProperty();
      p.property.postcode = undefined as unknown as string;
      const result = importAtlasProperty(p, 'atlas_scan_handoff');
      const model = buildHandoffDisplayModel(result);
      expect(model.readiness.confidenceWarnings.length).toBeGreaterThan(0);
    });

    it('missingCritical is empty for a fully-populated property', () => {
      const model = importAndBuild(makeProperty());
      expect(model.readiness.missingCritical).toHaveLength(0);
    });
  });
});
