/**
 * buildPortalDisplayModel.test.ts
 *
 * PR9 — Tests for buildPortalDisplayModel().
 *
 * Coverage:
 *   1. Canonical (v2) payload → display model with evidence/knowledge summary
 *   2. Legacy (v1) payload → display model without evidence/knowledge summary
 *   3. No engine output → returns null
 *   4. Canonical payload uses presentationState for recommendedOptionId
 *   5. Legacy payload falls back to first viable engine option for recommendedOptionId
 *   6. reportPostcode used as title fallback when atlasProperty has no address
 *   7. canonicalEngineRun.engineInput is not required — model still built
 *   8. Knowledge summary: household 'confirmed' when adultCount is high confidence
 *   9. Knowledge summary: household 'missing' when adultCount absent
 *  10. Knowledge summary: currentSystem 'review' when family is 'unknown'
 *  11. Evidence counts reflect canonical evidence arrays
 *  12. chosenOptionId only set when chosenByCustomer is true
 */

import { describe, it, expect } from 'vitest';
import { buildPortalDisplayModel } from '../selectors/buildPortalDisplayModel';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { AtlasPropertyV1 } from '@atlas/contracts';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function fv<T>(value: T, confidence: 'high' | 'medium' | 'low' = 'high') {
  return { value, source: 'engineer_entered' as const, confidence };
}

const STUB_ENGINE_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'Combi boiler' },
  explainers: [],
  options: [
    {
      id: 'combi',
      label: 'Combi boiler',
      status: 'viable',
      headline: 'Best fit',
      why: [],
      requirements: [],
      heat:        { status: 'ok', headline: '', bullets: [] },
      dhw:         { status: 'ok', headline: '', bullets: [] },
      engineering: { status: 'ok', headline: '', bullets: [] },
      sensitivities: [],
      typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
    },
    {
      id: 'system',
      label: 'System boiler',
      status: 'caution',
      headline: 'Alternative',
      why: [],
      requirements: [],
      heat:        { status: 'ok', headline: '', bullets: [] },
      dhw:         { status: 'ok', headline: '', bullets: [] },
      engineering: { status: 'ok', headline: '', bullets: [] },
      sensitivities: [],
      typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
    },
  ],
  verdict: {
    title: 'Combi boiler recommended',
    status: 'good',
    reasons: ['Adequate mains pressure'],
    confidence: { level: 'high', reasons: [] },
    assumptionsUsed: [],
  },
};

