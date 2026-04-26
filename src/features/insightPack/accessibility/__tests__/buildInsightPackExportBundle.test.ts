/**
 * buildInsightPackExportBundle.test.ts
 *
 * Tests for the Atlas Insight Pack export/email bundle.
 *
 * Verifies:
 *   - Email/export bundle includes the main PDF blob.
 *   - Email/export bundle includes accessible-summary.json.
 *   - Email/export bundle includes accessible-summary.txt.
 *   - accessible-summary.json parses correctly and contains the expected fields.
 *   - accessible-summary.txt contains the expected plain-text content.
 *   - Print/PDF does not include the sidecar grounding note
 *     (asserted via the CSS class contract between InsightPackDeck and
 *     InsightPackPrint.css — .accessible-summary-note is hidden in print).
 */

import { describe, it, expect } from 'vitest';
import {
  buildInsightPackExportBundle,
  type InsightPackExportBundle,
} from '../buildInsightPackExportBundle';
import {
  buildAccessibleTechnicalSummary,
  LLM_GROUNDING_NOTE,
  ACCESSIBLE_SUMMARY_SCHEMA_VERSION,
} from '../buildAccessibleTechnicalSummary';
import type { EngineOutputV1 } from '../../../../contracts/EngineOutputV1';
import type { AtlasDecisionV1 } from '../../../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../../../contracts/ScenarioResult';

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeMinimalEngineOutput(
  overrides: Partial<EngineOutputV1> = {},
): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'System boiler with stored cylinder' },
    explainers: [],
    options: [],
    ...overrides,
  };
}

function makeScenario(
  scenarioId: string,
  systemType: ScenarioResult['system']['type'],
): ScenarioResult {
  return {
    scenarioId,
    system: { type: systemType, summary: `${systemType} system` },
    performance: {
      hotWater: 'good',
      heating: 'good',
      efficiency: 'good',
      reliability: 'good',
    },
    keyBenefits: ['Physics-derived benefit'],
    keyConstraints: [`Constraint for ${scenarioId}`],
    dayToDayOutcomes: ['Day-to-day outcome A'],
    requiredWorks: [],
    upgradePaths: [],
    physicsFlags: {},
  };
}

function makeDecision(
  recommendedScenarioId: string,
  overrides: Partial<AtlasDecisionV1> = {},
): AtlasDecisionV1 {
  return {
    recommendedScenarioId,
    headline: 'A system boiler with stored cylinder is the right fit for this home.',
    summary: 'Physics-driven summary.',
    keyReasons: ['Physics reason A'],
    avoidedRisks: ['Avoided risk A'],
    dayToDayOutcomes: ['Outcome A'],
    requiredWorks: [],
    compatibilityWarnings: [],
    includedItems: [],
    quoteScope: [],
    futureUpgradePaths: [],
    supportingFacts: [],
    lifecycle: {
      currentSystem: { type: 'combi', ageYears: 12, condition: 'worn' },
      summary: 'Boiler is near end of serviceable life.',
      influencingFactors: {
        waterQuality: 'unknown',
        scaleRisk: 'low',
        usageIntensity: 'moderate',
      },
      replacementTimeline: { horizon: '1_2_years', urgency: 'high', bands: [] },
    },
    ...overrides,
  };
}

/** Minimal PDF blob representative of what window.print() / a renderer produces. */
function makePdfBlob(): Blob {
  return new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' });
}

function buildBundle(): InsightPackExportBundle {
  const summary = buildAccessibleTechnicalSummary(
    makeMinimalEngineOutput(),
    makeDecision('system_unvented'),
    [makeScenario('system_unvented', 'system'), makeScenario('combi', 'combi')],
  );
  return buildInsightPackExportBundle(makePdfBlob(), summary);
}

// ─── Bundle completeness ──────────────────────────────────────────────────────

describe('export/email bundle completeness', () => {
  it('bundle includes the main PDF blob', () => {
    const bundle = buildBundle();
    expect(bundle.pdf).toBeInstanceOf(Blob);
    expect(bundle.pdf.type).toBe('application/pdf');
  });

  it('bundle includes accessible-summary.json', () => {
    const bundle = buildBundle();
    expect(typeof bundle['accessible-summary.json']).toBe('string');
    expect(bundle['accessible-summary.json'].length).toBeGreaterThan(0);
  });

  it('bundle includes accessible-summary.txt', () => {
    const bundle = buildBundle();
    expect(typeof bundle['accessible-summary.txt']).toBe('string');
    expect(bundle['accessible-summary.txt'].length).toBeGreaterThan(0);
  });
});

// ─── JSON sidecar content ─────────────────────────────────────────────────────

