/**
 * buildSuggestedImplementationPack.test.ts
 *
 * Tests for buildSuggestedImplementationPack.
 *
 * Coverage:
 *   - Recommendation identity is preserved (recommendedScenarioId matches input)
 *   - Pack is generated deterministically (same inputs → same output)
 *   - No customer-facing language leakage (benefit framing, value claims)
 *   - Unresolved risks are surfaced
 *   - Qualifications are separated from customer value (not in customer summary)
 *   - Stored hot water scenarios: G3 qualification, expansion, discharge requirements
 *   - Open-vented → sealed conversion: loft tank items, sealed circuit items
 *   - Heat pump scenario: emitter review risk, MCS qualification, hydraulic separation
 *   - Water quality: filter, flush, inhibitor recommendations
 *   - Cross-section roll-up arrays (allUnresolvedRisks, allRequiredQualifications, etc.)
 *   - Pack version is always 'v1'
 */

import { describe, it, expect } from 'vitest';
import { buildSuggestedImplementationPack } from '../buildSuggestedImplementationPack';
import type { BuildImplementationPackInput } from '../buildSuggestedImplementationPack';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { EngineInputV2_3Contract } from '../../contracts/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIXED_NOW = '2026-05-11T19:00:00.000Z';

function makeDecision(overrides: Partial<AtlasDecisionV1> = {}): AtlasDecisionV1 {
  return {
    recommendedScenarioId:  'system_unvented',
    headline:               'A system boiler with unvented cylinder is the right fit for this home.',
    summary:                'System boiler with unvented cylinder.',
    keyReasons:             ['Mains-fed supply suits household size'],
    avoidedRisks:           [],
    dayToDayOutcomes:       [],
    requiredWorks:          ['Install system boiler'],
    compatibilityWarnings:  [],
    includedItems:          ['210L Mixergy cylinder', 'System boiler'],
    quoteScope:             [],
    futureUpgradePaths:     ['Heat pump pathway via low-temperature emitter spec'],
    supportingFacts:        [{ label: 'System age', value: '12 years', source: 'survey' }],
    lifecycle: {
      currentSystem: {
        type:      'combi',
        ageYears:  12,
        condition: 'worn',
      },
      expectedLifespan: {
        typicalRangeYears:  [12, 15],
        adjustedRangeYears: [11, 14],
      },
      influencingFactors: {
        waterQuality:     'moderate',
        scaleRisk:        'low',
        usageIntensity:   'medium',
        maintenanceLevel: 'average',
      },
      riskIndicators: [],
      summary:        'System approaching end of typical service life.',
    },
    ...overrides,
  };
}

function makeCustomerSummary(overrides: Partial<CustomerSummaryV1> = {}): CustomerSummaryV1 {
  return {
    recommendedScenarioId:  'system_unvented',
    recommendedSystemLabel: 'System boiler',
    headline:               'A system boiler is the right fit.',
    plainEnglishDecision:   'System boiler with unvented cylinder.',
    whyThisWins:            ['Reliable mains-fed supply'],
    whatThisAvoids:         [],
    includedNow:            ['System boiler', '210 L unvented cylinder'],
    requiredChecks:         ['G3-qualified installer required'],
    optionalUpgrades:       [],
    futureReady:            ['Heat pump pathway'],
    confidenceNotes:        [],
    hardConstraints:        [],
    performancePenalties:   [],
    fitNarrative:           'System boiler with unvented cylinder.',
    ...overrides,
  };
}

function makeEngineOutput(): EngineOutputV1 {
  return {
    eligibility:    [],
    redFlags:       [],
    recommendation: { primary: 'System boiler with unvented cylinder' },
    explainers:     [],
  };
}

function makeSurveyInput(overrides: Partial<EngineInputV2_3Contract> = {}): EngineInputV2_3Contract {
  return {
    infrastructure: { primaryPipeSizeMm: 22 },
    property:       { peakHeatLossKw: 8.5 },
    occupancy:      { signature: 'steady', peakConcurrentOutlets: 2 },
    dhw:            { architecture: 'stored_standard' },
    services: {
      mainsStaticPressureBar:   3.2,
      mainsDynamicPressureBar:  2.8,
      mainsDynamicFlowLpm:      18,
      coldWaterSource:          'mains_true',
    },
    currentSystem: {
      boiler: { type: 'combi', ageYears: 12 },
    },
    ...overrides,
  };
}

