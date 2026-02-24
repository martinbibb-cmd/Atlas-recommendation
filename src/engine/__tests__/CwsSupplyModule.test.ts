import { describe, it, expect } from 'vitest';
import { runCwsSupplyModuleV1 } from '../modules/CwsSupplyModule';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

/** Minimal valid EngineInputV2_3 stub for CWS tests. */
function baseInput(overrides: Partial<EngineInputV2_3> = {}): EngineInputV2_3 {
  return {
    postcode: 'SW1A 1AA',
    dynamicMainsPressure: 2.0,
    buildingMass: 'medium',
    primaryPipeDiameter: 22,
    heatLossWatts: 6000,
    radiatorCount: 8,
    hasLoftConversion: false,
    returnWaterTemp: 55,
    bathroomCount: 1,
    occupancySignature: 'steady_home',
    highOccupancy: false,
    preferCombi: false,
    ...overrides,
  };
}

describe('runCwsSupplyModuleV1', () => {
  // ── Dynamic pressure + flow only ────────────────────────────────────────────

  it('dynamic pressure + flow only → hasMeasurements true, limitation none, quality unknown (no static)', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 1.0, mainsDynamicFlowLpm: 12 })
    );
    expect(result.hasMeasurements).toBe(true);
    expect(result.limitation).toBe('none');
    expect(result.quality).toBe('unknown');
    expect(result.dynamic?.pressureBar).toBeCloseTo(1.0);
    expect(result.dynamic?.flowLpm).toBeCloseTo(12);
    expect(result.dropBar).toBeNull();
  });

  it('dynamic pressure + flow only → note mentions L/min @ bar', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 1.0, mainsDynamicFlowLpm: 12 })
    );
    expect(result.notes.some(n => n.includes('12.0 L/min @ 1.0 bar'))).toBe(true);
  });

  // ── Static + dynamic + flow → dropBar and quality ──────────────────────────

  it('static 3.2 bar + dynamic 2.0 bar + flow → dropBar 1.2, quality weak', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        staticMainsPressureBar: 3.2,
        dynamicMainsPressure: 2.0,
        mainsDynamicFlowLpm: 10,
      })
    );
    expect(result.hasMeasurements).toBe(true);
    expect(result.dropBar).toBeCloseTo(1.2);
    expect(result.quality).toBe('weak');
    expect(result.static?.pressureBar).toBeCloseTo(3.2);
  });

  it('static 3.5 bar + dynamic 3.2 bar + flow → dropBar 0.3, quality strong', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        staticMainsPressureBar: 3.5,
        dynamicMainsPressure: 3.2,
        mainsDynamicFlowLpm: 14,
      })
    );
    expect(result.dropBar).toBeCloseTo(0.3);
    expect(result.quality).toBe('strong');
  });

  it('static 3.5 bar + dynamic 2.7 bar + flow → dropBar 0.8, quality moderate', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        staticMainsPressureBar: 3.5,
        dynamicMainsPressure: 2.7,
        mainsDynamicFlowLpm: 10,
      })
    );
    expect(result.dropBar).toBeCloseTo(0.8);
    expect(result.quality).toBe('moderate');
  });

  it('static + dynamic + flow → pressure bullet contains drop info', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        staticMainsPressureBar: 3.2,
        dynamicMainsPressure: 2.0,
        mainsDynamicFlowLpm: 10,
      })
    );
    expect(result.notes.some(n => n.includes('3.2 →') && n.includes('drop'))).toBe(true);
  });

  // ── Dynamic pressure only (no flow) ─────────────────────────────────────────

  it('dynamic pressure only (no flow) → hasMeasurements false, limitation unknown', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 2.0 })
    );
    expect(result.hasMeasurements).toBe(false);
    expect(result.limitation).toBe('unknown');
    expect(result.quality).toBe('unknown');
    expect(result.dropBar).toBeNull();
  });

  it('dynamic pressure only → note says add L/min @ bar to judge stability', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 2.0 })
    );
    expect(result.notes.some(n => n.includes('2.0 bar') && n.includes('L/min @ bar'))).toBe(true);
  });

  // ── deliveryMode electric_cold_only ─────────────────────────────────────────

  it('deliveryMode electric_cold_only → notes mention electric shower and independent of cylinder', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 2.0,
        mainsDynamicFlowLpm: 8,
        dhwDeliveryMode: 'electric_cold_only',
      })
    );
    expect(
      result.notes.some(n => n.toLowerCase().includes('electric shower') && n.toLowerCase().includes('cylinder'))
    ).toBe(true);
  });

  it('deliveryMode gravity → notes mention gravity-fed and not mains', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 1.5,
        mainsDynamicFlowLpm: 9,
        dhwDeliveryMode: 'gravity',
      })
    );
    expect(result.notes.some(n => n.includes('Gravity-fed'))).toBe(true);
    expect(result.notes.some(n => n.includes('not mains'))).toBe(true);
  });

  // ── deliveryMode pumped ──────────────────────────────────────────────────────

  it('deliveryMode pumped → notes mention "Pumped shower" and "not mains"', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 1.5,
        mainsDynamicFlowLpm: 9,
        dhwDeliveryMode: 'pumped',
      })
    );
    expect(result.notes.some(n => n.includes('Pumped shower'))).toBe(true);
    expect(result.notes.some(n => n.includes('not mains'))).toBe(true);
  });

  it('deliveryMode tank_pumped → same note as pumped (legacy alias)', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 1.5,
        mainsDynamicFlowLpm: 9,
        dhwDeliveryMode: 'tank_pumped',
      })
    );
    expect(result.notes.some(n => n.includes('Pumped shower'))).toBe(true);
    expect(result.notes.some(n => n.includes('not mains'))).toBe(true);
  });

  it('deliveryMode pumped_from_tank → notes mention "Pumped shower" and "not mains"', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 1.5,
        mainsDynamicFlowLpm: 9,
        dhwDeliveryMode: 'pumped_from_tank',
      })
    );
    expect(result.notes.some(n => n.includes('Pumped shower'))).toBe(true);
    expect(result.notes.some(n => n.includes('not mains'))).toBe(true);
  });

  // ── deliveryMode mains_mixer ─────────────────────────────────────────────────

  it('deliveryMode mains_mixer → notes mention "Mixer (mains-fed)"', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 2.0,
        mainsDynamicFlowLpm: 12,
        dhwDeliveryMode: 'mains_mixer',
      })
    );
    expect(result.notes.some(n => n.includes('Mixer (mains-fed)'))).toBe(true);
    expect(result.notes.some(n => n.includes('mains flow/pressure under load'))).toBe(true);
  });

  it('deliveryMode mains_mixer → no mention of "power shower"', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 2.0,
        mainsDynamicFlowLpm: 12,
        dhwDeliveryMode: 'mains_mixer',
      })
    );
    expect(result.notes.every(n => !n.toLowerCase().includes('power shower'))).toBe(true);
  });

  // ── deliveryMode accumulator_supported ───────────────────────────────────────

  it('deliveryMode accumulator_supported → notes mention accumulator and mains supply', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 2.0,
        mainsDynamicFlowLpm: 12,
        dhwDeliveryMode: 'accumulator_supported',
      })
    );
    expect(result.notes.some(n => n.includes('Accumulator') && n.includes('mains supply'))).toBe(true);
  });

  // ── deliveryMode break_tank_booster ──────────────────────────────────────────

  it('deliveryMode break_tank_booster → notes mention break tank and mains refills', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 2.0,
        mainsDynamicFlowLpm: 12,
        dhwDeliveryMode: 'break_tank_booster',
      })
    );
    expect(result.notes.some(n => n.includes('Break tank') && n.includes('mains only refills'))).toBe(true);
  });

  // ── coldWaterSource passthrough ──────────────────────────────────────────────

  it('coldWaterSource loft_tank → source reflected in result', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ coldWaterSource: 'loft_tank', dynamicMainsPressure: 0.5 })
    );
    expect(result.source).toBe('loft_tank');
  });

  it('no coldWaterSource → defaults to unknown', () => {
    const result = runCwsSupplyModuleV1(baseInput());
    expect(result.source).toBe('unknown');
  });

  // ── dynamicMainsPressureBar alias ───────────────────────────────────────────

  it('dynamicMainsPressureBar alias is used when present', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 1.0,
        dynamicMainsPressureBar: 2.5,
        mainsDynamicFlowLpm: 10,
      })
    );
    expect(result.dynamic?.pressureBar).toBeCloseTo(2.5);
    expect(result.notes.some(n => n.includes('2.5 bar'))).toBe(true);
  });
});
