/**
 * buildTradeOffSummary
 *
 * Derives a simple, literal trade-off comparison between the current and
 * recommended systems. Each dimension is rated Low / Medium / High so the
 * result can be rendered as a fast-scan comparative summary.
 *
 * Dimensions:
 *   1. Efficiency          — system efficiency band
 *   2. Upfront cost        — installation capital cost band
 *   3. Disruption          — how much work is involved in the changeover
 *   4. Space impact        — extra space / plant required
 *   5. Hot water           — hot water delivery quality
 *   6. Future-readiness    — alignment with electrification / low-carbon pathway
 *
 * Rules:
 *   - Positions are rule-based and intentionally approximate.
 *   - No Math.random() — all outputs are deterministic.
 *   - Falls back to a neutral 'medium' profile when a system is unrecognised.
 */

import type { EngineOutputV1, OptionCardV1 } from '../../contracts/EngineOutputV1';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A three-point rating scale used for every trade-off dimension. */
export type TradeOffBand = 'low' | 'medium' | 'high';

/** One comparable dimension in the trade-off summary. */
export interface TradeOffDimension {
  /** Plain-English label for this dimension. */
  label: string;
  /** How the *current* system rates on this dimension. */
  current: TradeOffBand;
  /** How the *recommended* system rates on this dimension. */
  recommended: TradeOffBand;
}

/** The full comparative trade-off summary. */
export interface TradeOffSummaryData {
  /** Display label for the current system (e.g. "Combi boiler"). */
  currentSystemLabel: string;
  /** Display label for the recommended system (e.g. "Air source heat pump"). */
  recommendedSystemLabel: string;
  /** Ordered list of trade-off dimensions to display. */
  dimensions: TradeOffDimension[];
}

// ─── Internal profile type ────────────────────────────────────────────────────

interface SystemProfile {
  efficiency:      TradeOffBand;
  upfrontCost:     TradeOffBand;
  disruption:      TradeOffBand;
  spaceImpact:     TradeOffBand;
  hotWater:        TradeOffBand;
  futureReadiness: TradeOffBand;
}

// ─── Profiles by OptionCardV1 id ──────────────────────────────────────────────

const OPTION_PROFILES: Record<OptionCardV1['id'], SystemProfile> = {
  combi: {
    efficiency:      'medium',
    upfrontCost:     'low',
    disruption:      'low',
    spaceImpact:     'low',
    hotWater:        'medium',
    futureReadiness: 'low',
  },
  system_unvented: {
    efficiency:      'medium',
    upfrontCost:     'medium',
    disruption:      'medium',
    spaceImpact:     'medium',
    hotWater:        'high',
    futureReadiness: 'medium',
  },
  stored_unvented: {
    efficiency:      'medium',
    upfrontCost:     'medium',
    disruption:      'medium',
    spaceImpact:     'medium',
    hotWater:        'high',
    futureReadiness: 'medium',
  },
  stored_vented: {
    efficiency:      'low',
    upfrontCost:     'low',
    disruption:      'low',
    spaceImpact:     'high',
    hotWater:        'low',
    futureReadiness: 'low',
  },
  regular_vented: {
    efficiency:      'low',
    upfrontCost:     'low',
    disruption:      'low',
    spaceImpact:     'high',
    hotWater:        'low',
    futureReadiness: 'low',
  },
  ashp: {
    efficiency:      'high',
    upfrontCost:     'high',
    disruption:      'high',
    spaceImpact:     'medium',
    hotWater:        'high',
    futureReadiness: 'high',
  },
};

// ─── Profiles by currentHeatSourceType string ─────────────────────────────────

/**
 * Map EngineInputV2_3.currentHeatSourceType values to system profiles.
 * 'other' and unrecognised values fall through to the neutral default.
 */
const HEAT_SOURCE_PROFILES: Partial<Record<string, SystemProfile>> = {
  combi:   OPTION_PROFILES.combi,
  system:  OPTION_PROFILES.system_unvented,
  regular: OPTION_PROFILES.regular_vented,
  ashp:    OPTION_PROFILES.ashp,
};

const HEAT_SOURCE_LABELS: Record<string, string> = {
  combi:   'Combi boiler',
  system:  'System boiler',
  regular: 'Regular boiler',
  ashp:    'Air source heat pump',
  other:   'Current system',
};

const OPTION_LABELS: Record<OptionCardV1['id'], string> = {
  combi:           'Combi boiler',
  system_unvented: 'System boiler',
  stored_unvented: 'Unvented cylinder system',
  stored_vented:   'Vented cylinder system',
  regular_vented:  'Regular boiler (vented)',
  ashp:            'Air source heat pump',
};

const NEUTRAL_PROFILE: SystemProfile = {
  efficiency:      'medium',
  upfrontCost:     'medium',
  disruption:      'medium',
  spaceImpact:     'medium',
  hotWater:        'medium',
  futureReadiness: 'medium',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveCurrentProfile(
  currentHeatSourceType: string | undefined,
): { label: string; profile: SystemProfile } {
  if (currentHeatSourceType == null) {
    return { label: 'Current system', profile: NEUTRAL_PROFILE };
  }
  return {
    label:   HEAT_SOURCE_LABELS[currentHeatSourceType] ?? 'Current system',
    profile: HEAT_SOURCE_PROFILES[currentHeatSourceType] ?? NEUTRAL_PROFILE,
  };
}

function resolveRecommendedProfile(
  engineOutput: EngineOutputV1,
): { label: string; profile: SystemProfile } | null {
  const primaryOption = engineOutput.options?.find(o => o.status === 'viable');
  if (primaryOption == null) return null;
  return {
    label:   OPTION_LABELS[primaryOption.id] ?? primaryOption.label,
    profile: OPTION_PROFILES[primaryOption.id] ?? NEUTRAL_PROFILE,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build a TradeOffSummaryData from engine output and (optionally) the current
 * heat-source type from survey data.
 *
 * Returns null when the engine cannot produce a recommendation (no viable
 * options available), so the caller can decide whether to render the summary.
 *
 * @param engineOutput          - Full EngineOutputV1 result.
 * @param currentHeatSourceType - Optional current system type from survey
 *   (EngineInputV2_3.currentHeatSourceType).
 */
export function buildTradeOffSummary(
  engineOutput: EngineOutputV1,
  currentHeatSourceType?: string | undefined,
): TradeOffSummaryData | null {
  const recommended = resolveRecommendedProfile(engineOutput);
  if (recommended == null) return null;

  const current = resolveCurrentProfile(currentHeatSourceType);

  const dimensions: TradeOffDimension[] = [
    {
      label:       'Efficiency',
      current:     current.profile.efficiency,
      recommended: recommended.profile.efficiency,
    },
    {
      label:       'Upfront cost',
      current:     current.profile.upfrontCost,
      recommended: recommended.profile.upfrontCost,
    },
    {
      label:       'Disruption',
      current:     current.profile.disruption,
      recommended: recommended.profile.disruption,
    },
    {
      label:       'Space impact',
      current:     current.profile.spaceImpact,
      recommended: recommended.profile.spaceImpact,
    },
    {
      label:       'Hot water',
      current:     current.profile.hotWater,
      recommended: recommended.profile.hotWater,
    },
    {
      label:       'Future-readiness',
      current:     current.profile.futureReadiness,
      recommended: recommended.profile.futureReadiness,
    },
  ];

  return {
    currentSystemLabel:     current.label,
    recommendedSystemLabel: recommended.label,
    dimensions,
  };
}
