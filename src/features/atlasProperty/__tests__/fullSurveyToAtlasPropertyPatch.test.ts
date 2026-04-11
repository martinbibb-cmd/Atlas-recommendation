/**
 * fullSurveyToAtlasPropertyPatch.test.ts
 */

import { describe, it, expect } from 'vitest';
import { fullSurveyToAtlasPropertyPatch } from '../adapters/fullSurveyToAtlasPropertyPatch';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_SURVEY: FullSurveyModelV1 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  bathroomCount: 2,
  occupancySignature: 'steady_home',
  highOccupancy: false,
  dhw: { architecture: 'on_demand' },
  infrastructure: { primaryPipeSizeMm: 22 },
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
    childCount5to10: 1,
    childCount11to17: 0,
    youngAdultCount18to25AtHome: 0,
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('fullSurveyToAtlasPropertyPatch', () => {
  describe('property identity', () => {
    it('maps postcode to property.postcode', () => {
      const patch = fullSurveyToAtlasPropertyPatch(BASE_SURVEY);
      expect(patch.property?.postcode).toBe('SW1A 1AA');
    });

    it('omits property when postcode is absent', () => {
      const survey = { ...BASE_SURVEY, postcode: undefined as unknown as string };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.property).toBeUndefined();
    });
  });

  describe('household composition', () => {
    it('maps householdComposition fields with customer_stated source', () => {
      const patch = fullSurveyToAtlasPropertyPatch(BASE_SURVEY);
      const comp = patch.household?.composition;
      expect(comp?.adultCount?.value).toBe(2);
      expect(comp?.adultCount?.source).toBe('customer_stated');
      expect(comp?.adultCount?.confidence).toBe('medium');
      expect(comp?.childCount5to10?.value).toBe(1);
    });

    it('falls back to fullSurvey.usage.composition when root composition absent', () => {
      const survey: FullSurveyModelV1 = {
        ...BASE_SURVEY,
        householdComposition: undefined,
        fullSurvey: {
          usage: {
            composition: {
              adultCount: 3,
              childCount0to4: 0,
              childCount5to10: 0,
              childCount11to17: 1,
              youngAdultCount18to25AtHome: 0,
            },
            daytimeOccupancy: 'usually_home',
            bathUse: 'sometimes',
            bathroomCount: 1,
          },
        },
      };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.household?.composition?.adultCount?.value).toBe(3);
      expect(patch.household?.composition?.childCount11to17?.value).toBe(1);
    });
  });

  describe('occupancy pattern', () => {
    it('maps usually_out daytimeOccupancy to usually_out', () => {
      const survey: FullSurveyModelV1 = {
        ...BASE_SURVEY,
        fullSurvey: {
          usage: {
            composition: BASE_SURVEY.householdComposition!,
            daytimeOccupancy: 'usually_out',
            bathUse: 'rare',
            bathroomCount: 1,
          },
        },
      };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.household?.occupancyPattern?.value).toBe('usually_out');
    });

    it('maps usually_home daytimeOccupancy to steady_home', () => {
      const survey: FullSurveyModelV1 = {
        ...BASE_SURVEY,
        fullSurvey: {
          usage: {
            composition: BASE_SURVEY.householdComposition!,
            daytimeOccupancy: 'usually_home',
            bathUse: 'rare',
            bathroomCount: 1,
          },
        },
      };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.household?.occupancyPattern?.value).toBe('steady_home');
    });
  });

  describe('current system — family', () => {
    it('maps combi boiler to combi family', () => {
      const patch = fullSurveyToAtlasPropertyPatch(BASE_SURVEY);
      expect(patch.currentSystem?.family?.value).toBe('combi');
    });

    it('maps system boiler type to system family', () => {
      const survey: FullSurveyModelV1 = {
        ...BASE_SURVEY,
        dhw: { architecture: 'stored_standard' },
        currentSystem: { boiler: { type: 'system' } },
      };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.currentSystem?.family?.value).toBe('system');
    });

    it('maps regular boiler to regular family', () => {
      const survey: FullSurveyModelV1 = {
        ...BASE_SURVEY,
        dhw: { architecture: 'stored_standard' },
        currentSystem: { boiler: { type: 'regular' } },
      };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.currentSystem?.family?.value).toBe('regular');
    });

    it('maps stored_mixergy DHW to mixergy dhwType', () => {
      const survey: FullSurveyModelV1 = {
        ...BASE_SURVEY,
        dhw: { architecture: 'stored_mixergy' },
        currentSystem: { boiler: { type: 'system' } },
      };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.currentSystem?.dhwType?.value).toBe('mixergy');
    });
  });

  describe('heat source details', () => {
    it('derives installYear from ageYears', () => {
      const patch = fullSurveyToAtlasPropertyPatch(BASE_SURVEY);
      const currentYear = new Date().getFullYear();
      expect(patch.currentSystem?.heatSource?.installYear?.value).toBe(currentYear - 8);
      expect(patch.currentSystem?.heatSource?.installYear?.confidence).toBe('low');
    });

    it('maps nominalOutputKw to ratedOutputKw', () => {
      const patch = fullSurveyToAtlasPropertyPatch(BASE_SURVEY);
      expect(patch.currentSystem?.heatSource?.ratedOutputKw?.value).toBe(30);
      expect(patch.currentSystem?.heatSource?.ratedOutputKw?.source).toBe('engineer_entered');
    });

    it('maps pipe size to distribution.dominantPipeDiameterMm', () => {
      const patch = fullSurveyToAtlasPropertyPatch(BASE_SURVEY);
      expect(patch.currentSystem?.distribution?.dominantPipeDiameterMm?.value).toBe(22);
    });
  });

  describe('derived hydraulics', () => {
    it('maps dynamicMainsPressure with measured source and high confidence', () => {
      const patch = fullSurveyToAtlasPropertyPatch(BASE_SURVEY);
      expect(patch.derived?.hydraulics?.dynamicPressureBar?.value).toBe(2.5);
      expect(patch.derived?.hydraulics?.dynamicPressureBar?.source).toBe('measured');
      expect(patch.derived?.hydraulics?.dynamicPressureBar?.confidence).toBe('high');
    });

    it('maps mainsDynamicFlowLpm to mainsFlowLpm', () => {
      const survey: FullSurveyModelV1 = { ...BASE_SURVEY, mainsDynamicFlowLpm: 18 };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.derived?.hydraulics?.mainsFlowLpm?.value).toBe(18);
      expect(patch.derived?.hydraulics?.mainsFlowLpm?.source).toBe('measured');
    });

    it('omits derived.hydraulics when no pressure or flow values present', () => {
      const survey: FullSurveyModelV1 = {
        ...BASE_SURVEY,
        dynamicMainsPressure: undefined as unknown as number,
        dynamicMainsPressureBar: undefined,
        mainsDynamicFlowLpm: undefined,
      };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.derived?.hydraulics).toBeUndefined();
    });
  });

  describe('condition diagnostics', () => {
    it('flags knownFaults when radiators cold at bottom', () => {
      const survey: FullSurveyModelV1 = {
        ...BASE_SURVEY,
        fullSurvey: {
          heatingCondition: {
            radiatorsColdAtBottom: true,
          },
        },
      };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.currentSystem?.condition?.knownFaults?.value).toBe(true);
      expect(patch.currentSystem?.condition?.notes).toContain('Radiators cold at bottom');
    });

    it('does not flag knownFaults when diagnostics are clear', () => {
      const survey: FullSurveyModelV1 = {
        ...BASE_SURVEY,
        fullSurvey: {
          heatingCondition: {
            radiatorsColdAtBottom: false,
            radiatorsHeatingUnevenly: false,
          },
        },
      };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.currentSystem?.condition?.knownFaults?.value).toBe(false);
    });

    it('marks visualAssessment very_dirty when sludge evidence present', () => {
      const survey: FullSurveyModelV1 = {
        ...BASE_SURVEY,
        fullSurvey: {
          heatingCondition: {
            bleedWaterColour: 'black',
          },
        },
      };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.currentSystem?.waterQuality?.visualAssessment?.value).toBe('very_dirty');
    });

    it('marks visualAssessment clean when bleed water is clear', () => {
      const survey: FullSurveyModelV1 = {
        ...BASE_SURVEY,
        fullSurvey: {
          heatingCondition: {
            bleedWaterColour: 'clear',
          },
        },
      };
      const patch = fullSurveyToAtlasPropertyPatch(survey);
      expect(patch.currentSystem?.waterQuality?.visualAssessment?.value).toBe('clean');
    });
  });
});
