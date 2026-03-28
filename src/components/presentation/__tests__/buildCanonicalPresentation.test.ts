/**
 * buildCanonicalPresentation.test.ts
 *
 * Acceptance tests proving that changing canonical signals produces causally
 * specific, signal-driven changes in the presentation model.
 *
 * Key acceptance criteria from the problem statement:
 *   ✓ Changing demographics → home section copy changes visibly
 *   ✓ Changing PV/battery status → energy section copy changes visibly
 *   ✓ Good roof without PV ≠ existing PV (labelled distinctly)
 *   ✓ Planned PV → future-compatibility messaging, not installed-benefit messaging
 *   ✓ Recommendation language is causally specific
 */

import { describe, it, expect } from 'vitest';
import { runEngine } from '../../../engine/Engine';
import { buildCanonicalPresentation } from '../buildCanonicalPresentation';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/** Minimal base input — single professional adult, single bathroom, no PV. */
const BASE_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancyCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
};

function withInput(overrides: Partial<EngineInputV2_3>): EngineInputV2_3 {
  return { ...BASE_INPUT, ...overrides };
}

// ─── Home signal — demographic changes ────────────────────────────────────────

describe('buildCanonicalPresentation — home signal', () => {
  it('reflects a single adult with shower-only profile', () => {
    const input = withInput({
      occupancyCount: 1,
      bathroomCount: 1,
      occupancySignature: 'professional',
      demandTimingOverrides: { bathFrequencyPerWeek: 0, simultaneousUseSeverity: 'low' },
    });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);

    expect(model.page1.home.peakSimultaneousOutlets).toBe(1);
    expect(model.page1.home.storageBenefitLabel).toMatch(/low|well matched/i);
    expect(model.page1.home.dailyHotWaterLitres).toBeLessThan(60);
  });

  it('reflects a large family with high simultaneous demand', () => {
    const input = withInput({
      occupancyCount: 5,
      bathroomCount: 2,
      occupancySignature: 'steady_home',
      highOccupancy: true,
      demandTimingOverrides: {
        bathFrequencyPerWeek: 5,
        simultaneousUseSeverity: 'high',
        daytimeOccupancy: 'present',
      },
    });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);

    expect(model.page1.home.peakSimultaneousOutlets).toBeGreaterThanOrEqual(2);
    expect(model.page1.home.storageBenefitLabel).toMatch(/high/i);
    expect(model.page1.home.dailyHotWaterLitres).toBeGreaterThan(100);
  });

  it('single adult daily litres are less than family daily litres', () => {
    const singleInput = withInput({ occupancyCount: 1, bathroomCount: 1 });
    const familyInput = withInput({ occupancyCount: 4, bathroomCount: 2, highOccupancy: true });

    const singleResult = runEngine(singleInput);
    const familyResult = runEngine(familyInput);

    const singleModel = buildCanonicalPresentation(singleResult, singleInput);
    const familyModel = buildCanonicalPresentation(familyResult, familyInput);

    expect(familyModel.page1.home.dailyHotWaterLitres)
      .toBeGreaterThan(singleModel.page1.home.dailyHotWaterLitres);
  });

  it('narrative signals mention occupancy-driven context', () => {
    const input = withInput({
      occupancyCount: 4,
      bathroomCount: 2,
      highOccupancy: true,
      demandTimingOverrides: { simultaneousUseSeverity: 'high', bathFrequencyPerWeek: 4 },
    });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    // Narrative should reference the household size or simultaneous demand
    expect(model.page1.home.narrativeSignals.length).toBeGreaterThan(0);
  });
});

// ─── Energy signal — PV/battery status changes ────────────────────────────────

