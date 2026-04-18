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
  | 'technicalAppendix'
  | 'heatMap'
  | 'hotWaterDemand'
  | 'systemArchitecture'
  | 'suitabilitySummary'
  | 'upgradePathway';

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
 * The 3-page print structure from the output overhaul:
 *   Page 1 — Recommendation Summary (decision-first)
 *   Page 2 — Visual Evidence (3 trust-builder graphics)
 *   Page 3 — System Design (architecture, suitability, upgrade path)
 *   Page 4 — Engineering Appendix (optional, technical only)
 *
 * Ordering within each preset is intentional:
 *   customer    — 3-page customer report (pages 1–3)
 *   technical   — 4-page engineer report (pages 1–4)
 *   comparison  — comparison-focused sheet
 *   full        — every visible section
 */
export const PRINT_PRESETS = {
  customer: [
    // Page 1 — Recommendation Summary
    'recommendation',
    'currentSystem',
    // Page 2 — Visual Evidence
    'heatMap',
    'hotWaterDemand',
    'waterPower',
    // Page 3 — System Design
    'systemArchitecture',
    'suitabilitySummary',
    'constraints',
    'upgradePathway',
  ],
  technical: [
    // Page 1 — Recommendation Summary
    'recommendation',
    'currentSystem',
    // Page 2 — Visual Evidence
    'heatMap',
    'hotWaterDemand',
    'waterPower',
    // Page 3 — System Design
    'systemArchitecture',
    'suitabilitySummary',
    'constraints',
    'upgradePathway',
    // Page 4 — Engineering Appendix
    'usageModel',
    'evidence',
    'chemistry',
    'glassBox',
    'technicalAppendix',
  ],
  comparison: [
    'recommendation',
    'comparison',
    'suitabilitySummary',
    'constraints',
    'waterPower',
    'usageModel',
  ],
  full: [
    'recommendation',
    'currentSystem',
    'heatMap',
    'hotWaterDemand',
    'waterPower',
    'usageModel',
    'systemArchitecture',
    'suitabilitySummary',
    'constraints',
    'upgradePathway',
    'evidence',
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
  const combiRisk = result.combiDhwV1?.verdict.combiRisk ?? 'pass';
  return {
    id: 'waterPower',
    title: 'Water Power',
    status: combiRisk === 'fail' || combiRisk === 'warn' ? 'watch' : 'ok',
    visible: true,
    customerSafe: true,
    content: {
      combiRisk,
      verdict: result.combiDhwV1?.verdict,
    },
  };
}

function buildUsageModelSection(
  result: FullEngineResult,
  input: FullSurveyModelV1,
): OutputHubSection {
  const hasOccupancy = input.occupancyCount != null;
  const hasBathrooms = input.bathroomCount  != null;
  const storedRisk   = result.storedDhwV1?.verdict.storedRisk ?? 'pass';

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
      note: 'Full physics explainer and sandbox available in the System Summary.',
    },
  };
}