const STUB_ATLAS_PROPERTY: AtlasPropertyV1 = {
  version: '1.0',
  propertyId: 'prop_portal_test',
  createdAt: '2024-06-01T10:00:00Z',
  updatedAt: '2024-06-01T10:00:00Z',
  status: 'draft',
  sourceApps: ['atlas_scan'],
  property: {
    address1: '5 Example Road',
    town: 'Bristol',
    postcode: 'BS1 1AA',
  },
  capture: {
    sessionId: 'sess_01',
    startedAt: '2024-06-01T09:00:00Z',
    completedAt: '2024-06-01T09:30:00Z',
  },
  building: {
    floors: [],
    rooms: [{ roomId: 'r1', floorId: 'f1', label: 'Lounge' }],
    zones: [], boundaries: [], openings: [],
    emitters: [],
    systemComponents: [],
  },
  household: {
    composition: {
      adultCount: fv(2),
      childCount0to4: fv(0),
      childCount5to10: fv(0),
      childCount11to17: fv(0),
      youngAdultCount18to25AtHome: fv(0),
    },
    occupancyPattern: fv('steady_home'),
    hotWaterUsage: {
      bathPresent:   fv(true),
      showerPresent: fv(true),
      bathroomCount: fv(1),
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
    photos:     [
      { photoId: 'ph1', capturedAt: '2024-06-01T09:10:00Z', tag: 'boiler' },
      { photoId: 'ph2', capturedAt: '2024-06-01T09:15:00Z', tag: 'pipe_work' },
    ],
    voiceNotes: [
      { voiceNoteId: 'vn1', capturedAt: '2024-06-01T09:12:00Z', durationSeconds: 15, transcript: 'Combi.' },
    ],
    textNotes:  [
      { noteId: 'tn1', createdAt: '2024-06-01T09:20:00Z', body: 'All good.' },
    ],
    qaFlags: [],
    events:  [],
  },
  derived: {
    heatLoss:   { peakWatts: fv(7200, 'medium') },
    hydraulics: {
      dynamicPressureBar: fv(2.8),
      mainsFlowLpm:       fv(16),
    },
  },
} as unknown as AtlasPropertyV1;

const CANONICAL_PAYLOAD = {
  schemaVersion: '2.0' as const,
  atlasProperty: STUB_ATLAS_PROPERTY,
  engineRun: {
    engineOutput: STUB_ENGINE_OUTPUT,
  },
  presentationState: {
    recommendedOptionId: 'combi',
    chosenOptionId: undefined,
    chosenByCustomer: false,
  },
};

const LEGACY_PAYLOAD = {
  surveyData: { postcode: 'SW1A 1AA', occupancyCount: 2 },
  engineOutput: STUB_ENGINE_OUTPUT,
  presentationState: {
    recommendedOptionId: 'combi',
    chosenByCustomer: false,
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildPortalDisplayModel', () => {

  describe('canonical payload (v2)', () => {
    it('returns a display model with recommendationReady true', () => {
      const model = buildPortalDisplayModel(CANONICAL_PAYLOAD);
      expect(model).not.toBeNull();
      expect(model!.recommendationReady).toBe(true);
    });

    it('derives propertyTitle from atlasProperty address', () => {
      const model = buildPortalDisplayModel(CANONICAL_PAYLOAD);
      expect(model!.propertyTitle).toBe('5 Example Road, Bristol, BS1 1AA');
    });

    it('exposes engine output', () => {
      const model = buildPortalDisplayModel(CANONICAL_PAYLOAD);
      expect(model!.engineOutput).toBe(STUB_ENGINE_OUTPUT);
    });

    it('surfaces presentationState', () => {
      const model = buildPortalDisplayModel(CANONICAL_PAYLOAD);
      expect(model!.presentationState?.recommendedOptionId).toBe('combi');
    });

    it('populates evidenceSummary from atlasProperty.evidence', () => {
      const model = buildPortalDisplayModel(CANONICAL_PAYLOAD);
      expect(model!.evidenceSummary).toBeDefined();
      expect(model!.evidenceSummary!.photoCount).toBe(2);
      expect(model!.evidenceSummary!.voiceNoteCount).toBe(1);
      expect(model!.evidenceSummary!.textNoteCount).toBe(1);
      expect(model!.evidenceSummary!.extractedFactCount).toBeGreaterThan(0);
    });

    it('populates knowledgeSummary from canonical property fields', () => {
      const model = buildPortalDisplayModel(CANONICAL_PAYLOAD);
      expect(model!.knowledgeSummary).toBeDefined();
      expect(model!.knowledgeSummary!.household).toBe('confirmed');
      expect(model!.knowledgeSummary!.usage).toBe('confirmed');
      expect(model!.knowledgeSummary!.currentSystem).toBe('confirmed');
    });

    it('derives recommendedOptionId from presentationState', () => {
      const model = buildPortalDisplayModel(CANONICAL_PAYLOAD);
      expect(model!.recommendedOptionId).toBe('combi');
    });

    it('does not set chosenOptionId when chosenByCustomer is false', () => {
      const model = buildPortalDisplayModel(CANONICAL_PAYLOAD);
      expect(model!.chosenOptionId).toBeUndefined();
    });

    it('sets chosenOptionId when chosenByCustomer is true', () => {
      const payload = {
        ...CANONICAL_PAYLOAD,
        presentationState: {
          recommendedOptionId: 'combi',
          chosenOptionId: 'system',
          chosenByCustomer: true,
        },
      };
      const model = buildPortalDisplayModel(payload);
      expect(model!.chosenOptionId).toBe('system');
    });
  });

  describe('legacy payload (v1)', () => {
    it('returns a display model with recommendationReady true', () => {
      const model = buildPortalDisplayModel(LEGACY_PAYLOAD);
      expect(model).not.toBeNull();
      expect(model!.recommendationReady).toBe(true);
    });

    it('derives propertyTitle from reportPostcode when atlasProperty is absent', () => {
      const model = buildPortalDisplayModel(LEGACY_PAYLOAD, 'SW1A 1AA');
      expect(model!.propertyTitle).toBe('SW1A 1AA');
    });

    it('falls back to first viable option id when no presentationState.recommendedOptionId', () => {
      const payload = { engineOutput: STUB_ENGINE_OUTPUT };
      const model = buildPortalDisplayModel(payload);
      expect(model!.recommendedOptionId).toBe('combi');
    });

    it('exposes engine output', () => {
      const model = buildPortalDisplayModel(LEGACY_PAYLOAD);
      expect(model!.engineOutput).toBe(STUB_ENGINE_OUTPUT);
    });

    it('does NOT populate evidenceSummary (no atlasProperty)', () => {
      const model = buildPortalDisplayModel(LEGACY_PAYLOAD);
      expect(model!.evidenceSummary).toBeUndefined();
    });

    it('does NOT populate knowledgeSummary (no atlasProperty)', () => {
      const model = buildPortalDisplayModel(LEGACY_PAYLOAD);
      expect(model!.knowledgeSummary).toBeUndefined();
    });
  });

  describe('missing engine output', () => {
    it('returns null when payload has no engine output', () => {
      const model = buildPortalDisplayModel({ surveyData: {} });
      expect(model).toBeNull();
    });

    it('returns null for an empty object', () => {
      expect(buildPortalDisplayModel({})).toBeNull();
    });

    it('returns null for null', () => {
      expect(buildPortalDisplayModel(null)).toBeNull();
    });
  });

  describe('knowledge summary edge cases', () => {
    it('household is "missing" when adultCount is absent', () => {
      const composition = { ...STUB_ATLAS_PROPERTY.household!.composition };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (composition as any).adultCount = undefined;
      const p: AtlasPropertyV1 = {
        ...STUB_ATLAS_PROPERTY,
        household: { ...STUB_ATLAS_PROPERTY.household!, composition },
      };
      const payload = { ...CANONICAL_PAYLOAD, atlasProperty: p };
      const model = buildPortalDisplayModel(payload);
      expect(model!.knowledgeSummary!.household).toBe('missing');
    });

    it('currentSystem is "review" when family is "unknown"', () => {
      const p: AtlasPropertyV1 = {
        ...STUB_ATLAS_PROPERTY,
        currentSystem: {
          ...STUB_ATLAS_PROPERTY.currentSystem,
          family: fv('unknown'),
        },
      } as unknown as AtlasPropertyV1;
      const payload = { ...CANONICAL_PAYLOAD, atlasProperty: p };
      const model = buildPortalDisplayModel(payload);
      expect(model!.knowledgeSummary!.currentSystem).toBe('review');
    });

    it('currentSystem is "missing" when family is absent', () => {
      const p: AtlasPropertyV1 = {
        ...STUB_ATLAS_PROPERTY,
        currentSystem: { ...STUB_ATLAS_PROPERTY.currentSystem, family: undefined },
      } as unknown as AtlasPropertyV1;
      const payload = { ...CANONICAL_PAYLOAD, atlasProperty: p };
      const model = buildPortalDisplayModel(payload);
      expect(model!.knowledgeSummary!.currentSystem).toBe('missing');
    });
  });

  describe('mixed payload: canonical present but no address', () => {
    it('falls back to reportPostcode when atlasProperty has no address parts', () => {
      const p: AtlasPropertyV1 = {
        ...STUB_ATLAS_PROPERTY,
        property: { postcode: undefined as unknown as string },
      };
      const payload = { ...CANONICAL_PAYLOAD, atlasProperty: p };
      const model = buildPortalDisplayModel(payload, 'EX1 1AB');
      expect(model!.propertyTitle).toBe('EX1 1AB');
    });
  });
});
