/**
 * printSections.model.ts
 *
 * Shared print-section contract for the Live Output Hub.
 *
 * Responsibilities:
 *   - Define the PrintSectionId union and OutputHubSection interface
 *   - Define PRINT_PRESETS (customer / technical / comparison / full)
 *   - Build sections once from FullEngineResult + FullSurveyModelV1
 *   - Filter sections for a given preset
 *
 * This is the single source of truth for what gets printed and when.
 * All print-button presets are derived from the same section array.
 */

import type { FullEngineResult } from '../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../ui/fullSurvey/FullSurveyModelV1';

// ─── Section identity ─────────────────────────────────────────────────────────

export type PrintSectionId =
  | 'recommendation'
  | 'currentSystem'
  | 'waterPower'
  | 'usageModel'
  | 'evidence'
  | 'constraints'
  | 'chemistry'
  | 'glassBox'
  | 'controlRoom'
  | 'simulatorSummary'
  | 'comparison'
  | 'technicalAppendix';

// ─── Section contract ─────────────────────────────────────────────────────────

export interface OutputHubSection {
  /** Stable identifier — used by presets to select/filter sections. */
  id: PrintSectionId;
  /** Human-readable section heading shown in the print layout. */
  title: string;
  /** Tile status badge value (mirrors the Live Output Hub tile chip). */
  status: 'ok' | 'watch' | 'missing';
  /**
   * Whether this section has data to show.
   * Sections with visible=false are omitted from all presets.
   */
  visible: boolean;
  /**
   * Whether this section is safe to show to a customer.
   * Technical-only sections (glassBox, evidence, controlRoom, technicalAppendix)
   * set this to false.
   */
  customerSafe: boolean;
  /** Typed content bag — shape varies per section id. */
  content: Record<string, unknown>;
}

// ─── Print presets ────────────────────────────────────────────────────────────

/**
 * Each preset is an ordered list of section ids.
 * filterSections() applies the preset against the full section array.
 *
 * Ordering within each preset is intentional:
 *   customer    — customer-safe, non-technical
 *   technical   — full technical picture
 *   comparison  — comparison-focused
 *   full        — every visible section
 */
export const PRINT_PRESETS = {
  customer: [
    'recommendation',
    'currentSystem',
    'waterPower',
    'usageModel',
    'constraints',
    'chemistry',
    'simulatorSummary',
  ],
  technical: [
    'recommendation',
    'currentSystem',
    'waterPower',
    'usageModel',
    'evidence',
    'constraints',
    'chemistry',
    'glassBox',
    'technicalAppendix',
  ],
  comparison: [
    'recommendation',
    'comparison',
    'constraints',
    'waterPower',
    'usageModel',
  ],
  full: [
    'recommendation',
    'currentSystem',
    'waterPower',
    'usageModel',
    'evidence',
    'constraints',
    'chemistry',
    'glassBox',
    'controlRoom',
    'simulatorSummary',
    'comparison',
    'technicalAppendix',
  ],
} as const satisfies Record<string, ReadonlyArray<PrintSectionId>>;

export type PrintPreset = keyof typeof PRINT_PRESETS;

// ─── Section builders ─────────────────────────────────────────────────────────

const WITHHELD_PREFIX = 'Recommendation withheld';

function buildRecommendationSection(result: FullEngineResult): OutputHubSection {
  const { engineOutput } = result;
  const primary = engineOutput.recommendation.primary;
  const isWithheld = primary.startsWith(WITHHELD_PREFIX);
  return {
    id: 'recommendation',
    title: 'Recommendation',
    status: isWithheld ? 'watch' : 'ok',
    visible: true,
    customerSafe: true,
    content: {
      primary,
      secondary: engineOutput.recommendation.secondary ?? null,
      isWithheld,
      withheldReason: isWithheld ? (engineOutput.recommendation.secondary ?? null) : null,
      verdict: engineOutput.verdict
        ? {
            title:         engineOutput.verdict.title,
            status:        engineOutput.verdict.status,
            reasons:       engineOutput.verdict.reasons,
            confidence:    engineOutput.verdict.confidence.level,
            primaryReason: engineOutput.verdict.primaryReason ?? null,
          }
        : null,
      options: (engineOutput.options ?? []).map(o => ({
        id:     o.id,
        label:  o.label,
        status: o.status,
        why:    o.why,
      })),
    },
  };
}

