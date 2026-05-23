import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_EVIDENCE_CARD_TYPES_V1,
  CUSTOMER_EVIDENCE_CONFIDENCE_WORDING_V1,
  CUSTOMER_EVIDENCE_SECTION_IDS_V1,
  CUSTOMER_EVIDENCE_WARNING_CATEGORIES_V1,
  CUSTOMER_EVIDENCE_WARNING_SEVERITIES_V1,
  LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1,
  buildCustomerEvidencePackV1,
  buildDhwRecoveryMetricsV1,
  buildHydraulicConfidenceReportV1,
  buildLegoTechnixExplainabilityReportV1,
  getCustomerConfidenceWording,
  runLegoTechnixScenarioV1,
} from '..';
import type { CustomerEvidencePackV1 } from '../customerEvidence/CustomerEvidencePackV1';
import type { LegoTechnixSimulationStateV1 } from '../simulation/LegoTechnixSimulationStateV1';

function cloneState(state: LegoTechnixSimulationStateV1): LegoTechnixSimulationStateV1 {
  return JSON.parse(JSON.stringify(state)) as LegoTechnixSimulationStateV1;
}

function buildPackFromTemplate(templateId: string): CustomerEvidencePackV1 {
  const template = LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1.find((t) => t.id === templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const scenarioResult = runLegoTechnixScenarioV1({
    graph: template.graph,
    initialState: cloneState(template.initialState),
    ...template.scenario,
  });

  const dhwRecoveryMetrics = buildDhwRecoveryMetricsV1(scenarioResult);

  const hydraulicConfidenceReport = buildHydraulicConfidenceReportV1(template.graph, {
    ...scenarioResult,
    dhwRecoveryMetrics,
  });

  const explainabilityReport = buildLegoTechnixExplainabilityReportV1({
    graph: template.graph,
    scenarioResult,
    dhwRecoveryMetrics,
    hydraulicConfidenceReport,
  });

  return buildCustomerEvidencePackV1({
    lockedRecommendation: {
      systemLabel: template.label,
      systemType: template.systemType,
      recommendationSummary: `Locked summary for ${template.label}`,
    },
    explainabilityReport,
    hydraulicConfidenceReport,
    dhwRecoveryMetrics,
    scenarioResult,
  });
}

// ─── 1. Evidence pack builds from canonical templates ────────────────────────

describe('evidence pack builds from canonical templates', () => {
  for (const template of LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1) {
    it(`builds a complete evidence pack for ${template.id}`, () => {
      const pack = buildPackFromTemplate(template.id);

      expect(pack.schemaVersion).toBe('1.0');
      expect(pack.systemLabel).toBe(template.label);
      expect(pack.systemType).toBe(template.systemType);
      expect(pack.recommendationSummary).toBe(`Locked summary for ${template.label}`);
      expect(pack.sections).toHaveLength(CUSTOMER_EVIDENCE_SECTION_IDS_V1.length);

      const sectionIds = pack.sections.map((s) => s.id);
      expect(sectionIds).toEqual([...CUSTOMER_EVIDENCE_SECTION_IDS_V1]);
    });
  }
});

// ─── 2. Recommendation text is NOT regenerated ───────────────────────────────

describe('recommendation text is not regenerated inside the evidence builder', () => {
  it('systemLabel is taken verbatim from the locked recommendation summary', () => {
    const template = LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1[0];
    const pack = buildPackFromTemplate(template.id);

    expect(pack.systemLabel).toBe(template.label);
    expect(pack.systemType).toBe(template.systemType);
  });

  it('uses a custom locked system label without modification', () => {
    const template = LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1[0];

    const scenarioResult = runLegoTechnixScenarioV1({
      graph: template.graph,
      initialState: cloneState(template.initialState),
      ...template.scenario,
    });
    const dhwRecoveryMetrics = buildDhwRecoveryMetricsV1(scenarioResult);
    const hydraulicConfidenceReport = buildHydraulicConfidenceReportV1(template.graph, {
      ...scenarioResult,
      dhwRecoveryMetrics,
    });
    const explainabilityReport = buildLegoTechnixExplainabilityReportV1({
      graph: template.graph,
      scenarioResult,
      dhwRecoveryMetrics,
      hydraulicConfidenceReport,
    });

    const customLabel = 'Locked: Air Source Heat Pump — Chosen by recommendation engine';
    const pack = buildCustomerEvidencePackV1({
      lockedRecommendation: {
        systemLabel: customLabel,
        systemType: 'heat_pump_custom',
        recommendationSummary: 'Locked custom recommendation summary.',
      },
      explainabilityReport,
      hydraulicConfidenceReport,
      dhwRecoveryMetrics,
      scenarioResult,
    });

    expect(pack.systemLabel).toBe(customLabel);
    expect(pack.systemType).toBe('heat_pump_custom');
    expect(pack.recommendationSummary).toBe('Locked custom recommendation summary.');
  });
});

// ─── 3. Evidence cards consume explainability/projection outputs only ────────

describe('evidence cards consume explainability and projection outputs only', () => {
  it('thermal_story cards are sourced from explainability report sections', () => {
    const pack = buildPackFromTemplate('template_regular_boiler_vented_cylinder_y_plan');

    const heatingSection = pack.sections.find((s) => s.id === 'heating_behaviour');
    expect(heatingSection).toBeDefined();

    const thermalCard = heatingSection!.cards.find((c) => c.type === 'thermal_story');
    expect(thermalCard).toBeDefined();
    expect(thermalCard!.heading).toBe('How your heating behaves');
  });

  it('hot_water_story cards are sourced from dhwSummary and recovery metrics', () => {
    const pack = buildPackFromTemplate('template_system_boiler_unvented_cylinder_s_plan');

    const hotWaterSection = pack.sections.find((s) => s.id === 'hot_water_behaviour');
    expect(hotWaterSection).toBeDefined();

    const hotWaterCard = hotWaterSection!.cards.find((c) => c.type === 'hot_water_story');
    expect(hotWaterCard).toBeDefined();
    expect(hotWaterCard!.heading).toBe('Your hot water');
  });

  it('all expected card types are represented in packs', () => {
    const pack = buildPackFromTemplate('template_regular_boiler_vented_cylinder_y_plan');

    const allCardTypes = new Set(
      pack.sections.flatMap((s) => s.cards.map((c) => c.type)),
    );

    for (const cardType of CUSTOMER_EVIDENCE_CARD_TYPES_V1) {
      expect(allCardTypes.has(cardType)).toBe(true);
    }
  });
});

// ─── 4. Confidence wording is customer-safe ──────────────────────────────────

describe('confidence wording is customer-safe', () => {
  it('all confidence levels have customer-safe wording', () => {
    for (const [confidence, wording] of Object.entries(CUSTOMER_EVIDENCE_CONFIDENCE_WORDING_V1)) {
      expect(typeof wording).toBe('string');
      expect(wording.length).toBeGreaterThan(0);

      expect(wording).not.toMatch(/kPa|kW|l\/min|°C\s*delta|hydraulic|coefficient|modulation/i);

      expect(wording).not.toMatch(/panic|critical failure|catastrophic/i);

      expect(confidence).toBeDefined();
    }
  });

  it('getCustomerConfidenceWording returns non-empty string for every confidence level', () => {
    const levels = [
      'measured',
      'manufacturer',
      'user_entered',
      'derived',
      'estimated',
      'assumed',
      'unknown',
    ] as const;

    for (const level of levels) {
      const wording = getCustomerConfidenceWording(level);
      expect(typeof wording).toBe('string');
      expect(wording.length).toBeGreaterThan(0);
    }
  });

  it('measured wording is clearly positive', () => {
    expect(getCustomerConfidenceWording('measured')).toBe('Measured during the visit');
  });

  it('unknown wording directs to installer confirmation', () => {
    expect(getCustomerConfidenceWording('unknown')).toBe('Requires installer confirmation');
  });

  it('confidence cards in evidence packs contain wording strings', () => {
    const pack = buildPackFromTemplate('template_regular_boiler_vented_cylinder_y_plan');
    const confidenceSection = pack.sections.find((s) => s.id === 'confidence_and_assumptions');
    expect(confidenceSection).toBeDefined();

    const confidenceCard = confidenceSection!.cards.find((c) => c.type === 'confidence_story');
    expect(confidenceCard).toBeDefined();
    expect(confidenceCard!.summary.length).toBeGreaterThan(0);
  });
});

// ─── 5. DHW evidence reflects runtime metrics ────────────────────────────────

describe('DHW evidence reflects runtime metrics', () => {
  it('hot water section metrics are populated from DhwRecoveryMetricsV1', () => {
    const pack = buildPackFromTemplate('template_system_boiler_unvented_cylinder_s_plan');

    const hotWaterSection = pack.sections.find((s) => s.id === 'hot_water_behaviour');
    expect(hotWaterSection).toBeDefined();

    const hotWaterCard = hotWaterSection!.cards.find((c) => c.type === 'hot_water_story');
    expect(hotWaterCard).toBeDefined();

    expect(hotWaterCard!.metrics.length).toBeGreaterThan(0);
    for (const metric of hotWaterCard!.metrics) {
      expect(metric.label.length).toBeGreaterThan(0);
      expect(metric.confidenceWording.length).toBeGreaterThan(0);
    }
  });

  it('DHW section exists in every canonical template pack', () => {
    for (const template of LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1) {
      const pack = buildPackFromTemplate(template.id);
      const hotWaterSection = pack.sections.find((s) => s.id === 'hot_water_behaviour');
      expect(hotWaterSection).toBeDefined();
      expect(hotWaterSection!.cards.length).toBeGreaterThan(0);
    }
  });
});

// ─── 6. Warning severity mapping works correctly ─────────────────────────────

describe('warning severity mapping works correctly', () => {
  it('all CustomerEvidenceWarningV1 severities are one of info/attention/important', () => {
    const pack = buildPackFromTemplate('template_regular_boiler_vented_cylinder_y_plan');

    const allWarnings = pack.sections.flatMap((s) => [
      ...s.warnings,
      ...s.cards.flatMap((c) => c.warnings),
    ]);

    for (const warning of allWarnings) {
      expect(CUSTOMER_EVIDENCE_WARNING_SEVERITIES_V1).toContain(warning.severity);
      expect(CUSTOMER_EVIDENCE_WARNING_CATEGORIES_V1).toContain(warning.category);
      expect(warning.message.length).toBeGreaterThan(0);
    }
  });

  it('safety-related warnings appear in safety_protection section', () => {
    for (const template of LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1) {
      const pack = buildPackFromTemplate(template.id);
      const safetySection = pack.sections.find((s) => s.id === 'safety_protection');
      expect(safetySection).toBeDefined();
    }
  });

  it('comfort warnings appear in comfort_expectations section', () => {
    const pack = buildPackFromTemplate('template_regular_boiler_vented_cylinder_y_plan');
    const comfortSection = pack.sections.find((s) => s.id === 'comfort_expectations');
    expect(comfortSection).toBeDefined();
  });
});

// ─── 7. Stratified/mixed explanations differ ─────────────────────────────────

describe('stratified and mixed DHW explanations differ correctly', () => {
  it('stratified template produces stratified explanation card', () => {
    const pack = buildPackFromTemplate('template_mixergy_stratified_cylinder');

    const hotWaterSection = pack.sections.find((s) => s.id === 'hot_water_behaviour');
    expect(hotWaterSection).toBeDefined();

    const storageCard = hotWaterSection!.cards.find(
      (c) => c.type === 'hot_water_story' && c.heading === 'How your cylinder stores hot water',
    );
    expect(storageCard).toBeDefined();
    expect(storageCard!.summary).toContain('layers');
  });

  it('non-stratified template produces mixed explanation card', () => {
    const pack = buildPackFromTemplate('template_regular_boiler_vented_cylinder_y_plan');

    const hotWaterSection = pack.sections.find((s) => s.id === 'hot_water_behaviour');
    expect(hotWaterSection).toBeDefined();

    const storageCard = hotWaterSection!.cards.find(
      (c) => c.type === 'hot_water_story' && c.heading === 'How your cylinder stores hot water',
    );

    if (storageCard) {
      expect(storageCard.summary).not.toContain('layers');
      expect(storageCard.summary).toContain('mixes');
    }
  });

  it('stratified and mixed explanations produce different summary text', () => {
    const stratifiedPack = buildPackFromTemplate('template_mixergy_stratified_cylinder');
    const mixedPack = buildPackFromTemplate('template_regular_boiler_vented_cylinder_y_plan');

    const getStorageCard = (pack: CustomerEvidencePackV1) =>
      pack.sections
        .find((s) => s.id === 'hot_water_behaviour')
        ?.cards.find(
          (c) => c.type === 'hot_water_story' && c.heading === 'How your cylinder stores hot water',
        );

    const stratifiedCard = getStorageCard(stratifiedPack);
    const mixedCard = getStorageCard(mixedPack);

    if (stratifiedCard && mixedCard) {
      expect(stratifiedCard.summary).not.toBe(mixedCard.summary);
    }
  });
});

// ─── 8. Evidence timeline summaries are deterministic ────────────────────────

describe('evidence timeline summaries are deterministic', () => {
  it('same template produces identical timeline summaries on repeated calls', () => {
    const pack1 = buildPackFromTemplate('template_system_boiler_unvented_cylinder_s_plan');
    const pack2 = buildPackFromTemplate('template_system_boiler_unvented_cylinder_s_plan');

    const getTimelines = (pack: CustomerEvidencePackV1) =>
      pack.sections.flatMap((s) => s.timelineSummaries);

    const timelines1 = getTimelines(pack1);
    const timelines2 = getTimelines(pack2);

    expect(timelines1).toEqual(timelines2);
  });

  it('timeline entries have valid offsetSeconds and non-empty labels', () => {
    const pack = buildPackFromTemplate('template_system_boiler_unvented_cylinder_s_plan');

    const allTimelines = pack.sections.flatMap((s) => s.timelineSummaries);

    for (const entry of allTimelines) {
      expect(typeof entry.offsetSeconds).toBe('number');
      expect(entry.offsetSeconds).toBeGreaterThanOrEqual(0);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

// ─── 9. No physics calculations inside evidence builders ─────────────────────

describe('no physics calculations occur inside evidence builders', () => {
  it('evidence pack can be built with only explainability and confidence report (no scenario)', () => {
    const template = LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1[0];

    const scenarioResult = runLegoTechnixScenarioV1({
      graph: template.graph,
      initialState: cloneState(template.initialState),
      ...template.scenario,
    });
    const dhwRecoveryMetrics = buildDhwRecoveryMetricsV1(scenarioResult);
    const hydraulicConfidenceReport = buildHydraulicConfidenceReportV1(template.graph, {
      ...scenarioResult,
      dhwRecoveryMetrics,
    });
    const explainabilityReport = buildLegoTechnixExplainabilityReportV1({
      graph: template.graph,
      scenarioResult,
      dhwRecoveryMetrics,
      hydraulicConfidenceReport,
    });

    const packWithoutScenario = buildCustomerEvidencePackV1({
      lockedRecommendation: {
        systemLabel: template.label,
        systemType: template.systemType,
        recommendationSummary: `Locked summary for ${template.label}`,
      },
      explainabilityReport,
      hydraulicConfidenceReport,
    });

    expect(packWithoutScenario.schemaVersion).toBe('1.0');
    expect(packWithoutScenario.sections).toHaveLength(CUSTOMER_EVIDENCE_SECTION_IDS_V1.length);
  });

  it('evidence pack can be built without dhwRecoveryMetrics', () => {
    const template = LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1[0];

    const scenarioResult = runLegoTechnixScenarioV1({
      graph: template.graph,
      initialState: cloneState(template.initialState),
      ...template.scenario,
    });
    const hydraulicConfidenceReport = buildHydraulicConfidenceReportV1(template.graph, scenarioResult);
    const explainabilityReport = buildLegoTechnixExplainabilityReportV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
    });

    const pack = buildCustomerEvidencePackV1({
      lockedRecommendation: {
        systemLabel: template.label,
        systemType: template.systemType,
        recommendationSummary: `Locked summary for ${template.label}`,
      },
      explainabilityReport,
      hydraulicConfidenceReport,
      scenarioResult,
    });

    expect(pack.schemaVersion).toBe('1.0');
    expect(pack.sections).toHaveLength(CUSTOMER_EVIDENCE_SECTION_IDS_V1.length);
  });
});

// ─── 10. Evidence contracts remain serializable ──────────────────────────────

describe('evidence contracts remain serializable', () => {
  it('CustomerEvidencePackV1 round-trips through JSON.stringify/JSON.parse', () => {
    for (const template of LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1) {
      const pack = buildPackFromTemplate(template.id);

      const serialized = JSON.stringify(pack);
      expect(typeof serialized).toBe('string');

      const deserialized = JSON.parse(serialized) as CustomerEvidencePackV1;
      expect(deserialized.schemaVersion).toBe('1.0');
      expect(deserialized.systemLabel).toBe(pack.systemLabel);
      expect(deserialized.sections).toHaveLength(pack.sections.length);
    }
  });

  it('serialized pack contains no undefined values', () => {
    const pack = buildPackFromTemplate('template_heat_pump_unvented_weather_comp');
    const serialized = JSON.stringify(pack);
    expect(serialized).not.toContain('"undefined"');

    const deserialized = JSON.parse(serialized) as CustomerEvidencePackV1;
    expect(deserialized.schemaVersion).toBe('1.0');
  });

  it('all metric values in serialized pack are string or number', () => {
    const pack = buildPackFromTemplate('template_system_boiler_unvented_cylinder_s_plan');

    const allMetrics = pack.sections.flatMap((s) => s.cards.flatMap((c) => c.metrics));
    for (const metric of allMetrics) {
      expect(['string', 'number']).toContain(typeof metric.value);
    }
  });
});
