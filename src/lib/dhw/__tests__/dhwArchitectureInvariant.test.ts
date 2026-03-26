/**
 * dhwArchitectureInvariant.test.ts
 *
 * Hard invariant tests for the DHW architecture split.
 *
 * These tests assert the architectural boundary:
 *   thermal_store must NEVER be processed by any function intended for
 *   potable stored hot water cylinders.
 *
 * Core invariants:
 *   1. buildDhwContextFromSurvey routes thermal_store to ThermalStoreContext
 *      (architecture discriminator is 'thermal_store')
 *   2. buildDhwContextFromSurvey never calls buildStoredHotWaterContextFromSurvey
 *      for thermal_store surveys (proven by absence of StoredHotWaterContext fields)
 *   3. buildStoredHotWaterContextFromSurvey with dhwStorageType='thermal_store'
 *      does NOT return storageType='thermal_store' (excluded from the potable-
 *      cylinder type union — it falls through to inference, returning a safe
 *      cylinder type derived from other survey fields)
 *   4. Standard cylinder surveys do NOT receive 'thermal_store' storageType
 *   5. detectDhwArchitecture correctly classifies all four architecture branches
 */

import { describe, it, expect } from 'vitest';
import {
  buildDhwContextFromSurvey,
  detectDhwArchitecture,
} from '../buildDhwContextFromSurvey';
import { buildStoredHotWaterContextFromSurvey } from '../buildStoredHotWaterContextFromSurvey';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseSurvey: EngineInputV2_3 = {
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
  preferCombi: false,
};

const thermalStoreSurvey: FullSurveyModelV1 = {
  ...baseSurvey,
  dhwStorageType: 'thermal_store',
};

const unventedSurvey: FullSurveyModelV1 = {
  ...baseSurvey,
  dhwStorageType: 'unvented',
};

const mixergySurvey: FullSurveyModelV1 = {
  ...baseSurvey,
  dhwStorageType: 'mixergy',
};

const combiSurvey: FullSurveyModelV1 = {
  ...baseSurvey,
  currentHeatSourceType: 'combi',
  dhwStorageType: 'none',
};

// ─── Invariant 1: thermal_store → ThermalStoreContext ─────────────────────────

describe('DHW Architecture Invariant — thermal_store routes to dedicated context', () => {
  it('buildDhwContextFromSurvey returns architecture="thermal_store" for thermal store survey', () => {
    const ctx = buildDhwContextFromSurvey(thermalStoreSurvey);
    expect(ctx.architecture).toBe('thermal_store');
  });

  it('buildDhwContextFromSurvey result has no storageType field (not a cylinder subtype)', () => {
    const ctx = buildDhwContextFromSurvey(thermalStoreSurvey);
    expect('storageType' in ctx).toBe(false);
  });

  it('buildDhwContextFromSurvey result has no cwsHeadMetres field (not potable water)', () => {
    const ctx = buildDhwContextFromSurvey(thermalStoreSurvey);
    expect('cwsHeadMetres' in ctx).toBe(false);
  });

  it('buildDhwContextFromSurvey result has no mainsDynamicPressureBar field (not potable water)', () => {
    const ctx = buildDhwContextFromSurvey(thermalStoreSurvey);
    expect('mainsDynamicPressureBar' in ctx).toBe(false);
  });

  it('buildDhwContextFromSurvey result has no mainsFlowLpm field (not potable water)', () => {
    const ctx = buildDhwContextFromSurvey(thermalStoreSurvey);
    expect('mainsFlowLpm' in ctx).toBe(false);
  });

  it('buildDhwContextFromSurvey result has no hasEnoughDataForSuitability field (not a cylinder)', () => {
    const ctx = buildDhwContextFromSurvey(thermalStoreSurvey);
    expect('hasEnoughDataForSuitability' in ctx).toBe(false);
  });
});

// ─── Invariant 2: buildStoredHotWaterContextFromSurvey never returns 'thermal_store' ──

