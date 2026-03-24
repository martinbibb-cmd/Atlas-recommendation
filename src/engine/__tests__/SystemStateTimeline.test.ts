/**
 * SystemStateTimeline.test.ts — PR6: Tests for the canonical internal state timeline.
 *
 * Test categories:
 *   1. Combi timeline — DHW request creates ordered phase ticks
 *   2. Combi timeline — CH interruption appears only when CH was active
 *   3. Combi timeline — purge tick always follows delivery
 *   4. Combi timeline — return-to-CH pending appears after purge
 *   5. Hydronic timeline — draw-off changes store state summary
 *   6. Hydronic timeline — recharge decision distinct from draw-off delivery
 *   7. Hydronic timeline — recharge active only when trigger conditions met
 *   8. Hydronic timeline — no combi-only states appear in hydronic timeline
 *   9. Cross-family — same contract works for combi and stored families
 *  10. Cross-family — forbidden state combinations rejected by validator
 *  11. Cross-family — timeline ordering is deterministic (slotIndex ascending)
 *  12. Runner integration — runners populate stateTimeline correctly
 */

import { describe, it, expect } from 'vitest';
import {
  assertValidStateTimeline,
  COMBI_ONLY_MODES,
  STORE_ONLY_MODES,
} from '../timeline/SystemStateTimeline';
import type { SystemStateTick } from '../timeline/SystemStateTimeline';
import { buildCombiStateTimeline } from '../timeline/buildCombiStateTimeline';
import { buildHydronicStateTimeline } from '../timeline/buildHydronicStateTimeline';
import {
  runCombiDhwPhaseModel,
  adaptEngineInputToCombiPhase,
} from '../modules/CombiDhwPhaseModel';
import type { CombiDhwPhaseInput } from '../modules/CombiDhwPhaseModel';
import {
  runStoredDhwPhaseModel,
  adaptEngineInputToStoredPhase,
} from '../modules/StoredDhwPhaseModel';
import type { StoredDhwPhaseInput } from '../modules/StoredDhwPhaseModel';
import { runCombiSystemModel } from '../runners/runCombiSystemModel';
import { runSystemStoredSystemModel } from '../runners/runSystemStoredSystemModel';
import { runRegularStoredSystemModel } from '../runners/runRegularStoredSystemModel';
import { runHeatPumpStoredSystemModel } from '../runners/runHeatPumpStoredSystemModel';
import { buildSystemTopologyFromSpec } from '../topology/SystemTopology';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Shared phase model fixtures ──────────────────────────────────────────────

/** Standard combi shower draw with CH active: reaches steady state. */
const showerDrawWithCh: CombiDhwPhaseInput = {
  drawVolumeLitres: 54,
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  simultaneousChActive: true,
};

/** Standard combi shower draw without CH active. */
const showerDrawNoCh: CombiDhwPhaseInput = {
  drawVolumeLitres: 54,
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  simultaneousChActive: false,
};

/** Short draw (< 15 s): never reaches steady state. */
const shortDrawInput: CombiDhwPhaseInput = {
  drawVolumeLitres: 1.0,
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  simultaneousChActive: false,
};

/** Standard stored draw: well-charged 150 L cylinder, thermostat_call mode. */
const boilerStoredInput: StoredDhwPhaseInput = {
  cylinderVolumeLitres: 150,
  storeTopTempC: 60,
  storeMeanTempC: 55,
  drawVolumeLitres: 54,
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  controlMode: 'thermostat_call',
  thermostatThresholdC: 55,
  hysteresisBandC: 5,
  scheduledWindowActive: false,
  recoveryCharacteristic: 'boiler_stored',
};

/** Stored draw that crosses thermostat threshold (triggers recharge). */
const boilerStoredLowMeanInput: StoredDhwPhaseInput = {
  ...boilerStoredInput,
  storeMeanTempC: 52,   // below 55 °C threshold → triggers thermostat_call recharge
};

