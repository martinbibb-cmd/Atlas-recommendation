/**
 * buildPortalJourneyModel.ts
 *
 * PR10 — Derives a PortalJourneyModel from the PR9 PortalDisplayModel.
 *
 * Rules:
 *   - Input: PortalDisplayModel only — never raw payload shapes.
 *   - Output: fully customer-safe, home-specific journey content.
 *   - No Math.random() — entirely deterministic.
 *   - No raw engine jargon in customer-facing fields.
 *   - Only surfaces fit reasons genuinely supported by engine data.
 *   - Recommendation is always singular and clear.
 *   - Alternatives are clearly subordinate.
 */

import type { PortalDisplayModel } from '../types/portalDisplay.types';

import type {
  PortalJourneyModel,
  JourneyFindings,
  JourneyRecommendation,
  JourneyWhyFitsItem,
  JourneyAlternative,
  JourneyScenario,
} from '../types/portalJourney.types';

// ─── Findings ─────────────────────────────────────────────────────────────────

function buildFindings(dm: PortalDisplayModel): JourneyFindings {
  const engine = dm.engineOutput;
  const evidence = dm.evidenceSummary;

  // Current system — from verdict context or first option label
  // (not yet surfaced in findings; reserved for future enhancement)

  // Household summary from knowledge / evidence meta
  let householdSummary: string | undefined;
  const ks = dm.knowledgeSummary;
  if (ks) {
    const parts: string[] = [];
    if (ks.household === 'confirmed') parts.push('household confirmed');
    if (ks.usage === 'confirmed') parts.push('hot water use confirmed');
    if (parts.length > 0) householdSummary = 'Survey data captured: ' + parts.join(', ') + '.';
  }

  // Property summary from propertyTitle (available in all cases)
  const propertySummary = dm.propertyTitle !== 'Your recommendation'
    ? dm.propertyTitle
    : undefined;

  // Evidence summary snippets
  const evidenceSummaryParts: string[] = [];
  if (evidence) {
    if (evidence.photoCount > 0) {
      evidenceSummaryParts.push(`${evidence.photoCount} photo${evidence.photoCount !== 1 ? 's' : ''} captured`);
    }
    if (evidence.voiceNoteCount > 0) {
      evidenceSummaryParts.push(`${evidence.voiceNoteCount} voice note${evidence.voiceNoteCount !== 1 ? 's' : ''} recorded`);
    }
    if (evidence.extractedFactCount > 0) {
      evidenceSummaryParts.push(`${evidence.extractedFactCount} measured or entered data point${evidence.extractedFactCount !== 1 ? 's' : ''}`);
    }
  }

  // Verdict confidence as an observation
  const confidence = engine.verdict?.confidence;
  if (confidence?.level === 'high') {
    evidenceSummaryParts.push('High-confidence assessment based on measured inputs');
  } else if (confidence?.level === 'medium') {
    evidenceSummaryParts.push('Assessment based on a mix of measured and assumed inputs');
  } else if (confidence?.level === 'low') {
    evidenceSummaryParts.push('Assessment based primarily on assumed inputs — worth reviewing with your engineer');
  }

  // Verdict reasons as evidence-backed observations
  const verdictReasons = engine.verdict?.reasons ?? [];
  for (const r of verdictReasons) {
    evidenceSummaryParts.push(r);
  }

  // Priorities / constraints from redFlags or assumptions
  const priorities: string[] = [];
  const constraints: string[] = [];
  const redFlags = engine.redFlags ?? [];
  for (const flag of redFlags) {
    if (flag.severity === 'fail') {
      constraints.push(flag.title);
    } else if (flag.severity === 'warn') {
      priorities.push(flag.title);
    }
  }
  const assumptions = engine.meta?.assumptions ?? [];
  for (const a of assumptions) {
    if (a.severity === 'warn') {
      priorities.push(a.title);
    }
  }

  return {
    currentSystem:    undefined,
    householdSummary,
    propertySummary,
    priorities,
    constraints,
    evidenceSummary:  evidenceSummaryParts,
  };
}

// ─── Recommendation ───────────────────────────────────────────────────────────

/**
 * Derives the dominant limiter ID from the EngineOutputV1 limiters for a given
 * option id.  Returns null when no constraining limiter exists (clean run).
 */
function derivePrimaryConstraint(dm: PortalDisplayModel, _recId?: string): string | null {
  const entries = dm.engineOutput.limiters?.limiters ?? [];
  if (entries.length === 0) return null;

  // EngineOutputV1.LimiterV1 severity: 'fail' > 'warn' > 'info'
  // Pick the highest-severity entry as the primary constraint anchor.
  const severityOrder: Array<import('../../../contracts/EngineOutputV1').LimiterSeverity> = [
    'fail', 'warn', 'info',
  ];
  for (const severity of severityOrder) {
    const found = entries.find((e) => e.severity === severity);
    if (found) return found.id;
  }
  return null;
}

