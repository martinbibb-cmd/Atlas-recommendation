/**
 * buildDefaultQuotePacks.ts
 *
 * Derives a set of default quote pack cards from the canonical current system
 * summary and the Atlas engine recommendation.
 *
 * This is the scope-interpretation layer described in the Quote Pack Composer
 * concept: rather than starting from a blank "pick extras" screen, the quote
 * opens with evidence-derived pack options already configured.
 *
 * Formula:
 *   canonical survey + engine recommendation
 *   → existing setup summary + site constraints
 *   → recommended installation pack cards
 *
 * Design rules:
 *   - Pure function, deterministic: same input always produces same output.
 *   - Does not collect or re-ask current-system data.
 *   - Packs are topology-aware: combi packs never include cylinder controls;
 *     regular/open-vented packs always include pump and motorised valves.
 *   - Mixergy is always named specifically — never hidden under generic wording.
 *   - Every pack item highlight has a brief reason string.
 */

import type {
  UiCurrentHeatSourceLabel,
  UiCurrentHotWaterLabel,
  UiProposedHeatSourceLabel,
  UiProposedHotWaterLabel,
  CanonicalCurrentSystemSummary,
} from '../ui/installationSpecificationUiTypes';
import type {
  QuotePackCardV1,
  QuotePackKindV1,
  QuotePackShowroomContextV1,
  QuotePackDisruptionLevel,
} from './QuotePackV1';
import type { EvidenceProofLinkV1, ProposalSection } from '../../../features/scanEvidence/EvidenceProofLinkV1';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface BuildDefaultPacksInput {
  /**
   * Current system from the canonical survey.
   * Null when no survey data is available (packs will be minimal defaults).
   */
  canonicalCurrentSystem: CanonicalCurrentSystemSummary | null;

  /**
   * Atlas-recommended proposed heat source (from engine output).
   * Null when no recommendation is available.
   */
  seedProposedSystem: UiProposedHeatSourceLabel | null;

  /**
   * Primary reason for the Atlas recommendation (from engine output).
   * Null when no reason is available.
   */
  enginePrimaryReason?: string | null;

  /**
   * Site constraint labels from the engine output or survey.
   * For example: "Mains pressure limited", "Pipework access buried".
   */
  siteConstraints?: string[];

  /**
   * Evidence proof links from the scan session.
   * When provided, each pack card is annotated with the subset of links
   * relevant to its proposed system (boiler, cylinder, flue, radiators).
   *
   * Rules:
   *   - Links only annotate; they never change which pack is recommended.
   *   - Derived by buildEvidenceProofLinks() from the spatial evidence graph.
   */
  evidenceProofLinks?: EvidenceProofLinkV1[];
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface BuildDefaultPacksResult {
  /** The recommended pack kind (best_advice by default). */
  recommendedPackKind: QuotePackKindV1;
  /** Ordered pack cards for the showroom. */
  packCards: QuotePackCardV1[];
  /** Evidence context for the showroom header. */
  showroomContext: QuotePackShowroomContextV1;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a plain-English summary of the current installation from canonical survey data.
 */
function buildExistingSystemSummary(canonical: CanonicalCurrentSystemSummary | null): string {
  if (canonical == null) {
    return 'No current system data available from the canonical survey.';
  }

  const parts: string[] = [];

  const HEAT_SOURCE_LABELS: Record<UiCurrentHeatSourceLabel, string> = {
    combi_boiler:      'combination boiler',
    regular_boiler:    'regular boiler with vented cylinder',
    system_boiler:     'system boiler',
    storage_combi:     'storage combination boiler',
    heat_pump:         'heat pump',
    warm_air:          'warm air unit',
    back_boiler:       'back boiler',
    direct_electric:   'direct electric heating',
    other_heat_source: 'other heat source',
    none:              'no identified heat source',
  };

  const HOT_WATER_LABELS: Record<UiCurrentHotWaterLabel, string> = {
    no_cylinder:           'on-demand hot water from boiler',
    vented_cylinder:       'vented (tank-fed) cylinder',
    unvented_cylinder:     'mains-fed unvented cylinder',
    thermal_store:         'thermal store',
    mixergy_or_stratified: 'Mixergy / stratified cylinder',
    integrated_store:      'integrated store',
    other_hot_water:       'other hot-water arrangement',
  };

  if (canonical.heatSource != null) {
    parts.push(HEAT_SOURCE_LABELS[canonical.heatSource]);
  }

  if (canonical.hotWater != null && canonical.hotWater !== 'no_cylinder') {
    parts.push(HOT_WATER_LABELS[canonical.hotWater]);
  }

  if (canonical.boilerLocation != null) {
    parts.push(`boiler located in ${canonical.boilerLocation}`);
  }

  if (canonical.cylinderLocation != null) {
    parts.push(`cylinder in ${canonical.cylinderLocation}`);
  }

  if (parts.length === 0) {
    return 'Current system data partially available from the canonical survey.';
  }

  return `Currently installed: ${parts.join(', ')}.`;
}

/**
 * Maps a current heat source label to the most appropriate like-for-like proposed system.
 */
function likeForLikeHeatSource(
  heatSource: UiCurrentHeatSourceLabel | null,
): UiProposedHeatSourceLabel {
  if (heatSource == null) return 'combi_boiler';
  switch (heatSource) {
    case 'combi_boiler':
    case 'storage_combi':    return 'combi_boiler';
    case 'regular_boiler':
    case 'back_boiler':      return 'regular_boiler';
    case 'system_boiler':    return 'system_boiler';
    case 'heat_pump':        return 'heat_pump';
    default:                 return 'combi_boiler';
  }
}

/**
 * Maps a current heat source to the most appropriate like-for-like hot-water arrangement.
 */
function likeForLikeHotWater(
  heatSource: UiCurrentHeatSourceLabel | null,
  hotWater: UiCurrentHotWaterLabel | null,
): UiProposedHotWaterLabel | null {
  if (heatSource === 'combi_boiler') return null; // combi has no separate cylinder
  if (hotWater == null) return null;
  switch (hotWater) {
    case 'no_cylinder':           return null;
    case 'vented_cylinder':       return 'vented_cylinder';
    case 'unvented_cylinder':     return 'unvented_cylinder';
    case 'thermal_store':         return 'thermal_store';
    case 'mixergy_or_stratified': return 'mixergy_or_stratified';
    case 'integrated_store':      return 'unvented_cylinder';
    default:                      return null;
  }
}

/**
 * Derives a disruption level from the proposed system vs the current system.
 */
function deriveDisruptionLevel(
  proposed: UiProposedHeatSourceLabel,
  current: UiCurrentHeatSourceLabel | null,
  packKind: QuotePackKindV1,
): QuotePackDisruptionLevel {
  if (packKind === 'low_disruption') return 'low';
  if (proposed === 'heat_pump') return 'high';
  if (current == null) return 'medium';
  // Same family → lower disruption
  if (
    (proposed === 'combi_boiler' && current === 'combi_boiler') ||
    (proposed === 'system_boiler' && current === 'system_boiler') ||
    (proposed === 'regular_boiler' && (current === 'regular_boiler' || current === 'back_boiler'))
  ) {
    return packKind === 'like_for_like' ? 'low' : 'medium';
  }
  return 'medium';
}

// ─── Evidence link helpers ────────────────────────────────────────────────────

/**
 * Returns the proposal sections that are relevant for a given proposed
 * heat source and hot-water arrangement.
 *
 * These sections are used to filter the evidence proof links that are
 * attached to each pack card — only links matching one of these sections
 * are included.
 */
function sectionsForPack(
  proposed: UiProposedHeatSourceLabel,
  hotWater: UiProposedHotWaterLabel | null,
): ProposalSection[] {
  const sections: ProposalSection[] = ['boiler', 'general'];
  if (proposed !== 'combi_boiler' && proposed !== 'storage_combi' && hotWater != null) {
    sections.push('cylinder');
  }
  // All gas boiler packs have a flue
  if (proposed !== 'heat_pump') {
    sections.push('flue');
  }
  // All packs with radiators (always for gas; often for heat pump too)
  sections.push('radiators');
  return sections;
}

/**
 * Filters evidenceProofLinks to only those sections relevant for a given pack.
 * Returns undefined when the input is absent or no links match.
 */
function filterEvidenceLinksForPack(
  evidenceProofLinks: EvidenceProofLinkV1[] | undefined,
  proposed: UiProposedHeatSourceLabel,
  hotWater: UiProposedHotWaterLabel | null,
): EvidenceProofLinkV1[] | undefined {
  if (!evidenceProofLinks || evidenceProofLinks.length === 0) return undefined;
  const relevantSections = new Set(sectionsForPack(proposed, hotWater));
  const filtered = evidenceProofLinks.filter((link) => relevantSections.has(link.section));
  return filtered.length > 0 ? filtered : undefined;
}

// ─── Pack card builders ───────────────────────────────────────────────────────

function buildBestAdvicePack(
  canonical: CanonicalCurrentSystemSummary | null,
  seedProposed: UiProposedHeatSourceLabel,
  enginePrimaryReason: string | null,
  evidenceProofLinks?: EvidenceProofLinkV1[],
): QuotePackCardV1 {
  const hotWater = resolveHotWaterForSeed(seedProposed, canonical);

  const highlights = buildHighlightsForPack(seedProposed, hotWater, 'best_advice');

  return {
    kind: 'best_advice',
    title: 'Best advice',
    bestFor: 'Homes where Atlas can confirm the best long-term solution from the survey evidence.',
    whySuggested: enginePrimaryReason
      ?? 'Atlas has selected this pack as the best fit based on the survey, site conditions, and physics evidence.',
    proposedHeatSource: seedProposed,
    proposedHotWater: hotWater,
    includedHighlights: highlights,
    warningsOrVerification: buildWarningsForPack(seedProposed, hotWater, canonical),
    disruptionLevel: deriveDisruptionLevel(seedProposed, canonical?.heatSource ?? null, 'best_advice'),
    isRecommended: true,
    evidenceProofLinks: filterEvidenceLinksForPack(evidenceProofLinks, seedProposed, hotWater),
  };
}

function buildLikeForLikePack(
  canonical: CanonicalCurrentSystemSummary | null,
  evidenceProofLinks?: EvidenceProofLinkV1[],
): QuotePackCardV1 {
  const proposed = likeForLikeHeatSource(canonical?.heatSource ?? null);
  const hotWater = likeForLikeHotWater(canonical?.heatSource ?? null, canonical?.hotWater ?? null);
  const highlights = buildHighlightsForPack(proposed, hotWater, 'like_for_like');

  return {
    kind: 'like_for_like',
    title: 'Like-for-like',
    bestFor: 'Customers who want minimum change to their current setup.',
    whySuggested: 'This pack is the closest replacement for the existing installation. It retains the same system type and hot-water arrangement.',
    proposedHeatSource: proposed,
    proposedHotWater: hotWater,
    includedHighlights: highlights,
    warningsOrVerification: buildWarningsForPack(proposed, hotWater, canonical),
    disruptionLevel: 'low',
    evidenceProofLinks: filterEvidenceLinksForPack(evidenceProofLinks, proposed, hotWater),
  };
}

function buildLowDisruptionPack(
  canonical: CanonicalCurrentSystemSummary | null,
  evidenceProofLinks?: EvidenceProofLinkV1[],
): QuotePackCardV1 {
  const proposed = likeForLikeHeatSource(canonical?.heatSource ?? null);
  const hotWater = likeForLikeHotWater(canonical?.heatSource ?? null, canonical?.hotWater ?? null);

  return {
    kind: 'low_disruption',
    title: 'Low disruption',
    bestFor: 'Customers who need minimum disruption, existing pipe routes retained where possible.',
    whySuggested: 'This pack uses the least-invasive installation route. Existing pipe routes, cylinder location, and controls are retained where acceptable.',
    proposedHeatSource: proposed,
    proposedHotWater: hotWater,
    includedHighlights: [
      'Boiler replacement in same location',
      'Existing pipe routes retained where possible',
      'Existing controls retained where acceptable',
      'System cleanse and commission',
    ],
    warningsOrVerification: [
      'Existing controls may not meet current efficiency standards',
      'Existing pipework condition must be confirmed on site',
    ],
    disruptionLevel: 'low',
    evidenceProofLinks: filterEvidenceLinksForPack(evidenceProofLinks, proposed, hotWater),
  };
}

function buildHotWaterPriorityPack(
  canonical: CanonicalCurrentSystemSummary | null,
  seedProposed: UiProposedHeatSourceLabel | null,
  evidenceProofLinks?: EvidenceProofLinkV1[],
): QuotePackCardV1 {
  // Hot water priority defaults to system boiler + Mixergy unless current is combi
  const proposed: UiProposedHeatSourceLabel =
    seedProposed === 'heat_pump' ? 'heat_pump'
    : canonical?.heatSource === 'combi_boiler' ? 'system_boiler'
    : seedProposed ?? 'system_boiler';

  const hotWater: UiProposedHotWaterLabel = 'mixergy_or_stratified';

  return {
    kind: 'hot_water_priority',
    title: 'Hot water priority',
    bestFor: 'Homes with higher hot-water demand or where quick recovery matters.',
    whySuggested: 'This pack is optimised for stored hot-water performance, using a Mixergy / stratified cylinder that heats from the top for faster hot water availability.',
    proposedHeatSource: proposed,
    proposedHotWater: hotWater,
    includedHighlights: [
      'System boiler for reliable stored hot water',
      'Mixergy / stratified cylinder for faster hot-water recovery',
      'Cylinder thermostat and programmer',
      'Discharge route (required for mains-fed cylinder)',
      'System cleanse and commission',
    ],
    warningsOrVerification: [
      'Discharge route to suitable termination point must be confirmed',
      'Cylinder cupboard space must be verified on site',
      'Mains flow and pressure must support the chosen cylinder type',
    ],
    disruptionLevel: 'medium',
    evidenceProofLinks: filterEvidenceLinksForPack(evidenceProofLinks, proposed, hotWater),
  };
}

function buildFutureReadyPack(
  _canonical: CanonicalCurrentSystemSummary | null,
  seedProposed: UiProposedHeatSourceLabel | null,
  evidenceProofLinks?: EvidenceProofLinkV1[],
): QuotePackCardV1 {
  const proposed: UiProposedHeatSourceLabel = seedProposed ?? 'system_boiler';
  const hotWater: UiProposedHotWaterLabel | null =
    proposed === 'combi_boiler' || proposed === 'storage_combi' ? null
    : 'unvented_cylinder';

  return {
    kind: 'future_ready',
    title: 'Future ready',
    bestFor: 'Customers who may upgrade to a heat pump, solar, or battery in the next 5–10 years.',
    whySuggested: 'This pack avoids locking the home into a dead-end installation. It includes weather compensation, a cylinder compatible with future heat pump use, and lower-flow-temperature setup where possible.',
    proposedHeatSource: proposed,
    proposedHotWater: hotWater,
    includedHighlights: [
      'Weather compensation controls',
      'Lower-flow-temperature boiler setup',
      'Cylinder compatible with future heat pump',
      'Pipe insulation allowance',
      'System protection and commission',
    ],
    warningsOrVerification: [
      'Radiator sizing must be checked for lower flow temperatures',
      'Future heat pump compatibility depends on property heat loss — further assessment required',
    ],
    disruptionLevel: 'medium',
    evidenceProofLinks: filterEvidenceLinksForPack(evidenceProofLinks, proposed, hotWater),
  };
}

// ─── Highlight builders ───────────────────────────────────────────────────────

function buildHighlightsForPack(
  proposed: UiProposedHeatSourceLabel,
  hotWater: UiProposedHotWaterLabel | null,
  _packKind: QuotePackKindV1,
): string[] {
  const highlights: string[] = [];

  switch (proposed) {
    case 'combi_boiler':
    case 'storage_combi':
      highlights.push('Combination boiler (on-demand hot water)');
      break;
    case 'system_boiler':
      highlights.push('System boiler');
      break;
    case 'regular_boiler':
      highlights.push('Regular boiler', 'External circulation pump', 'Motorised valves');
      break;
    case 'heat_pump':
      highlights.push('Heat pump outdoor unit', 'Hydraulic connection');
      break;
  }

  if (hotWater != null) {
    switch (hotWater) {
      case 'vented_cylinder':       highlights.push('Vented (tank-fed) cylinder'); break;
      case 'unvented_cylinder':     highlights.push('Mains-fed cylinder'); break;
      case 'mixergy_or_stratified': highlights.push('Mixergy / stratified cylinder'); break;
      case 'thermal_store':         highlights.push('Thermal store'); break;
      case 'heat_pump_cylinder':    highlights.push('Heat pump cylinder'); break;
    }
  }

  highlights.push('Controls upgrade', 'System protection (filter)', 'Commission and handover');

  return highlights;
}

function buildWarningsForPack(
  proposed: UiProposedHeatSourceLabel,
  hotWater: UiProposedHotWaterLabel | null,
  canonical: CanonicalCurrentSystemSummary | null,
): string[] {
  const warnings: string[] = [];

  if (hotWater === 'unvented_cylinder' || hotWater === 'mixergy_or_stratified') {
    warnings.push('Discharge route to suitable termination point needs confirmation');
  }

  if (hotWater != null && hotWater !== 'vented_cylinder') {
    warnings.push('Cylinder cupboard space must be verified on site');
  }

  if (proposed === 'heat_pump') {
    warnings.push('Suitable outdoor unit location must be confirmed');
    warnings.push('Electrical supply capacity for heat pump must be checked');
  }

  if (canonical?.primaryCircuit === 'open_vented_primary' && proposed !== 'regular_boiler') {
    warnings.push('Open-vented primary circuit will require conversion to sealed system');
  }

  return warnings;
}

/**
 * Resolves the hot-water arrangement for the Atlas-recommended (best_advice) pack.
 * Uses the seed proposed system to determine what hot-water pairing makes sense.
 */
function resolveHotWaterForSeed(
  proposed: UiProposedHeatSourceLabel,
  canonical: CanonicalCurrentSystemSummary | null,
): UiProposedHotWaterLabel | null {
  if (proposed === 'combi_boiler' || proposed === 'storage_combi') return null;
  if (proposed === 'heat_pump') return 'heat_pump_cylinder';

  // For system or regular boiler, preserve existing hot-water type if suitable
  if (canonical?.hotWater != null) {
    switch (canonical.hotWater) {
      case 'vented_cylinder':       return 'vented_cylinder';
      case 'unvented_cylinder':     return 'unvented_cylinder';
      case 'mixergy_or_stratified': return 'mixergy_or_stratified';
      case 'thermal_store':         return 'thermal_store';
    }
  }

  // Default to unvented cylinder for system boiler (most common sensible choice)
  return 'unvented_cylinder';
}

// ─── buildDefaultQuotePacks ───────────────────────────────────────────────────

/**
 * Derives a set of default quote pack cards from canonical survey data and
 * the Atlas engine recommendation.
 *
 * The returned `packCards` are ordered: best_advice first (if available),
 * then like_for_like, low_disruption, hot_water_priority, future_ready.
 *
 * @param input - Survey + engine data
 * @returns     Pack cards and showroom context
 */
export function buildDefaultQuotePacks(input: BuildDefaultPacksInput): BuildDefaultPacksResult {
  const { canonicalCurrentSystem, seedProposedSystem, enginePrimaryReason, siteConstraints, evidenceProofLinks } = input;

  const existingSystemSummary = buildExistingSystemSummary(canonicalCurrentSystem);

  const packCards: QuotePackCardV1[] = [];
  let recommendedPackKind: QuotePackKindV1 = 'like_for_like';

  // Best advice — only shown when we have an engine recommendation
  if (seedProposedSystem != null) {
    packCards.push(buildBestAdvicePack(canonicalCurrentSystem, seedProposedSystem, enginePrimaryReason ?? null, evidenceProofLinks));
    recommendedPackKind = 'best_advice';
  }

  // Like-for-like
  packCards.push(buildLikeForLikePack(canonicalCurrentSystem, evidenceProofLinks));

  // Low disruption
  packCards.push(buildLowDisruptionPack(canonicalCurrentSystem, evidenceProofLinks));

  // Hot water priority (not shown when current system is combi with no engine upgrade rec)
  const currentIsCombiOnly =
    canonicalCurrentSystem?.heatSource === 'combi_boiler' &&
    (seedProposedSystem === 'combi_boiler' || seedProposedSystem === 'storage_combi');
  if (!currentIsCombiOnly) {
    packCards.push(buildHotWaterPriorityPack(canonicalCurrentSystem, seedProposedSystem, evidenceProofLinks));
  }

  // Future ready
  packCards.push(buildFutureReadyPack(canonicalCurrentSystem, seedProposedSystem, evidenceProofLinks));

  const showroomContext: QuotePackShowroomContextV1 = {
    existingSystemSummary,
    siteConditions: siteConstraints ?? [],
    recommendationReason: enginePrimaryReason ?? null,
    recommendedPackKind,
  };

  return { recommendedPackKind, packCards, showroomContext };
}