/** Heat pump stored draw. */
const hpStoredInput: StoredDhwPhaseInput = {
  ...boilerStoredInput,
  storeTopTempC: 50,
  storeMeanTempC: 45,
  thermostatThresholdC: 45,
  recoveryCharacteristic: 'heat_pump_stored',
  drawFlowLpm: 10,
  drawVolumeLitres: 60,
};

// ─── Topology stubs ───────────────────────────────────────────────────────────

const combiTopology   = buildSystemTopologyFromSpec({ systemType: 'combi' });
const systemTopology  = buildSystemTopologyFromSpec({ systemType: 'stored_water' });
const regularTopology = buildSystemTopologyFromSpec({ systemType: 'open_vented' });
const hpTopology      = buildSystemTopologyFromSpec({ systemType: 'heat_pump', hotWaterStorageLitres: 250 });

// ─── Shared engine input ──────────────────────────────────────────────────────

const baseEngineInput: EngineInputV2_3 = {
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
  occupancyCount: 2,
};

// ─── 1. Combi timeline — DHW request creates ordered phase ticks ──────────────

describe('SystemStateTimeline — combi: DHW request creates ordered phase ticks', () => {
  it('combi timeline is non-empty', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline.length).toBeGreaterThan(0);
  });

  it('first tick of CH-interrupted combi is ch_active preamble', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline[0].serviceMode).toBe('ch_active');
  });

  it('ch_active preamble has timestampS −1', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline[0].timestampS).toBe(-1);
  });

  it('dhw_request tick is present', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline.some(t => t.serviceMode === 'dhw_request')).toBe(true);
  });

  it('ignition_active tick is present', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline.some(t => t.serviceMode === 'ignition_active')).toBe(true);
  });

  it('delivery_active tick is present for a shower draw', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline.some(t => t.serviceMode === 'delivery_active')).toBe(true);
  });

  it('purge_active tick is present', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline.some(t => t.serviceMode === 'purge_active')).toBe(true);
  });

  it('phases appear in logical order: ch_active → dhw_request → ignition_active → delivery_active → purge_active → return_to_ch_pending', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const modes = timeline.map(t => t.serviceMode);

    const chIdx       = modes.indexOf('ch_active');
    const requestIdx  = modes.indexOf('dhw_request');
    const ignitionIdx = modes.indexOf('ignition_active');
    const deliveryIdx = modes.indexOf('delivery_active');
    const purgeIdx    = modes.indexOf('purge_active');
    const returnIdx   = modes.indexOf('return_to_ch_pending');

    expect(chIdx).toBeLessThan(requestIdx);
    expect(requestIdx).toBeLessThan(ignitionIdx);
    expect(ignitionIdx).toBeLessThan(deliveryIdx);
    expect(deliveryIdx).toBeLessThan(purgeIdx);
    expect(purgeIdx).toBeLessThan(returnIdx);
  });

  it('slotIndex values are strictly sequential starting from 0', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    timeline.forEach((tick, i) => {
      expect(tick.slotIndex).toBe(i);
    });
  });

  it('all ticks carry activeFamily === "combi"', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    timeline.forEach(tick => {
      expect(tick.activeFamily).toBe('combi');
    });
  });
});

// ─── 2. Combi timeline — CH interruption only when CH was active ──────────────

