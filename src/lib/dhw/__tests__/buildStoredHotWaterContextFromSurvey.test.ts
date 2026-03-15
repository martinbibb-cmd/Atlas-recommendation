/**
 * buildStoredHotWaterContextFromSurvey.test.ts
 *
 * Tests for the canonical DHW truth adapter that bridges FullSurveyModelV1
 * into StoredHotWaterContext for use by the simulator, compare mode, and
 * report adapters.
 *
 * Acceptance criteria covered:
 *   - survey current cylinder state maps into DHW truth context
 *   - vented low-head scenario → storageType='vented', cwsHeadMetres set
 *   - unvented poor mains scenario → storageType='unvented', mainsFlowLpm set or null
 *   - undersized cylinder → cylinderVolumeLitres captured
 *   - Mixergy remains distinct from generic cylinder logic (storageType='mixergy')
 *   - known mains inputs remove bogus 'missing' outcomes (hasEnoughDataForSuitability)
 *   - gas supply does NOT appear as a factor in this workflow
 *   - compare mode receives correct current/proposed stored hot water contexts
 */

import { describe, it, expect } from 'vitest';
import { buildStoredHotWaterContextFromSurvey } from '../buildStoredHotWaterContextFromSurvey';
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
};

// ─── storageType derivation ────────────────────────────────────────────────────

describe('buildStoredHotWaterContextFromSurvey — storageType derivation', () => {
  it('returns "none" when currentCylinderPresent is false', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      currentCylinderPresent: false,
    });
    expect(ctx.storageType).toBe('none');
  });

  it('uses dhwStorageType engine field when set (takes precedence)', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'unvented',
    });
    expect(ctx.storageType).toBe('unvented');
  });

  it('dhwStorageType "mixergy" is preserved (not collapsed to unvented)', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'mixergy',
    });
    expect(ctx.storageType).toBe('mixergy');
  });

  it('maps currentCylinderType "vented" from fullSurvey.dhwCondition → storageType "vented"', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      fullSurvey: { dhwCondition: { currentCylinderType: 'vented' } },
    } as FullSurveyModelV1);
    expect(ctx.storageType).toBe('vented');
  });

  it('maps currentCylinderType "unvented" from fullSurvey.dhwCondition → storageType "unvented"', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      fullSurvey: { dhwCondition: { currentCylinderType: 'unvented' } },
    } as FullSurveyModelV1);
    expect(ctx.storageType).toBe('unvented');
  });

  it('maps currentCylinderType "mixergy" from fullSurvey.dhwCondition → storageType "mixergy" (distinct path)', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      fullSurvey: { dhwCondition: { currentCylinderType: 'mixergy' } },
    } as FullSurveyModelV1);
    expect(ctx.storageType).toBe('mixergy');
  });

  it('maps dhwStorageRegime "heat_pump_cylinder" → storageType "heat_pump_cylinder"', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageRegime: 'heat_pump_cylinder',
    });
    expect(ctx.storageType).toBe('heat_pump_cylinder');
  });

  it('infers "none" from currentHeatSourceType "combi" (no cylinder in combi system)', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      currentHeatSourceType: 'combi',
    } as unknown as FullSurveyModelV1);
    expect(ctx.storageType).toBe('none');
  });

  it('infers "vented" from currentHeatSourceType "regular"', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      currentHeatSourceType: 'regular',
    } as unknown as FullSurveyModelV1);
    expect(ctx.storageType).toBe('vented');
  });

  it('infers "heat_pump_cylinder" from currentHeatSourceType "ashp"', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      currentHeatSourceType: 'ashp',
    } as unknown as FullSurveyModelV1);
    expect(ctx.storageType).toBe('heat_pump_cylinder');
  });

  it('infers "unvented" from currentHeatSourceType "system" (modern default)', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      currentHeatSourceType: 'system',
    } as unknown as FullSurveyModelV1);
    expect(ctx.storageType).toBe('unvented');
  });

  it('infers "unvented" from currentHeatSourceType "system" + stainless_unvented material', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      currentHeatSourceType: 'system',
      fullSurvey: { dhwCondition: { cylinderMaterial: 'stainless_unvented' } },
    } as FullSurveyModelV1);
    expect(ctx.storageType).toBe('unvented');
  });

  it('infers "vented" from currentHeatSourceType "system" + copper_vented material', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      currentHeatSourceType: 'system',
      fullSurvey: { dhwCondition: { cylinderMaterial: 'copper_vented' } },
    } as FullSurveyModelV1);
    expect(ctx.storageType).toBe('vented');
  });

  it('dhwStorageType takes precedence over currentHeatSourceType inference', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      currentHeatSourceType: 'combi',
      dhwStorageType: 'unvented',
    } as unknown as FullSurveyModelV1);
    expect(ctx.storageType).toBe('unvented');
  });

  it('currentCylinderPresent=false takes precedence over all other fields', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      currentCylinderPresent: false,
      dhwStorageType: 'unvented',
      currentHeatSourceType: 'system',
    } as unknown as FullSurveyModelV1);
    expect(ctx.storageType).toBe('none');
  });
});

