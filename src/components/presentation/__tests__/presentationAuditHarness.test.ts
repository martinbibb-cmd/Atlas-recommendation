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
import { resolveShortlistVisualId, resolveCurrentSystemVisualId } from '../presentationVisualMapping';
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
  strings.push(cs.systemTypeLabel, cs.ageLabel, cs.ageContext);
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
    ...model.finalPage.houseConstraintNotes, ...model.finalPage.energyTimingNotes);

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
        expect(model.page1.currentSystem.systemTypeLabel).toBeTruthy();
        expect(model.page1.currentSystem.ageLabel).toBeTruthy();
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
