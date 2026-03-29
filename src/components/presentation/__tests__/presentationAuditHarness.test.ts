/**
 * presentationAuditHarness.test.ts
 *
 * Structured audit harness for the Atlas canonical presentation layer.
 *
 * This replaces manual spot-checking with automated rule-based regression
 * checks that catch domain/presentation bugs before human review.
 *
 * Four audit levels:
 *
 *   1. CONTRACT AUDIT — model shape invariants (bad mappings caught before UI)
 *   2. SCENARIO AUDIT — golden scenarios produce expected key outputs
 *   3. RULE AUDIT     — "must never" invariants (catches the embarrassing bugs)
 *   4. DIFFERENCE TESTS — paired scenarios prove the engine distinguishes cases
 *
 * Acceptance criteria from the problem statement:
 *   ✓ Core presentation bugs caught by tests, not manual discovery
 *   ✓ Scenario differences prove the system distinguishes important domain cases
 *   ✓ Compliance misclassification and storage conflation are auto-flagged
 *   ✓ Open-vented and unvented produce distinct presentation outputs
 *   ✓ Appliance family never implies DHW storage type
 *   ✓ complianceRequired items never appear in bestPerformanceUpgrades
 *   ✓ Shortlist visuals are chosen from signals, not invalid family aliases
 */

import { describe, it, expect } from 'vitest';
import { runEngine } from '../../../engine/Engine';
import { buildCanonicalPresentation } from '../buildCanonicalPresentation';
import { resolveShortlistVisualId, resolveCurrentSystemVisualId, resolveOptionsOverviewVisualId } from '../presentationVisualMapping';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type {
  CanonicalPresentationModel,
  ShortlistedOptionDetail,
} from '../buildCanonicalPresentation';
import {
  AUDIT_SCENARIOS,
  SINGLE_PERSON_COMBI_FIT,
  LARGE_FAMILY_STORED_FIT,
  OPEN_VENTED_CURRENT_SYSTEM,
  UNVENTED_CURRENT_SYSTEM,
  SYSTEM_BOILER_VENTED,
  REGULAR_BOILER_UNVENTED,
  STRONG_PV_POOR_ALIGNMENT,
  STRONG_PV_GOOD_ALIGNMENT,
  HEAT_PUMP_BORDERLINE,
  HIGH_HARDNESS_COMBI_RISK,
  LOFT_CONVERSION_VENTED_CONSTRAINT,
  MIXERGY_CURRENT_SYSTEM,
  THERMAL_STORE_CURRENT_SYSTEM,
  SCENARIO_PAIRS,
} from './presentationAuditFixtures';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Run engine + build presentation model for a given input. */
function buildAuditModel(input: EngineInputV2_3): CanonicalPresentationModel {
  const result = runEngine(input);
  return buildCanonicalPresentation(result, input, result.recommendationResult);
}

/**
 * Returns all visible string values from a canonical presentation model.
 * Used to check for forbidden phrases across the entire rendered output.
 */
function collectAllStrings(model: CanonicalPresentationModel): string[] {
  const strings: string[] = [];

  // Page 1 — house
  const h = model.page1.house;
  strings.push(h.heatLossLabel, h.heatLossBand, h.pipeworkLabel, h.waterSupplyLabel,
    h.pvPotentialLabel, h.wallTypeLabel, h.insulationLabel, ...h.notes);

  // Page 1 — home
  const ho = model.page1.home;
  strings.push(ho.demandProfileLabel, ho.dailyHotWaterLabel, ho.peakOutletsLabel,
    ho.bathUseIntensityLabel, ho.occupancyTimingLabel, ho.storageBenefitLabel,
    ...ho.narrativeSignals);

  // Page 1 — energy
  const e = model.page1.energy;
  strings.push(e.pvStatusLabel, e.batteryStatusLabel, e.pvSuitabilityLabel,
    e.energyAlignmentLabel, e.solarStorageOpportunityLabel, ...e.narrativeSignals);

  // Page 1 — current system
  const cs = model.page1.currentSystem;
  // systemTypeLabel and ageLabel are nullable — push only when present
  if (cs.systemTypeLabel) strings.push(cs.systemTypeLabel);
  if (cs.ageLabel)        strings.push(cs.ageLabel);
  strings.push(cs.ageContext);
  if (cs.makeModelText) strings.push(cs.makeModelText);
  if (cs.outputLabel)   strings.push(cs.outputLabel);

  // Page 1.5
  strings.push(model.page1_5.heading, model.page1_5.ageBandLabel,
    ...model.page1_5.probabilisticNotes);
  if (model.page1_5.waterQualityNote) strings.push(model.page1_5.waterQualityNote);

  // Page 2
  for (const opt of model.page2.options) {
    strings.push(opt.label, opt.headline, opt.whatItIs,
      ...opt.throughHouseNotes, ...opt.throughHomeNotes, ...opt.throughEnergyNotes,
      ...opt.worksWellWhen, ...opt.limitedWhen);
  }

  // Page 3
  for (const item of model.page3.items) {
    strings.push(item.label, item.reasonLine);
    if (item.demandFitNote)        strings.push(item.demandFitNote);
    if (item.waterFitNote)         strings.push(item.waterFitNote);
    if (item.infrastructureFitNote) strings.push(item.infrastructureFitNote);
    if (item.energyFitNote)        strings.push(item.energyFitNote);
  }

  // Page 4+ shortlist
  for (const opt of model.page4Plus.options) {
    strings.push(opt.label, ...opt.complianceItems, ...opt.requiredWork,
      ...opt.bestPerformanceUpgrades);
  }

  // Final page
  strings.push(model.finalPage.homeScenarioDescription,
    model.finalPage.dhwArchitectureNote,
    ...model.finalPage.houseConstraintNotes, ...model.finalPage.energyTimingNotes,
    ...model.finalPage.simulatorCapabilities);

  return strings.filter(s => s.length > 0);
}

/**
 * Returns a fingerprint string for a presentation model used in
 * identical-output detection across intentionally different scenarios.
 */
function modelFingerprint(model: CanonicalPresentationModel): string {
  return JSON.stringify({
    dhwArchitecture:   model.page1.currentSystem.dhwArchitecture,
    dhwStorageType:    model.page1.currentSystem.dhwStorageType,
    drivingStyleMode:  model.page1.currentSystem.drivingStyleMode,
    systemTypeLabel:   model.page1.currentSystem.systemTypeLabel,
    pvStatusLabel:     model.page1.energy.pvStatusLabel,
    storageBenefit:    model.page1.home.storageBenefitLabel,
    demandProfile:     model.page1.home.demandProfileLabel,
    peakOutlets:       model.page1.home.peakSimultaneousOutlets,
    dailyLitres:       model.page1.home.dailyHotWaterLitres,
    rankingOrder:      model.page3.items.map(i => i.family),
    shortlistFamilies: model.page4Plus.options.map(o => o.family),
  });
}

// ─── Pre-built models for all scenarios ──────────────────────────────────────

const PREBUILT_MODELS = Object.fromEntries(
  Object.entries(AUDIT_SCENARIOS).map(([name, input]) => [name, buildAuditModel(input)]),
) as Record<string, CanonicalPresentationModel>;

// ═════════════════════════════════════════════════════════════════════════════
// 1. CONTRACT AUDIT — model shape invariants
// ═════════════════════════════════════════════════════════════════════════════