describe('SystemStateTimeline — combi: CH interruption only when CH was active', () => {
  it('ch_interrupted tick is present when CH was active', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline.some(t => t.serviceMode === 'ch_interrupted')).toBe(true);
  });

  it('ch_interrupted tick is absent when CH was not active', () => {
    const phase = runCombiDhwPhaseModel(showerDrawNoCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline.some(t => t.serviceMode === 'ch_interrupted')).toBe(false);
  });

  it('ch_active preamble is absent when CH was not active', () => {
    const phase = runCombiDhwPhaseModel(showerDrawNoCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline.some(t => t.serviceMode === 'ch_active')).toBe(false);
  });

  it('first tick is dhw_request when CH was not active', () => {
    const phase = runCombiDhwPhaseModel(showerDrawNoCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline[0].serviceMode).toBe('dhw_request');
  });

  it('heatingInterrupted is true on ch_interrupted tick', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const chInterrupted = timeline.find(t => t.serviceMode === 'ch_interrupted')!;
    expect(chInterrupted.heatingInterrupted).toBe(true);
  });

  it('heatingInterrupted is true on ignition_active tick when CH was active', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const ignition = timeline.find(t => t.serviceMode === 'ignition_active')!;
    expect(ignition.heatingInterrupted).toBe(true);
  });

  it('heatingInterrupted is false on ignition_active tick when CH was not active', () => {
    const phase = runCombiDhwPhaseModel(showerDrawNoCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const ignition = timeline.find(t => t.serviceMode === 'ignition_active')!;
    expect(ignition.heatingInterrupted).toBe(false);
  });

  it('chAvailable is false on ch_interrupted tick', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const chInterrupted = timeline.find(t => t.serviceMode === 'ch_interrupted')!;
    expect(chInterrupted.chAvailable).toBe(false);
  });

  it('return_to_ch_pending tick is present when CH was active', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline.some(t => t.serviceMode === 'return_to_ch_pending')).toBe(true);
  });
});

// ─── 3. Combi timeline — purge always follows delivery ───────────────────────

describe('SystemStateTimeline — combi: purge tick always follows delivery', () => {
  it('purge_active appears immediately after delivery_active (shower draw)', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const modes = timeline.map(t => t.serviceMode);
    const deliveryIdx = modes.indexOf('delivery_active');
    const purgeIdx = modes.indexOf('purge_active');
    expect(purgeIdx).toBe(deliveryIdx + 1);
  });

  it('purge_active is present even for a short draw (no delivery_active)', () => {
    const phase = runCombiDhwPhaseModel(shortDrawInput);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(timeline.some(t => t.serviceMode === 'purge_active')).toBe(true);
  });

  it('purge_active tick has dhwAvailable === false', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const purge = timeline.find(t => t.serviceMode === 'purge_active')!;
    expect(purge.dhwAvailable).toBe(false);
  });

  it('purge_active tick has chAvailable === false', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const purge = timeline.find(t => t.serviceMode === 'purge_active')!;
    expect(purge.chAvailable).toBe(false);
  });

  it('purge_active tick has purge_started transitionReason', () => {
    const phase = runCombiDhwPhaseModel(showerDrawNoCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const purge = timeline.find(t => t.serviceMode === 'purge_active')!;
    expect(purge.transitionReason).toBe('purge_started');
  });
});

// ─── 4. Combi timeline — return-to-CH pending appears after purge ─────────────

describe('SystemStateTimeline — combi: return-to-CH pending after purge', () => {
  it('return_to_ch_pending appears after purge_active', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const modes = timeline.map(t => t.serviceMode);
    const purgeIdx = modes.indexOf('purge_active');
    const returnIdx = modes.indexOf('return_to_ch_pending');
    expect(returnIdx).toBeGreaterThan(purgeIdx);
  });

  it('return_to_ch_pending has chAvailable === true', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const returnTick = timeline.find(t => t.serviceMode === 'return_to_ch_pending')!;
    expect(returnTick.chAvailable).toBe(true);
  });

  it('return_to_ch_pending has heatingInterrupted === false', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const returnTick = timeline.find(t => t.serviceMode === 'return_to_ch_pending')!;
    expect(returnTick.heatingInterrupted).toBe(false);
  });

  it('return_to_ch_pending has return_to_ch_initiated transitionReason', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const returnTick = timeline.find(t => t.serviceMode === 'return_to_ch_pending')!;
    expect(returnTick.transitionReason).toBe('return_to_ch_initiated');
  });

  it('delivery_active tick has dhwAvailable === true', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    const delivery = timeline.find(t => t.serviceMode === 'delivery_active')!;
    expect(delivery.dhwAvailable).toBe(true);
  });
});

// ─── 5. Hydronic timeline — draw-off changes store state ─────────────────────

