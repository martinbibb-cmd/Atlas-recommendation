/**
 * buildPortalContentModel.ts
 *
 * Pure function that derives portal-ready content from EngineOutputV1 +
 * EngineInputV2_3.
 *
 * Design rules:
 *   - No Math.random() — entirely deterministic.
 *   - No raw engine jargon in portal-facing fields.
 *   - All data from EngineOutputV1 and EngineInputV2_3.
 *   - Customer-safe labels only.
 *   - No engine logic re-derived here — signals come from existing output.
 */

import type { EngineOutputV1, OptionCardV1 } from '../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';

// ─── Portal content types ─────────────────────────────────────────────────────

export interface PortalSummaryChip {
  label: string;
  value: string;
}

export interface PortalSignalItem {
  label: string;
  value: string;
}

export interface PortalImprovementTile {
  /** Short bold label, e.g. "Hot water reliability". */
  label: string;
  /** One-line outcome, e.g. "Better suited to homes where consistent hot water matters". */
  outcome: string;
  /** Small supporting text adding real-world context. */
  detail: string;
}

export interface PortalComparisonCard {
  id: string;
  label: string;
  isRecommended: boolean;
  verdictBadge: string;
  suitabilityLine: string;
  strengths: string[];
  caveats: string[];
}

export interface PortalEvidenceSection {
  id: string;
  heading: string;
  summary: string;
  details: string[];
}

export interface PortalContentModel {
  // ── Hero ───────────────────────────────────────────────────────────────────
  recommendationTitle: string;
  primaryReason: string;
  trustStatement: string;
  summaryChips: PortalSummaryChip[];
  portalConfidenceLabel: string;

  // ── Why this suits your home ───────────────────────────────────────────────
  whyRecommended: string[];
  homeSignals: PortalSignalItem[];
  hotWaterSignals: PortalSignalItem[];
  currentSystemSignals: PortalSignalItem[];

  // ── What this improves ─────────────────────────────────────────────────────
  improvements: PortalImprovementTile[];

  // ── Compare options ────────────────────────────────────────────────────────
  comparisonCards: PortalComparisonCard[];

  // ── Evidence behind the advice ─────────────────────────────────────────────
  evidenceSections: PortalEvidenceSection[];

  // ── Your installation plan ─────────────────────────────────────────────────
  requiredWork: string[];
  recommendedWork: string[];

  // ── Guided simulator entry ─────────────────────────────────────────────────
  simulatorIntro: string;
}

// ─── Display-label helpers ────────────────────────────────────────────────────

function heatLossBandLabel(watts: number): string {
  if (watts > 12000) return 'Very high heat loss';
  if (watts > 9000)  return 'High heat loss';
  if (watts > 6000)  return 'Moderate heat loss';
  if (watts > 3000)  return 'Low heat loss';
  return 'Very low heat loss';
}

/** Converts watts to a rounded kW string with one decimal place, e.g. 8500 → "8.5". */
function formatKilowatts(watts: number): string {
  return String(Math.round(watts / 1000 * 10) / 10);
}

function currentHeatSourceLabel(type: EngineInputV2_3['currentHeatSourceType']): string {
  switch (type) {
    case 'combi':   return 'Combi boiler';
    case 'system':  return 'System boiler';
    case 'regular': return 'Regular boiler';
    case 'ashp':    return 'Air source heat pump';
    case 'other':   return 'Other heat source';
    default:        return 'Not recorded';
  }
}

function wallTypeLabel(wallType: string | undefined): string | null {
  if (!wallType) return null;
  const LABELS: Record<string, string> = {
    solid_masonry:       'Solid masonry walls',
    cavity_unfilled:     'Unfilled cavity walls',
    cavity_uninsulated:  'Unfilled cavity walls',
    cavity_filled:       'Insulated cavity walls',
    cavity_insulated:    'Insulated cavity walls',
    timber_frame:        'Timber frame',
  };
  return LABELS[wallType] ?? null;
}

