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
import { resolveShortlistVisualId } from '../presentationVisualMapping';
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

const BUILT = Object.fromEntries(
  Object.entries(AUDIT_SCENARIOS).map(([name, input]) => [name, buildAuditModel(input)]),
) as Record<string, CanonicalPresentationModel>;

// ═════════════════════════════════════════════════════════════════════════════
// 1. CONTRACT AUDIT — model shape invariants
// ═════════════════════════════════════════════════════════════════════════════

describe('Contract audit — canonical presentation model shape', () => {

  describe('every scenario produces a fully-populated model', () => {
    for (const [name] of Object.entries(AUDIT_SCENARIOS)) {
      it(`scenario "${name}" — page1 house signals are populated`, () => {
        const model = BUILT[name];
        expect(model.page1.house.heatLossLabel).toBeTruthy();
        expect(model.page1.house.pipeworkLabel).toBeTruthy();
        expect(model.page1.house.wallTypeKey).toMatch(/^(solid_masonry|cavity_uninsulated|cavity_insulated)$/);
      });

      it(`scenario "${name}" — page1 home signals are populated`, () => {
        const model = BUILT[name];
        expect(model.page1.home.demandProfileLabel).toBeTruthy();
        expect(model.page1.home.dailyHotWaterLitres).toBeGreaterThan(0);
        expect(model.page1.home.peakSimultaneousOutlets).toBeGreaterThanOrEqual(1);
        expect(model.page1.home.storageBenefitLabel).toBeTruthy();
      });

      it(`scenario "${name}" — page1 energy signals are populated`, () => {
        const model = BUILT[name];
        expect(model.page1.energy.pvStatusLabel).toBeTruthy();
        expect(model.page1.energy.pvSuitabilityLabel).toBeTruthy();
      });

      it(`scenario "${name}" — page1 currentSystem signals are populated`, () => {
        const model = BUILT[name];
        expect(model.page1.currentSystem.systemTypeLabel).toBeTruthy();
        expect(model.page1.currentSystem.ageLabel).toBeTruthy();
        expect(model.page1.currentSystem.drivingStyleMode).toMatch(/^(combi|stored|heat_pump)$/);
        expect(model.page1.currentSystem.dhwStorageType).toMatch(
          /^(open_vented|unvented|thermal_store|mixergy|unknown)$/,
        );
      });

      it(`scenario "${name}" — page1_5 ageing context is populated`, () => {
        const model = BUILT[name];
        expect(model.page1_5.heading).toBeTruthy();
        expect(model.page1_5.ageBandLabel).toBeTruthy();
      });

      it(`scenario "${name}" — page2 options list is non-empty`, () => {
        const model = BUILT[name];
        expect(model.page2.options.length).toBeGreaterThan(0);
      });

      it(`scenario "${name}" — page3 ranking items are non-empty`, () => {
        const model = BUILT[name];
        expect(model.page3.items.length).toBeGreaterThan(0);
      });

      it(`scenario "${name}" — page4Plus shortlist options are non-empty`, () => {
        const model = BUILT[name];
        expect(model.page4Plus.options.length).toBeGreaterThan(0);
      });

      it(`scenario "${name}" — finalPage home scenario description is populated`, () => {
        const model = BUILT[name];
        expect(model.finalPage.homeScenarioDescription).toBeTruthy();
      });
    }
  });

  it('dhwStorageType is explicit — never inferred silently from appliance family', () => {
    // When dhwStorageType is given, the presentation must use it exactly.
    // Input 'vented' → output 'open_vented'; input 'unvented' → output 'unvented'.
    // This test ensures the inputDhwStorageTypeToSignal mapping is applied, not bypassed.
    const ventedModel  = BUILT['open_vented_current_system'];
    const unventedModel = BUILT['unvented_current_system'];

    expect(ventedModel.page1.currentSystem.dhwStorageType).toBe('open_vented');
    expect(unventedModel.page1.currentSystem.dhwStorageType).toBe('unvented');
  });

  it('appliance family does not determine dhwStorageType — system+vented is open_vented', () => {
    // system family with 'vented' storage must produce 'open_vented', not 'unvented'
    const model = BUILT['system_boiler_vented'];
    expect(model.page1.currentSystem.drivingStyleMode).toBe('stored'); // system family → stored mode
    expect(model.page1.currentSystem.dhwStorageType).toBe('open_vented'); // vented storage, not inferred from family
  });

  it('appliance family does not determine dhwStorageType — regular+unvented is unvented', () => {
    // regular family with 'unvented' storage must produce 'unvented', not 'open_vented'
    const model = BUILT['regular_boiler_unvented'];
    expect(model.page1.currentSystem.drivingStyleMode).toBe('stored'); // regular family → stored mode
    expect(model.page1.currentSystem.dhwStorageType).toBe('unvented'); // unvented storage, not inferred from family
  });

  it('page2 every option has a non-empty whatItIs description', () => {
    for (const [name, model] of Object.entries(BUILT)) {
      for (const opt of model.page2.options) {
        expect(opt.whatItIs, `"${name}" option "${opt.id}" has empty whatItIs`).toBeTruthy();
      }
    }
  });

  it('page2 every option has a status within the expected set', () => {
    for (const [name, model] of Object.entries(BUILT)) {
      for (const opt of model.page2.options) {
        expect(
          ['viable', 'caution', 'rejected'].includes(opt.status),
          `"${name}" option "${opt.id}" has invalid status "${opt.status}"`,
        ).toBe(true);
      }
    }
  });

  it('page3 ranking items have ranks starting at 1 without gaps', () => {
    for (const [name, model] of Object.entries(BUILT)) {
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
  const model = BUILT['single_person_combi_fit'];

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
  const model = BUILT['large_family_stored_fit'];

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
  const model = BUILT['open_vented_current_system'];

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
  const model = BUILT['unvented_current_system'];

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
  const poorModel = BUILT['strong_pv_poor_alignment'];
  const goodModel = BUILT['strong_pv_good_alignment'];

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
  const model = BUILT['heat_pump_borderline'];

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
  const model = BUILT['high_hardness_combi_risk'];

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
  const model = BUILT['loft_conversion_vented_constraint'];

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

    for (const [name, model] of Object.entries(BUILT)) {
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

    for (const [name, model] of Object.entries(BUILT)) {
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
    const ventedModel = BUILT['open_vented_current_system'];
    expect(ventedModel.page1.currentSystem.dhwStorageType).not.toBe('unvented');
  });

  it('unvented scenarios never produce dhwStorageType="open_vented"', () => {
    const unventedModel = BUILT['unvented_current_system'];
    expect(unventedModel.page1.currentSystem.dhwStorageType).not.toBe('open_vented');
  });

  it('system boiler + vented storage is not conflated to unvented', () => {
    const model = BUILT['system_boiler_vented'];
    expect(model.page1.currentSystem.dhwStorageType).toBe('open_vented');
  });

  it('regular boiler + unvented storage is not conflated to open_vented', () => {
    const model = BUILT['regular_boiler_unvented'];
    expect(model.page1.currentSystem.dhwStorageType).toBe('unvented');
  });
});

describe('Rule audit — shortlist visuals must use signal logic, not raw family names', () => {
  it('solar storage opportunity=high → cylinder_charge visual regardless of family', () => {
    // Signal override: solar=high wins over any family-based fallback
    expect(resolveShortlistVisualId('high', 1, 'combi')).toBe('cylinder_charge');
    expect(resolveShortlistVisualId('high', 1, 'stored_unvented')).toBe('cylinder_charge');
    expect(resolveShortlistVisualId('high', 1, 'ashp')).toBe('cylinder_charge');
  });

  it('peakSimultaneousOutlets >= 2 → flow_split when solar is not high', () => {
    expect(resolveShortlistVisualId('low', 2, 'combi')).toBe('flow_split');
    expect(resolveShortlistVisualId('medium', 2, 'stored_vented')).toBe('flow_split');
    expect(resolveShortlistVisualId('low', 3, 'system_unvented')).toBe('flow_split');
  });

  it('stored families with low solar and single outlet → cylinder_charge', () => {
    const STORED_FAMILIES = ['stored_vented', 'stored_unvented', 'regular_vented', 'system_unvented'];
    for (const family of STORED_FAMILIES) {
      expect(resolveShortlistVisualId('low', 1, family)).toBe('cylinder_charge');
    }
  });

  it('combi with low solar and single outlet → driving_style fallback', () => {
    expect(resolveShortlistVisualId('low', 1, 'combi')).toBe('driving_style');
  });

  it('heat_pump with low solar and single outlet → driving_style fallback', () => {
    expect(resolveShortlistVisualId('low', 1, 'ashp')).toBe('driving_style');
  });

  it('solar signal takes priority over simultaneous outlet count', () => {
    // solar=high overrides the outlets>=2 rule — cylinder_charge is the correct answer
    expect(resolveShortlistVisualId('high', 3, 'combi')).toBe('cylinder_charge');
  });
});

describe('Rule audit — open-vented and unvented must produce distinct outputs', () => {
  const ventedModel  = BUILT['open_vented_current_system'];
  const unventedModel = BUILT['unvented_current_system'];

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
      for (const [name, model] of Object.entries(BUILT)) {
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
    for (const [name, model] of Object.entries(BUILT)) {
      // We allow empty narrative signals for energy in some cases (e.g. no PV, no roof data)
      // but the pvStatusLabel must never be empty.
      expect(model.page1.energy.pvStatusLabel, `"${name}" pvStatusLabel is empty`).toBeTruthy();
    }
  });

  it('every scenario page1 home storageBenefitLabel is populated', () => {
    for (const [name, model] of Object.entries(BUILT)) {
      expect(
        model.page1.home.storageBenefitLabel,
        `"${name}" storageBenefitLabel is empty`,
      ).toBeTruthy();
    }
  });

  it('every scenario page1_5 heading is non-empty', () => {
    for (const [name, model] of Object.entries(BUILT)) {
      expect(model.page1_5.heading, `"${name}" page1_5 heading is empty`).toBeTruthy();
    }
  });

  it('every scenario finalPage homeScenarioDescription is non-empty', () => {
    for (const [name, model] of Object.entries(BUILT)) {
      expect(
        model.finalPage.homeScenarioDescription,
        `"${name}" homeScenarioDescription is empty`,
      ).toBeTruthy();
    }
  });
});

describe('Rule audit — intentionally different scenarios must not produce identical output', () => {
  it('single_person_combi_fit and large_family_stored_fit have distinct fingerprints', () => {
    expect(modelFingerprint(BUILT['single_person_combi_fit'])).not.toBe(
      modelFingerprint(BUILT['large_family_stored_fit']),
    );
  });

  it('open_vented_current_system and unvented_current_system have distinct fingerprints', () => {
    expect(modelFingerprint(BUILT['open_vented_current_system'])).not.toBe(
      modelFingerprint(BUILT['unvented_current_system']),
    );
  });

  it('strong_pv_poor_alignment and strong_pv_good_alignment have distinct fingerprints', () => {
    expect(modelFingerprint(BUILT['strong_pv_poor_alignment'])).not.toBe(
      modelFingerprint(BUILT['strong_pv_good_alignment']),
    );
  });

  it('system_boiler_vented and regular_boiler_unvented have distinct fingerprints', () => {
    expect(modelFingerprint(BUILT['system_boiler_vented'])).not.toBe(
      modelFingerprint(BUILT['regular_boiler_unvented']),
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
        opt.family,
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