describe('accessible-summary.json content', () => {
  it('parses as valid JSON', () => {
    const bundle = buildBundle();
    expect(() => JSON.parse(bundle['accessible-summary.json'])).not.toThrow();
  });

  it('contains source: "AtlasDecisionV1"', () => {
    const bundle = buildBundle();
    const parsed = JSON.parse(bundle['accessible-summary.json']);
    expect(parsed.source).toBe('AtlasDecisionV1');
  });

  it('contains correct schemaVersion', () => {
    const bundle = buildBundle();
    const parsed = JSON.parse(bundle['accessible-summary.json']);
    expect(parsed.schemaVersion).toBe(ACCESSIBLE_SUMMARY_SCHEMA_VERSION);
  });

  it('contains generatedAt timestamp', () => {
    const bundle = buildBundle();
    const parsed = JSON.parse(bundle['accessible-summary.json']);
    expect(parsed.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('recommendation.recommendedScenarioId matches decision.recommendedScenarioId', () => {
    const bundle = buildBundle();
    const parsed = JSON.parse(bundle['accessible-summary.json']);
    expect(parsed.recommendation.recommendedScenarioId).toBe('system_unvented');
  });

  it('contains llmGroundingNote inside the JSON sidecar', () => {
    const bundle = buildBundle();
    const parsed = JSON.parse(bundle['accessible-summary.json']);
    expect(parsed.llmGroundingNote).toBe(LLM_GROUNDING_NOTE);
  });

  it('contains visitId when supplied via identity', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
      undefined,
      undefined,
      { visitId: 'visit-abc-123' },
    );
    const bundle = buildInsightPackExportBundle(makePdfBlob(), summary);
    const parsed = JSON.parse(bundle['accessible-summary.json']);
    expect(parsed.visitId).toBe('visit-abc-123');
  });

  it('contains engineRunId when supplied via identity', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
      undefined,
      undefined,
      { engineRunId: 'run-xyz-789' },
    );
    const bundle = buildInsightPackExportBundle(makePdfBlob(), summary);
    const parsed = JSON.parse(bundle['accessible-summary.json']);
    expect(parsed.engineRunId).toBe('run-xyz-789');
  });

  it('visitId and engineRunId are absent when identity is not provided', () => {
    const bundle = buildBundle();
    const parsed = JSON.parse(bundle['accessible-summary.json']);
    expect(parsed.visitId).toBeUndefined();
    expect(parsed.engineRunId).toBeUndefined();
  });
});

// ─── Plain-text sidecar content ───────────────────────────────────────────────

describe('accessible-summary.txt content', () => {
  it('contains the Atlas header', () => {
    const bundle = buildBundle();
    expect(bundle['accessible-summary.txt']).toContain('ATLAS ACCESSIBLE TECHNICAL SUMMARY');
  });

  it('contains the recommendation headline', () => {
    const bundle = buildBundle();
    expect(bundle['accessible-summary.txt']).toContain(
      'A system boiler with stored cylinder is the right fit for this home.',
    );
  });

  it('contains the LLM grounding note (inside sidecar)', () => {
    const bundle = buildBundle();
    expect(bundle['accessible-summary.txt']).toContain(LLM_GROUNDING_NOTE);
  });

  it('contains Source: AtlasDecisionV1', () => {
    const bundle = buildBundle();
    expect(bundle['accessible-summary.txt']).toContain('Source: AtlasDecisionV1');
  });
});

// ─── Print / PDF does not include sidecar content ────────────────────────────

describe('print/PDF does not include sidecar content', () => {
  it('.accessible-summary-note CSS class is suppressed in InsightPackPrint.css', async () => {
    // Read the print CSS to assert the class is hidden under @media print.
    // This is the boundary test: if the CSS rule is accidentally removed,
    // the grounding note would appear in the printed PDF.
    const fs = await import('fs');
    const path = await import('path');
    const cssPath = path.resolve(
      __dirname,
      '../../InsightPackPrint.css',
    );
    const css = fs.readFileSync(cssPath, 'utf-8');
    // The .accessible-summary-note class must be set to display:none inside @media print
    expect(css).toMatch(/\.accessible-summary-note[\s\S]*?display:\s*none/);
  });

  it('accessible-summary.txt is NOT embedded in the PDF blob', () => {
    // The PDF blob is opaque to this layer; what we can assert is that the
    // plain-text sidecar is a separate file, not merged into the pdf field.
    const bundle = buildBundle();
    // The txt sidecar is a string, not embedded in the Blob.
    expect(typeof bundle['accessible-summary.txt']).toBe('string');
    // The PDF blob must not be a string.
    expect(bundle.pdf).toBeInstanceOf(Blob);
    expect(bundle.pdf).not.toBe(bundle['accessible-summary.txt']);
  });
});
