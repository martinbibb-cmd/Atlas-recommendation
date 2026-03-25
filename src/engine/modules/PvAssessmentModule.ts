/**
 * PvAssessmentModule.ts
 *
 * Canonical PV (photovoltaic) assessment module.
 *
 * Computes structured PV output signals that presentation, simulator, and the
 * recommendation engine can bind to. Expands the lightweight
 * FutureEnergyOpportunitiesModule with quantified signals and a canonical
 * output contract.
 *
 * Design rules:
 *   - Deterministic. No randomness.
 *   - All signals change meaningfully when roof, shading, or occupancy changes.
 *   - PV signals influence stored-water and Mixergy scoring in the recommendation
 *     engine. They must not be re-derived in UI components.
 *   - Battery and existing-PV flags are first-class outputs, not footnotes.
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Output types ─────────────────────────────────────────────────────────────

/**
 * Overall PV viability for this property.
 *
 *   good    — south-facing pitch, low shading; good annual yield expected
 *   fair    — east/west-facing or mixed; usable but sub-optimal
 *   limited — north-facing, heavy shading, flat with unknown aspect, or
 *             insufficient data to assess
 */
export type PvSuitability = 'good' | 'fair' | 'limited';

/**
 * When PV generation is expected to peak relative to household demand.
 *
 *   peak_daytime    — generation peaks 10:00–14:00; well-aligned with
 *                     daytime-home households and cylinder top-up windows
 *   spread          — east/west mixed generates morning and afternoon spread
 *   limited_season  — flat/unknown or high-shading; effectively winter-limited
 */
export type PvGenerationTimingProfile = 'peak_daytime' | 'spread' | 'limited_season';

/**
 * Alignment between when PV generates and when the household draws hot water.
 *
 *   aligned         — generation peak coincides with demand (daytime home,
 *                     south-facing, stored water present)
 *   partly_aligned  — partial overlap (e.g. away daytime but cylinder can
 *                     absorb midday surplus)
 *   poorly_aligned  — household away during generation peak AND no stored water
 *                     to capture surplus
 */
export type EnergyDemandAlignment = 'aligned' | 'partly_aligned' | 'poorly_aligned';

/**
 * Potential for PV surplus to be usefully stored as hot water.
 *
 *   high    — stored water present + favourable alignment; surplus captured
 *             rather than exported
 *   medium  — stored water present but sub-optimal alignment, or good
 *             alignment but no stored water (battery would help)
 *   low     — combi-only with professional absence; little opportunity to
 *             absorb PV surplus
 */
export type SolarStorageOpportunity = 'high' | 'medium' | 'low';

/**
 * Canonical PV assessment result — the "Energy" anchor for presentation.
 *
 * All presentation copy referencing solar potential must originate here.
 */
export interface PvAssessmentResult {
  /**
   * Overall PV viability for this property.
   * Derived from roof orientation, roof type, and shading.
   */
  pvSuitability: PvSuitability;

  /**
   * Generation timing profile — when during the day PV is expected to produce.
   * Drives the "alignment" narrative.
   */
  pvGenerationTimingProfile: PvGenerationTimingProfile;

  /**
   * Alignment between PV generation and household hot-water demand.
   * Combines generation timing with occupancy pattern and stored-water presence.
   */
  energyDemandAlignment: EnergyDemandAlignment;

  /**
   * Opportunity to capture PV surplus as stored hot water.
   * High when a cylinder (especially Mixergy) is present and alignment is good.
   */
  solarStorageOpportunity: SolarStorageOpportunity;

  /**
   * Whether the home currently has PV panels installed.
   * True when solarBoost.enabled === true (diverter implies existing panels).
   */
  hasExistingPv: boolean;

  /**
   * Whether a battery storage system is present or planned.
   * Sourced from expertAssumptions.hasBattery / batteryPlanned if available.
   * Undefined when not known.
   */
  batteryPlanned: boolean | undefined;