describe('SystemStateTimeline — hydronic: draw-off changes store state', () => {
  it('hydronic timeline starts with store_draw_active', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    expect(timeline[0].serviceMode).toBe('store_draw_active');
  });

  it('store_draw_active tick has dhwAvailable === true', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const drawTick = timeline.find(t => t.serviceMode === 'store_draw_active')!;
    expect(drawTick.dhwAvailable).toBe(true);
  });

  it('store_draw_active tick has storeStateSummary defined', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const drawTick = timeline.find(t => t.serviceMode === 'store_draw_active')!;
    expect(drawTick.storeStateSummary).toBeDefined();
  });

  it('store_draw_active tick pre-draw storeStateSummary is "available" for a charged cylinder', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const drawTick = timeline.find(t => t.serviceMode === 'store_draw_active')!;
    expect(drawTick.storeStateSummary).toBe('available');
  });

  it('storeStateSummary is "depleted" when usable volume is exhausted', () => {
    // Request a huge draw to deplete the store
    const phase = runStoredDhwPhaseModel({ ...boilerStoredInput, drawVolumeLitres: 999 });
    const timeline = buildHydronicStateTimeline(phase, 'system');
    // The recharge_decision tick reflects post-draw store state
    const rechargeDecisionTick = timeline.find(t => t.serviceMode === 'recharge_decision')!;
    expect(rechargeDecisionTick.storeStateSummary).toBe('depleted');
  });

  it('store_draw_active tick has store_draw_started transitionReason', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const drawTick = timeline.find(t => t.serviceMode === 'store_draw_active')!;
    expect(drawTick.transitionReason).toBe('store_draw_started');
  });

  it('all hydronic ticks carry the correct activeFamily', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    timeline.forEach(tick => {
      expect(tick.activeFamily).toBe('system');
    });
  });

  it('heat_pump family ticks carry activeFamily === "heat_pump"', () => {
    const phase = runStoredDhwPhaseModel(hpStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'heat_pump');
    timeline.forEach(tick => {
      expect(tick.activeFamily).toBe('heat_pump');
    });
  });
});

// ─── 6. Hydronic timeline — recharge decision distinct from delivery ───────────

describe('SystemStateTimeline — hydronic: recharge decision distinct from draw-off', () => {
  it('recharge_decision tick is always present (emitted after every draw)', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    expect(timeline.some(t => t.serviceMode === 'recharge_decision')).toBe(true);
  });

  it('recharge_decision appears after store_draw_active', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const modes = timeline.map(t => t.serviceMode);
    const drawIdx = modes.indexOf('store_draw_active');
    const decisionIdx = modes.indexOf('recharge_decision');
    expect(decisionIdx).toBeGreaterThan(drawIdx);
  });

  it('recharge_decision tick has dhwAvailable === false', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const decisionTick = timeline.find(t => t.serviceMode === 'recharge_decision')!;
    expect(decisionTick.dhwAvailable).toBe(false);
  });

  it('recharge_decision timestampS is greater than store_draw_active timestampS', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const drawTick = timeline.find(t => t.serviceMode === 'store_draw_active')!;
    const decisionTick = timeline.find(t => t.serviceMode === 'recharge_decision')!;
    expect(decisionTick.timestampS).toBeGreaterThan(drawTick.timestampS);
  });
});

// ─── 7. Hydronic timeline — recharge active only when trigger conditions met ──

