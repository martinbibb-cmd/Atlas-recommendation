/**
 * atlasPropertyToEngineInput.test.ts
 */

import { describe, it, expect } from 'vitest';
import { atlasPropertyToEngineInput } from '../adapters/atlasPropertyToEngineInput';
import type { AtlasPropertyV1 } from '@atlas/contracts';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function fv<T>(value: T) {
  return { value, source: 'engineer_entered' as const, confidence: 'medium' as const };
}

const BASE_PROPERTY: AtlasPropertyV1 = {
  version: '1.0',
  propertyId: 'prop_test',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  status: 'draft',
  sourceApps: ['atlas_mind'],
  property: {
    postcode: 'SW1A 1AA',
  },
  capture: {
    sessionId: 'session_1',
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
      childCount5to10:             fv(1),
      childCount11to17:            fv(0),
      youngAdultCount18to25AtHome: fv(0),
    },
    occupancyPattern: fv('usually_out'),
    hotWaterUsage: {
      bathPresent: fv(true),
    },
  },
  currentSystem: {
    family: fv('combi'),
    dhwType: fv('combi'),
    heatSource: {
      ratedOutputKw: fv(30),
      installYear:   fv(2016),
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
      peakWatts: { value: 8500, source: 'derived', confidence: 'medium' },
    },
    hydraulics: {
      dynamicPressureBar: { value: 2.5, source: 'measured', confidence: 'high' },
      mainsFlowLpm:       { value: 18,  source: 'measured', confidence: 'high' },
    },
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('atlasPropertyToEngineInput', () => {
  describe('property identity', () => {
    it('maps postcode', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      expect(input.postcode).toBe('SW1A 1AA');
    });
  });

  describe('household composition', () => {
    it('maps household composition to householdComposition', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      expect(input.householdComposition?.adultCount).toBe(2);
      expect(input.householdComposition?.childCount5to10).toBe(1);
    });

    it('derives occupancyCount as total of all age bands', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      // 2 adults + 1 child 5-10 = 3
      expect(input.occupancyCount).toBe(3);
    });

    it('sets highOccupancy true when total occupants >= 4', () => {
      const property: AtlasPropertyV1 = {
        ...BASE_PROPERTY,
        household: {
          ...BASE_PROPERTY.household,
          composition: {
            adultCount:                  fv(4),
            childCount0to4:              fv(0),
            childCount5to10:             fv(0),
            childCount11to17:            fv(0),
            youngAdultCount18to25AtHome: fv(0),
          },
        },
      };
      const input = atlasPropertyToEngineInput(property);
      expect(input.highOccupancy).toBe(true);
    });

    it('sets highOccupancy false for 3 occupants', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      expect(input.highOccupancy).toBe(false);
    });
  });

  describe('occupancy signature', () => {
    it('maps usually_out to professional', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      expect(input.occupancySignature).toBe('professional');
    });

    it('maps steady_home to steady_home', () => {
      const property: AtlasPropertyV1 = {
        ...BASE_PROPERTY,
        household: {
          ...BASE_PROPERTY.household,
          occupancyPattern: fv('steady_home'),
        },
      };
      const input = atlasPropertyToEngineInput(property);
      expect(input.occupancySignature).toBe('steady_home');
    });

    it('maps mixed to shift_worker', () => {
      const property: AtlasPropertyV1 = {
        ...BASE_PROPERTY,
        household: {
          ...BASE_PROPERTY.household,
          occupancyPattern: fv('mixed'),
        },
      };
      const input = atlasPropertyToEngineInput(property);
      expect(input.occupancySignature).toBe('shift_worker');
    });
  });

  describe('DHW architecture', () => {
    it('maps combi dhwType to on_demand architecture', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      expect(input.dhw?.architecture).toBe('on_demand');
    });

    it('maps mixergy dhwType to stored_mixergy architecture', () => {
      const property: AtlasPropertyV1 = {
        ...BASE_PROPERTY,
        currentSystem: { ...BASE_PROPERTY.currentSystem, dhwType: fv('mixergy') },
      };
      const input = atlasPropertyToEngineInput(property);
      expect(input.dhw?.architecture).toBe('stored_mixergy');
    });

    it('maps vented_cylinder dhwType to stored_standard architecture', () => {
      const property: AtlasPropertyV1 = {
        ...BASE_PROPERTY,
        currentSystem: { ...BASE_PROPERTY.currentSystem, dhwType: fv('vented_cylinder') },
      };
      const input = atlasPropertyToEngineInput(property);
      expect(input.dhw?.architecture).toBe('stored_standard');
    });
  });

  describe('heat loss', () => {
    it('converts peakWatts to peakHeatLossKw', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      // 8500 W → 8.5 kW
      expect(input.property?.peakHeatLossKw).toBeCloseTo(8.5);
    });
  });

  describe('hydraulics', () => {
    it('maps dynamicPressureBar to dynamicMainsPressure and dynamicMainsPressureBar', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      expect(input.dynamicMainsPressure).toBe(2.5);
      expect(input.dynamicMainsPressureBar).toBe(2.5);
    });

    it('maps mainsFlowLpm to mainsDynamicFlowLpm', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      expect(input.mainsDynamicFlowLpm).toBe(18);
    });
  });

  describe('current system', () => {
    it('maps combi family to combi boiler type', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      expect(input.currentSystem?.boiler?.type).toBe('combi');
    });

    it('derives ageYears from installYear', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      const expected = new Date().getFullYear() - 2016;
      expect(input.currentSystem?.boiler?.ageYears).toBe(expected);
    });

    it('maps ratedOutputKw to nominalOutputKw', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      expect(input.currentSystem?.boiler?.nominalOutputKw).toBe(30);
    });
  });

  describe('infrastructure', () => {
    it('maps 22mm pipe diameter to primaryPipeSizeMm', () => {
      const input = atlasPropertyToEngineInput(BASE_PROPERTY);
      expect(input.infrastructure?.primaryPipeSizeMm).toBe(22);
    });

    it('omits infrastructure when pipe size is not a canonical value', () => {
      const property: AtlasPropertyV1 = {
        ...BASE_PROPERTY,
        currentSystem: {
          ...BASE_PROPERTY.currentSystem,
          distribution: {
            dominantPipeDiameterMm: fv(20),
          },
        },
      };
      const input = atlasPropertyToEngineInput(property);
      expect(input.infrastructure).toBeUndefined();
    });
  });
});