  /**
   * Array of plain-language narrative flags for presentation copy.
   *
   * Examples:
   *   "South-facing roof: good annual PV yield expected."
   *   "Cylinder present — PV surplus can be stored as hot water."
   *   "Household away during peak solar hours — battery increases value."
   */
  solarNarrativeSignals: string[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

type RoofOrientationSignal = 'south_likely' | 'less_optimal' | 'north_facing' | 'unknown';
type ShadingSignal = 'none_or_low' | 'medium' | 'high' | 'unknown';

function deriveRoofOrientation(input: EngineInputV2_3): RoofOrientationSignal {
  if (input.roofOrientation && input.roofOrientation !== 'unknown') {
    const o = input.roofOrientation;
    if (o === 'south' || o === 'south_east' || o === 'south_west' || o === 'mixed') {
      return 'south_likely';
    }
    if (o === 'north') return 'north_facing';
    return 'less_optimal'; // east or west
  }
  if (input.houseFrontFacing) {
    const f = input.houseFrontFacing;
    if (f === 'north' || f === 'south') return 'south_likely';
    return 'less_optimal';
  }
  return 'unknown';
}

function deriveShading(input: EngineInputV2_3): ShadingSignal {
  if (!input.solarShading || input.solarShading === 'unknown') return 'unknown';
  if (input.solarShading === 'low') return 'none_or_low';
  if (input.solarShading === 'medium') return 'medium';
  return 'high';
}

function computePvSuitability(
  orientation: RoofOrientationSignal,
  shading: ShadingSignal,
  roofType: EngineInputV2_3['roofType'],
): PvSuitability {
  // Hard limited cases
  if (orientation === 'north_facing') return 'limited';
  if (shading === 'high') return 'limited';
  if (roofType === 'flat') return 'fair'; // flat needs ballasted frames; feasible but sub-optimal

  // Good cases
  if (orientation === 'south_likely' && (shading === 'none_or_low' || shading === 'unknown')) {
    return 'good';
  }

  // Fair cases
  if (orientation === 'south_likely' && shading === 'medium') return 'fair';
  if (orientation === 'less_optimal') return 'fair';

  // Unknown orientation — cannot assess well
  return 'limited';
}

function computeGenerationTimingProfile(
  orientation: RoofOrientationSignal,
  shading: ShadingSignal,
): PvGenerationTimingProfile {
  if (shading === 'high') return 'limited_season';
  if (orientation === 'north_facing') return 'limited_season';
  if (orientation === 'unknown' && shading === 'unknown') return 'limited_season';

  if (orientation === 'less_optimal') return 'spread'; // east+west spread
  if (orientation === 'south_likely') return 'peak_daytime'; // south peaks midday
  // mixed/unknown but not excluded
  return 'spread';
}

function hasStoredHotWater(input: EngineInputV2_3): boolean {
  if (input.preferCombi === true) return false;
  return input.dhwTankType != null;
}

function hasDaytimeOccupancy(input: EngineInputV2_3): boolean {
  const sig = input.occupancySignature;
  return sig === 'steady_home' || sig === 'steady' || sig === 'shift_worker' || sig === 'shift';
}

function computeEnergyDemandAlignment(
  timingProfile: PvGenerationTimingProfile,
  input: EngineInputV2_3,
): EnergyDemandAlignment {
  const stored = hasStoredHotWater(input);
  const daytimeHome = hasDaytimeOccupancy(input);
  const isMixergy = input.dhwTankType === 'mixergy';

  if (timingProfile === 'limited_season') {
    // Very little generation; minimal alignment possible
    return stored ? 'partly_aligned' : 'poorly_aligned';
  }

  if (timingProfile === 'peak_daytime') {
    if (daytimeHome && stored) return 'aligned'; // Best case: home + cylinder
    if (isMixergy) return 'aligned'; // Mixergy captures midday surplus regardless of presence
    if (stored) return 'partly_aligned'; // Cylinder absorbs even when away
    if (daytimeHome) return 'partly_aligned'; // General daytime use without storage
    return 'poorly_aligned'; // Away + no storage = most generation exported
  }

  // spread profile
  if (stored) return 'partly_aligned';
  if (daytimeHome) return 'partly_aligned';
  return 'poorly_aligned';
}

function computeSolarStorageOpportunity(
  pvSuitability: PvSuitability,
  alignment: EnergyDemandAlignment,
  input: EngineInputV2_3,
): SolarStorageOpportunity {
  const stored = hasStoredHotWater(input);
  const isMixergy = input.dhwTankType === 'mixergy';

  if (pvSuitability === 'limited') {
    // Not much solar to capture
    return stored ? 'medium' : 'low';
  }

  if (alignment === 'aligned') {
    return isMixergy ? 'high' : stored ? 'high' : 'medium';
  }

  if (alignment === 'partly_aligned') {
    return stored ? 'medium' : 'low';
  }

  // poorly_aligned
  return 'low';
}

function buildPvNarrativeSignals(
  pvSuitability: PvSuitability,
  orientation: RoofOrientationSignal,
  shading: ShadingSignal,
  timingProfile: PvGenerationTimingProfile,
  alignment: EnergyDemandAlignment,
  storageOpportunity: SolarStorageOpportunity,
  hasExistingPv: boolean,
  isMixergy: boolean,
  hasStored: boolean,
  daytimeHome: boolean,
): string[] {
  const signals: string[] = [];

  // Orientation
  if (orientation === 'south_likely') {
    signals.push('South-facing roof — good annual PV yield is expected from this orientation.');
  } else if (orientation === 'less_optimal') {
    signals.push(
      'East/west-facing roof — PV is viable but yield will be lower than a south-facing equivalent.',
    );
  } else if (orientation === 'north_facing') {
    signals.push('North-facing roof — PV is not well suited to this property.');
  }

  // Shading
  if (shading === 'medium') {
    signals.push('Moderate shading detected — a shading analysis should confirm actual yield.');
  } else if (shading === 'high') {
    signals.push('Heavy shading significantly limits PV viability — detailed survey recommended.');
  }

  // Existing PV
  if (hasExistingPv) {
    signals.push(
      'Existing solar installation detected — diverter or load-shift optimisation may increase self-consumption.',
    );
  }

  // Storage opportunity
  if (isMixergy && pvSuitability !== 'limited') {
    signals.push(
      'Mixergy cylinder enables active solar stratification — midday PV surplus is efficiently captured.',
    );
  } else if (hasStored && storageOpportunity === 'high') {
    signals.push('Cylinder present — PV surplus can be stored as hot water rather than exported.');
  } else if (!hasStored && alignment === 'poorly_aligned') {
    signals.push(
      'No stored hot water — PV surplus is likely exported during peak generation. A cylinder or battery would increase self-consumption.',
    );
  }

  // Occupancy timing
  if (!daytimeHome && hasStored && pvSuitability !== 'limited') {
    signals.push(
      'Household away during peak solar hours — the cylinder absorbs midday surplus automatically.',
    );
  }
  if (!daytimeHome && !hasStored && pvSuitability !== 'limited') {
    signals.push(
      'Household away during peak solar hours — a battery would capture midday surplus that would otherwise be exported.',
    );
  }

  // Overall verdict
  if (pvSuitability === 'good' && storageOpportunity === 'high') {
    signals.push('This home is well positioned to benefit from PV — both generation and capture are favourable.');
  } else if (pvSuitability === 'limited') {
    signals.push('PV benefit is limited by roof or shading constraints — check feasibility before proceeding.');
  }

  return signals;
}

// ─── Module entry point ───────────────────────────────────────────────────────

/**
 * Run the PV assessment module.
 *
 * Consumes engine input; returns a canonical `PvAssessmentResult`.
 * Does not depend on any runner result — pure function of input.
 */
export function runPvAssessmentModule(input: EngineInputV2_3): PvAssessmentResult {
  const orientation = deriveRoofOrientation(input);
  const shading = deriveShading(input);

  const pvSuitability = computePvSuitability(orientation, shading, input.roofType);
  const pvGenerationTimingProfile = computeGenerationTimingProfile(orientation, shading);
  const energyDemandAlignment = computeEnergyDemandAlignment(pvGenerationTimingProfile, input);

  const solarStorageOpportunity = computeSolarStorageOpportunity(
    pvSuitability,
    energyDemandAlignment,
    input,
  );

  const hasExistingPv = input.solarBoost?.enabled === true;

  // Battery: sourced from expertAssumptions if the field exists; otherwise undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const batteryPlanned: boolean | undefined = (input.expertAssumptions as any)?.batteryPlanned ?? undefined;

  const isMixergy = input.dhwTankType === 'mixergy';
  const hasStored = hasStoredHotWater(input);
  const daytimeHome = hasDaytimeOccupancy(input);

  const solarNarrativeSignals = buildPvNarrativeSignals(
    pvSuitability,
    orientation,
    shading,
    pvGenerationTimingProfile,
    energyDemandAlignment,
    solarStorageOpportunity,
    hasExistingPv,
    isMixergy,
    hasStored,
    daytimeHome,
  );

  return {
    pvSuitability,
    pvGenerationTimingProfile,
    energyDemandAlignment,
    solarStorageOpportunity,
    hasExistingPv,
    batteryPlanned,
    solarNarrativeSignals,
  };
}