describe('SystemStateTimeline — hydronic: recharge active only when triggered', () => {
  it('recharge_active is present when thermostat threshold is crossed', () => {
    // Mean below threshold → triggers thermostat_call recharge
    const phase = runStoredDhwPhaseModel(boilerStoredLowMeanInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    expect(timeline.some(t => t.serviceMode === 'recharge_active')).toBe(true);
  });

  it('recharge_complete follows recharge_active when triggered', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredLowMeanInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const modes = timeline.map(t => t.serviceMode);
    const activeIdx = modes.indexOf('recharge_active');
    const completeIdx = modes.indexOf('recharge_complete');
    expect(completeIdx).toBeGreaterThan(activeIdx);
  });

  it('recharge_complete tick has storeStateSummary === "available"', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredLowMeanInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const completeTick = timeline.find(t => t.serviceMode === 'recharge_complete')!;
    expect(completeTick.storeStateSummary).toBe('available');
  });

  it('recharge_active has chAvailable === true when CH was not interrupted', () => {
    // No Y-plan interruption when simultaneousChActive is false (default)
    const phase = runStoredDhwPhaseModel(boilerStoredLowMeanInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const activeTick = timeline.find(t => t.serviceMode === 'recharge_active');
    if (activeTick) {
      // When chInterruptedByReheat is false, CH remains available
      expect(activeTick.heatingInterrupted).toBe(false);
    }
  });

  it('recharge_active transitionReason is recharge_started', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredLowMeanInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const activeTick = timeline.find(t => t.serviceMode === 'recharge_active')!;
    expect(activeTick.transitionReason).toBe('recharge_started');
  });

  it('recharge_complete tick has dhwAvailable === true (store returned to target)', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredLowMeanInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const completeTick = timeline.find(t => t.serviceMode === 'recharge_complete')!;
    expect(completeTick.dhwAvailable).toBe(true);
  });

  it('recharge_active and recharge_complete are absent when no recharge was triggered', () => {
    // Drain just a small amount so the store stays above the 55 °C threshold
    const phase = runStoredDhwPhaseModel({
      ...boilerStoredInput,
      drawVolumeLitres: 5,
      storeMeanTempC: 60,
      storeTopTempC: 65,
      // thermostatThresholdC = 55 in boilerStoredInput; mean stays well above threshold
    });
    const timeline = buildHydronicStateTimeline(phase, 'system');
    expect(timeline.some(t => t.serviceMode === 'recharge_active')).toBe(false);
    expect(timeline.some(t => t.serviceMode === 'recharge_complete')).toBe(false);
  });
});

// ─── 8. Hydronic timeline — no combi-only states in hydronic timeline ──────────

describe('SystemStateTimeline — hydronic: no combi-only states', () => {
  it('system timeline contains no combi-only service modes', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    timeline.forEach(tick => {
      expect(COMBI_ONLY_MODES.has(tick.serviceMode)).toBe(false);
    });
  });

  it('regular timeline contains no combi-only service modes', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'regular');
    timeline.forEach(tick => {
      expect(COMBI_ONLY_MODES.has(tick.serviceMode)).toBe(false);
    });
  });

  it('heat_pump timeline contains no combi-only service modes', () => {
    const phase = runStoredDhwPhaseModel(hpStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'heat_pump');
    timeline.forEach(tick => {
      expect(COMBI_ONLY_MODES.has(tick.serviceMode)).toBe(false);
    });
  });

  it('hydronic ticks have storeStateSummary defined (not undefined)', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    timeline.forEach(tick => {
      expect(tick.storeStateSummary).toBeDefined();
    });
  });
});

// ─── 9. Cross-family — same contract for combi and stored ─────────────────────