function buildCurrentSystemSection(
  result: FullEngineResult,
  input: FullSurveyModelV1,
): OutputHubSection {
  const { engineOutput } = result;
  const hasRejected = engineOutput.eligibility.some(e => e.status === 'rejected');
  const hasCaution  = engineOutput.eligibility.some(e => e.status === 'caution');
  return {
    id: 'currentSystem',
    title: 'Current System',
    status: hasRejected || hasCaution ? 'watch' : 'ok',
    visible: true,
    customerSafe: true,
    content: {
      boilerType:  input.currentHeatSourceType ?? null,
      eligibility: engineOutput.eligibility.map(e => ({
        id:     e.id,
        label:  e.label,
        status: e.status,
        reason: e.reason,
      })),
    },
  };
}

function buildWaterPowerSection(result: FullEngineResult): OutputHubSection {
  const combiRisk = result.combiDhwV1.verdict.combiRisk;
  return {
    id: 'waterPower',
    title: 'Water Power',
    status: combiRisk === 'fail' || combiRisk === 'warn' ? 'watch' : 'ok',
    visible: true,
    customerSafe: true,
    content: {
      combiRisk,
      verdict: result.combiDhwV1.verdict,
    },
  };
}

function buildUsageModelSection(
  result: FullEngineResult,
  input: FullSurveyModelV1,
): OutputHubSection {
  const hasOccupancy = input.occupancyCount != null;
  const hasBathrooms = input.bathroomCount  != null;
  const storedRisk   = result.storedDhwV1.verdict.storedRisk;

  const missingFields: string[] = [];
  if (!hasOccupancy) missingFields.push('Occupancy count');
  if (!hasBathrooms) missingFields.push('Bathroom count');

  let status: 'ok' | 'watch' | 'missing' = 'ok';
  if (missingFields.length > 0) {
    status = 'missing';
  } else if (storedRisk === 'warn') {
    status = 'watch';
  }

  return {
    id: 'usageModel',
    title: 'Usage Model',
    status,
    visible: true,
    customerSafe: true,
    content: {
      occupancyCount: input.occupancyCount  ?? null,
      bathroomCount:  input.bathroomCount   ?? null,
      storedRisk,
      missingFields,
    },
  };
}

function buildEvidenceSection(result: FullEngineResult): OutputHubSection {
  const { engineOutput } = result;
  const evidence = engineOutput.evidence ?? [];
  const hasData  = evidence.length > 0;
  const hasLow   = evidence.some(e => e.confidence === 'low');
  return {
    id: 'evidence',
    title: 'Evidence',
    status: !hasData ? 'missing' : hasLow ? 'watch' : 'ok',
    visible: true,
    customerSafe: false,
    content: {
      evidence: evidence.map(e => ({
        label:      e.label,
        source:     e.source,
        confidence: e.confidence,
      })),
      confidenceLevel: engineOutput.meta?.confidence?.level ?? null,
      unknowns:        engineOutput.meta?.confidence?.unknowns ?? [],
    },
  };
}

function buildConstraintsSection(result: FullEngineResult): OutputHubSection {
  const { engineOutput } = result;
  const limiters = engineOutput.limiters?.limiters ?? [];
  const hasFail  = limiters.some(l => l.severity === 'fail');
  return {
    id: 'constraints',
    title: 'Constraints',
    status: !engineOutput.limiters ? 'missing' : hasFail ? 'watch' : 'ok',
    visible: true,
    customerSafe: true,
    content: {
      limiters: limiters.map(l => ({
        id:           l.id,
        title:        l.title,
        severity:     l.severity,
        detail:       l.impact.summary,
        observed:     `${l.observed.value} ${l.observed.unit}`,
        limit:        `${l.limit.value} ${l.limit.unit}`,
        suggestedFix: l.suggestedFixes.length > 0 ? l.suggestedFixes[0].label : null,
      })),
    },
  };
}

function buildChemistrySection(result: FullEngineResult): OutputHubSection {
  const decay = result.normalizer.tenYearEfficiencyDecayPct;
  return {
    id: 'chemistry',
    title: 'Chemistry',
    status: decay > 8 ? 'watch' : 'ok',
    visible: true,
    customerSafe: true,
    content: {
      tenYearDecayPct: decay,
    },
  };
}

