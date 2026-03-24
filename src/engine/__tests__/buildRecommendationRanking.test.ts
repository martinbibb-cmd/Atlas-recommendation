/**
 * buildRecommendationRanking.test.ts — PR12: trade-off tag helper tests.
 *
 * PR12 removed the legacy scoring adjustment functions
 * (computeSpaceRankingAdjustments, computeDisruptionRankingAdjustments,
 * computeMainsFlowRankingAdjustments) because they were replaced by the
 * evidence-backed recommendation engine (buildRecommendationsFromEvidence).
 *
 * This file now tests only the two trade-off tag helpers that remain in
 * buildRecommendationRanking.ts (used by buildAdviceFromCompare for the
 * simulator compare UI).
 */

import { describe, it, expect } from 'vitest';
import {
  deriveSpaceTradeOffTag,
  deriveDisruptionTradeOffTag,
} from '../buildRecommendationRanking';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

const baseInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
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

describe('deriveSpaceTradeOffTag', () => {
  it('returns null when spacePriority is low', () => {
    const tag = deriveSpaceTradeOffTag('combi', {
      ...baseInput,
      preferences: { spacePriority: 'low' },
    });
    expect(tag).toBeNull();
  });

  it('returns null when preferences absent', () => {
    expect(deriveSpaceTradeOffTag('combi', baseInput)).toBeNull();
  });

  it('returns space constrained tag for combi with high spacePriority', () => {
    const tag = deriveSpaceTradeOffTag('combi', {
      ...baseInput,
      preferences: { spacePriority: 'high' },
    });
    expect(tag).toBe('Space constrained — combi preferred');
  });

  it('returns high demand tag for stored system even with high spacePriority when occupancy >= 4', () => {
    const tag = deriveSpaceTradeOffTag('stored', {
      ...baseInput,
      occupancyCount: 4,
      preferences: { spacePriority: 'high' },
    });
    expect(tag).toBe('High demand — stored hot water required despite space impact');
  });

  it('returns space constrained tag for combi with medium spacePriority', () => {
    const tag = deriveSpaceTradeOffTag('combi', {
      ...baseInput,
      preferences: { spacePriority: 'medium' },
    });
    expect(tag).toBe('Space constrained — combi preferred');
  });
});

describe('deriveDisruptionTradeOffTag', () => {
  it('returns null when disruptionTolerance is medium', () => {
    const tag = deriveDisruptionTradeOffTag('heat_pump', {
      ...baseInput,
      preferences: { disruptionTolerance: 'medium' },
    });
    expect(tag).toBeNull();
  });

  it('returns null when preferences absent', () => {
    expect(deriveDisruptionTradeOffTag('heat_pump', baseInput)).toBeNull();
  });

  it('returns low disruption tag for combi with low tolerance', () => {
    const tag = deriveDisruptionTradeOffTag('combi', {
      ...baseInput,
      preferences: { disruptionTolerance: 'low' },
    });
    expect(tag).toBe('Lower-disruption path preferred due to household installation tolerance');
  });

  it('returns low disruption tag for stored with low tolerance', () => {
    const tag = deriveDisruptionTradeOffTag('stored', {
      ...baseInput,
      preferences: { disruptionTolerance: 'low' },
    });
    expect(tag).toBe('Lower-disruption path preferred due to household installation tolerance');
  });

  it('returns high disruption tag for heat_pump with high tolerance', () => {
    const tag = deriveDisruptionTradeOffTag('heat_pump', {
      ...baseInput,
      preferences: { disruptionTolerance: 'high' },
    });
    expect(tag).toBe('Heat pump remains a strong option because major upgrade works are acceptable');
  });

  it('returns null for heat_pump with low disruption tolerance', () => {
    const tag = deriveDisruptionTradeOffTag('heat_pump', {
      ...baseInput,
      preferences: { disruptionTolerance: 'low' },
    });
    expect(tag).toBeNull();
  });
});