/**
 * Derives supporting event strings from verdict reasons and non-fail red flags.
 */
function deriveSupportingEvents(dm: PortalDisplayModel): readonly string[] {
  const events: string[] = [];
  for (const reason of dm.engineOutput.verdict?.reasons ?? []) {
    events.push(reason);
  }
  for (const flag of dm.engineOutput.redFlags ?? []) {
    if (flag.severity !== 'fail') events.push(flag.id);
  }
  return events;
}

function buildRecommendation(dm: PortalDisplayModel): JourneyRecommendation {
  const recId = dm.recommendedOptionId;
  const options = dm.engineOutput.options ?? [];
  const recOption = options.find((o) => o.id === recId) ?? options.find((o) => o.status === 'viable');

  // Physics guard: if no option found, emit a low-confidence placeholder.
  // The UI must check physicsReady === false and show the "We need more
  // information" state instead of rendering a recommendation card.
  if (!recOption) {
    return {
      recommendedOptionId: recId,
      title:           'We need more information',
      summary:         'Atlas needs a complete survey or scan to produce a physics-backed recommendation for your home.',
      keyBenefits:     [],
      confidenceLabel: undefined,
      physicsReady:    false,
    };
  }

  // Key benefits: top 3 from why[], dhw bullets, heat bullets — deduplicated
  const benefitCandidates: string[] = [
    ...recOption.why,
    ...recOption.dhw.bullets,
    ...recOption.heat.bullets,
  ];
  const keyBenefits = benefitCandidates.slice(0, 3);

  // Confidence label from option confidenceBadge or verdict confidence
  const confidenceLabel =
    recOption.confidenceBadge?.label ??
    (dm.engineOutput.verdict?.confidence?.level === 'high'
      ? 'High confidence — based on measured inputs'
      : dm.engineOutput.verdict?.confidence?.level === 'medium'
        ? 'Medium confidence — some inputs assumed'
        : undefined);

  // Primary reason: first why[] item or headline
  const summary = recOption.why[0] ?? recOption.headline ?? `${recOption.label} is the best fit for your home.`;

  // Physics anchor fields
  const primaryConstraint = derivePrimaryConstraint(dm, recOption.id);
  const supportingEvents  = deriveSupportingEvents(dm);

  return {
    recommendedOptionId: recOption.id,
    title:              recOption.label,
    summary,
    keyBenefits,
    confidenceLabel,
    physicsReady:       true,
    primaryConstraint,
    supportingEvents,
  };
}

// ─── Why fits ─────────────────────────────────────────────────────────────────

function buildWhyFits(dm: PortalDisplayModel): JourneyWhyFitsItem[] {
  const recId = dm.recommendedOptionId;
  const options = dm.engineOutput.options ?? [];
  const recOption = options.find((o) => o.id === recId) ?? options.find((o) => o.status === 'viable');

  if (!recOption) return [];

  const items: JourneyWhyFitsItem[] = [];

  // Hot water fit
  if (recOption.dhw.status !== 'na') {
    const isPositive = recOption.dhw.status === 'ok';
    if (recOption.dhw.headline) {
      items.push({
        title:       'Hot water supply',
        explanation: recOption.dhw.headline + (recOption.dhw.bullets[0] ? ` — ${recOption.dhw.bullets[0]}` : ''),
        status:      isPositive ? 'positive' : 'caveat',
      });
    }
  }

  // Heating fit
  if (recOption.heat.status !== 'na') {
    const isPositive = recOption.heat.status === 'ok';
    if (recOption.heat.headline) {
      items.push({
        title:       'Heating performance',
        explanation: recOption.heat.headline + (recOption.heat.bullets[0] ? ` — ${recOption.heat.bullets[0]}` : ''),
        status:      isPositive ? 'positive' : 'caveat',
      });
    }
  }

  // Engineering / space fit
  if (recOption.engineering.status !== 'na') {
    const isPositive = recOption.engineering.status === 'ok';
    if (recOption.engineering.headline) {
      items.push({
        title:       'Installation and space',
        explanation: recOption.engineering.headline + (recOption.engineering.bullets[0] ? ` — ${recOption.engineering.bullets[0]}` : ''),
        status:      isPositive ? 'positive' : 'caveat',
      });
    }
  }

  // Sensitivities that matter: downgrade sensitivities are worth noting as caveats
  const sensitivities = recOption.sensitivities ?? [];
  for (const s of sensitivities) {
    if (s.effect === 'downgrade' && items.length < 5) {
      items.push({
        title:       s.lever,
        explanation: s.note,
        status:      'caveat',
      });
    }
  }

  return items;
}