function buildGlassBoxSection(result: FullEngineResult): OutputHubSection {
  const { engineOutput } = result;
  return {
    id: 'glassBox',
    title: 'Glass Box',
    status: 'ok',
    visible: true,
    customerSafe: false,
    content: {
      assumptions: (engineOutput.meta?.assumptions ?? []).map(a => ({
        id:       a.id,
        title:    a.title,
        detail:   a.detail,
        severity: a.severity,
      })),
      redFlags: (engineOutput.redFlags ?? []).map(f => ({
        id:       f.id,
        title:    f.title,
        detail:   f.detail,
        severity: f.severity,
      })),
    },
  };
}

function buildControlRoomSection(): OutputHubSection {
  return {
    id: 'controlRoom',
    title: 'Control Room',
    status: 'ok',
    visible: true,
    customerSafe: false,
    content: {
      note: 'Full physics explainer and sandbox available in the System Lab.',
    },
  };
}

function buildSimulatorSummarySection(input: FullSurveyModelV1): OutputHubSection {
  const available = input.occupancyCount != null && input.bathroomCount != null;
  return {
    id: 'simulatorSummary',
    title: 'Simulator Summary',
    status: 'ok',
    visible: available,
    customerSafe: true,
    content: {
      simulatorAvailable: available,
      occupancyCount: input.occupancyCount ?? null,
      bathroomCount:  input.bathroomCount  ?? null,
      prefillHint: available
        ? 'Survey data available — simulator can be pre-configured from this result.'
        : null,
    },
  };
}

function buildComparisonSection(result: FullEngineResult): OutputHubSection {
  const options = result.engineOutput.options ?? [];
  return {
    id: 'comparison',
    title: 'Comparison Sheet',
    status: 'ok',
    visible: options.length > 0,
    customerSafe: true,
    content: {
      options: options.map(o => ({
        id:          o.id,
        label:       o.label,
        status:      o.status,
        heat:        o.heat.headline,
        dhw:         o.dhw.headline,
        engineering: o.engineering.headline,
        why:         o.why,
        requirements: o.typedRequirements.mustHave,
      })),
    },
  };
}

function buildTechnicalAppendixSection(result: FullEngineResult): OutputHubSection {
  const { engineOutput } = result;
  return {
    id: 'technicalAppendix',
    title: 'Technical Appendix',
    status: 'ok',
    visible: true,
    customerSafe: false,
    content: {
      assumptions: (engineOutput.meta?.assumptions ?? []).map(a => ({
        id:       a.id,
        title:    a.title,
        detail:   a.detail,
        severity: a.severity,
      })),
      confidence: engineOutput.meta?.confidence
        ? {
            level:    engineOutput.meta.confidence.level,
            unknowns: engineOutput.meta.confidence.unknowns ?? [],
            unlockBy: engineOutput.meta.confidence.unlockBy ?? [],
          }
        : null,
      redFlags: (engineOutput.redFlags ?? []).map(f => ({
        id:       f.id,
        title:    f.title,
        detail:   f.detail,
        severity: f.severity,
      })),
    },
  };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build the full ordered list of printable sections from engine result + survey.
 *
 * Every Live Output Hub tile maps to exactly one section.  New tiles added to
 * the hub in future PRs only need to add a section builder here to automatically
 * appear in the Full Output Report.
 */
export function buildOutputHubSections(
  result: FullEngineResult,
  input: FullSurveyModelV1,
): OutputHubSection[] {
  return [
    buildRecommendationSection(result),
    buildCurrentSystemSection(result, input),
    buildWaterPowerSection(result),
    buildUsageModelSection(result, input),
    buildEvidenceSection(result),
    buildConstraintsSection(result),
    buildChemistrySection(result),
    buildGlassBoxSection(result),
    buildControlRoomSection(),
    buildSimulatorSummarySection(input),
    buildComparisonSection(result),
    buildTechnicalAppendixSection(result),
  ];
}

// ─── Preset filter ────────────────────────────────────────────────────────────

/**
 * Return only the sections that are (a) included in the given preset and
 * (b) have visible data.
 *
 * Ordering follows the preset definition, not the builder order.
 */
export function filterSections(
  sections: OutputHubSection[],
  preset: PrintPreset,
): OutputHubSection[] {
  const ids = PRINT_PRESETS[preset] as ReadonlyArray<string>;
  return ids
    .map(id => sections.find(s => s.id === id))
    .filter((s): s is OutputHubSection => s !== undefined && s.visible);
}