function insulationLabel(level: string | undefined): string | null {
  if (!level) return null;
  const LABELS: Record<string, string> = {
    poor:        'Limited insulation',
    moderate:    'Moderate insulation',
    good:        'Good insulation',
    exceptional: 'Well insulated',
  };
  return LABELS[level] ?? null;
}

function occupancySignatureLabel(sig: string | undefined): string | null {
  if (!sig) return null;
  const LABELS: Record<string, string> = {
    professional:   'Weekday daytime away',
    home_all_day:   'Home most of the day',
    shift_worker:   'Variable working pattern',
    retired:        'Home throughout the day',
    irregular:      'Irregular usage pattern',
  };
  return LABELS[sig] ?? null;
}

function boilerAgeLabel(ageYears: number | undefined): string | null {
  if (ageYears == null) return null;
  if (ageYears < 5)  return `Recently installed (under 5 years)`;
  if (ageYears < 10) return `Established (${ageYears} years)`;
  if (ageYears < 15) return `Ageing (${ageYears} years)`;
  return `Old (${ageYears}+ years)`;
}

function verdictBadgeLabel(card: OptionCardV1, isRecommended: boolean): string {
  if (isRecommended) return 'Recommended';
  switch (card.status) {
    case 'viable':   return 'Viable option';
    case 'caution':  return 'Use with caution';
    case 'rejected': return 'Not recommended';
    default:         return 'Option';
  }
}

function confidenceLabel(level: string | undefined): string {
  switch (level) {
    case 'high':   return 'High confidence';
    case 'medium': return 'Medium confidence';
    case 'low':    return 'Lower confidence';
    default:       return 'Confidence not assessed';
  }
}

// ─── Improvements derivation ──────────────────────────────────────────────────

const DEFAULT_IMPROVEMENT_TILES: PortalImprovementTile[] = [
  {
    label:   'Hot water reliability',
    outcome: 'Two showers can run at once — on-demand hot water suited to your household pattern',
    detail:  'Hot water availability matched to the way your home is used, without unnecessary waiting time.',
  },
  {
    label:   'Everyday comfort',
    outcome: 'Heating response aligned with your home\'s heat profile',
    detail:  'System output chosen to match the actual heat demand of your property.',
  },
  {
    label:   'System resilience',
    outcome: 'A more dependable installation for the long term',
    detail:  'Designed around your installation constraints and current condition signals.',
  },
  {
    label:   'Control upgrade potential',
    outcome: 'Compatible with modern heating controls',
    detail:  'Ready for smart thermostats and zone control improvements when you choose to upgrade.',
  },
];

function buildImprovements(recommendedOption: OptionCardV1 | undefined): PortalImprovementTile[] {
  if (!recommendedOption) return DEFAULT_IMPROVEMENT_TILES;

  const dhwHeadline  = recommendedOption.dhw?.headline?.trim();
  const heatHeadline = recommendedOption.heat?.headline?.trim();
  const engHeadline  = recommendedOption.engineering?.headline?.trim();

  const dhwDetail  = recommendedOption.dhw?.bullets?.[0]?.trim();
  const heatDetail = recommendedOption.heat?.bullets?.[0]?.trim();
  const engDetail  = recommendedOption.engineering?.bullets?.[0]?.trim();

  // Use engine-provided bullets where available, fall back to defaults.
  return [
    {
      label:   DEFAULT_IMPROVEMENT_TILES[0].label,
      outcome: dhwHeadline  || DEFAULT_IMPROVEMENT_TILES[0].outcome,
      detail:  dhwDetail    || DEFAULT_IMPROVEMENT_TILES[0].detail,
    },
    {
      label:   DEFAULT_IMPROVEMENT_TILES[1].label,
      outcome: heatHeadline || DEFAULT_IMPROVEMENT_TILES[1].outcome,
      detail:  heatDetail   || DEFAULT_IMPROVEMENT_TILES[1].detail,
    },
    {
      label:   DEFAULT_IMPROVEMENT_TILES[2].label,
      outcome: engHeadline  || DEFAULT_IMPROVEMENT_TILES[2].outcome,
      detail:  engDetail    || DEFAULT_IMPROVEMENT_TILES[2].detail,
    },
    {
      label:   DEFAULT_IMPROVEMENT_TILES[3].label,
      outcome: recommendedOption.why?.[0] || DEFAULT_IMPROVEMENT_TILES[3].outcome,
      detail:  recommendedOption.why?.[1] || DEFAULT_IMPROVEMENT_TILES[3].detail,
    },
  ];
}