// ─── cylinderVolumeLitres resolution ──────────────────────────────────────────

describe('buildStoredHotWaterContextFromSurvey — cylinderVolumeLitres', () => {
  it('returns engine-level cylinderVolumeLitres when set', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      cylinderVolumeLitres: 180,
    });
    expect(ctx.cylinderVolumeLitres).toBe(180);
  });

  it('falls back to fullSurvey.dhwCondition.currentCylinderVolumeLitres', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      fullSurvey: { dhwCondition: { currentCylinderVolumeLitres: 117 } },
    } as FullSurveyModelV1);
    expect(ctx.cylinderVolumeLitres).toBe(117);
  });

  it('returns null when volume is "unknown" sentinel in survey', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      fullSurvey: { dhwCondition: { currentCylinderVolumeLitres: 'unknown' } },
    } as FullSurveyModelV1);
    expect(ctx.cylinderVolumeLitres).toBeNull();
  });

  it('engine-level cylinderVolumeLitres takes precedence over survey diagnostic', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      cylinderVolumeLitres: 210,
      fullSurvey: { dhwCondition: { currentCylinderVolumeLitres: 117 } },
    } as FullSurveyModelV1);
    expect(ctx.cylinderVolumeLitres).toBe(210);
  });

  it('returns null when no volume is available', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({ ...baseSurvey });
    expect(ctx.cylinderVolumeLitres).toBeNull();
  });
});

// ─── cwsHeadMetres resolution ─────────────────────────────────────────────────

describe('buildStoredHotWaterContextFromSurvey — cwsHeadMetres', () => {
  it('returns engine-level cwsHeadMetres when set', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      cwsHeadMetres: 1.2,
    });
    expect(ctx.cwsHeadMetres).toBe(1.2);
  });

  it('falls back to fullSurvey.dhwCondition.currentCwsHeadMetres', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      fullSurvey: { dhwCondition: { currentCwsHeadMetres: 0.8 } },
    } as FullSurveyModelV1);
    expect(ctx.cwsHeadMetres).toBe(0.8);
  });

  it('returns null when currentCwsHeadMetres is "unknown" sentinel', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      fullSurvey: { dhwCondition: { currentCwsHeadMetres: 'unknown' } },
    } as FullSurveyModelV1);
    expect(ctx.cwsHeadMetres).toBeNull();
  });

  it('engine-level cwsHeadMetres takes precedence over survey diagnostic', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      cwsHeadMetres: 2.0,
      fullSurvey: { dhwCondition: { currentCwsHeadMetres: 0.4 } },
    } as FullSurveyModelV1);
    expect(ctx.cwsHeadMetres).toBe(2.0);
  });

  it('returns null when no head data is available', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({ ...baseSurvey });
    expect(ctx.cwsHeadMetres).toBeNull();
  });
});

// ─── mains pressure resolution ────────────────────────────────────────────────

describe('buildStoredHotWaterContextFromSurvey — mainsDynamicPressureBar', () => {
  it('returns dynamic pressure when available', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dynamicMainsPressure: 2.0,
    });
    expect(ctx.mainsDynamicPressureBar).toBe(2.0);
  });

  it('prefers dynamicMainsPressureBar alias over legacy dynamicMainsPressure', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dynamicMainsPressure: 0.5,
      dynamicMainsPressureBar: 2.5,
    });
    expect(ctx.mainsDynamicPressureBar).toBe(2.5);
  });

  it('returns null when mainsPressureRecorded is false (flow-only test)', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dynamicMainsPressure: 2.5,
      mainsPressureRecorded: false,
    });
    expect(ctx.mainsDynamicPressureBar).toBeNull();
  });

  it('returns null when pressure is zero or absent', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dynamicMainsPressure: 0,
    });
    expect(ctx.mainsDynamicPressureBar).toBeNull();
  });
});

// ─── mains flow resolution ────────────────────────────────────────────────────