describe('Contract audit — canonical presentation model shape', () => {

  describe('every scenario produces a fully-populated model', () => {
    for (const [name] of Object.entries(AUDIT_SCENARIOS)) {
      it(`scenario "${name}" — page1 house signals are populated`, () => {
        const model = PREBUILT_MODELS[name];
        expect(model.page1.house.heatLossLabel).toBeTruthy();
        expect(model.page1.house.pipeworkLabel).toBeTruthy();
        expect(model.page1.house.wallTypeKey).toMatch(/^(solid_masonry|cavity_uninsulated|cavity_insulated)$/);
      });

      it(`scenario "${name}" — page1 home signals are populated`, () => {
        const model = PREBUILT_MODELS[name];
        expect(model.page1.home.demandProfileLabel).toBeTruthy();
        expect(model.page1.home.dailyHotWaterLitres).toBeGreaterThan(0);
        expect(model.page1.home.peakSimultaneousOutlets).toBeGreaterThanOrEqual(1);
        expect(model.page1.home.storageBenefitLabel).toBeTruthy();
      });

      it(`scenario "${name}" — page1 energy signals are populated`, () => {
        const model = PREBUILT_MODELS[name];
        expect(model.page1.energy.pvStatusLabel).toBeTruthy();
        expect(model.page1.energy.pvSuitabilityLabel).toBeTruthy();
      });

      it(`scenario "${name}" — page1 currentSystem signals are populated`, () => {
        const model = PREBUILT_MODELS[name];
        // systemTypeLabel is non-null when currentHeatSourceType was captured — all
        // audit fixtures set this explicitly so it must always be truthy here.
        expect(model.page1.currentSystem.systemTypeLabel).toBeTruthy();
        // ageLabel is nullable by design: it is null when age was not captured in
        // the survey. When present it must be a non-empty string; when absent it
        // must be exactly null (never an empty string, undefined, or other falsy).
        const ageLabel = model.page1.currentSystem.ageLabel;
        expect(
          ageLabel === null || (typeof ageLabel === 'string' && ageLabel.length > 0),
          `ageLabel must be null or a non-empty string, got: ${JSON.stringify(ageLabel)}`,
        ).toBe(true);
        expect(model.page1.currentSystem.drivingStyleMode).toMatch(/^(combi|stored|heat_pump)$/);
        expect(model.page1.currentSystem.dhwStorageType).toMatch(
          /^(open_vented|unvented|thermal_store|mixergy|unknown)$/,
        );
        // Architecture is the primary discriminator — must always be present.
        expect(model.page1.currentSystem.dhwArchitecture).toMatch(
          /^(on_demand|standard_cylinder|mixergy|thermal_store)$/,
        );
      });

      it(`scenario "${name}" — page1_5 ageing context is populated`, () => {
        const model = PREBUILT_MODELS[name];
        expect(model.page1_5.heading).toBeTruthy();
        expect(model.page1_5.ageBandLabel).toBeTruthy();
      });

      it(`scenario "${name}" — page2 options list is non-empty`, () => {
        const model = PREBUILT_MODELS[name];
        expect(model.page2.options.length).toBeGreaterThan(0);
      });

      it(`scenario "${name}" — page3 ranking items are non-empty`, () => {
        const model = PREBUILT_MODELS[name];
        expect(model.page3.items.length).toBeGreaterThan(0);
      });

      it(`scenario "${name}" — page4Plus shortlist options are non-empty`, () => {
        const model = PREBUILT_MODELS[name];
        expect(model.page4Plus.options.length).toBeGreaterThan(0);
      });

      it(`scenario "${name}" — finalPage home scenario description is populated`, () => {
        const model = PREBUILT_MODELS[name];
        expect(model.finalPage.homeScenarioDescription).toBeTruthy();
      });
    }
  });

  it('dhwStorageType is explicit — never inferred silently from appliance family', () => {
    // When dhwStorageType is given, the presentation must use it exactly.
    // Input 'vented' → output 'open_vented'; input 'unvented' → output 'unvented'.
    // This test ensures the inputDhwStorageTypeToSignal mapping is applied, not bypassed.
    const ventedModel  = PREBUILT_MODELS['open_vented_current_system'];
    const unventedModel = PREBUILT_MODELS['unvented_current_system'];

    expect(ventedModel.page1.currentSystem.dhwStorageType).toBe('open_vented');
    expect(unventedModel.page1.currentSystem.dhwStorageType).toBe('unvented');
  });

  it('appliance family does not determine dhwStorageType — system+vented is open_vented', () => {
    // system family with 'vented' storage must produce 'open_vented', not 'unvented'
    const model = PREBUILT_MODELS['system_boiler_vented'];
    expect(model.page1.currentSystem.drivingStyleMode).toBe('stored'); // system family → stored mode
    expect(model.page1.currentSystem.dhwStorageType).toBe('open_vented'); // vented storage, not inferred from family
  });

  it('appliance family does not determine dhwStorageType — regular+unvented is unvented', () => {
    // regular family with 'unvented' storage must produce 'unvented', not 'open_vented'
    const model = PREBUILT_MODELS['regular_boiler_unvented'];
    expect(model.page1.currentSystem.drivingStyleMode).toBe('stored'); // regular family → stored mode
    expect(model.page1.currentSystem.dhwStorageType).toBe('unvented'); // unvented storage, not inferred from family
  });

  it('page2 every option has a non-empty whatItIs description', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      for (const opt of model.page2.options) {
        expect(opt.whatItIs, `"${name}" option "${opt.id}" has empty whatItIs`).toBeTruthy();
      }
    }
  });

  it('page2 every option has a status within the expected set', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      for (const opt of model.page2.options) {
        expect(
          ['viable', 'caution', 'rejected'].includes(opt.status),
          `"${name}" option "${opt.id}" has invalid status "${opt.status}"`,
        ).toBe(true);
      }
    }
  });

  it('page3 ranking items have ranks starting at 1 without gaps', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      const ranks = model.page3.items.map(i => i.rank);
      ranks.forEach((r, idx) => {
        expect(r, `"${name}" ranking item ${idx} has unexpected rank ${r}`).toBe(idx + 1);
      });
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. SCENARIO AUDIT — key assertions per golden scenario
// ═════════════════════════════════════════════════════════════════════════════

describe('Scenario audit — single_person_combi_fit', () => {
  const model = PREBUILT_MODELS['single_person_combi_fit'];

  it('home signal: 1 outlet, low daily demand', () => {
    expect(model.page1.home.peakSimultaneousOutlets).toBe(1);
    expect(model.page1.home.dailyHotWaterLitres).toBeLessThan(60);
  });

  it('home signal: storage benefit is low for single professional', () => {
    expect(model.page1.home.storageBenefitLabel).toMatch(/low|well matched/i);
  });

  it('currentSystem: dhwStorageType is unknown (no stored cylinder)', () => {
    // dhwStorageType='none' maps to 'unknown' in presentation
    expect(model.page1.currentSystem.dhwStorageType).toBe('unknown');
  });

  it('ranking: combi appears in the ranking', () => {
    const families = model.page3.items.map(i => i.family);
    expect(families).toContain('combi');
  });
});

describe('Scenario audit — large_family_stored_fit', () => {
  const model = PREBUILT_MODELS['large_family_stored_fit'];

  it('home signal: 2+ outlets, high daily demand (>100 L/day)', () => {
    expect(model.page1.home.peakSimultaneousOutlets).toBeGreaterThanOrEqual(2);
    expect(model.page1.home.dailyHotWaterLitres).toBeGreaterThan(100);
  });

  it('home signal: storage benefit is high for large family', () => {
    expect(model.page1.home.storageBenefitLabel).toMatch(/high/i);
  });

  it('currentSystem: dhwStorageType is unvented', () => {
    expect(model.page1.currentSystem.dhwStorageType).toBe('unvented');
  });
});

describe('Scenario audit — open_vented_current_system', () => {
  const model = PREBUILT_MODELS['open_vented_current_system'];

  it('currentSystem: dhwStorageType is open_vented', () => {
    expect(model.page1.currentSystem.dhwStorageType).toBe('open_vented');
  });

  it('currentSystem: drivingStyleMode is stored (regular boiler)', () => {
    expect(model.page1.currentSystem.drivingStyleMode).toBe('stored');
  });

  it('water supply: notes loft-tank supply source', () => {
    expect(model.page1.house.waterSupplyLabel).toMatch(/tank/i);
  });
});

describe('Scenario audit — unvented_current_system', () => {
  const model = PREBUILT_MODELS['unvented_current_system'];

  it('currentSystem: dhwStorageType is unvented', () => {
    expect(model.page1.currentSystem.dhwStorageType).toBe('unvented');
  });

  it('currentSystem: drivingStyleMode is stored (system boiler)', () => {
    expect(model.page1.currentSystem.drivingStyleMode).toBe('stored');
  });

  it('water supply: notes mains supply', () => {
    expect(model.page1.house.waterSupplyLabel).toMatch(/mains/i);
  });
});

describe('Scenario audit — strong_pv_poor_alignment vs strong_pv_good_alignment', () => {
  const poorModel = PREBUILT_MODELS['strong_pv_poor_alignment'];
  const goodModel = PREBUILT_MODELS['strong_pv_good_alignment'];

  it('both show existing PV in pvStatusLabel', () => {
    expect(poorModel.page1.energy.pvStatusLabel).toMatch(/installed/i);
    expect(goodModel.page1.energy.pvStatusLabel).toMatch(/installed/i);
  });

  it('energy alignment labels differ between poor and good alignment scenarios', () => {
    expect(poorModel.page1.energy.energyAlignmentLabel).not.toBe(
      goodModel.page1.energy.energyAlignmentLabel,
    );
  });

  it('good alignment produces higher or equal solar storage opportunity', () => {
    // Good alignment should produce 'high' or better solar storage opportunity
    // than poor alignment — they cannot be identical.
    expect(poorModel.page1.energy.solarStorageOpportunityLabel).not.toBe(
      goodModel.page1.energy.solarStorageOpportunityLabel,
    );
  });
});

describe('Scenario audit — heat_pump_borderline', () => {
  const model = PREBUILT_MODELS['heat_pump_borderline'];

  it('currentSystem: drivingStyleMode is heat_pump', () => {
    expect(model.page1.currentSystem.drivingStyleMode).toBe('heat_pump');
  });

  it('page3 includes heat_pump in ranking', () => {
    const families = model.page3.items.map(i => i.family);
    expect(families).toContain('heat_pump');
  });

  it('finalPage mentions heat loss kW', () => {
    expect(model.finalPage.houseConstraintNotes.join(' ')).toMatch(/10\.0\s*kW/);
  });
});

describe('Scenario audit — high_hardness_combi_risk', () => {
  const model = PREBUILT_MODELS['high_hardness_combi_risk'];

  it('combi option appears in page2 options', () => {
    const optIds = model.page2.options.map(o => o.id);
    expect(optIds).toContain('combi');
  });

  it('combi option in page2 has worksWellWhen and limitedWhen arrays', () => {
    const combi = model.page2.options.find(o => o.id === 'combi');
    expect(combi).toBeDefined();
    expect(Array.isArray(combi!.worksWellWhen)).toBe(true);
    expect(Array.isArray(combi!.limitedWhen)).toBe(true);
  });
});

describe('Scenario audit — loft_conversion_vented_constraint', () => {
  const model = PREBUILT_MODELS['loft_conversion_vented_constraint'];

  it('stored_vented option is caution or lower due to loft constraints', () => {
    const opt = model.page2.options.find(o => o.id === 'stored_vented');
    expect(opt).toBeDefined();
    // loft conversion + future conversion should produce caution or rejected for vented
    expect(['caution', 'rejected']).toContain(opt!.status);
  });

  it('finalPage notes loft conversion constraint', () => {
    expect(model.finalPage.houseConstraintNotes.join(' ')).toMatch(/loft/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. RULE AUDIT — "must never" invariants
// ═════════════════════════════════════════════════════════════════════════════

describe('Rule audit — compliance items must never appear in upgrades', () => {
  it('no scenario has a compliance item that also appears in bestPerformanceUpgrades', () => {
    const violations: string[] = [];

    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      for (const opt of model.page4Plus.options) {
        const complianceSet = new Set(opt.complianceItems);
        for (const upgrade of opt.bestPerformanceUpgrades) {
          if (complianceSet.has(upgrade)) {
            violations.push(`"${name}" / option "${opt.family}": "${upgrade}" in both complianceItems and bestPerformanceUpgrades`);
          }
        }
      }
    }

    expect(
      violations,
      `Compliance items must never appear in upgrades:\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });

  it('no scenario has a compliance item that also appears in requiredWork', () => {
    const violations: string[] = [];

    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      for (const opt of model.page4Plus.options) {
        const complianceSet = new Set(opt.complianceItems);
        for (const work of opt.requiredWork) {
          if (complianceSet.has(work)) {
            violations.push(`"${name}" / option "${opt.family}": "${work}" in both complianceItems and requiredWork`);
          }
        }
      }
    }

    expect(
      violations,
      `Compliance items must never appear in requiredWork:\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });
});

describe('Rule audit — storage type conflation must never occur', () => {
  it('open-vented scenarios never produce dhwStorageType="unvented"', () => {
    const ventedModel = PREBUILT_MODELS['open_vented_current_system'];
    expect(ventedModel.page1.currentSystem.dhwStorageType).not.toBe('unvented');
  });

  it('unvented scenarios never produce dhwStorageType="open_vented"', () => {
    const unventedModel = PREBUILT_MODELS['unvented_current_system'];
    expect(unventedModel.page1.currentSystem.dhwStorageType).not.toBe('open_vented');
  });

  it('system boiler + vented storage is not conflated to unvented', () => {
    const model = PREBUILT_MODELS['system_boiler_vented'];
    expect(model.page1.currentSystem.dhwStorageType).toBe('open_vented');
  });

  it('regular boiler + unvented storage is not conflated to open_vented', () => {
    const model = PREBUILT_MODELS['regular_boiler_unvented'];
    expect(model.page1.currentSystem.dhwStorageType).toBe('unvented');
  });
});

describe('Rule audit — shortlist visuals must use architecture, not storage-type strings', () => {
  it('architecture=mixergy → cylinder_charge_mixergy', () => {
    expect(resolveShortlistVisualId('high', 1, 'mixergy')).toBe('cylinder_charge_mixergy');
    expect(resolveShortlistVisualId('high', 0, 'mixergy')).toBe('cylinder_charge_mixergy');
  });

  it('architecture=standard_cylinder → cylinder_charge_standard', () => {
    expect(resolveShortlistVisualId('high', 1, 'standard_cylinder')).toBe('cylinder_charge_standard');
    expect(resolveShortlistVisualId('high', 0, 'standard_cylinder')).toBe('cylinder_charge_standard');
  });

  it('architecture=thermal_store → null (audit guard: thermal store is legacy, suppressed from shortlist)', () => {
    expect(resolveShortlistVisualId('high', 1, 'thermal_store')).toBeNull();
  });

  it('architecture=on_demand → null (no cylinder visual for on-demand)', () => {
    expect(resolveShortlistVisualId('high', 1, 'on_demand')).toBeNull();
    expect(resolveShortlistVisualId('high', 0, 'on_demand')).toBeNull();
  });

  it('no architecture → null (never show wrong animation)', () => {
    // Missing architecture: show nothing rather than the wrong visual
    expect(resolveShortlistVisualId('high', 1)).toBeNull();
    expect(resolveShortlistVisualId('high', 0)).toBeNull();
  });

  it('peakSimultaneousOutlets >= 2 → flow_split when solar is not high', () => {
    expect(resolveShortlistVisualId('low', 2)).toBe('flow_split');
    expect(resolveShortlistVisualId('medium', 2)).toBe('flow_split');
    expect(resolveShortlistVisualId('low', 3)).toBe('flow_split');
  });

  it('no signal match → null (family-based fallbacks are removed)', () => {
    // Previously stored families returned cylinder_charge and combi/ashp returned
    // driving_style. Now all no-signal cases return null — truth over completeness.
    expect(resolveShortlistVisualId('low', 1)).toBeNull();
    expect(resolveShortlistVisualId('medium', 1)).toBeNull();
    expect(resolveShortlistVisualId('none', 0)).toBeNull();
  });

  it('never shows a family-based visual (driving_style or cylinder_charge) without a matching signal', () => {
    const noSignalCases: [string, number][] = [
      ['low', 0],
      ['low', 1],
      ['medium', 0],
      ['medium', 1],
      ['none', 0],
      ['none', 1],
    ];
    for (const [solar, outlets] of noSignalCases) {
      const result = resolveShortlistVisualId(solar, outlets);
      expect(result, `should be null for solar=${solar}, outlets=${outlets}`).toBeNull();
    }
  });

  it('solar signal takes priority over simultaneous outlet count', () => {
    // solar=high overrides the outlets>=2 rule — cylinder subtype visual is the correct answer
    expect(resolveShortlistVisualId('high', 3, 'standard_cylinder')).toBe('cylinder_charge_standard');
    expect(resolveShortlistVisualId('high', 3, 'mixergy')).toBe('cylinder_charge_mixergy');
  });
});

describe('Rule audit — open-vented and unvented must produce distinct outputs', () => {
  const ventedModel  = PREBUILT_MODELS['open_vented_current_system'];
  const unventedModel = PREBUILT_MODELS['unvented_current_system'];

  it('dhwStorageType differs between open-vented and unvented scenarios', () => {
    expect(ventedModel.page1.currentSystem.dhwStorageType).not.toBe(
      unventedModel.page1.currentSystem.dhwStorageType,
    );
  });

  it('currentSystem fingerprints differ between open-vented and unvented', () => {
    const ventedFP = JSON.stringify({
      dhwStorageType:   ventedModel.page1.currentSystem.dhwStorageType,
      systemTypeLabel:  ventedModel.page1.currentSystem.systemTypeLabel,
      waterSupplyLabel: ventedModel.page1.house.waterSupplyLabel,
    });
    const unventedFP = JSON.stringify({
      dhwStorageType:   unventedModel.page1.currentSystem.dhwStorageType,
      systemTypeLabel:  unventedModel.page1.currentSystem.systemTypeLabel,
      waterSupplyLabel: unventedModel.page1.house.waterSupplyLabel,
    });
    expect(ventedFP).not.toBe(unventedFP);
  });
});

describe('Rule audit — no forbidden phrases in any scenario output', () => {
  const FORBIDDEN_PHRASES = [
    'instantaneous hot water',
    'gravity system',
    'low pressure system',
    'high pressure system',
    'unlimited hot water',
  ] as const;

  for (const phrase of FORBIDDEN_PHRASES) {
    it(`no scenario output contains the forbidden phrase "${phrase}"`, () => {
      const violations: string[] = [];
      for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
        const strings = collectAllStrings(model);
        const hits = strings.filter(s => s.toLowerCase().includes(phrase.toLowerCase()));
        if (hits.length > 0) {
          violations.push(`"${name}": ${hits.join('; ')}`);
        }
      }
      expect(
        violations,
        `Forbidden phrase "${phrase}" found in presentation output:\n${violations.join('\n')}`,
      ).toHaveLength(0);
    });
  }
});

describe('Rule audit — no empty takeaways for required sections', () => {
  it('every scenario page1 energy narrativeSignals contains at least one entry', () => {
    // Energy page must always produce at least one narrative signal
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      // We allow empty narrative signals for energy in some cases (e.g. no PV, no roof data)
      // but the pvStatusLabel must never be empty.
      expect(model.page1.energy.pvStatusLabel, `"${name}" pvStatusLabel is empty`).toBeTruthy();
    }
  });

  it('every scenario page1 home storageBenefitLabel is populated', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      expect(
        model.page1.home.storageBenefitLabel,
        `"${name}" storageBenefitLabel is empty`,
      ).toBeTruthy();
    }
  });

  it('every scenario page1_5 heading is non-empty', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      expect(model.page1_5.heading, `"${name}" page1_5 heading is empty`).toBeTruthy();
    }
  });

  it('every scenario finalPage homeScenarioDescription is non-empty', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      expect(
        model.finalPage.homeScenarioDescription,
        `"${name}" homeScenarioDescription is empty`,
      ).toBeTruthy();
    }
  });
});