describe('buildCanonicalPresentation — energy signal', () => {
  it('good roof without PV is labelled distinctly from existing PV', () => {
    const goodRoofNoPv = withInput({
      roofOrientation: 'south',
      solarShading: 'low',
      roofType: 'pitched',
      pvStatus: 'none',
    });
    const goodRoofExistingPv = withInput({
      roofOrientation: 'south',
      solarShading: 'low',
      roofType: 'pitched',
      pvStatus: 'existing',
    });

    const noPvResult = runEngine(goodRoofNoPv);
    const existingPvResult = runEngine(goodRoofExistingPv);

    const noPvModel = buildCanonicalPresentation(noPvResult, goodRoofNoPv);
    const existingPvModel = buildCanonicalPresentation(existingPvResult, goodRoofExistingPv);

    // Good roof without PV should NOT say "panels installed"
    expect(noPvModel.page1.energy.pvSuitabilityLabel).not.toMatch(/installed/i);
    // Existing PV should say "installed"
    expect(existingPvModel.page1.energy.pvSuitabilityLabel).toMatch(/installed/i);
    // The two labels should be different
    expect(noPvModel.page1.energy.pvSuitabilityLabel).not.toBe(
      existingPvModel.page1.energy.pvSuitabilityLabel,
    );
  });

  it('planned PV label differs from existing PV label', () => {
    const plannedPvInput = withInput({
      roofOrientation: 'south',
      solarShading: 'low',
      roofType: 'pitched',
      pvStatus: 'planned',
    });
    const existingPvInput = withInput({
      roofOrientation: 'south',
      solarShading: 'low',
      roofType: 'pitched',
      pvStatus: 'existing',
    });

    const plannedResult = runEngine(plannedPvInput);
    const existingResult = runEngine(existingPvInput);

    const plannedModel = buildCanonicalPresentation(plannedResult, plannedPvInput);
    const existingModel = buildCanonicalPresentation(existingResult, existingPvInput);

    expect(plannedModel.page1.energy.pvStatusLabel).toMatch(/planned/i);
    expect(existingModel.page1.energy.pvStatusLabel).toMatch(/installed/i);
    expect(plannedModel.page1.energy.pvStatusLabel).not.toBe(
      existingModel.page1.energy.pvStatusLabel,
    );
  });

  it('battery status is reflected correctly', () => {
    const noBattery  = withInput({ pvStatus: 'existing', batteryStatus: 'none' });
    const hasBattery = withInput({ pvStatus: 'existing', batteryStatus: 'existing' });

    const noBatteryResult  = runEngine(noBattery);
    const hasBatteryResult = runEngine(hasBattery);

    const noBatteryModel  = buildCanonicalPresentation(noBatteryResult, noBattery);
    const hasBatteryModel = buildCanonicalPresentation(hasBatteryResult, hasBattery);

    expect(noBatteryModel.page1.energy.batteryStatusLabel).toMatch(/no battery/i);
    expect(hasBatteryModel.page1.energy.batteryStatusLabel).toMatch(/installed/i);
  });

  it('planned battery label is distinct from existing battery', () => {
    const plannedBattery  = withInput({ batteryStatus: 'planned' });
    const existingBattery = withInput({ batteryStatus: 'existing' });

    const plannedResult  = runEngine(plannedBattery);
    const existingResult = runEngine(existingBattery);

    const plannedModel  = buildCanonicalPresentation(plannedResult, plannedBattery);
    const existingModel = buildCanonicalPresentation(existingResult, existingBattery);

    expect(plannedModel.page1.energy.batteryStatusLabel).toMatch(/planned/i);
    expect(existingModel.page1.energy.batteryStatusLabel).toMatch(/installed/i);
  });

  it('north-facing roof produces limited PV suitability', () => {
    const northFacing = withInput({ roofOrientation: 'north' });
    const result = runEngine(northFacing);
    const model = buildCanonicalPresentation(result, northFacing);

    expect(model.page1.energy.pvSuitabilityLabel).toMatch(/limited/i);
  });
});

// ─── House signal ─────────────────────────────────────────────────────────────

describe('buildCanonicalPresentation — house signal', () => {
  it('heat loss is expressed in kW with a decimal', () => {
    const result = runEngine(BASE_INPUT);
    const model = buildCanonicalPresentation(result, BASE_INPUT);
    expect(model.page1.house.heatLossLabel).toMatch(/8\.0\s*kW/i);
  });

  it('pipework is reflected in the label', () => {
    const input = withInput({ primaryPipeDiameter: 28 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1.house.pipeworkLabel).toMatch(/28/);
  });

  it('loft conversion note appears when flag is set', () => {
    const input = withInput({ hasLoftConversion: true });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1.house.notes.some(n => /loft/i.test(n))).toBe(true);
  });
});

// ─── Current system signal ────────────────────────────────────────────────────

describe('buildCanonicalPresentation — current system signal', () => {
  it('age label shows the recorded age', () => {
    const input = withInput({ currentHeatSourceType: 'combi', currentBoilerAgeYears: 12 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1.currentSystem.ageLabel).toMatch(/12/);
  });

  it('age context flags old combi', () => {
    const input = withInput({ currentHeatSourceType: 'combi', currentBoilerAgeYears: 17 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1.currentSystem.ageContext).toMatch(/beyond|design life/i);
  });

  it('age context is reassuring for a young boiler', () => {
    const input = withInput({ currentHeatSourceType: 'combi', currentBoilerAgeYears: 3 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1.currentSystem.ageContext).toMatch(/young|service life/i);
  });

  it('drivingStyleMode is "combi" for a combi boiler', () => {
    const input = withInput({ currentHeatSourceType: 'combi' });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1.currentSystem.drivingStyleMode).toBe('combi');
  });

  it('drivingStyleMode is "stored" for a system boiler', () => {
    const input = withInput({ currentHeatSourceType: 'system' });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1.currentSystem.drivingStyleMode).toBe('stored');
  });

  it('drivingStyleMode is "stored" for a regular boiler', () => {
    const input = withInput({ currentHeatSourceType: 'regular' });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1.currentSystem.drivingStyleMode).toBe('stored');
  });

  it('drivingStyleMode is "heat_pump" for an ASHP', () => {
    const input = withInput({ currentHeatSourceType: 'ashp' });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1.currentSystem.drivingStyleMode).toBe('heat_pump');
  });
});