describe('buildStoredHotWaterContextFromSurvey — mainsFlowLpm', () => {
  it('returns flow when mainsDynamicFlowLpmKnown is true', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      mainsDynamicFlowLpm: 22,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(ctx.mainsFlowLpm).toBe(22);
  });

  it('returns null when mainsDynamicFlowLpmKnown is false (unconfirmed estimate)', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      mainsDynamicFlowLpm: 22,
      mainsDynamicFlowLpmKnown: false,
    });
    expect(ctx.mainsFlowLpm).toBeNull();
  });

  it('returns null when mainsDynamicFlowLpmKnown is absent', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      mainsDynamicFlowLpm: 22,
    });
    expect(ctx.mainsFlowLpm).toBeNull();
  });

  it('returns null when flow is zero even with known flag', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      mainsDynamicFlowLpm: 0,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(ctx.mainsFlowLpm).toBeNull();
  });
});

// ─── storedWaterTempC ─────────────────────────────────────────────────────────

describe('buildStoredHotWaterContextFromSurvey — storedWaterTempC', () => {
  it('returns storeTempC when set', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      storeTempC: 65,
    });
    expect(ctx.storedWaterTempC).toBe(65);
  });

  it('returns null when storeTempC is not set', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({ ...baseSurvey });
    expect(ctx.storedWaterTempC).toBeNull();
  });
});

// ─── hasEnoughDataForSuitability ─────────────────────────────────────────────

describe('buildStoredHotWaterContextFromSurvey — hasEnoughDataForSuitability', () => {
  // Vented: gravity supply — no pressure/flow data needed
  it('vented system → hasEnoughDataForSuitability is true (gravity supply, no flow data needed)', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'vented',
    });
    expect(ctx.hasEnoughDataForSuitability).toBe(true);
  });

  it('vented system without cwsHeadMetres → still hasEnoughDataForSuitability (head helps but not required)', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'vented',
      // no cwsHeadMetres
    });
    expect(ctx.hasEnoughDataForSuitability).toBe(true);
  });

  // Unvented: confirmed mains flow required
  it('unvented with confirmed mains flow → hasEnoughDataForSuitability is true', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'unvented',
      mainsDynamicFlowLpm: 25,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(ctx.hasEnoughDataForSuitability).toBe(true);
  });

  it('unvented without confirmed mains flow → hasEnoughDataForSuitability is false', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'unvented',
      // no confirmed flow
    });
    expect(ctx.hasEnoughDataForSuitability).toBe(false);
  });

  it('unvented with unconfirmed flow (known=false) → hasEnoughDataForSuitability is false', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'unvented',
      mainsDynamicFlowLpm: 22,
      mainsDynamicFlowLpmKnown: false,
    });
    expect(ctx.hasEnoughDataForSuitability).toBe(false);
  });

  // Mixergy: same as unvented (mains-pressure supply)
  it('mixergy with confirmed mains flow → hasEnoughDataForSuitability is true', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'mixergy',
      mainsDynamicFlowLpm: 20,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(ctx.hasEnoughDataForSuitability).toBe(true);
  });

  it('mixergy without confirmed mains flow → hasEnoughDataForSuitability is false', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'mixergy',
    });
    expect(ctx.hasEnoughDataForSuitability).toBe(false);
  });

  // Heat pump cylinder: COP penalty always applies
  it('heat_pump_cylinder → hasEnoughDataForSuitability is true (COP penalty unconditional)', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageRegime: 'heat_pump_cylinder',
    });
    expect(ctx.hasEnoughDataForSuitability).toBe(true);
  });

  // None: no cylinder to evaluate
  it('storageType "none" → hasEnoughDataForSuitability is false', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      currentCylinderPresent: false,
    });
    expect(ctx.hasEnoughDataForSuitability).toBe(false);
  });

  // Known mains data should remove bogus "missing" outcomes
  it('entering mains flow removes "insufficient data" for unvented — known inputs are consumed', () => {
    const withoutFlow = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'unvented',
    });
    const withFlow = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'unvented',
      mainsDynamicFlowLpm: 30,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(withoutFlow.hasEnoughDataForSuitability).toBe(false);
    expect(withFlow.hasEnoughDataForSuitability).toBe(true);
  });
});

// ─── Full scenario tests (acceptance criteria) ────────────────────────────────