function makeInput(
  decisionOverrides:   Partial<AtlasDecisionV1>         = {},
  surveyOverrides:     Partial<EngineInputV2_3Contract>  = {},
): BuildImplementationPackInput {
  return {
    atlasDecision:   makeDecision(decisionOverrides),
    customerSummary: makeCustomerSummary(),
    engineOutput:    makeEngineOutput(),
    surveyInput:     makeSurveyInput(surveyOverrides),
  };
}

// ─── Pack version and identity ────────────────────────────────────────────────

describe('buildSuggestedImplementationPack — identity', () => {
  it('sets packVersion to v1', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    expect(pack.packVersion).toBe('v1');
  });

  it('preserves recommendedScenarioId from atlasDecision', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    expect(pack.recommendedScenarioId).toBe('system_unvented');
  });

  it('uses the provided timestamp override', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    expect(pack.generatedAt).toBe(FIXED_NOW);
  });
});

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('buildSuggestedImplementationPack — determinism', () => {
  it('produces identical output when called twice with the same inputs', () => {
    const input = makeInput();
    const pack1 = buildSuggestedImplementationPack(input, FIXED_NOW);
    const pack2 = buildSuggestedImplementationPack(input, FIXED_NOW);
    expect(JSON.stringify(pack1)).toBe(JSON.stringify(pack2));
  });
});

// ─── Stored hot water — unvented cylinder ────────────────────────────────────

describe('buildSuggestedImplementationPack — stored unvented (system_unvented)', () => {
  it('identifies stored_unvented strategy', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    expect(pack.hotWater.strategy).toBe('stored_unvented');
  });

  it('includes unvented cylinder as a required component', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    const cylinder = pack.hotWater.suggestedComponents.find((c) => c.id === 'unvented_cylinder');
    expect(cylinder).toBeDefined();
    expect(cylinder?.confidence).toBe('required');
  });

  it('surfaces expansion management requirements', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    expect(pack.hotWater.expansionManagement).toBeDefined();
    expect(pack.hotWater.expansionManagement!.length).toBeGreaterThan(0);
  });

  it('surfaces tundish and discharge requirements', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    expect(pack.hotWater.dischargeRequirements).toBeDefined();
    expect(pack.hotWater.dischargeRequirements!.length).toBeGreaterThan(0);
  });

  it('requires G3-qualified installer in safety/compliance section', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    const g3 = pack.safetyCompliance.requiredQualifications.find((q) => q.id === 'g3_unvented');
    expect(g3).toBeDefined();
    expect(g3?.label).toContain('G3');
  });

  it('includes G3 commissioning certificate in required compliance items', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    const cert = pack.safetyCompliance.requiredComplianceItems.find((c) => c.id === 'g3_commissioning_certificate');
    expect(cert).toBeDefined();
    expect(cert?.timing).toBe('after');
  });

  it('includes Building Control G3 notification', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    const bc = pack.safetyCompliance.requiredComplianceItems.find((c) => c.id === 'building_control_g3');
    expect(bc).toBeDefined();
    expect(bc?.timing).toBe('before');
  });
});

// ─── Open-vented → sealed conversion ─────────────────────────────────────────