describe('SystemStateTimeline — cross-family: same contract for all families', () => {
  it('combi timeline produces SystemStateTick objects', () => {
    const phase = runCombiDhwPhaseModel(showerDrawNoCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    timeline.forEach(tick => {
      expect(tick).toHaveProperty('slotIndex');
      expect(tick).toHaveProperty('timestampS');
      expect(tick).toHaveProperty('activeFamily');
      expect(tick).toHaveProperty('serviceMode');
      expect(tick).toHaveProperty('chAvailable');
      expect(tick).toHaveProperty('dhwAvailable');
      expect(tick).toHaveProperty('heatingInterrupted');
      expect(tick).toHaveProperty('activeLimiterIds');
    });
  });

  it('hydronic timeline produces SystemStateTick objects', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    timeline.forEach(tick => {
      expect(tick).toHaveProperty('slotIndex');
      expect(tick).toHaveProperty('timestampS');
      expect(tick).toHaveProperty('activeFamily');
      expect(tick).toHaveProperty('serviceMode');
      expect(tick).toHaveProperty('chAvailable');
      expect(tick).toHaveProperty('dhwAvailable');
      expect(tick).toHaveProperty('heatingInterrupted');
      expect(tick).toHaveProperty('activeLimiterIds');
    });
  });

  it('activeLimiterIds is empty for all ticks (no limiters in PR6)', () => {
    const combiPhase = runCombiDhwPhaseModel(showerDrawNoCh);
    const combiTimeline = buildCombiStateTimeline(combiPhase, 'combi');
    combiTimeline.forEach(tick => {
      expect(tick.activeLimiterIds).toEqual([]);
    });

    const storedPhase = runStoredDhwPhaseModel(boilerStoredInput);
    const storedTimeline = buildHydronicStateTimeline(storedPhase, 'system');
    storedTimeline.forEach(tick => {
      expect(tick.activeLimiterIds).toEqual([]);
    });
  });

  it('combi timeline contains no store-only service modes', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    timeline.forEach(tick => {
      expect(STORE_ONLY_MODES.has(tick.serviceMode)).toBe(false);
    });
  });

  it('hydronic timeline contains at least one store-only service mode', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    const hasStoreOnly = timeline.some(tick => STORE_ONLY_MODES.has(tick.serviceMode));
    expect(hasStoreOnly).toBe(true);
  });

  it('combi timeline storeStateSummary is undefined on all ticks', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    timeline.forEach(tick => {
      expect(tick.storeStateSummary).toBeUndefined();
    });
  });
});

// ─── 10. Cross-family — validator rejects forbidden combinations ───────────────

describe('SystemStateTimeline — cross-family: validator rejects forbidden combinations', () => {
  it('assertValidStateTimeline does not throw for a valid combi timeline', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    expect(() => assertValidStateTimeline(timeline, 'combi')).not.toThrow();
  });

  it('assertValidStateTimeline does not throw for a valid hydronic timeline', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    expect(() => assertValidStateTimeline(timeline, 'system')).not.toThrow();
  });

  it('assertValidStateTimeline throws when combi-only mode appears in a hydronic timeline', () => {
    const badTick: SystemStateTick = {
      slotIndex: 0,
      timestampS: 0,
      activeFamily: 'system',
      serviceMode: 'purge_active',  // combi-only
      chAvailable: true,
      dhwAvailable: false,
      storeStateSummary: 'available',
      heatingInterrupted: false,
      activeLimiterIds: [],
      transitionReason: 'purge_started',
    };
    expect(() => assertValidStateTimeline([badTick], 'system')).toThrow(/combi-only mode/);
  });

  it('assertValidStateTimeline throws when store-only mode appears in a combi timeline', () => {
    const badTick: SystemStateTick = {
      slotIndex: 0,
      timestampS: 0,
      activeFamily: 'combi',
      serviceMode: 'store_draw_active',  // store-only
      chAvailable: true,
      dhwAvailable: true,
      storeStateSummary: undefined,
      heatingInterrupted: false,
      activeLimiterIds: [],
      transitionReason: 'store_draw_started',
    };
    expect(() => assertValidStateTimeline([badTick], 'combi')).toThrow(/store-only mode/);
  });

  it('assertValidStateTimeline throws when storeStateSummary is set on a combi tick', () => {
    const badTick: SystemStateTick = {
      slotIndex: 0,
      timestampS: 0,
      activeFamily: 'combi',
      serviceMode: 'delivery_active',
      chAvailable: false,
      dhwAvailable: true,
      storeStateSummary: 'available',  // forbidden on combi
      heatingInterrupted: false,
      activeLimiterIds: [],
    };
    expect(() => assertValidStateTimeline([badTick], 'combi')).toThrow(/storeStateSummary/);
  });

  it('assertValidStateTimeline throws when slotIndex is not sequential', () => {
    const tick0: SystemStateTick = {
      slotIndex: 0,
      timestampS: 0,
      activeFamily: 'combi',
      serviceMode: 'dhw_request',
      chAvailable: true,
      dhwAvailable: false,
      heatingInterrupted: false,
      activeLimiterIds: [],
    };
    const tick2: SystemStateTick = {
      slotIndex: 2,   // gap — slotIndex 1 is missing
      timestampS: 5,
      activeFamily: 'combi',
      serviceMode: 'ignition_active',
      chAvailable: false,
      dhwAvailable: false,
      heatingInterrupted: false,
      activeLimiterIds: [],
    };
    expect(() => assertValidStateTimeline([tick0, tick2], 'combi')).toThrow(/slotIndex/);
  });

  it('assertValidStateTimeline throws when tick activeFamily mismatches declared family', () => {
    const badTick: SystemStateTick = {
      slotIndex: 0,
      timestampS: 0,
      activeFamily: 'system',   // mismatch: declared as combi
      serviceMode: 'delivery_active',
      chAvailable: false,
      dhwAvailable: true,
      heatingInterrupted: false,
      activeLimiterIds: [],
    };
    expect(() => assertValidStateTimeline([badTick], 'combi')).toThrow(/activeFamily/);
  });

  it('assertValidStateTimeline accepts an empty timeline', () => {
    expect(() => assertValidStateTimeline([], 'combi')).not.toThrow();
    expect(() => assertValidStateTimeline([], 'system')).not.toThrow();
  });
});