describe('buildStoredHotWaterContextFromSurvey — full scenarios', () => {
  // Acceptance: vented low-head scenario judged as head-limited input data
  it('vented low-head scenario: storageType vented, cwsHeadMetres 0.2, hasEnough=true', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      coldWaterSource: 'loft_tank',
      dhwStorageType: 'vented',
      cwsHeadMetres: 0.2,
    });
    expect(ctx.storageType).toBe('vented');
    expect(ctx.cwsHeadMetres).toBe(0.2);
    expect(ctx.hasEnoughDataForSuitability).toBe(true);
  });

  // Acceptance: unvented poor mains scenario judged as mains-limited input data
  it('unvented poor mains scenario: storageType unvented, mainsFlowLpm 8, mainsDynamicPressureBar 0.8, hasEnough=true', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      coldWaterSource: 'mains_true',
      dhwStorageType: 'unvented',
      mainsDynamicFlowLpm: 8,
      mainsDynamicFlowLpmKnown: true,
      dynamicMainsPressureBar: 0.8,
    });
    expect(ctx.storageType).toBe('unvented');
    expect(ctx.mainsFlowLpm).toBe(8);
    expect(ctx.mainsDynamicPressureBar).toBe(0.8);
    expect(ctx.hasEnoughDataForSuitability).toBe(true);
  });

  // Acceptance: undersized cylinder captured
  it('undersized cylinder scenario: cylinderVolumeLitres captured from survey diagnostic', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      fullSurvey: { dhwCondition: { currentCylinderVolumeLitres: 80, currentCylinderType: 'unvented' } },
      mainsDynamicFlowLpm: 25,
      mainsDynamicFlowLpmKnown: true,
    } as FullSurveyModelV1);
    expect(ctx.cylinderVolumeLitres).toBe(80);
    expect(ctx.storageType).toBe('unvented');
  });

  // Acceptance: Mixergy remains distinct from generic unvented
  it('Mixergy scenario: storageType is mixergy, not collapsed to unvented', () => {
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      fullSurvey: { dhwCondition: { currentCylinderType: 'mixergy' } },
      mainsDynamicFlowLpm: 20,
      mainsDynamicFlowLpmKnown: true,
    } as FullSurveyModelV1);
    expect(ctx.storageType).toBe('mixergy');
    expect(ctx.mainsFlowLpm).toBe(20);
    expect(ctx.hasEnoughDataForSuitability).toBe(true);
  });

  // Acceptance: gas supply does not appear as a factor
  it('gas supply fields do not affect DHW context (gas supply gating removed)', () => {
    // Even if we construct a survey with no gas-related confirmation, the DHW context
    // should evaluate correctly for a stored system
    const ctx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'vented',
      cylinderVolumeLitres: 150,
      // No gas supply confirmation field — gas is irrelevant in this path
    });
    expect(ctx.storageType).toBe('vented');
    expect(ctx.cylinderVolumeLitres).toBe(150);
    expect(ctx.hasEnoughDataForSuitability).toBe(true);
  });

  // Compare mode: current system vs proposed system receive distinct contexts
  it('compare mode: current vented vs proposed unvented produce distinct storageType values', () => {
    const currentCtx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'vented',
      cwsHeadMetres: 0.8,
    });
    const proposedCtx = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'unvented',
      mainsDynamicFlowLpm: 30,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(currentCtx.storageType).toBe('vented');
    expect(proposedCtx.storageType).toBe('unvented');
    expect(currentCtx.cwsHeadMetres).toBe(0.8);
    expect(proposedCtx.mainsFlowLpm).toBe(30);
  });

  // Compare mode: current undersized vs proposed larger cylinder shows thermal capacity difference
  it('compare mode: current smaller vs proposed larger cylinder captured correctly', () => {
    const current = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'unvented',
      cylinderVolumeLitres: 120,
      mainsDynamicFlowLpm: 25,
      mainsDynamicFlowLpmKnown: true,
    });
    const proposed = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'unvented',
      cylinderVolumeLitres: 210,
      mainsDynamicFlowLpm: 25,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(current.cylinderVolumeLitres).toBe(120);
    expect(proposed.cylinderVolumeLitres).toBe(210);
  });

  // Compare mode: Mixergy vs standard cylinder remain distinct
  it('compare mode: Mixergy vs standard cylinder remain distinct storage types', () => {
    const standard = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'unvented',
      mainsDynamicFlowLpm: 22,
      mainsDynamicFlowLpmKnown: true,
    });
    const mixergy = buildStoredHotWaterContextFromSurvey({
      ...baseSurvey,
      dhwStorageType: 'mixergy',
      mainsDynamicFlowLpm: 22,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(standard.storageType).toBe('unvented');
    expect(mixergy.storageType).toBe('mixergy');
  });
});
