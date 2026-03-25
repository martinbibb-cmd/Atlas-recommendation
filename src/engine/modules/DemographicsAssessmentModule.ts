/**
 * DemographicsAssessmentModule.ts
 *
 * Computes canonical demographic output signals from engine input.
 *
 * These outputs are the "demographic truth" that presentation, simulators, and
 * the recommendation engine can bind to. They must not be re-derived in UI
 * components — all derived demographic signals flow through this module.
 *
 * Design rules:
 *   - Deterministic. No randomness.
 *   - All outputs must change meaningfully when household composition changes.
 *   - Used by buildRecommendationsFromEvidence to adjust storage-benefit scoring.
 *   - Used by presentation layer for copy that references "your home".
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import {
  findDemandPreset,
  resolveTimingOverrides,
} from '../schema/OccupancyPreset';
import type { DemandPresetId } from '../schema/OccupancyPreset';

// ─── Output types ─────────────────────────────────────────────────────────────

/**
 * Intensity of bath use in the household.
 *   low    — shower-only or very occasional baths (< 2/week)
 *   medium — occasional baths (2–3 per week)
 *   high   — frequent baths (4+ per week or daily)
 */
export type BathUseIntensity = 'low' | 'medium' | 'high';

/**
 * Whether the household is typically home during peak solar generation hours
 * (09:00–15:00).
 *   daytime_home   — at least one person home most of the working day
 *   away_daytime   — household typically absent 09:00–17:00
 *   irregular      — shift work or variable schedule
 */
export type OccupancyTimingProfile = 'daytime_home' | 'away_daytime' | 'irregular';

/**
 * Composite signal for how much the household benefits from stored hot water
 * relative to a combi (flow-only) system.
 *
 *   high   — large family, bath use, multiple bathrooms, or daytime presence
 *            where cylinder top-up supports daytime draws
 *   medium — moderate family or some bath use; marginal stored-water advantage
 *   low    — small household, shower-only, professional absence pattern
 */
export type StorageBenefitSignal = 'high' | 'medium' | 'low';

/**
 * Canonical demographic assessment result — the "Home" anchor for presentation.
 *
 * All presentation copy referencing household demand must originate here;
 * it must not be re-derived in UI components.
 */
export interface DemographicAssessmentResult {
  /**
   * Human-readable label for the inferred demand profile.
   * Sourced from DemandPreset.demandStyleLabel when a preset is resolved.
   * Example: "Family · High simultaneous use · Evening shower peak"
   */
  demandProfileLabel: string;

  /**
   * Estimated daily hot-water consumption in litres.
   *
   * Formula (UK-based):
   *   base: 45 L/person/day (shower + kitchen)
   *   bath contribution: bathFrequencyPerWeek × 80 L / 7
   *
   * Clamped minimum: 30 L (single adult shower-only).
   * This value drives cylinder sizing narratives and storage-benefit scoring.
   */
  dailyHotWaterLitres: number;

  /**
   * Estimated peak number of simultaneous DHW outlets in use.
   * Derived from bathroomCount, household size, and simultaneousUseSeverity.
   *
   * Rules:
   *   bathroomCount >= 2 AND simultaneousUseSeverity = 'high'  → 3
   *   bathroomCount >= 2 OR  simultaneousUseSeverity = 'high'  → 2
   *   else                                                       → 1
   */
  peakSimultaneousOutlets: number;

  /**
   * Bath-use intensity band derived from bathFrequencyPerWeek.
   */
  bathUseIntensity: BathUseIntensity;

  /**
   * Daytime presence profile derived from occupancySignature or demandPreset.
   */
  occupancyTimingProfile: OccupancyTimingProfile;

  /**
   * Composite storage-benefit signal — how much this household benefits from
   * stored hot water compared with a combi (flow-only) system.
   */
  storageBenefitSignal: StorageBenefitSignal;