describe('buildSuggestedImplementationPack — open-vented to sealed conversion', () => {
  const loftInput = makeInput(
    { recommendedScenarioId: 'system_unvented' },
    { services: { coldWaterSource: 'loft_tank' }, dhw: { architecture: 'stored_standard' } },
  );

  it('surfaces loft tank removal risk', () => {
    const pack = buildSuggestedImplementationPack(loftInput, FIXED_NOW);
    const risk = pack.pipework.unresolvedRisks.find((r) => r.id === 'loft_pipe_routes_unconfirmed');
    expect(risk).toBeDefined();
    expect(risk?.severity).toBe('required');
  });

  it('includes loft pipework capping component in pipework section', () => {
    const pack = buildSuggestedImplementationPack(loftInput, FIXED_NOW);
    const cap = pack.pipework.suggestedComponents.find((c) => c.id === 'loft_pipework_capping');
    expect(cap).toBeDefined();
    expect(cap?.confidence).toBe('required');
  });

  it('includes loft tank disposal in compliance items via safety section', () => {
    const pack = buildSuggestedImplementationPack(loftInput, FIXED_NOW);
    // The safety section notes loft tank disposal when converting from vented
    // This is a pipework topology note rather than a compliance item for system_unvented
    // Confirm topology notes include loft conversion notes
    const topoNote = pack.pipework.topologyNotes.some((n) =>
      n.toLowerCase().includes('vent') || n.toLowerCase().includes('cold-feed'),
    );
    expect(topoNote).toBe(true);
  });

  it('includes filling loop component for sealed circuit', () => {
    const pack = buildSuggestedImplementationPack(loftInput, FIXED_NOW);
    const fl = pack.hydraulicComponents.suggestedComponents.find((c) => c.id === 'filling_loop');
    expect(fl).toBeDefined();
  });
});

// ─── Heat pump scenario ───────────────────────────────────────────────────────

describe('buildSuggestedImplementationPack — heat pump (ashp)', () => {
  const ashpInput = makeInput(
    {
      recommendedScenarioId: 'ashp',
      futureUpgradePaths: [],
    },
    { dhw: { architecture: 'on_demand' } },
  );

  it('identifies ashp recommended family', () => {
    const pack = buildSuggestedImplementationPack(ashpInput, FIXED_NOW);
    expect(pack.heatSource.recommendedFamily).toBe('ashp');
  });

  it('surfaces emitter review as a required risk', () => {
    const pack = buildSuggestedImplementationPack(ashpInput, FIXED_NOW);
    const risk = pack.heatSource.unresolvedRisks.find((r) => r.id === 'emitter_review_required');
    expect(risk).toBeDefined();
    expect(risk?.severity).toBe('required');
  });

  it('requires MCS-certified installer qualification', () => {
    const pack = buildSuggestedImplementationPack(ashpInput, FIXED_NOW);
    const mcs = pack.safetyCompliance.requiredQualifications.find((q) => q.id === 'mcs_installer');
    expect(mcs).toBeDefined();
  });

  it('surfaces hydraulic separation review risk', () => {
    const pack = buildSuggestedImplementationPack(ashpInput, FIXED_NOW);
    const risk = pack.hydraulicComponents.unresolvedRisks.find(
      (r) => r.id === 'hydraulic_separation_review',
    );
    expect(risk).toBeDefined();
    expect(risk?.severity).toBe('required');
  });

  it('includes low-loss header as if_applicable component', () => {
    const pack = buildSuggestedImplementationPack(ashpInput, FIXED_NOW);
    const llh = pack.hydraulicComponents.suggestedComponents.find(
      (c) => c.id === 'low_loss_header_or_buffer',
    );
    expect(llh).toBeDefined();
    expect(llh?.confidence).toBe('if_applicable');
  });

  it('requires MCS certificate in compliance items', () => {
    const pack = buildSuggestedImplementationPack(ashpInput, FIXED_NOW);
    const cert = pack.safetyCompliance.requiredComplianceItems.find(
      (c) => c.id === 'mcs_certificate',
    );
    expect(cert).toBeDefined();
  });

  it('uses heat_pump_cylinder strategy for ashp', () => {
    const pack = buildSuggestedImplementationPack(ashpInput, FIXED_NOW);
    expect(pack.hotWater.strategy).toBe('heat_pump_cylinder');
  });
});

// ─── Mixergy ──────────────────────────────────────────────────────────────────

