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

  it('dynamic pressure + flow only → hasMeasurements true, limitation none, no inconsistency (no static)', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 1.0, mainsDynamicFlowLpm: 12 })
    );
    expect(result.hasMeasurements).toBe(true);
    expect(result.limitation).toBe('none');
    expect(result.inconsistent).toBe(false);
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

  // ── Flow-only (pressure not recorded — mainsPressureRecorded: false) ─────────

  it('flow-only, pressure not recorded (12 L/min) → meetsUnventedRequirement true', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ mainsPressureRecorded: false, mainsDynamicFlowLpm: 12 })
    );
    expect(result.meetsUnventedRequirement).toBe(true);
    expect(result.hasMeasurements).toBe(true);
    expect(result.hasDynOpPoint).toBe(false); // no pressure → no operating point
  });

  it('flow-only, pressure not recorded (11 L/min) → meetsUnventedRequirement false (needs >= 12)', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ mainsPressureRecorded: false, mainsDynamicFlowLpm: 11 })
    );
    expect(result.meetsUnventedRequirement).toBe(false);
  });

  it('flow-only, pressure not recorded → note says "pressure not recorded"', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ mainsPressureRecorded: false, mainsDynamicFlowLpm: 14 })
    );
    expect(result.notes.some(n => n.includes('pressure not recorded'))).toBe(true);
  });

  it('flow at 0 bar (explicitly entered) → does NOT meet unvented requirement', () => {
    // 0 bar is a real entered value — it fails the ≥1.0 bar gate and is not "pressure not recorded"
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 0, dynamicMainsPressureBar: 0, mainsDynamicFlowLpm: 12 })
    );
    expect(result.meetsUnventedRequirement).toBe(false);
  });

  it('flow at 0 bar → hasMeasurements true, hasDynOpPoint true (pressure IS recorded as 0)', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 0, dynamicMainsPressureBar: 0, mainsDynamicFlowLpm: 14 })
    );
    expect(result.hasMeasurements).toBe(true);
    expect(result.hasDynOpPoint).toBe(true);
    expect(result.inconsistent).toBe(false);
  });

  // ── Unvented eligibility gate: 10 L/min @ ≥ 1.0 bar OR 12 L/min with pressure not recorded ─

  it('10 L/min @ 1.0 bar → meets unvented requirement', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 1.0, mainsDynamicFlowLpm: 10 })
    );
    expect(result.meetsUnventedRequirement).toBe(true);
  });

  it('9 L/min @ 1.0 bar → does NOT meet unvented requirement', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 1.0, mainsDynamicFlowLpm: 9 })
    );
    expect(result.meetsUnventedRequirement).toBe(false);
  });

  it('10 L/min @ 0.9 bar → does NOT meet unvented requirement (pressure below 1.0 bar)', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 0.9, mainsDynamicFlowLpm: 10 })
    );
    expect(result.meetsUnventedRequirement).toBe(false);
  });

  // ── Static + dynamic + flow → dropBar computed ──────────────────────────────

  it('static 3.2 bar + dynamic 2.0 bar + flow → dropBar 1.2, no inconsistency', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        staticMainsPressureBar: 3.2,
        dynamicMainsPressure: 2.0,
        mainsDynamicFlowLpm: 10,
      })
    );
    expect(result.hasMeasurements).toBe(true);
    expect(result.dropBar).toBeCloseTo(1.2);
    expect(result.inconsistent).toBe(false);
    expect(result.static?.pressureBar).toBeCloseTo(3.2);
  });

  it('static 3.5 bar + dynamic 3.2 bar + flow → dropBar 0.3', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        staticMainsPressureBar: 3.5,
        dynamicMainsPressure: 3.2,
        mainsDynamicFlowLpm: 14,
      })
    );
    expect(result.dropBar).toBeCloseTo(0.3);
    expect(result.inconsistent).toBe(false);
  });

  it('static 3.5 bar + dynamic 2.7 bar + flow → dropBar 0.8', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        staticMainsPressureBar: 3.5,
        dynamicMainsPressure: 2.7,
        mainsDynamicFlowLpm: 10,
      })
    );
    expect(result.dropBar).toBeCloseTo(0.8);
    expect(result.inconsistent).toBe(false);
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

  // ── Inconsistency: dynamic > static + 0.2 ───────────────────────────────────

  it('dynamic > static + 0.2 → inconsistent true, dropBar null, warning note prepended', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        staticMainsPressureBar: 2.0,
        dynamicMainsPressure: 3.0, // 3.0 > 2.0 + 0.2 → inconsistent
        mainsDynamicFlowLpm: 10,
      })
    );
    expect(result.inconsistent).toBe(true);
    expect(result.dropBar).toBeNull();
    expect(result.meetsUnventedRequirement).toBe(false);
    expect(result.notes[0]).toContain('inconsistent');
  });

  // ── Dynamic pressure only (no flow) ─────────────────────────────────────────

  it('dynamic pressure only (no flow) → hasMeasurements false, hasDynOpPoint false', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 2.0 })
    );
    expect(result.hasMeasurements).toBe(false);
    expect(result.hasDynOpPoint).toBe(false);
    expect(result.limitation).toBe('unknown');
    expect(result.inconsistent).toBe(false);
    expect(result.meetsUnventedRequirement).toBe(false);
    expect(result.dropBar).toBeNull();
  });

  it('dynamic pressure only → note says add L/min @ bar to judge stability', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 2.0 })
    );
    expect(result.notes.some(n => n.includes('2.0 bar') && n.includes('L/min @ bar'))).toBe(true);
  });

  // ── Dynamic flow = 0 → treated as absent ────────────────────────────────────

  it('dynamic flow = 0 → hasMeasurements false (flow treated as absent)', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 3.0, mainsDynamicFlowLpm: 0 })
    );
    expect(result.hasMeasurements).toBe(false);
    expect(result.hasDynOpPoint).toBe(false);
    expect(result.limitation).toBe('unknown');
  });

  it('dynamic flow = 0 → note includes "L/min @ bar" (pressure-only branch)', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 3.0, mainsDynamicFlowLpm: 0 })
    );
    expect(result.notes.some(n => n.includes('L/min @ bar'))).toBe(true);
  });

  it('dynamic pressure >= 1.5 but no flow → hasMeasurements false, note includes "L/min @ bar"', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({ dynamicMainsPressure: 2.0 })
    );
    expect(result.hasMeasurements).toBe(false);
    expect(result.notes.some(n => n.includes('L/min @ bar'))).toBe(true);
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

  it('deliveryMode pumped → notes mention "Power shower (pump from tank)" and "not mains"', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 1.5,
        mainsDynamicFlowLpm: 9,
        dhwDeliveryMode: 'pumped',
      })
    );
    expect(result.notes.some(n => n.includes('Power shower (pump from tank)'))).toBe(true);
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
    expect(result.notes.some(n => n.includes('Power shower (pump from tank)'))).toBe(true);
    expect(result.notes.some(n => n.includes('not mains'))).toBe(true);
  });

  it('deliveryMode pumped_from_tank → notes mention "Power shower (pump from tank)" and "not mains"', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 1.5,
        mainsDynamicFlowLpm: 9,
        dhwDeliveryMode: 'pumped_from_tank',
      })
    );
    expect(result.notes.some(n => n.includes('Power shower (pump from tank)'))).toBe(true);
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

  it('deliveryMode accumulator_supported → notes mention "Cannot increase mains supply", accumulator and mains supply', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 2.0,
        mainsDynamicFlowLpm: 12,
        dhwDeliveryMode: 'accumulator_supported',
      })
    );
    expect(result.notes.some(n => n.includes('Cannot increase mains supply'))).toBe(true);
    expect(result.notes.some(n => n.includes('Accumulator') && n.includes('mains supply'))).toBe(true);
  });

  // ── deliveryMode break_tank_booster ──────────────────────────────────────────

  it('deliveryMode break_tank_booster → notes mention "Cannot increase mains supply", break tank and mains refills', () => {
    const result = runCwsSupplyModuleV1(
      baseInput({
        dynamicMainsPressure: 2.0,
        mainsDynamicFlowLpm: 12,
        dhwDeliveryMode: 'break_tank_booster',
      })
    );
    expect(result.notes.some(n => n.includes('Cannot increase mains supply'))).toBe(true);
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