describe('DHW Architecture Invariant — buildStoredHotWaterContextFromSurvey never returns thermal_store storageType', () => {
  it('when dhwStorageType is "thermal_store", storageType is NOT "thermal_store" (falls through to inference)', () => {
    // The function is for potable cylinders only; thermal_store is excluded and
    // falls through to heat-source inference.
    const ctx = buildStoredHotWaterContextFromSurvey(thermalStoreSurvey);
    expect(ctx.storageType).not.toBe('thermal_store');
  });

  it('storageType is always one of the potable-cylinder values', () => {
    const ctx = buildStoredHotWaterContextFromSurvey(thermalStoreSurvey);
    const validTypes = ['none', 'vented', 'unvented', 'mixergy', 'heat_pump_cylinder'] as const;
    expect(validTypes).toContain(ctx.storageType);
  });
});

// ─── Invariant 3: detectDhwArchitecture correctly classifies all architectures ──

describe('DHW Architecture Invariant — detectDhwArchitecture classification', () => {
  it('classifies thermal_store correctly', () => {
    expect(detectDhwArchitecture(thermalStoreSurvey)).toBe('thermal_store');
  });

  it('classifies unvented cylinder as standard_cylinder', () => {
    expect(detectDhwArchitecture(unventedSurvey)).toBe('standard_cylinder');
  });

  it('classifies mixergy as mixergy (not standard_cylinder)', () => {
    expect(detectDhwArchitecture(mixergySurvey)).toBe('mixergy');
  });

  it('classifies combi / no-cylinder as on_demand', () => {
    expect(detectDhwArchitecture(combiSurvey)).toBe('on_demand');
  });

  it('classifies currentCylinderPresent=false as on_demand', () => {
    expect(detectDhwArchitecture({ ...baseSurvey, currentCylinderPresent: false })).toBe('on_demand');
  });

  it('classifies vented as standard_cylinder', () => {
    expect(detectDhwArchitecture({ ...baseSurvey, dhwStorageType: 'vented' })).toBe('standard_cylinder');
  });

  it('classifies heat_pump_cylinder as standard_cylinder', () => {
    expect(detectDhwArchitecture({ ...baseSurvey, dhwStorageType: 'heat_pump_cylinder' })).toBe('standard_cylinder');
  });
});

// ─── Invariant 4: standard cylinder surveys never get thermal_store ───────────

describe('DHW Architecture Invariant — standard cylinder surveys produce correct architecture', () => {
  it('unvented survey → architecture is standard_cylinder', () => {
    const ctx = buildDhwContextFromSurvey(unventedSurvey);
    expect(ctx.architecture).toBe('standard_cylinder');
  });

  it('unvented survey → has storageType field (is a potable cylinder)', () => {
    const ctx = buildDhwContextFromSurvey(unventedSurvey);
    expect('storageType' in ctx).toBe(true);
  });

  it('unvented survey storageType is "unvented" (not thermal_store)', () => {
    const ctx = buildDhwContextFromSurvey(unventedSurvey);
    if (ctx.architecture === 'standard_cylinder') {
      expect(ctx.storageType).toBe('unvented');
    } else {
      throw new Error('Expected standard_cylinder architecture');
    }
  });
});

// ─── Invariant 5: mixergy surveys use cylinder builder but are distinct ────────

describe('DHW Architecture Invariant — mixergy uses cylinder builder with correct discriminator', () => {
  it('mixergy survey → architecture is mixergy', () => {
    const ctx = buildDhwContextFromSurvey(mixergySurvey);
    expect(ctx.architecture).toBe('mixergy');
  });

  it('mixergy survey → has storageType field (it IS a cylinder architecture)', () => {
    const ctx = buildDhwContextFromSurvey(mixergySurvey);
    expect('storageType' in ctx).toBe(true);
  });

  it('mixergy survey → architecture is NOT thermal_store', () => {
    const ctx = buildDhwContextFromSurvey(mixergySurvey);
    expect(ctx.architecture).not.toBe('thermal_store');
  });
});