// ─── Comparison cards derivation ──────────────────────────────────────────────

function buildComparisonCards(
  options: OptionCardV1[] | undefined,
  recommendedId: string,
): PortalComparisonCard[] {
  if (!options?.length) return [];

  // Recommended card first, then by score descending, then viable before rejected.
  const sorted = [...options].sort((a, b) => {
    if (a.id === recommendedId) return -1;
    if (b.id === recommendedId) return 1;
    const scoreA = a.score?.total ?? (a.status === 'viable' ? 50 : 0);
    const scoreB = b.score?.total ?? (b.status === 'viable' ? 50 : 0);
    return scoreB - scoreA;
  });

  return sorted.map((card) => {
    const isRecommended = card.id === recommendedId;

    const strengths = [
      ...(card.why ?? []),
      ...(card.heat?.bullets ?? []),
      ...(card.dhw?.bullets ?? []),
    ].filter(Boolean).slice(0, 3);

    const caveats: string[] = [];
    if (card.heat?.status === 'caution') caveats.push(card.heat.headline || 'Heating constraints noted');
    if (card.dhw?.status === 'caution')  caveats.push(card.dhw.headline  || 'Hot water constraints noted');
    if (card.engineering?.status === 'caution') caveats.push(card.engineering.headline || 'Installation constraints noted');

    // Also add sensitivities as caveats (max 2 total)
    (card.sensitivities ?? []).forEach((s) => {
      if (caveats.length < 2 && s.effect === 'downgrade') {
        caveats.push(s.note);
      }
    });

    const suitabilityLine = card.headline || (isRecommended ? 'Best match for your home' : `${card.label} assessed for your survey`);

    return {
      id:             card.id,
      label:          card.label,
      isRecommended,
      verdictBadge:   verdictBadgeLabel(card, isRecommended),
      suitabilityLine,
      strengths:      strengths.length ? strengths : [card.headline || `${card.label} assessed`],
      caveats:        caveats.slice(0, 2),
    };
  });
}

// ─── Evidence sections derivation ────────────────────────────────────────────