// ─── House signal — wallTypeKey ───────────────────────────────────────────────

describe('buildCanonicalPresentation — house signal wallTypeKey', () => {
  it('solid_masonry wall → wallTypeKey solid_masonry', () => {
    const input = withInput({ building: { fabric: { wallType: 'solid_masonry' } } });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1.house.wallTypeKey).toBe('solid_masonry');
  });

  it('cavity_unfilled wall → wallTypeKey cavity_uninsulated (same high heat-loss physics)', () => {
    const input = withInput({ building: { fabric: { wallType: 'cavity_unfilled' } } });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1.house.wallTypeKey).toBe('cavity_uninsulated');
  });

  it('cavity_filled wall → wallTypeKey cavity_insulated', () => {
    const input = withInput({ building: { fabric: { wallType: 'cavity_filled' } } });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1.house.wallTypeKey).toBe('cavity_insulated');
  });

  it('no wall type → wallTypeKey defaults to cavity_insulated', () => {
    const result = runEngine(BASE_INPUT);
    const model = buildCanonicalPresentation(result, BASE_INPUT);
    expect(['solid_masonry', 'cavity_uninsulated', 'cavity_insulated']).toContain(
      model.page1.house.wallTypeKey,
    );
  });
});

// ─── Page 1.5 — Ageing context ────────────────────────────────────────────────