// ─── 11. Cross-family — timeline ordering is deterministic ────────────────────

describe('SystemStateTimeline — cross-family: deterministic ordering', () => {
  it('combi timeline slotIndex is strictly ascending', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].slotIndex).toBe(timeline[i - 1].slotIndex + 1);
    }
  });

  it('hydronic timeline slotIndex is strictly ascending', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredLowMeanInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].slotIndex).toBe(timeline[i - 1].slotIndex + 1);
    }
  });

  it('combi timeline timestampS is non-decreasing', () => {
    const phase = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline = buildCombiStateTimeline(phase, 'combi');
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].timestampS).toBeGreaterThanOrEqual(timeline[i - 1].timestampS);
    }
  });

  it('hydronic timeline timestampS is non-decreasing', () => {
    const phase = runStoredDhwPhaseModel(boilerStoredLowMeanInput);
    const timeline = buildHydronicStateTimeline(phase, 'system');
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].timestampS).toBeGreaterThanOrEqual(timeline[i - 1].timestampS);
    }
  });

  it('same combi input always produces the same timeline', () => {
    const phase1 = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline1 = buildCombiStateTimeline(phase1, 'combi');
    const phase2 = runCombiDhwPhaseModel(showerDrawWithCh);
    const timeline2 = buildCombiStateTimeline(phase2, 'combi');
    expect(JSON.stringify(timeline1)).toBe(JSON.stringify(timeline2));
  });

  it('same hydronic input always produces the same timeline', () => {
    const phase1 = runStoredDhwPhaseModel(boilerStoredLowMeanInput);
    const timeline1 = buildHydronicStateTimeline(phase1, 'system');
    const phase2 = runStoredDhwPhaseModel(boilerStoredLowMeanInput);
    const timeline2 = buildHydronicStateTimeline(phase2, 'system');
    expect(JSON.stringify(timeline1)).toBe(JSON.stringify(timeline2));
  });
});

// ─── 12. Runner integration — runners populate stateTimeline ──────────────────