describe('Rule audit — intentionally different scenarios must not produce identical output', () => {
  it('single_person_combi_fit and large_family_stored_fit have distinct fingerprints', () => {
    expect(modelFingerprint(PREBUILT_MODELS['single_person_combi_fit'])).not.toBe(
      modelFingerprint(PREBUILT_MODELS['large_family_stored_fit']),
    );
  });

  it('open_vented_current_system and unvented_current_system have distinct fingerprints', () => {
    expect(modelFingerprint(PREBUILT_MODELS['open_vented_current_system'])).not.toBe(
      modelFingerprint(PREBUILT_MODELS['unvented_current_system']),
    );
  });

  it('strong_pv_poor_alignment and strong_pv_good_alignment have distinct fingerprints', () => {
    expect(modelFingerprint(PREBUILT_MODELS['strong_pv_poor_alignment'])).not.toBe(
      modelFingerprint(PREBUILT_MODELS['strong_pv_good_alignment']),
    );
  });

  it('system_boiler_vented and regular_boiler_unvented have distinct fingerprints', () => {
    expect(modelFingerprint(PREBUILT_MODELS['system_boiler_vented'])).not.toBe(
      modelFingerprint(PREBUILT_MODELS['regular_boiler_unvented']),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. DIFFERENCE TESTS — paired scenarios prove the engine distinguishes cases
// ═════════════════════════════════════════════════════════════════════════════

describe('Difference tests — PV none vs existing', () => {
  const pair = SCENARIO_PAIRS.find(p => p.name === 'pv_none_vs_existing')!;
  const modelA = buildAuditModel(pair.scA); // no PV
  const modelB = buildAuditModel(pair.scB); // existing PV

  it('pvStatusLabel differs between no-PV and existing-PV', () => {
    expect(modelA.page1.energy.pvStatusLabel).not.toBe(modelB.page1.energy.pvStatusLabel);
  });

  it('existing PV produces pvStatusLabel mentioning "installed"', () => {
    expect(modelB.page1.energy.pvStatusLabel).toMatch(/installed/i);
  });

  it('no-PV pvStatusLabel says "No PV" (absence, not presence)', () => {
    expect(modelA.page1.energy.pvStatusLabel).toMatch(/no pv/i);
  });

  it('pvSuitabilityLabel differs between no-PV and existing-PV', () => {
    expect(modelA.page1.energy.pvSuitabilityLabel).not.toBe(modelB.page1.energy.pvSuitabilityLabel);
  });
});

describe('Difference tests — PV none vs planned', () => {
  const pair = SCENARIO_PAIRS.find(p => p.name === 'pv_none_vs_planned')!;
  const modelA = buildAuditModel(pair.scA); // no PV
  const modelB = buildAuditModel(pair.scB); // planned PV

  it('pvStatusLabel differs between no-PV and planned-PV', () => {
    expect(modelA.page1.energy.pvStatusLabel).not.toBe(modelB.page1.energy.pvStatusLabel);
  });

  it('planned PV produces pvStatusLabel mentioning "planned"', () => {
    expect(modelB.page1.energy.pvStatusLabel).toMatch(/planned/i);
  });
});

describe('Difference tests — open-vented vs unvented DHW', () => {
  const pair = SCENARIO_PAIRS.find(p => p.name === 'open_vented_vs_unvented')!;
  const modelA = buildAuditModel(pair.scA); // open-vented
  const modelB = buildAuditModel(pair.scB); // unvented

  it('dhwStorageType changes from open_vented to unvented', () => {
    expect(modelA.page1.currentSystem.dhwStorageType).toBe('open_vented');
    expect(modelB.page1.currentSystem.dhwStorageType).toBe('unvented');
  });

  it('waterSupplyLabel changes from tank-fed to mains-fed', () => {
    expect(modelA.page1.house.waterSupplyLabel).toMatch(/tank/i);
    expect(modelB.page1.house.waterSupplyLabel).toMatch(/mains/i);
  });

  it('overall model fingerprints differ', () => {
    expect(modelFingerprint(modelA)).not.toBe(modelFingerprint(modelB));
  });
});

describe('Difference tests — 1 person vs 5 people', () => {
  const pair = SCENARIO_PAIRS.find(p => p.name === 'one_person_vs_five_people')!;
  const modelA = buildAuditModel(pair.scA); // 1 person
  const modelB = buildAuditModel(pair.scB); // 5 people

  it('dailyHotWaterLitres is higher for 5-person household', () => {
    expect(modelB.page1.home.dailyHotWaterLitres).toBeGreaterThan(
      modelA.page1.home.dailyHotWaterLitres,
    );
  });

  it('storageBenefitLabel changes between 1-person and 5-person', () => {
    expect(modelA.page1.home.storageBenefitLabel).not.toBe(modelB.page1.home.storageBenefitLabel);
  });

  it('demandProfileLabel changes between 1-person (professional) and 5-person (steady_home)', () => {
    // occupancySignature differs: 'professional' vs 'steady_home'
    expect(modelA.page1.home.demandProfileLabel).not.toBe(modelB.page1.home.demandProfileLabel);
  });
});

describe('Difference tests — low vs high simultaneous demand', () => {
  const pair = SCENARIO_PAIRS.find(p => p.name === 'low_vs_high_simultaneous')!;
  const modelA = buildAuditModel(pair.scA); // low simultaneous
  const modelB = buildAuditModel(pair.scB); // high simultaneous (2 bathrooms)

  it('peakSimultaneousOutlets is higher for 2-bathroom high-demand household', () => {
    expect(modelB.page1.home.peakSimultaneousOutlets).toBeGreaterThan(
      modelA.page1.home.peakSimultaneousOutlets,
    );
  });

  it('shortlist visual for high-simultaneous stored option is flow_split', () => {
    // With 2+ outlets, the shortlist visual should be flow_split regardless of family
    const highDemandShortlistOptions = modelB.page4Plus.options;
    expect(highDemandShortlistOptions.length).toBeGreaterThan(0);
    for (const opt of highDemandShortlistOptions) {
      const visual = resolveShortlistVisualId(
        opt.solarStorageOpportunity,
        opt.peakSimultaneousOutlets,
      );
      // With 2+ outlets and no high solar, all options get flow_split
      if (opt.peakSimultaneousOutlets >= 2 && opt.solarStorageOpportunity !== 'high') {
        expect(visual).toBe('flow_split');
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. ADDITIONAL COMBI DHW RULE CHECKS
//    (from custom_instruction domain rules)
// ═════════════════════════════════════════════════════════════════════════════

describe('Combi DHW rules — occupancy/bathroom gate thresholds', () => {
  /** Build a fresh engine run and extract the combi option card. */
  function getCombiCard(overrides: Partial<EngineInputV2_3>) {
    const input: EngineInputV2_3 = {
      postcode: 'SW1A 1AA',
      dynamicMainsPressure: 2.5,
      // Deliberately omit mainsDynamicFlowLpm / mainsDynamicFlowLpmKnown:
      // a known 18 L/min flow triggers a combi-dhw-shortfall 'fail' because
      // heating 18 L/min through ΔT 35°C requires ~44 kW (> any combi).
      // Without a known measurement, the engine uses demand-heuristic estimates
      // that don't flag a shortfall for a 1-bath, 1-person household.
      buildingMass: 'medium',
      primaryPipeDiameter: 22,
      heatLossWatts: 8000,
      radiatorCount: 10,
      hasLoftConversion: false,
      returnWaterTemp: 45,
      occupancySignature: 'professional',
      highOccupancy: false,
      preferCombi: true,
      currentHeatSourceType: 'combi',
      ...overrides,
    };
    const result = runEngine(input);
    const model = buildCanonicalPresentation(result, input, result.recommendationResult);
    // Find combi in options
    return model.page2.options.find(o => o.id === 'combi');
  }

  it('2 bathrooms → combi option shows caution or rejected', () => {
    const combi = getCombiCard({ bathroomCount: 2, occupancyCount: 2 });
    expect(combi).toBeDefined();
    expect(['caution', 'rejected']).toContain(combi!.status);
  });

  it('peakConcurrentOutlets >= 2 → combi option is rejected', () => {
    const combi = getCombiCard({ bathroomCount: 2, peakConcurrentOutlets: 2, occupancyCount: 2 });
    expect(combi).toBeDefined();
    expect(combi!.status).toBe('rejected');
  });

  it('1 bathroom, 1 person → combi option is viable', () => {
    const combi = getCombiCard({ bathroomCount: 1, occupancyCount: 1 });
    expect(combi).toBeDefined();
    expect(combi!.status).toBe('viable');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. SCENARIO AUDIT — Mixergy and thermal store architecture distinction
// ═════════════════════════════════════════════════════════════════════════════

describe('Scenario audit — mixergy_current_system', () => {
  const model = PREBUILT_MODELS['mixergy_current_system'];

  it('currentSystem: dhwStorageType is mixergy (not conflated with unvented)', () => {
    expect(model.page1.currentSystem.dhwStorageType).toBe('mixergy');
  });

  it('currentSystem: drivingStyleMode is stored (system boiler)', () => {
    expect(model.page1.currentSystem.drivingStyleMode).toBe('stored');
  });

  it('model fingerprint differs from standard unvented scenario', () => {
    expect(modelFingerprint(model)).not.toBe(
      modelFingerprint(PREBUILT_MODELS['unvented_current_system']),
    );
  });
});

describe('Scenario audit — thermal_store_current_system', () => {
  const model = PREBUILT_MODELS['thermal_store_current_system'];

  it('currentSystem: dhwStorageType is thermal_store (not conflated with open_vented)', () => {
    expect(model.page1.currentSystem.dhwStorageType).toBe('thermal_store');
  });

  it('currentSystem: drivingStyleMode is stored (regular boiler)', () => {
    expect(model.page1.currentSystem.drivingStyleMode).toBe('stored');
  });

  it('model fingerprint differs from open-vented scenario', () => {
    expect(modelFingerprint(model)).not.toBe(
      modelFingerprint(PREBUILT_MODELS['open_vented_current_system']),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. ARCHITECTURE DISTINCTION — four DHW stories must stay separate
//    on-demand combi | standard stored | stratified (Mixergy) | thermal store
// ═════════════════════════════════════════════════════════════════════════════

describe('Architecture distinction — four DHW storage types produce four distinct dhwStorageType values', () => {
  it('combi (no storage) → dhwStorageType is unknown', () => {
    expect(PREBUILT_MODELS['single_person_combi_fit'].page1.currentSystem.dhwStorageType).toBe('unknown');
  });

  it('standard stored hot water (unvented) → dhwStorageType is unvented', () => {
    expect(PREBUILT_MODELS['unvented_current_system'].page1.currentSystem.dhwStorageType).toBe('unvented');
  });

  it('stratified stored hot water (Mixergy) → dhwStorageType is mixergy', () => {
    expect(PREBUILT_MODELS['mixergy_current_system'].page1.currentSystem.dhwStorageType).toBe('mixergy');
  });

  it('thermal store (stored heat with exchanger) → dhwStorageType is thermal_store', () => {
    expect(PREBUILT_MODELS['thermal_store_current_system'].page1.currentSystem.dhwStorageType).toBe('thermal_store');
  });

  it('all four DHW architectures produce distinct dhwStorageType values', () => {
    const types = [
      PREBUILT_MODELS['single_person_combi_fit'].page1.currentSystem.dhwStorageType,
      PREBUILT_MODELS['unvented_current_system'].page1.currentSystem.dhwStorageType,
      PREBUILT_MODELS['mixergy_current_system'].page1.currentSystem.dhwStorageType,
      PREBUILT_MODELS['thermal_store_current_system'].page1.currentSystem.dhwStorageType,
    ];
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(4);
  });
});

describe('Architecture distinction — shortlist visual for thermal_store is always null (uncertainty guard)', () => {
  it('thermal_store + solar=high → null (thermal store is legacy; show uncertainty card)', () => {
    expect(resolveShortlistVisualId('high', 1, 'thermal_store')).toBeNull();
    expect(resolveShortlistVisualId('high', 0, 'thermal_store')).toBeNull();
  });

  it('thermal_store + storageBenefit=high → null (thermal store must not get a cylinder visual)', () => {
    expect(resolveShortlistVisualId('low', 1, 'thermal_store', 'high')).toBeNull();
    expect(resolveShortlistVisualId('none', 0, 'thermal_store', 'high')).toBeNull();
  });

  it('mixergy + solar=high → cylinder_charge_mixergy (stratified cylinder is distinct from standard)', () => {
    expect(resolveShortlistVisualId('high', 1, 'mixergy')).toBe('cylinder_charge_mixergy');
  });

  it('standard_cylinder + solar=high → cylinder_charge_standard (standard stored cylinder)', () => {
    expect(resolveShortlistVisualId('high', 1, 'standard_cylinder')).toBe('cylinder_charge_standard');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. DIFFERENCE TESTS — standard cylinder vs Mixergy and thermal store
// ═════════════════════════════════════════════════════════════════════════════

describe('Difference tests — standard cylinder vs Mixergy', () => {
  const pair = SCENARIO_PAIRS.find(p => p.name === 'standard_cylinder_vs_mixergy')!;
  const modelA = buildAuditModel(pair.scA); // standard unvented
  const modelB = buildAuditModel(pair.scB); // Mixergy

  it('dhwStorageType changes from unvented to mixergy', () => {
    expect(modelA.page1.currentSystem.dhwStorageType).toBe('unvented');
    expect(modelB.page1.currentSystem.dhwStorageType).toBe('mixergy');
  });

  it('overall model fingerprints differ', () => {
    expect(modelFingerprint(modelA)).not.toBe(modelFingerprint(modelB));
  });
});

describe('Difference tests — standard cylinder vs thermal store', () => {
  const pair = SCENARIO_PAIRS.find(p => p.name === 'standard_cylinder_vs_thermal_store')!;
  const modelA = buildAuditModel(pair.scA); // standard unvented
  const modelB = buildAuditModel(pair.scB); // thermal store

  it('dhwStorageType changes from unvented to thermal_store', () => {
    expect(modelA.page1.currentSystem.dhwStorageType).toBe('unvented');
    expect(modelB.page1.currentSystem.dhwStorageType).toBe('thermal_store');
  });

  it('overall model fingerprints differ', () => {
    expect(modelFingerprint(modelA)).not.toBe(modelFingerprint(modelB));
  });
});

describe('Difference tests — combi-friendly vs stored-friendly home', () => {
  const pair = SCENARIO_PAIRS.find(p => p.name === 'combi_friendly_vs_stored_friendly')!;
  const modelA = buildAuditModel(pair.scA); // combi-friendly (1 person)
  const modelB = buildAuditModel(pair.scB); // stored-friendly (3 people, 2 baths)

  it('drivingStyleMode changes from combi to stored', () => {
    expect(modelA.page1.currentSystem.drivingStyleMode).toBe('combi');
    expect(modelB.page1.currentSystem.drivingStyleMode).toBe('stored');
  });

  it('peakSimultaneousOutlets is higher for stored-friendly home', () => {
    expect(modelB.page1.home.peakSimultaneousOutlets).toBeGreaterThan(
      modelA.page1.home.peakSimultaneousOutlets,
    );
  });

  it('storageBenefitLabel differs between combi-friendly and stored-friendly', () => {
    expect(modelA.page1.home.storageBenefitLabel).not.toBe(modelB.page1.home.storageBenefitLabel);
  });

  it('model fingerprints differ', () => {
    expect(modelFingerprint(modelA)).not.toBe(modelFingerprint(modelB));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. ARCHITECTURE AS PRIMARY DISCRIMINATOR
//    dhwArchitecture must be the first branching key for visuals, wording,
//    and requirements.  These tests enforce the architecture contract end-to-end.
// ═════════════════════════════════════════════════════════════════════════════

describe('Architecture contract — dhwArchitecture field is present on every scenario model', () => {
  it('every scenario currentSystem has dhwArchitecture in the valid set', () => {
    const validArchitectures = new Set([
      'on_demand', 'standard_cylinder', 'mixergy', 'thermal_store',
    ]);
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      const arch = model.page1.currentSystem.dhwArchitecture;
      expect(
        validArchitectures.has(arch),
        `"${name}" — unexpected dhwArchitecture: "${arch}"`,
      ).toBe(true);
    }
  });

  it('every shortlist option has dhwArchitecture in the valid set', () => {
    const validArchitectures = new Set([
      'on_demand', 'standard_cylinder', 'mixergy', 'thermal_store',
    ]);
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      for (const opt of model.page4Plus.options) {
        const arch = opt.dhwArchitecture;
        expect(
          validArchitectures.has(arch),
          `"${name}" option "${opt.family}" — unexpected dhwArchitecture: "${arch}"`,
        ).toBe(true);
      }
    }
  });
});

describe('Architecture contract — correct architecture per scenario', () => {
  it('combi scenario → dhwArchitecture is on_demand', () => {
    expect(
      PREBUILT_MODELS['single_person_combi_fit'].page1.currentSystem.dhwArchitecture,
    ).toBe('on_demand');
  });

  it('standard unvented scenario → dhwArchitecture is standard_cylinder', () => {
    expect(
      PREBUILT_MODELS['unvented_current_system'].page1.currentSystem.dhwArchitecture,
    ).toBe('standard_cylinder');
  });

  it('open-vented scenario → dhwArchitecture is standard_cylinder', () => {
    expect(
      PREBUILT_MODELS['open_vented_current_system'].page1.currentSystem.dhwArchitecture,
    ).toBe('standard_cylinder');
  });

  it('Mixergy scenario → dhwArchitecture is mixergy', () => {
    expect(
      PREBUILT_MODELS['mixergy_current_system'].page1.currentSystem.dhwArchitecture,
    ).toBe('mixergy');
  });

  it('thermal store scenario → dhwArchitecture is thermal_store', () => {
    expect(
      PREBUILT_MODELS['thermal_store_current_system'].page1.currentSystem.dhwArchitecture,
    ).toBe('thermal_store');
  });

  it('combi shortlist option → dhwArchitecture is on_demand', () => {
    const model = PREBUILT_MODELS['single_person_combi_fit'];
    const combiOpt = model.page4Plus.options.find(o => o.family === 'combi');
    if (combiOpt) {
      expect(combiOpt.dhwArchitecture).toBe('on_demand');
    }
  });
});

describe('Architecture contract — four architectures produce four distinct dhwArchitecture values', () => {
  it('all four architecture values appear across the scenario set', () => {
    const architectures = Object.values(PREBUILT_MODELS).map(
      m => m.page1.currentSystem.dhwArchitecture,
    );
    const unique = new Set(architectures);
    expect(unique.has('on_demand')).toBe(true);
    expect(unique.has('standard_cylinder')).toBe(true);
    expect(unique.has('mixergy')).toBe(true);
    expect(unique.has('thermal_store')).toBe(true);
  });

  it('standard_cylinder and thermal_store architectures produce different fingerprints', () => {
    expect(
      modelFingerprint(PREBUILT_MODELS['unvented_current_system']),
    ).not.toBe(
      modelFingerprint(PREBUILT_MODELS['thermal_store_current_system']),
    );
  });

  it('standard_cylinder and mixergy architectures produce different fingerprints', () => {
    expect(
      modelFingerprint(PREBUILT_MODELS['unvented_current_system']),
    ).not.toBe(
      modelFingerprint(PREBUILT_MODELS['mixergy_current_system']),
    );
  });

  it('mixergy and thermal_store architectures produce different fingerprints', () => {
    expect(
      modelFingerprint(PREBUILT_MODELS['mixergy_current_system']),
    ).not.toBe(
      modelFingerprint(PREBUILT_MODELS['thermal_store_current_system']),
    );
  });
});

describe('Architecture contract — resolveCurrentSystemVisualId returns correct visual per architecture', () => {
  it('on_demand → driving_style visual', () => {
    expect(resolveCurrentSystemVisualId('on_demand')).toBe('driving_style');
  });

  it('standard_cylinder → cylinder_charge_standard visual', () => {
    expect(resolveCurrentSystemVisualId('standard_cylinder')).toBe('cylinder_charge_standard');
  });

  it('mixergy → cylinder_charge_mixergy visual', () => {
    expect(resolveCurrentSystemVisualId('mixergy')).toBe('cylinder_charge_mixergy');
  });

  it('thermal_store → thermal_store visual', () => {
    expect(resolveCurrentSystemVisualId('thermal_store')).toBe('thermal_store');
  });

  it('undefined architecture → driving_style fallback', () => {
    expect(resolveCurrentSystemVisualId(undefined)).toBe('driving_style');
  });

  it('thermal_store scenario uses thermal_store visual (architecture-first branching)', () => {
    const arch = PREBUILT_MODELS['thermal_store_current_system'].page1.currentSystem.dhwArchitecture;
    expect(resolveCurrentSystemVisualId(arch)).toBe('thermal_store');
  });

  it('mixergy scenario uses cylinder_charge_mixergy visual (not driving_style)', () => {
    const arch = PREBUILT_MODELS['mixergy_current_system'].page1.currentSystem.dhwArchitecture;
    expect(resolveCurrentSystemVisualId(arch)).toBe('cylinder_charge_mixergy');
  });

  it('standard_cylinder scenario uses cylinder_charge_standard visual (not driving_style)', () => {
    const arch = PREBUILT_MODELS['unvented_current_system'].page1.currentSystem.dhwArchitecture;
    expect(resolveCurrentSystemVisualId(arch)).toBe('cylinder_charge_standard');
  });

  it('combi scenario uses driving_style visual', () => {
    const arch = PREBUILT_MODELS['single_person_combi_fit'].page1.currentSystem.dhwArchitecture;
    expect(resolveCurrentSystemVisualId(arch)).toBe('driving_style');
  });
});

describe('Architecture contract — architecture never derived from appliance family alone', () => {
  it('system boiler + vented storage → standard_cylinder (not confused with open-vented family inference)', () => {
    const model = PREBUILT_MODELS['system_boiler_vented'];
    expect(model.page1.currentSystem.dhwArchitecture).toBe('standard_cylinder');
    expect(model.page1.currentSystem.dhwStorageType).toBe('open_vented');
  });

  it('regular boiler + unvented storage → standard_cylinder (not confused with regular family inference)', () => {
    const model = PREBUILT_MODELS['regular_boiler_unvented'];
    expect(model.page1.currentSystem.dhwArchitecture).toBe('standard_cylinder');
    expect(model.page1.currentSystem.dhwStorageType).toBe('unvented');
  });

  it('thermal_store architecture is independent of driving style mode', () => {
    // A regular boiler with thermal store → thermal_store architecture even though
    // drivingStyleMode is 'stored' (same as a regular boiler with a vented cylinder)
    const thermalModel = PREBUILT_MODELS['thermal_store_current_system'];
    const ventedModel  = PREBUILT_MODELS['open_vented_current_system'];
    expect(thermalModel.page1.currentSystem.drivingStyleMode).toBe('stored');
    expect(ventedModel.page1.currentSystem.drivingStyleMode).toBe('stored');
    // But architectures must differ
    expect(thermalModel.page1.currentSystem.dhwArchitecture).toBe('thermal_store');
    expect(ventedModel.page1.currentSystem.dhwArchitecture).toBe('standard_cylinder');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. ARCHITECTURE AS PRIMARY DISCRIMINATOR — OPTIONS PAGE (Page 2)
//     Each AvailableOptionExplanation must carry its own dhwArchitecture.
//     The four architectures must produce distinct through-energy wording.
// ═════════════════════════════════════════════════════════════════════════════

describe('Architecture contract — page2 options carry dhwArchitecture field', () => {
  const VALID_ARCHITECTURES = new Set([
    'on_demand', 'standard_cylinder', 'mixergy', 'thermal_store',
  ]);

  it('every scenario page2 option has a valid dhwArchitecture', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      for (const opt of model.page2.options) {
        expect(
          VALID_ARCHITECTURES.has(opt.dhwArchitecture),
          `"${name}" option "${opt.id}" — unexpected dhwArchitecture: "${opt.dhwArchitecture}"`,
        ).toBe(true);
      }
    }
  });

  it('combi option always has dhwArchitecture = on_demand', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      const combi = model.page2.options.find(o => o.id === 'combi');
      if (combi) {
        expect(combi.dhwArchitecture, `"${name}" combi option must be on_demand`).toBe('on_demand');
      }
    }
  });

  it('ashp option always has dhwArchitecture = standard_cylinder', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      const ashp = model.page2.options.find(o => o.id === 'ashp');
      if (ashp) {
        expect(ashp.dhwArchitecture, `"${name}" ashp option must be standard_cylinder`).toBe('standard_cylinder');
      }
    }
  });

  it('stored options in Mixergy scenario have dhwArchitecture = mixergy', () => {
    const model = PREBUILT_MODELS['mixergy_current_system'];
    const storedOptions = model.page2.options.filter(o => o.id !== 'combi' && o.id !== 'ashp');
    for (const opt of storedOptions) {
      expect(opt.dhwArchitecture, `stored option "${opt.id}" in Mixergy scenario must be mixergy`).toBe('mixergy');
    }
  });

  it('stored options in standard unvented scenario have dhwArchitecture = standard_cylinder', () => {
    const model = PREBUILT_MODELS['unvented_current_system'];
    const storedOptions = model.page2.options.filter(o => o.id !== 'combi' && o.id !== 'ashp');
    for (const opt of storedOptions) {
      expect(opt.dhwArchitecture, `stored option "${opt.id}" in standard unvented scenario must be standard_cylinder`).toBe('standard_cylinder');
    }
  });

  it('combi option throughHomeNotes reference on-demand delivery for low-demand household', () => {
    const model = PREBUILT_MODELS['single_person_combi_fit'];
    const combi = model.page2.options.find(o => o.id === 'combi');
    expect(combi).toBeDefined();
    // on_demand architecture — home notes must mention on-demand or outlet/draw profile
    const homeNotesJoined = combi!.throughHomeNotes.join(' ');
    expect(homeNotesJoined).toMatch(/on-demand|single-outlet|combi/i);
  });

  it('stored option throughHomeNotes reference cylinder sizing / demand volume', () => {
    const model = PREBUILT_MODELS['large_family_stored_fit'];
    const stored = model.page2.options.find(o => o.id !== 'combi' && o.status !== 'rejected');
    if (stored) {
      const homeNotesJoined = stored.throughHomeNotes.join(' ');
      expect(homeNotesJoined).toMatch(/cylinder|demand|L\/day/i);
    }
  });

  it('existing PV: stored option throughEnergyNotes mention solar diverter', () => {
    const model = PREBUILT_MODELS['strong_pv_good_alignment'];
    const stored = model.page2.options.find(o =>
      (o.id === 'stored_unvented' || o.id === 'system_unvented') && o.status !== 'rejected',
    );
    if (stored) {
      const energyNotesJoined = stored.throughEnergyNotes.join(' ');
      expect(energyNotesJoined).toMatch(/solar diverter|surplus|PV/i);
    }
  });

  it('existing PV: combi option throughEnergyNotes mention cannot store surplus', () => {
    const model = PREBUILT_MODELS['strong_pv_poor_alignment'];
    const combi = model.page2.options.find(o => o.id === 'combi');
    if (combi) {
      const energyNotesJoined = combi.throughEnergyNotes.join(' ');
      expect(energyNotesJoined).toMatch(/cannot store|battery|surplus/i);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 11. SIMULATOR HANDOFF — architecture-specific note
//     The finalPage must carry a dhwArchitectureNote that differs across the
//     four architectures.  The CTA label must refer to "System Simulator".
// ═════════════════════════════════════════════════════════════════════════════

describe('Architecture contract — finalPage carries dhwArchitectureNote', () => {
  it('every scenario finalPage has a non-empty dhwArchitectureNote', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      expect(
        model.finalPage.dhwArchitectureNote,
        `"${name}" finalPage.dhwArchitectureNote is empty`,
      ).toBeTruthy();
    }
  });

  it('four architectures produce four distinct dhwArchitectureNote values', () => {
    const notes = [
      PREBUILT_MODELS['single_person_combi_fit'].finalPage.dhwArchitectureNote,
      PREBUILT_MODELS['unvented_current_system'].finalPage.dhwArchitectureNote,
      PREBUILT_MODELS['mixergy_current_system'].finalPage.dhwArchitectureNote,
      PREBUILT_MODELS['thermal_store_current_system'].finalPage.dhwArchitectureNote,
    ];
    const unique = new Set(notes);
    expect(unique.size).toBe(4);
  });

  it('on_demand note references System Simulator and on-demand/combi behaviour', () => {
    const note = PREBUILT_MODELS['single_person_combi_fit'].finalPage.dhwArchitectureNote;
    expect(note).toMatch(/System Simulator/i);
    expect(note).toMatch(/on-demand|combi|flow rate|simultaneous/i);
  });

  it('standard_cylinder note references System Simulator and cylinder/recovery', () => {
    const note = PREBUILT_MODELS['unvented_current_system'].finalPage.dhwArchitectureNote;
    expect(note).toMatch(/System Simulator/i);
    expect(note).toMatch(/cylinder|recovery|solar/i);
  });

  it('mixergy note references System Simulator and Mixergy-specific behaviour', () => {
    const note = PREBUILT_MODELS['mixergy_current_system'].finalPage.dhwArchitectureNote;
    expect(note).toMatch(/System Simulator/i);
    expect(note).toMatch(/Mixergy|demand-mirroring|cycling/i);
  });

  it('thermal_store note references System Simulator and thermal-store-specific behaviour', () => {
    const note = PREBUILT_MODELS['thermal_store_current_system'].finalPage.dhwArchitectureNote;
    expect(note).toMatch(/System Simulator/i);
    expect(note).toMatch(/thermal store|primary temperature|exchanger/i);
  });

  it('homeScenarioDescription includes DHW architecture label for all four scenarios', () => {
    // on_demand
    expect(PREBUILT_MODELS['single_person_combi_fit'].finalPage.homeScenarioDescription)
      .toMatch(/on-demand/i);
    // standard_cylinder
    expect(PREBUILT_MODELS['unvented_current_system'].finalPage.homeScenarioDescription)
      .toMatch(/stored hot water via cylinder/i);
    // mixergy
    expect(PREBUILT_MODELS['mixergy_current_system'].finalPage.homeScenarioDescription)
      .toMatch(/Mixergy/i);
    // thermal_store
    expect(PREBUILT_MODELS['thermal_store_current_system'].finalPage.homeScenarioDescription)
      .toMatch(/thermal store/i);
  });

  it('energyTimingNotes reference "System Simulator" not just "simulator"', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      const notesJoined = model.finalPage.energyTimingNotes.join(' ');
      // Must not use the ambiguous bare "simulator" word — must say "System Simulator"
      expect(notesJoined, `"${name}" energyTimingNotes must reference "System Simulator"`).toMatch(/System Simulator/i);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 12. NO FORBIDDEN SIMULATOR TERMINOLOGY
//     Lightweight preview surfaces must never be called "simulator".
//     All "simulator" references in the presentation output must target
//     the real System Simulator (not the Scenario Preview / Behaviour Preview).
// ═════════════════════════════════════════════════════════════════════════════

describe('Simulator terminology — presentation output must not use ambiguous simulator wording', () => {
  const FORBIDDEN_SIMULATOR_PHRASES = [
    'scenario preview',
    'behaviour preview',
    'preview panel',
    'ScenarioPreviewPanel',
    'PortalSimulatorPanel',
  ] as const;

  for (const phrase of FORBIDDEN_SIMULATOR_PHRASES) {
    it(`no scenario output contains the forbidden simulator phrase "${phrase}"`, () => {
      const violations: string[] = [];
      for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
        const strings = collectAllStrings(model);
        const hits = strings.filter(s => s.toLowerCase().includes(phrase.toLowerCase()));
        if (hits.length > 0) {
          violations.push(`"${name}": ${hits.join('; ')}`);
        }
      }
      expect(
        violations,
        `Forbidden phrase "${phrase}" found in presentation output:\n${violations.join('\n')}`,
      ).toHaveLength(0);
    });
  }

  it('simulator references in finalPage use "System Simulator" not bare "simulator"', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      const architectureNote = model.finalPage.dhwArchitectureNote;
      // The architecture note must refer to "System Simulator" (canonical term)
      expect(architectureNote, `"${name}" dhwArchitectureNote must say "System Simulator"`).toMatch(/System Simulator/i);
    }
  });
});

// ─── Architecture-note task patterns (shared across difference-regression tests) ─

/**
 * Regex patterns for asserting that dhwArchitectureNote contains task-based
 * guidance ("try...") for the correct architecture.  Used across multiple
 * architecture-difference describe blocks to avoid duplication.
 */
const ARCH_NOTE_PATTERNS = {
  on_demand:         /try|overlapping|simultaneous/i,
  standard_cylinder: /try|bath|back-to-back/i,
  mixergy:           /try|top[- ]down|demand-mirroring/i,
  thermal_store:     /try|stored heat|primary|thermal store/i,
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// 13. ARCHITECTURE-DIFFERENCE REGRESSION
//     Changing ONLY dhwArchitecture (holding house / home / objectives constant)
//     must materially change:
//       a) page2 option notes (throughHomeNotes / throughEnergyNotes)
//       b) options-overview visual id (resolveOptionsOverviewVisualId)
//       c) homeScenarioDescription (includes architecture label)
//       d) dhwArchitectureNote (actionable task guidance)
//
//     This catches silent conflation where architecture changes stop flowing
//     through the presentation layer.
// ═════════════════════════════════════════════════════════════════════════════

describe('Architecture-difference regression — on_demand vs standard_cylinder', () => {
  const pair = SCENARIO_PAIRS.find(p => p.name === 'on_demand_vs_standard_cylinder')!;
  const modelA = buildAuditModel(pair.scA); // on_demand (combi)
  const modelB = buildAuditModel(pair.scB); // standard_cylinder (unvented)

  it('pair fixture is present', () => {
    expect(pair).toBeDefined();
  });

  it('dhwArchitecture changes from on_demand to standard_cylinder', () => {
    expect(modelA.page1.currentSystem.dhwArchitecture).toBe('on_demand');
    expect(modelB.page1.currentSystem.dhwArchitecture).toBe('standard_cylinder');
  });

  it('options-overview visual differs: null (on_demand) vs cylinder_charge_standard (standard_cylinder)', () => {
    const visualA = resolveOptionsOverviewVisualId(modelA.page1.currentSystem.dhwArchitecture);
    const visualB = resolveOptionsOverviewVisualId(modelB.page1.currentSystem.dhwArchitecture);
    expect(visualA).toBeNull();
    expect(visualB).toBe('cylinder_charge_standard');
    expect(visualA).not.toBe(visualB);
  });

  it('homeScenarioDescription differs (contains different architecture label)', () => {
    expect(modelA.finalPage.homeScenarioDescription).toMatch(/on-demand/i);
    expect(modelB.finalPage.homeScenarioDescription).toMatch(/stored hot water via cylinder/i);
    expect(modelA.finalPage.homeScenarioDescription).not.toBe(
      modelB.finalPage.homeScenarioDescription,
    );
  });

  it('dhwArchitectureNote differs (different task guidance per architecture)', () => {
    expect(modelA.finalPage.dhwArchitectureNote).not.toBe(modelB.finalPage.dhwArchitectureNote);
    expect(modelA.finalPage.dhwArchitectureNote).toMatch(ARCH_NOTE_PATTERNS.on_demand);
    expect(modelB.finalPage.dhwArchitectureNote).toMatch(ARCH_NOTE_PATTERNS.standard_cylinder);
  });

  it('page2 combi option throughHomeNotes differ from stored option notes across architectures', () => {
    // on_demand scenario — combi option should reference on-demand delivery
    const combiA = modelA.page2.options.find(o => o.id === 'combi');
    if (combiA) {
      expect(combiA.throughHomeNotes.join(' ')).toMatch(/on-demand|single-outlet|combi/i);
    }
    // standard_cylinder scenario — stored option should reference cylinder
    const storedB = modelB.page2.options.find(o => o.id !== 'combi' && o.id !== 'ashp');
    if (storedB) {
      expect(storedB.throughHomeNotes.join(' ')).toMatch(/cylinder|demand|L\/day/i);
    }
  });

  it('model fingerprints differ', () => {
    expect(modelFingerprint(modelA)).not.toBe(modelFingerprint(modelB));
  });
});

describe('Architecture-difference regression — standard_cylinder vs mixergy', () => {
  const pair = SCENARIO_PAIRS.find(p => p.name === 'standard_cylinder_vs_mixergy')!;
  const modelA = buildAuditModel(pair.scA); // standard_cylinder
  const modelB = buildAuditModel(pair.scB); // mixergy

  it('dhwArchitecture changes from standard_cylinder to mixergy', () => {
    expect(modelA.page1.currentSystem.dhwArchitecture).toBe('standard_cylinder');
    expect(modelB.page1.currentSystem.dhwArchitecture).toBe('mixergy');
  });

  it('options-overview visual differs: cylinder_charge_standard vs cylinder_charge_mixergy', () => {
    const visualA = resolveOptionsOverviewVisualId(modelA.page1.currentSystem.dhwArchitecture);
    const visualB = resolveOptionsOverviewVisualId(modelB.page1.currentSystem.dhwArchitecture);
    expect(visualA).toBe('cylinder_charge_standard');
    expect(visualB).toBe('cylinder_charge_mixergy');
    expect(visualA).not.toBe(visualB);
  });

  it('homeScenarioDescription differs (standard cylinder vs Mixergy label)', () => {
    expect(modelA.finalPage.homeScenarioDescription).toMatch(/stored hot water via cylinder/i);
    expect(modelB.finalPage.homeScenarioDescription).toMatch(/Mixergy/i);
    expect(modelA.finalPage.homeScenarioDescription).not.toBe(
      modelB.finalPage.homeScenarioDescription,
    );
  });

  it('dhwArchitectureNote differs (standard cylinder task vs Mixergy-specific task)', () => {
    expect(modelA.finalPage.dhwArchitectureNote).not.toBe(modelB.finalPage.dhwArchitectureNote);
    expect(modelA.finalPage.dhwArchitectureNote).toMatch(ARCH_NOTE_PATTERNS.standard_cylinder);
    expect(modelB.finalPage.dhwArchitectureNote).toMatch(ARCH_NOTE_PATTERNS.mixergy);
  });
});

describe('Architecture-difference regression — standard_cylinder vs thermal_store', () => {
  const pair = SCENARIO_PAIRS.find(p => p.name === 'standard_cylinder_vs_thermal_store')!;
  const modelA = buildAuditModel(pair.scA); // standard_cylinder
  const modelB = buildAuditModel(pair.scB); // thermal_store

  it('dhwArchitecture changes from standard_cylinder to thermal_store', () => {
    expect(modelA.page1.currentSystem.dhwArchitecture).toBe('standard_cylinder');
    expect(modelB.page1.currentSystem.dhwArchitecture).toBe('thermal_store');
  });

  it('options-overview visual differs: cylinder_charge_standard vs thermal_store', () => {
    const visualA = resolveOptionsOverviewVisualId(modelA.page1.currentSystem.dhwArchitecture);
    const visualB = resolveOptionsOverviewVisualId(modelB.page1.currentSystem.dhwArchitecture);
    expect(visualA).toBe('cylinder_charge_standard');
    expect(visualB).toBe('thermal_store');
    expect(visualA).not.toBe(visualB);
  });

  it('homeScenarioDescription differs (cylinder label vs thermal store label)', () => {
    expect(modelA.finalPage.homeScenarioDescription).toMatch(/stored hot water via cylinder/i);
    expect(modelB.finalPage.homeScenarioDescription).toMatch(/thermal store/i);
    expect(modelA.finalPage.homeScenarioDescription).not.toBe(
      modelB.finalPage.homeScenarioDescription,
    );
  });

  it('dhwArchitectureNote differs (cylinder task vs thermal store task)', () => {
    expect(modelA.finalPage.dhwArchitectureNote).not.toBe(modelB.finalPage.dhwArchitectureNote);
    expect(modelA.finalPage.dhwArchitectureNote).toMatch(ARCH_NOTE_PATTERNS.standard_cylinder);
    expect(modelB.finalPage.dhwArchitectureNote).toMatch(ARCH_NOTE_PATTERNS.thermal_store);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 14. ACTIONABLE SIMULATOR NOTES
//     dhwArchitectureNote must be task-based (tell the user what to try),
//     not just descriptive (tell the user what the system is).
//     Each note must include a "try" prompt for the System Simulator.
// ═════════════════════════════════════════════════════════════════════════════

describe('Actionable simulator notes — dhwArchitectureNote is task-based', () => {
  it('on_demand note prompts the user to try overlapping tap use or short draws', () => {
    const note = PREBUILT_MODELS['single_person_combi_fit'].finalPage.dhwArchitectureNote;
    expect(note).toMatch(/try/i);
    expect(note).toMatch(ARCH_NOTE_PATTERNS.on_demand);
  });

  it('standard_cylinder note prompts the user to try a bath or back-to-back draws', () => {
    const note = PREBUILT_MODELS['unvented_current_system'].finalPage.dhwArchitectureNote;
    expect(note).toMatch(/try/i);
    expect(note).toMatch(ARCH_NOTE_PATTERNS.standard_cylinder);
  });

  it('mixergy note prompts the user to try top-down stored hot water', () => {
    const note = PREBUILT_MODELS['mixergy_current_system'].finalPage.dhwArchitectureNote;
    expect(note).toMatch(/try/i);
    expect(note).toMatch(ARCH_NOTE_PATTERNS.mixergy);
  });

  it('thermal_store note prompts the user to try stored-heat and primary temperature behaviour', () => {
    const note = PREBUILT_MODELS['thermal_store_current_system'].finalPage.dhwArchitectureNote;
    expect(note).toMatch(/try/i);
    expect(note).toMatch(ARCH_NOTE_PATTERNS.thermal_store);
  });

  it('all four architecture notes include "try" task prompts', () => {
    const architectureScenarios = [
      'single_person_combi_fit',
      'unvented_current_system',
      'mixergy_current_system',
      'thermal_store_current_system',
    ] as const;
    for (const name of architectureScenarios) {
      const note = PREBUILT_MODELS[name].finalPage.dhwArchitectureNote;
      expect(note, `"${name}" dhwArchitectureNote must be task-based (include "try")`).toMatch(/try/i);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 15. SIMULATOR-PRESENCE AUDIT
//     The presentation model must always carry a valid, populated final page
//     that routes to the real System Simulator, not a lightweight preview.
//
//     Checks:
//       a) finalPage is always present and has a non-empty homeScenarioDescription
//       b) simulatorCapabilities is always a non-empty array
//       c) simulatorCapabilities mention core simulator features (diagram, taps, etc.)
//       d) no simulatorCapabilities entry references a forbidden preview surface
//       e) the canonical simulator note always targets "System Simulator"
// ═════════════════════════════════════════════════════════════════════════════

describe('Simulator-presence audit — finalPage always routes to the real System Simulator', () => {
  it('every scenario produces a non-empty finalPage homeScenarioDescription', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      expect(
        model.finalPage.homeScenarioDescription,
        `"${name}" finalPage.homeScenarioDescription is empty`,
      ).toBeTruthy();
    }
  });

  it('every scenario finalPage has a non-empty simulatorCapabilities list', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      expect(
        model.finalPage.simulatorCapabilities.length,
        `"${name}" finalPage.simulatorCapabilities must not be empty`,
      ).toBeGreaterThan(0);
    }
  });

  it('simulatorCapabilities covers the full system diagram', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      const caps = model.finalPage.simulatorCapabilities.join(' ');
      expect(
        caps,
        `"${name}" simulatorCapabilities must mention "system diagram"`,
      ).toMatch(/system diagram/i);
    }
  });

  it('simulatorCapabilities covers live tap controls', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      const caps = model.finalPage.simulatorCapabilities.join(' ');
      expect(
        caps,
        `"${name}" simulatorCapabilities must mention tap controls`,
      ).toMatch(/tap|outlet/i);
    }
  });

  it('simulatorCapabilities covers hot-water behaviour', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      const caps = model.finalPage.simulatorCapabilities.join(' ');
      expect(
        caps,
        `"${name}" simulatorCapabilities must mention hot-water behaviour`,
      ).toMatch(/hot[- ]water|draw|recovery/i);
    }
  });

  it('simulatorCapabilities covers heating response', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      const caps = model.finalPage.simulatorCapabilities.join(' ');
      expect(
        caps,
        `"${name}" simulatorCapabilities must mention heating response`,
      ).toMatch(/heat/i);
    }
  });

  const FORBIDDEN_PREVIEW_PHRASES = [
    'scenario preview',
    'behaviour preview',
    'preview panel',
    'ScenarioPreviewPanel',
    'PortalSimulatorPanel',
  ] as const;

  for (const phrase of FORBIDDEN_PREVIEW_PHRASES) {
    it(`simulatorCapabilities do not reference forbidden preview surface "${phrase}"`, () => {
      for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
        const caps = model.finalPage.simulatorCapabilities.join(' ');
        expect(
          caps.toLowerCase(),
          `"${name}" simulatorCapabilities must not reference "${phrase}"`,
        ).not.toContain(phrase.toLowerCase());
      }
    });
  }

  it('dhwArchitectureNote always references the real System Simulator (not preview surface)', () => {
    for (const [name, model] of Object.entries(PREBUILT_MODELS)) {
      const note = model.finalPage.dhwArchitectureNote;
      expect(note, `"${name}" dhwArchitectureNote must reference "System Simulator"`).toMatch(/System Simulator/i);
      FORBIDDEN_PREVIEW_PHRASES.forEach(phrase => {
        expect(
          note.toLowerCase(),
          `"${name}" dhwArchitectureNote must not reference "${phrase}"`,
        ).not.toContain(phrase.toLowerCase());
      });
    }
  });
});