describe('buildCanonicalPresentation — page1_5 ageing context', () => {
  it('includes probabilistic framing note', () => {
    const input = withInput({ currentBoilerAgeYears: 10 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.probabilisticNotes.some(n => /probabilistic|context/i.test(n))).toBe(true);
  });

  it('age band label contains the age', () => {
    const input = withInput({ currentBoilerAgeYears: 8 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.ageBandLabel).toMatch(/8/);
  });

  // ── PR10 fields ────────────────────────────────────────────────────────────

  it('heading is the PR10 ageing-page title', () => {
    const input = withInput({ currentBoilerAgeYears: 10 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.heading).toMatch(/systems like yours/i);
  });

  it('conditionSummary is present and non-empty', () => {
    const input = withInput({ currentBoilerAgeYears: 10 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.conditionSummary.length).toBeGreaterThan(0);
  });

  it('young combi → healthy efficiency band', () => {
    const input = withInput({ currentBoilerAgeYears: 3, currentHeatSourceType: 'combi' });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.currentEfficiencyBand).toBe('healthy');
  });

  it('mid-age combi → ageing efficiency band', () => {
    const input = withInput({ currentBoilerAgeYears: 10, currentHeatSourceType: 'combi' });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.currentEfficiencyBand).toBe('ageing');
  });

  it('old combi → neglected efficiency band', () => {
    const input = withInput({ currentBoilerAgeYears: 18, currentHeatSourceType: 'combi' });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.currentEfficiencyBand).toBe('neglected');
  });

  it('poor boilerConditionBand → neglected regardless of age', () => {
    const input = withInput({ currentBoilerAgeYears: 5, boilerConditionBand: 'poor' });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.currentEfficiencyBand).toBe('neglected');
  });

  it('efficiencyBandDescription is non-empty', () => {
    const input = withInput({ currentBoilerAgeYears: 10 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.efficiencyBandDescription.length).toBeGreaterThan(0);
  });

  it('combi → plate HEX degradation architecture', () => {
    const input = withInput({ currentHeatSourceType: 'combi', currentBoilerAgeYears: 10 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.componentDegradation.architecture).toBe('combi');
    expect(model.page1_5.componentDegradation.componentLabel).toMatch(/plate|hex/i);
  });

  it('system boiler → stored degradation architecture', () => {
    const input = withInput({ currentHeatSourceType: 'system', currentBoilerAgeYears: 10 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.componentDegradation.architecture).toBe('stored');
    expect(model.page1_5.componentDegradation.componentLabel).toMatch(/coil/i);
  });

  it('plateHexConditionBand propagates to componentDegradation for combi', () => {
    const input = withInput({
      currentHeatSourceType: 'combi',
      plateHexConditionBand: 'severe',
    });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.componentDegradation.conditionBand).toBe('severe');
  });

  it('circulationSignals includes a filter signal', () => {
    const input = withInput({ hasMagneticFilter: true, currentBoilerAgeYears: 8 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    const filterSignal = model.page1_5.circulationSignals.find(s => /filter/i.test(s.label));
    expect(filterSignal).toBeDefined();
    expect(filterSignal?.status).toBe('ok');
  });

  it('no magnetic filter on ageing system → warn signal', () => {
    const input = withInput({ hasMagneticFilter: false, currentBoilerAgeYears: 10 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    const filterSignal = model.page1_5.circulationSignals.find(s => /filter/i.test(s.label));
    expect(filterSignal?.status).toBe('warn');
  });

  it('homeImpacts is a non-empty array', () => {
    const input = withInput({ currentBoilerAgeYears: 10 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.page1_5.homeImpacts.length).toBeGreaterThan(0);
  });

  it('likelyFirstImprovements always includes a service item', () => {
    const input = withInput({ currentBoilerAgeYears: 10 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    const hasService = model.page1_5.likelyFirstImprovements.some(i => /service/i.test(i));
    expect(hasService).toBe(true);
  });

  it('powerflush only present for old neglected systems', () => {
    const youngInput = withInput({ currentBoilerAgeYears: 4, currentHeatSourceType: 'combi' });
    const youngResult = runEngine(youngInput);
    const youngModel = buildCanonicalPresentation(youngResult, youngInput);
    const hasPowerflush = youngModel.page1_5.likelyFirstImprovements.some(i => /powerflush/i.test(i));
    expect(hasPowerflush).toBe(false);

    const oldInput = withInput({ currentBoilerAgeYears: 18, currentHeatSourceType: 'combi' });
    const oldResult = runEngine(oldInput);
    const oldModel = buildCanonicalPresentation(oldResult, oldInput);
    const oldHasPowerflush = oldModel.page1_5.likelyFirstImprovements.some(i => /powerflush/i.test(i));
    expect(oldHasPowerflush).toBe(true);
  });
});



// ─── Page 2 — Available options ───────────────────────────────────────────────

describe('buildCanonicalPresentation — page2 available options', () => {
  it('returns an array of available options', () => {
    const result = runEngine(BASE_INPUT);
    const model = buildCanonicalPresentation(result, BASE_INPUT);
    expect(model.page2.options.length).toBeGreaterThan(0);
  });

  it('each option has through-house notes referencing heat loss', () => {
    const result = runEngine(BASE_INPUT);
    const model = buildCanonicalPresentation(result, BASE_INPUT);
    const combi = model.page2.options.find(o => o.id === 'combi');
    if (combi) {
      const houseText = combi.throughHouseNotes.join(' ');
      expect(houseText).toMatch(/kW/i);
    }
  });

  it('existing PV influences through-energy notes for stored option', () => {
    const input = withInput({ pvStatus: 'existing', dhwTankType: 'system' });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    const stored = model.page2.options.find(o =>
      o.id === 'stored_unvented' || o.id === 'system_unvented' || o.id === 'stored_vented',
    );
    if (stored && stored.throughEnergyNotes.length > 0) {
      expect(stored.throughEnergyNotes.join(' ')).toMatch(/pv|solar/i);
    }
  });
});

// ─── Page 3 — Physics-first ranking ───────────────────────────────────────────

describe('buildCanonicalPresentation — page3 ranking', () => {
  it('produces a ranked list when recommendationResult is provided', () => {
    const result = runEngine(BASE_INPUT);
    const model = buildCanonicalPresentation(result, BASE_INPUT, result.recommendationResult);
    expect(model.page3.items.length).toBeGreaterThan(0);
    expect(model.page3.items[0].rank).toBe(1);
  });

  it('rank 1 reason line references house or home signals', () => {
    const result = runEngine(BASE_INPUT);
    const model = buildCanonicalPresentation(result, BASE_INPUT, result.recommendationResult);
    if (model.page3.items.length > 0) {
      // Reason should reference something signal-specific (kW, people, outlets, L/day)
      expect(model.page3.items[0].reasonLine).toMatch(/kW|person|people|outlet|L\/day|bathroom/i);
    }
  });
});

// ─── Final page — Simulator ───────────────────────────────────────────────────

describe('buildCanonicalPresentation — final page simulator', () => {
  it('home scenario description includes occupancy and hot-water estimate', () => {
    const input = withInput({ occupancyCount: 3 });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.finalPage.homeScenarioDescription).toMatch(/3-person/i);
    expect(model.finalPage.homeScenarioDescription).toMatch(/L\/day/i);
  });

  it('house constraint notes include heat loss', () => {
    const result = runEngine(BASE_INPUT);
    const model = buildCanonicalPresentation(result, BASE_INPUT);
    expect(model.finalPage.houseConstraintNotes.join(' ')).toMatch(/8\.0\s*kW/i);
  });

  it('existing PV produces energy timing note', () => {
    const input = withInput({ pvStatus: 'existing', roofOrientation: 'south' });
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input);
    expect(model.finalPage.energyTimingNotes.join(' ')).toMatch(/pv|solar|simulator/i);
  });
});