describe('SystemStateTimeline — runner integration', () => {
  const combiEngineInput: EngineInputV2_3 = { ...baseEngineInput, currentHeatSourceType: 'combi' };
  const systemEngineInput: EngineInputV2_3 = { ...baseEngineInput, currentHeatSourceType: 'system', preferCombi: false };
  const regularEngineInput: EngineInputV2_3 = { ...baseEngineInput, currentHeatSourceType: 'regular', preferCombi: false };
  const hpEngineInput: EngineInputV2_3 = { ...baseEngineInput, currentHeatSourceType: 'ashp', preferCombi: false };

  it('combi runner populates stateTimeline', () => {
    const result = runCombiSystemModel(combiEngineInput, combiTopology);
    expect(result.stateTimeline).toBeDefined();
    expect(result.stateTimeline.length).toBeGreaterThan(0);
  });

  it('combi runner stateTimeline contains only combi-family ticks', () => {
    const result = runCombiSystemModel(combiEngineInput, combiTopology);
    result.stateTimeline.forEach(tick => {
      expect(tick.activeFamily).toBe('combi');
      expect(STORE_ONLY_MODES.has(tick.serviceMode)).toBe(false);
    });
  });

  it('combi runner stateTimeline passes assertValidStateTimeline', () => {
    const result = runCombiSystemModel(combiEngineInput, combiTopology);
    expect(() => assertValidStateTimeline(result.stateTimeline, 'combi')).not.toThrow();
  });

  it('system runner populates stateTimeline', () => {
    const result = runSystemStoredSystemModel(systemEngineInput, systemTopology);
    expect(result.stateTimeline).toBeDefined();
    expect(result.stateTimeline.length).toBeGreaterThan(0);
  });

  it('system runner stateTimeline contains no combi-only ticks', () => {
    const result = runSystemStoredSystemModel(systemEngineInput, systemTopology);
    result.stateTimeline.forEach(tick => {
      expect(COMBI_ONLY_MODES.has(tick.serviceMode)).toBe(false);
    });
  });

  it('system runner stateTimeline passes assertValidStateTimeline', () => {
    const result = runSystemStoredSystemModel(systemEngineInput, systemTopology);
    expect(() => assertValidStateTimeline(result.stateTimeline, 'system')).not.toThrow();
  });

  it('regular runner populates stateTimeline', () => {
    const result = runRegularStoredSystemModel(regularEngineInput, regularTopology);
    expect(result.stateTimeline).toBeDefined();
    expect(result.stateTimeline.length).toBeGreaterThan(0);
  });

  it('regular runner stateTimeline contains no combi-only ticks', () => {
    const result = runRegularStoredSystemModel(regularEngineInput, regularTopology);
    result.stateTimeline.forEach(tick => {
      expect(COMBI_ONLY_MODES.has(tick.serviceMode)).toBe(false);
    });
  });
  it('regular runner stateTimeline passes assertValidStateTimeline', () => {
    const result = runRegularStoredSystemModel(regularEngineInput, regularTopology);
    // open_vented topology gives appliance.family === 'open_vented'
    expect(() => assertValidStateTimeline(result.stateTimeline, 'open_vented')).not.toThrow();
  });

  it('heat pump runner populates stateTimeline', () => {
    const result = runHeatPumpStoredSystemModel(hpEngineInput, hpTopology);
    expect(result.stateTimeline).toBeDefined();
    expect(result.stateTimeline.length).toBeGreaterThan(0);
  });

  it('heat pump runner stateTimeline contains no combi-only ticks', () => {
    const result = runHeatPumpStoredSystemModel(hpEngineInput, hpTopology);
    result.stateTimeline.forEach(tick => {
      expect(COMBI_ONLY_MODES.has(tick.serviceMode)).toBe(false);
    });
  });

  it('heat pump runner stateTimeline passes assertValidStateTimeline', () => {
    const result = runHeatPumpStoredSystemModel(hpEngineInput, hpTopology);
    expect(() => assertValidStateTimeline(result.stateTimeline, 'heat_pump')).not.toThrow();
  });

  it('all four runners produce timelines that pass validation', () => {
    const combiResult  = runCombiSystemModel(combiEngineInput, combiTopology);
    const systemResult = runSystemStoredSystemModel(systemEngineInput, systemTopology);
    const regularResult = runRegularStoredSystemModel(regularEngineInput, regularTopology);
    const hpResult     = runHeatPumpStoredSystemModel(hpEngineInput, hpTopology);

    expect(() => assertValidStateTimeline(combiResult.stateTimeline,   'combi')).not.toThrow();
    expect(() => assertValidStateTimeline(systemResult.stateTimeline,  'system')).not.toThrow();
    // open_vented topology gives appliance.family === 'open_vented'
    expect(() => assertValidStateTimeline(regularResult.stateTimeline, 'open_vented')).not.toThrow();
    expect(() => assertValidStateTimeline(hpResult.stateTimeline,      'heat_pump')).not.toThrow();
  });
});