  /**
   * Array of plain-language narrative flags for presentation copy.
   *
   * Examples:
   *   "Large household with high simultaneous demand — a combi may struggle."
   *   "Bath-heavy usage increases stored-water value significantly."
   *   "Professional absence pattern reduces daytime demand."
   */
  demographicNarrativeSignals: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Base daily hot-water draw per person (shower + kitchen + handwashing). */
const BASE_LITRES_PER_PERSON = 45;

/** Additional litres per bath event (average UK deep-fill bath). */
const LITRES_PER_BATH = 80;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveBathUseIntensity(bathFrequencyPerWeek: number): BathUseIntensity {
  if (bathFrequencyPerWeek >= 4) return 'high';
  if (bathFrequencyPerWeek >= 2) return 'medium';
  return 'low';
}

function deriveOccupancyTimingProfile(
  input: EngineInputV2_3,
): OccupancyTimingProfile {
  const sig = input.occupancySignature;
  if (sig === 'steady_home' || sig === 'steady') return 'daytime_home';
  if (sig === 'shift_worker' || sig === 'shift') return 'irregular';
  // 'professional' → away daytime
  return 'away_daytime';
}

function computeStorageBenefitSignal(
  occupancyCount: number,
  bathIntensity: BathUseIntensity,
  timingProfile: OccupancyTimingProfile,
  bathroomCount: number,
  peakOutlets: number,
): StorageBenefitSignal {
  // Hard high-benefit cases
  if (occupancyCount >= 4) return 'high';
  if (bathIntensity === 'high') return 'high';
  if (peakOutlets >= 2) return 'high';
  if (bathroomCount >= 2 && occupancyCount >= 3) return 'high';

  // Medium cases
  if (occupancyCount === 3) return 'medium';
  if (bathIntensity === 'medium') return 'medium';
  if (timingProfile === 'daytime_home' && occupancyCount >= 2) return 'medium';
  if (bathroomCount >= 2) return 'medium';

  // Default low
  return 'low';
}

function buildNarrativeSignals(
  occupancyCount: number,
  bathIntensity: BathUseIntensity,
  timingProfile: OccupancyTimingProfile,
  peakOutlets: number,
  storageBenefit: StorageBenefitSignal,
  bathroomCount: number,
): string[] {
  const signals: string[] = [];

  if (occupancyCount >= 5) {
    signals.push(
      'Very large household — high continuous hot-water demand; a generously sized cylinder is advisable.',
    );
  } else if (occupancyCount >= 4) {
    signals.push(
      'Large household with high simultaneous demand — a combi may struggle to keep up.',
    );
  } else if (occupancyCount === 3) {
    signals.push(
      'Three-person household — borderline for combi; simultaneous use is the key constraint.',
    );
  }

  if (bathIntensity === 'high') {
    signals.push(
      'Frequent baths significantly increase stored hot-water demand — cylinder volume matters.',
    );
  } else if (bathIntensity === 'medium') {
    signals.push('Occasional bath use adds to stored hot-water demand beyond shower-only estimates.');
  }

  if (peakOutlets >= 3) {
    signals.push(
      'Three or more simultaneous outlets expected — a combi cannot safely serve this household.',
    );
  } else if (peakOutlets === 2) {
    signals.push(
      'Simultaneous hot-water draw is likely — a combi with two bathrooms carries concurrency risk.',
    );
  }

  if (timingProfile === 'daytime_home') {
    signals.push(
      'Household is typically home during the day — daytime cylinder top-up has real value here.',
    );
  } else if (timingProfile === 'away_daytime') {
    signals.push(
      'Professional absence pattern — demand concentrates in morning and evening peaks.',
    );
  } else {
    signals.push(
      'Irregular occupancy pattern — demand peaks are offset and harder to predict.',
    );
  }

  if (storageBenefit === 'high') {
    signals.push(
      'Stored hot water offers meaningful advantage over a combi for this household.',
    );
  } else if (storageBenefit === 'low' && occupancyCount <= 2 && bathroomCount <= 1) {
    signals.push(
      'Low stored-water advantage — a combi is well-matched to this household size.',
    );
  }

  return signals;
}

// ─── Module entry point ───────────────────────────────────────────────────────

/**
 * Run the demographics assessment module.
 *
 * Consumes engine input; returns a canonical `DemographicAssessmentResult`.
 * Does not depend on any runner result — it is a pure function of the input.
 */
export function runDemographicsAssessmentModule(
  input: EngineInputV2_3,
): DemographicAssessmentResult {
  const occupancyCount = input.occupancyCount ?? 2;
  const bathroomCount = input.bathroomCount ?? 1;

  // Resolve the active preset to get timing overrides
  const presetId: DemandPresetId | undefined = input.demandPreset;
  const preset = presetId ? findDemandPreset(presetId) : undefined;
  const timingOverrides = presetId
    ? resolveTimingOverrides(presetId, input.demandTimingOverrides)
    : undefined;

  const bathFrequencyPerWeek =
    input.demandTimingOverrides?.bathFrequencyPerWeek ??
    timingOverrides?.bathFrequencyPerWeek ??
    (preset?.defaults.bathFrequencyPerWeek ?? 2);

  const simultaneousUseSeverity =
    input.demandTimingOverrides?.simultaneousUseSeverity ??
    timingOverrides?.simultaneousUseSeverity ??
    preset?.defaults.simultaneousUseSeverity ??
    'low';

  // Derive label
  const demandProfileLabel: string =
    preset?.demandStyleLabel ??
    input.occupancySignature ?? 'Unknown demand profile';

  // Daily hot water volume
  const dailyHotWaterLitres = Math.max(
    30,
    occupancyCount * BASE_LITRES_PER_PERSON +
      (bathFrequencyPerWeek * LITRES_PER_BATH) / 7,
  );

  // Peak simultaneous outlets
  const peakSimultaneousOutlets: number =
    input.peakConcurrentOutlets ??
    ((): number => {
      if (bathroomCount >= 2 && simultaneousUseSeverity === 'high') return 3;
      if (bathroomCount >= 2 || simultaneousUseSeverity === 'high') return 2;
      return 1;
    })();

  // Bath intensity
  const bathUseIntensity = deriveBathUseIntensity(bathFrequencyPerWeek);

  // Timing profile
  const occupancyTimingProfile = deriveOccupancyTimingProfile(input);

  // Storage benefit signal
  const storageBenefitSignal = computeStorageBenefitSignal(
    occupancyCount,
    bathUseIntensity,
    occupancyTimingProfile,
    bathroomCount,
    peakSimultaneousOutlets,
  );

  // Narrative flags
  const demographicNarrativeSignals = buildNarrativeSignals(
    occupancyCount,
    bathUseIntensity,
    occupancyTimingProfile,
    peakSimultaneousOutlets,
    storageBenefitSignal,
    bathroomCount,
  );

  return {
    demandProfileLabel,
    dailyHotWaterLitres,
    peakSimultaneousOutlets,
    bathUseIntensity,
    occupancyTimingProfile,
    storageBenefitSignal,
    demographicNarrativeSignals,
  };
}
