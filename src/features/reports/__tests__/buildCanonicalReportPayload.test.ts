/**
 * buildCanonicalReportPayload.test.ts
 *
 * PR3 — Tests for buildCanonicalReportPayload().
 */

import { describe, it, expect } from 'vitest';
import { buildCanonicalReportPayload } from '../adapters/buildCanonicalReportPayload';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import type { AtlasPropertyV1 } from '@atlas/contracts';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MINIMAL_ENGINE_OUTPUT: EngineOutputV1 = {
  options: [
    {
      id: 'combi_retain',
      status: 'viable',
      pathwayType: 'gas_combi',
      label: 'Keep combi',
      shortLabel: 'Keep combi',
      rationale: [],
      metrics: {} as EngineOutputV1['options'][0]['metrics'],
      flags: [],
      prerequisites: [],
    } as unknown as EngineOutputV1['options'][0],
  ],
};

const BASE_SURVEY: FullSurveyModelV1 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  bathroomCount: 1,
  occupancySignature: 'steady_home',
  highOccupancy: false,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8500,
  radiatorCount: 8,
  hasLoftConversion: false,
  returnWaterTemp: 70,
  preferCombi: false,
  currentHeatSourceType: 'combi',
  dhwStorageType: 'none',
  currentSystem: {
    boiler: {
      type: 'combi',
      ageYears: 8,
      nominalOutputKw: 30,
    },
  },
  householdComposition: {
    adultCount: 2,
    childCount0to4: 0,
    childCount5to10: 0,
    childCount11to17: 0,
    youngAdultCount18to25AtHome: 0,
  },
};

const STUB_ATLAS_PROPERTY: AtlasPropertyV1 = {
  propertyId: 'test-prop-1',
} as unknown as AtlasPropertyV1;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildCanonicalReportPayload', () => {
  describe('schemaVersion', () => {
    it('always emits schemaVersion "2.0"', () => {
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.schemaVersion).toBe('2.0');
    });
  });

  describe('atlasProperty from supplied canonical', () => {
    it('uses the supplied atlasProperty directly', () => {
      const payload = buildCanonicalReportPayload({
        atlasProperty: STUB_ATLAS_PROPERTY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.atlasProperty).toBe(STUB_ATLAS_PROPERTY);
    });

    it('does not derive from surveyData when atlasProperty is supplied', () => {
      const payload = buildCanonicalReportPayload({
        atlasProperty: STUB_ATLAS_PROPERTY,
        surveyData: BASE_SURVEY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.atlasProperty).toBe(STUB_ATLAS_PROPERTY);
    });
  });

  describe('atlasProperty derived from surveyData', () => {
    it('derives atlasProperty from surveyData when atlasProperty is not supplied', () => {
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.atlasProperty).toBeDefined();
      expect(typeof payload.atlasProperty).toBe('object');
    });

    it('produces an empty property shell when neither atlasProperty nor surveyData is supplied', () => {
      const payload = buildCanonicalReportPayload({
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.atlasProperty).toBeDefined();
      expect(typeof payload.atlasProperty).toBe('object');
    });
  });

  describe('engineRun', () => {
    it('persists engineOutput in engineRun', () => {
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.engineRun.engineOutput).toBe(MINIMAL_ENGINE_OUTPUT);
    });

    it('persists engineInput in engineRun when supplied', () => {
      const engineInput = { postcode: 'SW1A 1AA' } as unknown as Parameters<typeof buildCanonicalReportPayload>[0]['engineInput'];
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineInput,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.engineRun.engineInput).toBe(engineInput);
    });

    it('omits engineInput from engineRun when not supplied', () => {
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.engineRun.engineInput).toBeUndefined();
    });

    it('includes runMeta when supplied', () => {
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
        runMeta: { source: 'atlas_mind', runId: 'run-1' },
      });
      expect(payload.engineRun.runMeta?.source).toBe('atlas_mind');
      expect(payload.engineRun.runMeta?.runId).toBe('run-1');
    });

    it('omits runMeta when not supplied', () => {
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.engineRun.runMeta).toBeUndefined();
    });
  });

  describe('presentationState', () => {
    it('includes presentationState when supplied', () => {
      const ps = { recommendedOptionId: 'opt-1', chosenByCustomer: false };
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
        presentationState: ps,
      });
      expect(payload.presentationState).toEqual(ps);
    });

    it('stores null when presentationState is not supplied', () => {
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.presentationState).toBeNull();
    });
  });

  describe('decisionSynthesis', () => {
    it('stores null when decisionSynthesis is not supplied', () => {
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.decisionSynthesis).toBeNull();
    });
  });

  describe('legacy block', () => {
    it('includes legacy.surveyData when surveyData is supplied', () => {
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.legacy?.surveyData).toBe(BASE_SURVEY);
    });

    it('includes legacy.engineOutput', () => {
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.legacy?.engineOutput).toBe(MINIMAL_ENGINE_OUTPUT);
    });

    it('includes legacy.engineInput when engineInput is supplied', () => {
      const engineInput = { postcode: 'SW1A 1AA' } as unknown as Parameters<typeof buildCanonicalReportPayload>[0]['engineInput'];
      const payload = buildCanonicalReportPayload({
        surveyData: BASE_SURVEY,
        engineInput,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.legacy?.engineInput).toBe(engineInput);
    });

    it('omits legacy.surveyData when surveyData is not supplied', () => {
      const payload = buildCanonicalReportPayload({
        atlasProperty: STUB_ATLAS_PROPERTY,
        engineOutput: MINIMAL_ENGINE_OUTPUT,
      });
      expect(payload.legacy?.surveyData).toBeUndefined();
    });
  });
});