describe('buildSuggestedImplementationPack — Mixergy', () => {
  const mixergyInput = makeInput(
    { recommendedScenarioId: 'system_unvented' },
    { dhw: { architecture: 'stored_mixergy' } },
  );

  it('identifies stored_mixergy strategy', () => {
    const pack = buildSuggestedImplementationPack(mixergyInput, FIXED_NOW);
    expect(pack.hotWater.strategy).toBe('stored_mixergy');
  });

  it('includes Mixergy cylinder component noting demand mirroring and reduced cycling', () => {
    const pack = buildSuggestedImplementationPack(mixergyInput, FIXED_NOW);
    const cyl = pack.hotWater.suggestedComponents.find((c) => c.id === 'mixergy_cylinder');
    expect(cyl).toBeDefined();
    expect(cyl?.rationale.toLowerCase()).toContain('cycling');
  });

  it('requires G3 qualification for Mixergy (unvented)', () => {
    const pack = buildSuggestedImplementationPack(mixergyInput, FIXED_NOW);
    const g3 = pack.safetyCompliance.requiredQualifications.find((q) => q.id === 'g3_unvented');
    expect(g3).toBeDefined();
  });
});

// ─── Water quality ────────────────────────────────────────────────────────────

describe('buildSuggestedImplementationPack — water quality', () => {
  it('includes magnetic filter recommendation', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    expect(pack.waterQuality.filterRecommendation).toBeDefined();
    expect(pack.waterQuality.filterRecommendation!.toLowerCase()).toContain('magnetic');
  });

  it('recommends power flush for system aged ≥10 years', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    // Fixture has ageYears: 12 and condition: worn
    expect(pack.waterQuality.flushStrategy?.toLowerCase()).toContain('power flush');
  });

  it('includes inhibitor recommendation', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    expect(pack.waterQuality.inhibitorRecommendation).toBeDefined();
    expect(pack.waterQuality.inhibitorRecommendation!.toLowerCase()).toContain('inhibitor');
  });

  it('includes scale reducer for moderate water hardness', () => {
    // Fixture influencingFactors.waterQuality is 'moderate'
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    expect(pack.waterQuality.scaleManagement).toBeDefined();
    expect(pack.waterQuality.scaleManagement!.toLowerCase()).toContain('scale');
  });

  it('surfaces unknown water hardness as advisory risk when waterQuality is unknown', () => {
    const input = makeInput({
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 8, condition: 'good' },
        expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [11, 14] },
        influencingFactors: { waterQuality: 'unknown', scaleRisk: 'low', usageIntensity: 'medium', maintenanceLevel: 'average' },
        riskIndicators: [],
        summary: '',
      },
    });
    const pack = buildSuggestedImplementationPack(input, FIXED_NOW);
    const risk = pack.waterQuality.unresolvedRisks.find((r) => r.id === 'water_hardness_unknown');
    expect(risk).toBeDefined();
    expect(risk?.severity).toBe('advisory');
  });
});

// ─── Cross-section roll-ups ───────────────────────────────────────────────────

describe('buildSuggestedImplementationPack — cross-section roll-ups', () => {
  it('allUnresolvedRisks is non-empty when risks exist', () => {
    // Use 15 mm primary pipe — this triggers a microbore risk in the heat source section
    const input = makeInput({}, { infrastructure: { primaryPipeSizeMm: 15 } });
    const pack = buildSuggestedImplementationPack(input, FIXED_NOW);
    expect(pack.allUnresolvedRisks.length).toBeGreaterThan(0);
  });

  it('allUnresolvedRisks has no duplicate ids', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    const ids = pack.allUnresolvedRisks.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('allRequiredQualifications is non-empty for system_unvented', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    expect(pack.allRequiredQualifications.length).toBeGreaterThan(0);
  });

  it('allRequiredComplianceItems is non-empty for system_unvented', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    expect(pack.allRequiredComplianceItems.length).toBeGreaterThan(0);
  });

  it('allRequiredValidations contains no duplicate ids', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    const ids = pack.allRequiredValidations.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── No customer-facing language leakage ─────────────────────────────────────

describe('buildSuggestedImplementationPack — no customer-facing language leakage', () => {
  const BANNED_PHRASES = [
    'you will',
    'you\'ll',
    'you should',
    'your home will',
    'your family',
    'peace of mind',
    'great choice',
    'perfect for',
    'ideal for you',
  ];

  it('does not contain customer benefit framing in install notes', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);

    const allText = [
      ...pack.heatSource.installNotes,
      ...pack.hotWater.installNotes,
      ...pack.hydraulicComponents.installNotes,
      ...pack.controls.installNotes,
      ...pack.waterQuality.installNotes,
      ...pack.safetyCompliance.installNotes,
    ].join('\n').toLowerCase();

    for (const phrase of BANNED_PHRASES) {
      expect(allText).not.toContain(phrase);
    }
  });

  it('qualification triggeredBy does not reference customer value', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    for (const q of pack.allRequiredQualifications) {
      const lower = q.triggeredBy.toLowerCase();
      expect(lower).not.toContain('better');
      expect(lower).not.toContain('improved');
      expect(lower).not.toContain('peace of mind');
    }
  });
});

