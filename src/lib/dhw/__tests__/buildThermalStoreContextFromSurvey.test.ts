/**
 * buildThermalStoreContextFromSurvey.test.ts
 *
 * Tests for the dedicated thermal store context builder.
 *
 * Acceptance criteria:
 *   1. Returns architecture: 'thermal_store' discriminator always
 *   2. primaryStoreTempC comes from survey.storeTempC
 *   3. storeVolumeLitres comes from survey.cylinderVolumeLitres
 *   4. Both fields are null when not supplied
 *   5. ThermalStoreContext has no cylinder pressure/flow fields
 *      (mains pressure / CWS head are not applicable to thermal stores)
 */

import { describe, it, expect } from 'vitest';
import { buildThermalStoreContextFromSurvey } from '../buildThermalStoreContextFromSurvey';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Minimal base survey ──────────────────────────────────────────────────────

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
  dhwStorageType: 'thermal_store',
};

// ─── architecture discriminator ───────────────────────────────────────────────

describe('buildThermalStoreContextFromSurvey — architecture discriminator', () => {
  it('always returns architecture: "thermal_store"', () => {
    const ctx = buildThermalStoreContextFromSurvey({ ...baseSurvey } as FullSurveyModelV1);
    expect(ctx.architecture).toBe('thermal_store');
  });
});

// ─── primaryStoreTempC ────────────────────────────────────────────────────────

describe('buildThermalStoreContextFromSurvey — primaryStoreTempC', () => {
  it('returns storeTempC when set', () => {
    const ctx = buildThermalStoreContextFromSurvey({
      ...baseSurvey,
      storeTempC: 80,
    } as FullSurveyModelV1);
    expect(ctx.primaryStoreTempC).toBe(80);
  });

  it('returns null when storeTempC is not set', () => {
    const ctx = buildThermalStoreContextFromSurvey({ ...baseSurvey } as FullSurveyModelV1);
    expect(ctx.primaryStoreTempC).toBeNull();
  });
});

// ─── storeVolumeLitres ────────────────────────────────────────────────────────

describe('buildThermalStoreContextFromSurvey — storeVolumeLitres', () => {
  it('returns cylinderVolumeLitres when set', () => {
    const ctx = buildThermalStoreContextFromSurvey({
      ...baseSurvey,
      cylinderVolumeLitres: 210,
    } as FullSurveyModelV1);
    expect(ctx.storeVolumeLitres).toBe(210);
  });

  it('returns null when cylinderVolumeLitres is not set', () => {
    const ctx = buildThermalStoreContextFromSurvey({ ...baseSurvey } as FullSurveyModelV1);
    expect(ctx.storeVolumeLitres).toBeNull();
  });
});

// ─── no potable-water fields ──────────────────────────────────────────────────

describe('buildThermalStoreContextFromSurvey — no potable-water fields', () => {
  it('does not have cwsHeadMetres (not applicable to thermal stores)', () => {
    const ctx = buildThermalStoreContextFromSurvey({ ...baseSurvey } as FullSurveyModelV1);
    expect('cwsHeadMetres' in ctx).toBe(false);
  });

  it('does not have mainsDynamicPressureBar (not applicable to thermal stores)', () => {
    const ctx = buildThermalStoreContextFromSurvey({ ...baseSurvey } as FullSurveyModelV1);
    expect('mainsDynamicPressureBar' in ctx).toBe(false);
  });

  it('does not have mainsFlowLpm (not applicable to thermal stores)', () => {
    const ctx = buildThermalStoreContextFromSurvey({ ...baseSurvey } as FullSurveyModelV1);
    expect('mainsFlowLpm' in ctx).toBe(false);
  });

  it('does not have storageType (thermal stores are not a subtype of stored hot water)', () => {
    const ctx = buildThermalStoreContextFromSurvey({ ...baseSurvey } as FullSurveyModelV1);
    expect('storageType' in ctx).toBe(false);
  });
});