function buildEvidenceSections(
  output: EngineOutputV1,
  input: EngineInputV2_3,
): PortalEvidenceSection[] {
  const sections: PortalEvidenceSection[] = [];

  // ── 1. Heat loss and home fabric ─────────────────────────────────────────
  const fabricDetails: string[] = [];
  if (input.heatLossWatts) {
    fabricDetails.push(`Heat loss assessed at ${formatKilowatts(input.heatLossWatts)} kW`);
  }
  const wt = wallTypeLabel(input.building?.fabric?.wallType);
  if (wt) fabricDetails.push(`Wall type: ${wt}`);
  const il = insulationLabel(input.building?.fabric?.insulationLevel as string | undefined);
  if (il) fabricDetails.push(`Insulation: ${il}`);

  sections.push({
    id:      'heat_loss_fabric',
    heading: 'Heat loss and home fabric',
    summary: input.heatLossWatts
      ? `Your home has a ${heatLossBandLabel(input.heatLossWatts).toLowerCase()} — the recommended system is sized to match.`
      : 'Heat loss characteristics assessed from your survey data.',
    details: fabricDetails,
  });

  // ── 2. Household demand ──────────────────────────────────────────────────
  const demandDetails: string[] = [];
  if (input.occupancyCount != null) demandDetails.push(`${input.occupancyCount} regular occupant${input.occupancyCount !== 1 ? 's' : ''}`);
  if (input.bathroomCount)          demandDetails.push(`${input.bathroomCount} bathroom${input.bathroomCount !== 1 ? 's' : ''}`);
  const timingLabel = occupancySignatureLabel(input.occupancySignature);
  if (timingLabel) demandDetails.push(`Usage pattern: ${timingLabel}`);

  sections.push({
    id:      'household_demand',
    heading: 'Household demand',
    summary: 'Hot water and heating demand estimated from your household size, bathroom count, and usage pattern.',
    details: demandDetails,
  });

  // ── 3. Current system assessment ─────────────────────────────────────────
  const systemDetails: string[] = [];
  const heatSourceLabel = currentHeatSourceLabel(input.currentHeatSourceType);
  if (input.currentHeatSourceType) systemDetails.push(`Current heat source: ${heatSourceLabel}`);
  const ageLabel = boilerAgeLabel(input.currentBoilerAgeYears);
  if (ageLabel) systemDetails.push(ageLabel);
  if (input.makeModelText) systemDetails.push(`Make / model: ${input.makeModelText}`);

  const verdictReasons = output.verdict?.reasons ?? [];
  const systemSummary = verdictReasons.length
    ? verdictReasons[0]
    : 'Current system evaluated as part of the recommendation assessment.';

  sections.push({
    id:      'current_system',
    heading: 'Current system assessment',
    summary: systemSummary,
    details: systemDetails,
  });

  // ── 4. Constraints and required work ─────────────────────────────────────
  const constraintDetails: string[] = [];
  const recommended = output.options?.find((o) => o.status === 'viable');
  if (recommended) {
    const compliance = recommended.typedRequirements?.complianceRequired ?? [];
    const mustHave   = recommended.typedRequirements?.mustHave ?? [];
    constraintDetails.push(...compliance.slice(0, 2), ...mustHave.slice(0, 2));
  }

  sections.push({
    id:      'constraints',
    heading: 'Constraints and required work',
    summary: constraintDetails.length
      ? 'The following items are required to install the recommended system correctly.'
      : 'No significant installation constraints identified from your survey data.',
    details: constraintDetails,
  });

  return sections;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Builds the full PortalContentModel from engine output and input.
 *
 * Returns a deterministic, customer-safe content model — no Math.random(),
 * no raw engine identifiers, no jargon in portal-facing strings.
 */
export function buildPortalContentModel(
  output: EngineOutputV1,
  input: EngineInputV2_3,
): PortalContentModel {
  const primaryId = output.options?.find((o) => o.status === 'viable')?.id ?? '';
  const recommendedOption = output.options?.find((o) => o.id === primaryId);

  // ── Hero ──────────────────────────────────────────────────────────────────
  const recommendationTitle = output.verdict?.title || output.recommendation?.primary || 'Your recommendation';
  const primaryReason = output.verdict?.primaryReason || output.verdict?.reasons?.[0] || '';
  const portalConfidenceLabel = confidenceLabel(output.verdict?.confidence?.level);

  // ── Summary chips ─────────────────────────────────────────────────────────
  const summaryChips: PortalSummaryChip[] = [];

  // Home size chip
  const occupancyParts: string[] = [];
  if (input.occupancyCount != null) {
    occupancyParts.push(`${input.occupancyCount} ${input.occupancyCount === 1 ? 'person' : 'people'}`);
  }
  if (input.bathroomCount) {
    occupancyParts.push(`${input.bathroomCount} ${input.bathroomCount === 1 ? 'bathroom' : 'bathrooms'}`);
  }
  if (occupancyParts.length) {
    summaryChips.push({ label: 'Household', value: occupancyParts.join(', ') });
  }

  // Heat loss chip
  if (input.heatLossWatts) {
    summaryChips.push({ label: 'Heat loss', value: heatLossBandLabel(input.heatLossWatts) });
  }

  // Current system chip
  if (input.currentHeatSourceType) {
    summaryChips.push({ label: 'Current system', value: currentHeatSourceLabel(input.currentHeatSourceType) });
  }

  // Confidence chip
  summaryChips.push({ label: 'Confidence', value: portalConfidenceLabel });

  // ── Why section ───────────────────────────────────────────────────────────
  const whyRecommended = (output.verdict?.reasons ?? []).slice(0, 3);

  const homeSignals: PortalSignalItem[] = [];
  if (input.heatLossWatts) {
    homeSignals.push({ label: 'Heat loss', value: heatLossBandLabel(input.heatLossWatts) });
  }
  const wt = wallTypeLabel(input.building?.fabric?.wallType);
  if (wt) homeSignals.push({ label: 'Wall type', value: wt });
  const il = insulationLabel(input.building?.fabric?.insulationLevel as string | undefined);
  if (il) homeSignals.push({ label: 'Insulation', value: il });
  if (input.buildingMass) {
    const massLabels: Record<string, string> = { light: 'Light thermal mass', medium: 'Medium thermal mass', heavy: 'Heavy thermal mass' };
    const massLabel = massLabels[input.buildingMass];
    if (massLabel) homeSignals.push({ label: 'Thermal mass', value: massLabel });
  }

  const hotWaterSignals: PortalSignalItem[] = [];
  if (input.occupancyCount != null) {
    hotWaterSignals.push({ label: 'Occupants', value: String(input.occupancyCount) });
  }
  if (input.bathroomCount) {
    hotWaterSignals.push({ label: 'Bathrooms', value: String(input.bathroomCount) });
  }
  const timingLabel = occupancySignatureLabel(input.occupancySignature);
  if (timingLabel) hotWaterSignals.push({ label: 'Usage pattern', value: timingLabel });

  const currentSystemSignals: PortalSignalItem[] = [];
  if (input.currentHeatSourceType) {
    currentSystemSignals.push({ label: 'Heat source', value: currentHeatSourceLabel(input.currentHeatSourceType) });
  }
  const ageLabel = boilerAgeLabel(input.currentBoilerAgeYears);
  if (ageLabel) currentSystemSignals.push({ label: 'System age', value: ageLabel });
  if (input.makeModelText) currentSystemSignals.push({ label: 'Make / model', value: input.makeModelText });

  // ── Improvements ─────────────────────────────────────────────────────────
  const improvements = buildImprovements(recommendedOption);

  // ── Comparison cards ──────────────────────────────────────────────────────
  const comparisonCards = buildComparisonCards(output.options, primaryId);

  // ── Evidence ──────────────────────────────────────────────────────────────
  const evidenceSections = buildEvidenceSections(output, input);

  // ── Plan ──────────────────────────────────────────────────────────────────
  const requiredWork = [
    ...(recommendedOption?.typedRequirements?.complianceRequired ?? []),
    ...(recommendedOption?.typedRequirements?.mustHave ?? []),
  ];
  const recommendedWork = [
    ...(recommendedOption?.typedRequirements?.likelyUpgrades ?? []),
    ...(recommendedOption?.typedRequirements?.niceToHave ?? []),
  ];

  // ── Simulator intro ───────────────────────────────────────────────────────
  const simulatorIntro = `See how the ${recommendationTitle} behaves across a typical day — tap use, heating response, recovery, and trade-offs.`;

  return {
    recommendationTitle,
    primaryReason,
    trustStatement: 'This is the option we would choose for this home.',
    summaryChips,
    portalConfidenceLabel,
    whyRecommended,
    homeSignals,
    hotWaterSignals,
    currentSystemSignals,
    improvements,
    comparisonCards,
    evidenceSections,
    requiredWork,
    recommendedWork,
    simulatorIntro,
  };
}