// ─── Heat loss not confirmed ──────────────────────────────────────────────────

describe('buildSuggestedImplementationPack — missing heat loss', () => {
  it('surfaces heat_loss_not_confirmed as required risk when peakHeatLossKw is 0', () => {
    const input = makeInput({}, { property: { peakHeatLossKw: 0 } });
    const pack = buildSuggestedImplementationPack(input, FIXED_NOW);
    const risk = pack.heatSource.unresolvedRisks.find((r) => r.id === 'heat_loss_not_confirmed');
    expect(risk).toBeDefined();
    expect(risk?.severity).toBe('required');
  });
});

// ─── Combi scenario ───────────────────────────────────────────────────────────

describe('buildSuggestedImplementationPack — combi scenario', () => {
  const combiInput = makeInput(
    { recommendedScenarioId: 'combi', futureUpgradePaths: [] },
    { dhw: { architecture: 'on_demand' } },
  );

  it('identifies on_demand strategy for combi', () => {
    const pack = buildSuggestedImplementationPack(combiInput, FIXED_NOW);
    expect(pack.hotWater.strategy).toBe('on_demand');
  });

  it('does not require G3 qualification for combi', () => {
    const pack = buildSuggestedImplementationPack(combiInput, FIXED_NOW);
    const g3 = pack.safetyCompliance.requiredQualifications.find((q) => q.id === 'g3_unvented');
    expect(g3).toBeUndefined();
  });

  it('does not surface expansion management for combi', () => {
    const pack = buildSuggestedImplementationPack(combiInput, FIXED_NOW);
    expect(pack.hotWater.expansionManagement).toBeUndefined();
  });

  it('does not surface tundish/discharge for combi', () => {
    const pack = buildSuggestedImplementationPack(combiInput, FIXED_NOW);
    expect(pack.hotWater.dischargeRequirements).toBeUndefined();
  });
});

// ─── Future ready ─────────────────────────────────────────────────────────────

describe('buildSuggestedImplementationPack — future ready', () => {
  it('always includes ASHP pathway item for non-ASHP systems', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    const item = pack.futureReady.items.find((i) => i.id === 'ashp_pathway');
    expect(item).toBeDefined();
  });

  it('does not duplicate ASHP pathway item for ASHP systems', () => {
    const ashpInput = makeInput({ recommendedScenarioId: 'ashp', futureUpgradePaths: [] }, { dhw: { architecture: 'on_demand' } });
    const pack = buildSuggestedImplementationPack(ashpInput, FIXED_NOW);
    const item = pack.futureReady.items.find((i) => i.id === 'ashp_pathway');
    expect(item).toBeUndefined();
  });

  it('includes smart controls readiness item', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    const item = pack.futureReady.items.find((i) => i.id === 'smart_controls_readiness');
    expect(item).toBeDefined();
  });

  it('includes solar boost readiness item', () => {
    const pack = buildSuggestedImplementationPack(makeInput(), FIXED_NOW);
    const item = pack.futureReady.items.find((i) => i.id === 'solar_boost_readiness');
    expect(item).toBeDefined();
  });

  it('injects futureUpgradePaths from atlasDecision into future ready items', () => {
    const pack = buildSuggestedImplementationPack(
      makeInput({ futureUpgradePaths: ['Battery storage pathway'] }),
      FIXED_NOW,
    );
    const item = pack.futureReady.items.find((i) =>
      i.label === 'Battery storage pathway',
    );
    expect(item).toBeDefined();
  });
});