function buildSimulatorSummarySection(input: FullSurveyModelV1): OutputHubSection {
  const available = input.occupancyCount != null && input.bathroomCount != null;
  return {
    id: 'simulatorSummary',
    title: 'Workspace Summary',
    status: 'ok',
    visible: available,
    customerSafe: true,
    content: {
      simulatorAvailable: available,
      occupancyCount: input.occupancyCount ?? null,
      bathroomCount:  input.bathroomCount  ?? null,
      prefillHint: available
        ? 'Survey data available — proof workspace can be pre-configured from this result.'
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

// ─── Standard UK room design temperatures ────────────────────────────────────
// These are fixed BS EN 12831 reference values used for heat-loss calculation,
// not derived per-room from the survey.  They demonstrate that sizing is
// intentional and standards-based.

const ROOM_DESIGN_TEMPS: Array<{ room: string; tempC: number }> = [
  { room: 'Lounge',    tempC: 21 },
  { room: 'Kitchen',   tempC: 20 },
  { room: 'Bedroom',   tempC: 18 },
  { room: 'Bathroom',  tempC: 22 },
  { room: 'Hall',      tempC: 18 },
];

function buildHeatMapSection(result: FullEngineResult): OutputHubSection {
  const fabric = result.fabricModelV1;
  return {
    id: 'heatMap',
    title: 'House Heating Map',
    status: 'ok',
    visible: true,
    customerSafe: true,
    content: {
      roomDesignTemps: ROOM_DESIGN_TEMPS,
      heatLossBand:    fabric?.heatLossBand    ?? 'unknown',
      thermalMassBand: fabric?.thermalMassBand ?? 'unknown',
      driftTauHours:   fabric?.driftTauHours   ?? null,
      notes:           fabric?.notes           ?? [],
    },
  };
}

function buildHotWaterDemandSection(
  result: FullEngineResult,
  input: FullSurveyModelV1,
): OutputHubSection {
  const combi  = result.combiDhwV1;
  const stored = result.storedDhwV1;
  const occupancy  = input.occupancyCount  ?? null;
  const bathrooms  = input.bathroomCount   ?? null;

  // Hot water demand is driven primarily by how many people live in the home.
  // The number of bathrooms affects how many people can use hot water at the
  // same time (concurrency), not the total amount used.
  //
  // Diversity factor: in real life, not everyone uses hot water simultaneously
  // even if bathrooms are available — they overlap, not all run at once.
  //   1 concurrent outlet → factor 1.0 (single draw, full flow)
  //   2 concurrent outlets → factor 0.75 (some overlap but not full double)
  //   3+ concurrent outlets → factor 0.60 (further spreading of demand)
  const DIVERSITY_FACTOR: Record<number, number> = { 1: 1.0, 2: 0.75, 3: 0.60 };
  const maxConcurrent = input.peakConcurrentOutlets
    ?? (occupancy != null && bathrooms != null
        ? Math.min(bathrooms, occupancy)
        : bathrooms ?? (occupancy != null ? 1 : null));
  const diversityFactor = maxConcurrent != null
    ? (DIVERSITY_FACTOR[Math.min(maxConcurrent, 3)] ?? 0.60)
    : 1.0;
  const peakOutlets = maxConcurrent;
  // Occupancy-based demand estimate (8 L/min per person is a standard UK guide rate)
  const peakDemandLpm = occupancy != null
    ? Math.round(occupancy * 8 * diversityFactor)
    : peakOutlets != null ? peakOutlets * 8 : null;

  // Combi delivery: kW → L/min at 40°C rise (4.2 kJ/kg·K × 1 kg/L → kW/kW = L/s × 60)
  const combiDeliveryLpm = combi?.maxQtoDhwKwDerated != null
    ? parseFloat(((combi.maxQtoDhwKwDerated / (4.2 * 40 / 60)) ).toFixed(1))
    : null;
  return {
    id: 'hotWaterDemand',
    title: 'Hot Water Demand',
    status: combi?.verdict.combiRisk === 'fail' ? 'watch' : 'ok',
    visible: true,
    customerSafe: true,
    content: {
      occupancyCount:       occupancy,
      bathroomCount:        bathrooms,
      peakOutlets:          peakOutlets,
      peakDemandLpm,
      diversityFactor,
      combiDeliveryLpm,
      combiRisk:            combi?.verdict.combiRisk ?? 'pass',
      storedVolumeBand:     stored?.recommended?.volumeBand ?? 'medium',
      storedType:           stored?.recommended?.type       ?? 'standard',
    },
  };
}

/** Derive a simple ordered connection diagram from the primary engine option. */
function buildSystemArchitectureSection(result: FullEngineResult): OutputHubSection {
  const options = result.engineOutput.options ?? [];
  const primary = options.find(o => o.status === 'viable') ?? options[0];
  const id      = primary?.id ?? 'unknown';

  // Each node in the connection chain
  const chain: string[] = (() => {
    switch (id) {
      case 'combi':
        return ['Gas combi boiler', 'Radiators'];
      case 'stored_unvented':
      case 'system_unvented':
        return ['Gas system boiler', 'Unvented hot water cylinder', 'Radiators'];
      case 'stored_vented':
      case 'regular_vented':
        return ['Gas regular boiler', 'Cold water storage tank', 'Vented hot water cylinder', 'Radiators'];
      case 'ashp':
        return ['Air source heat pump', 'Buffer vessel', 'Hot water cylinder', 'Low-temperature radiators / underfloor heating'];
      default:
        return primary ? [primary.label] : ['System type to be confirmed'];
    }
  })();

  const mustHave = primary?.typedRequirements?.mustHave ?? primary?.requirements ?? [];
  return {
    id: 'systemArchitecture',
    title: 'System Architecture',
    status: 'ok',
    visible: true,
    customerSafe: true,
    content: {
      optionId:        id,
      optionLabel:     primary?.label ?? '—',
      connectionChain: chain,
      mustHave,
    },
  };
}

function buildSuitabilitySummarySection(result: FullEngineResult): OutputHubSection {
  const options = result.engineOutput.options ?? [];
  return {
    id: 'suitabilitySummary',
    title: 'Suitability Summary',
    status: 'ok',
    visible: options.length > 0,
    customerSafe: true,
    content: {
      rows: options.map(o => ({
        id:     o.id,
        label:  o.label,
        status: o.status,
        why:    o.why.slice(0, 2),
      })),
    },
  };
}

function buildUpgradePathwaySection(result: FullEngineResult): OutputHubSection {
  const plans = result.engineOutput.plans;
  // Use engine pathway data when available; otherwise build a simple staged
  // upgrade from the primary option's requirements.
  const options = result.engineOutput.options ?? [];
  const primary = options.find(o => o.status === 'viable') ?? options[0];

  if (plans && plans.pathways.length > 0) {
    const pathway = [...plans.pathways].sort((a, b) => a.rank - b.rank)[0];
    return {
      id: 'upgradePathway',
      title: 'Future Upgrade Path',
      status: 'ok',
      visible: true,
      customerSafe: true,
      content: {
        source: 'engine',
        stages: pathway.prerequisites.map((p, i) => ({
          stage:  i + 1,
          label:  p.description,
          detail: p.triggerEvent ?? '',
        })),
        outcomeToday:        pathway.outcomeToday,
        outcomeAfterTrigger: pathway.outcomeAfterTrigger ?? null,
        rationale:           pathway.rationale,
      },
    };
  }

  // Fallback: derive stages from option requirements
  const mustHave     = primary?.typedRequirements?.mustHave       ?? [];
  const likelyUpgrades = primary?.typedRequirements?.likelyUpgrades ?? [];
  const niceToHave   = primary?.typedRequirements?.niceToHave     ?? [];
  const stages: Array<{ stage: number; label: string; detail: string }> = [];
  if (mustHave.length > 0) {
    stages.push({ stage: 1, label: 'Immediate installation requirements', detail: mustHave.join('. ') });
  }
  if (likelyUpgrades.length > 0) {
    stages.push({ stage: 2, label: 'Likely upgrades', detail: likelyUpgrades.join('. ') });
  }
  if (niceToHave.length > 0) {
    stages.push({ stage: 3, label: 'Future improvements', detail: niceToHave.join('. ') });
  }
  return {
    id: 'upgradePathway',
    title: 'Future Upgrade Path',
    status: 'ok',
    visible: stages.length > 0,
    customerSafe: true,
    content: {
      source:              'derived',
      stages,
      outcomeToday:        primary?.heat.headline ?? null,
      outcomeAfterTrigger: null,
      rationale:           null,
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
    buildHeatMapSection(result),
    buildHotWaterDemandSection(result, input),
    buildWaterPowerSection(result),
    buildUsageModelSection(result, input),
    buildSystemArchitectureSection(result),
    buildSuitabilitySummarySection(result),
    buildConstraintsSection(result),
    buildUpgradePathwaySection(result),
    buildEvidenceSection(result),
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