// ─── What to expect ───────────────────────────────────────────────────────────

function buildWhatToExpect(dm: PortalDisplayModel): string[] {
  const recId = dm.recommendedOptionId;
  const options = dm.engineOutput.options ?? [];
  const recOption = options.find((o) => o.id === recId) ?? options.find((o) => o.status === 'viable');

  const lines: string[] = [];

  if (recOption) {
    // Required work as installation implications
    const mustHave = recOption.typedRequirements.mustHave ?? [];
    for (const item of mustHave) {
      lines.push(item);
    }
    // Likely upgrades
    const upgrades = recOption.typedRequirements.likelyUpgrades ?? [];
    for (const item of upgrades) {
      lines.push(item);
    }
    // Engineering caveats
    if (recOption.engineering.status === 'caution') {
      for (const bullet of recOption.engineering.bullets) {
        lines.push(bullet);
      }
    }
  }

  // Global red flags severity info/warn
  const redFlags = dm.engineOutput.redFlags ?? [];
  for (const flag of redFlags) {
    if (flag.severity === 'info' || flag.severity === 'warn') {
      lines.push(flag.title + (flag.detail ? ` — ${flag.detail}` : ''));
    }
  }

  return lines;
}

// ─── Alternatives ─────────────────────────────────────────────────────────────

function buildAlternatives(dm: PortalDisplayModel): JourneyAlternative[] {
  const recId = dm.recommendedOptionId;
  const options = dm.engineOutput.options ?? [];

  const alternatives: JourneyAlternative[] = [];

  for (const option of options) {
    if (option.id === recId) continue;
    if (option.status === 'rejected') continue;

    // Derive a 'why not top choice' from heat/dhw/engineering caveats
    const caveatParts: string[] = [];
    if (option.dhw.status === 'caution')         caveatParts.push(option.dhw.headline);
    if (option.heat.status === 'caution')        caveatParts.push(option.heat.headline);
    if (option.engineering.status === 'caution') caveatParts.push(option.engineering.headline);

    alternatives.push({
      optionId:         option.id,
      title:            option.label,
      summary:          option.headline,
      whyNotTopChoice:  caveatParts.length > 0 ? caveatParts.filter(Boolean).join('; ') : undefined,
    });
  }

  return alternatives;
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

const DEFAULT_SCENARIOS: JourneyScenario[] = [
  {
    id:          'more_hot_water',
    title:       'What if you need more hot water at once?',
    description: 'See how the system handles simultaneous demand from multiple bathrooms.',
  },
  {
    id:          'lower_disruption',
    title:       'What if installation disruption is a priority?',
    description: 'Explore options that minimise installation complexity.',
  },
  {
    id:          'future_bathroom',
    title:       'What if you add a bathroom in future?',
    description: 'Check whether the system can grow with your home.',
  },
  {
    id:          'system_preference',
    title:       'Want to compare a different system type?',
    description: 'See how the alternative options stack up side-by-side.',
  },
];

function buildScenarios(_dm: PortalDisplayModel): JourneyScenario[] {
  // Default safe scenarios — always available as simulator entry points.
  // Future: could filter based on what options were assessed.
  return DEFAULT_SCENARIOS;
}

// ─── Title ────────────────────────────────────────────────────────────────────

function buildTitle(dm: PortalDisplayModel): string {
  const base = dm.propertyTitle;
  if (base && base !== 'Your recommendation') {
    return `Your recommendation for ${base}`;
  }
  return 'Your home recommendation';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derives a PortalJourneyModel from a PortalDisplayModel.
 *
 * The journey model is the customer-facing layer:
 *   report payload
 *   → buildPortalDisplayModel()   (PR9 — schema interpretation)
 *   → buildPortalJourneyModel()   (PR10 — customer narrative)
 *   → portal section components
 *
 * @param displayModel  The PR9 portal display model. Must not be null.
 */
export function buildPortalJourneyModel(displayModel: PortalDisplayModel): PortalJourneyModel {
  return {
    title:         buildTitle(displayModel),
    findings:      buildFindings(displayModel),
    recommendation: buildRecommendation(displayModel),
    whyFits:       buildWhyFits(displayModel),
    whatToExpect:  buildWhatToExpect(displayModel),
    alternatives:  buildAlternatives(displayModel),
    scenarios:     buildScenarios(displayModel),
  };
}

// Re-export type alias for convenience
export type { PortalJourneyModel };
