import { lookupSedbukV1, type SedbukLookupInput } from './SedbukModule';
import {
  runBoilerSizingModuleV1,
  classifySizingBand,
  type BoilerSizingResultV1,
} from './BoilerSizingModule';
import { DEFAULT_NOMINAL_EFFICIENCY_PCT } from '../utils/efficiency';

export type BoilerType = 'combi' | 'system' | 'regular' | 'back_boiler' | 'unknown';
export type OversizeBand = 'well_matched' | 'mild_oversize' | 'oversized' | 'aggressive';

/**
 * Final-resort efficiency fallback when no GC number, no ErP label, and no band
 * estimate are available.  Aligns with the industry-standard 92% nominal used
 * throughout the engine rather than a lower arbitrary value.
 */
const UNKNOWN_SEASONAL_ETA = DEFAULT_NOMINAL_EFFICIENCY_PCT / 100;
const MIN_ETA = 0.55;
const MAX_ETA = 0.95;
const POINT_LOW_LOAD_PENALTY = 0.02;

export interface BoilerEfficiencyModelInputV1 {
  gcNumber?: string;
  ageYears?: number;
  type?: BoilerType;
  condensing?: 'yes' | 'no' | 'unknown';
  nominalOutputKw?: number;
  peakHeatLossKw?: number | null;
  demandHeatKw96?: number[];
  /**
   * Surveyor-entered or ErP-derived SEDBUK % (percentage points, e.g. 84).
   * Used as the baseline seasonal efficiency when the SEDBUK database lookup
   * does not return a result (no GC number match). Takes precedence over the
   * generic `UNKNOWN_SEASONAL_ETA` fallback so that ErP class selections
   * actually drive the engine model.
   */
  inputSedbukPct?: number;
}

/**
 * Boiler ages above this threshold are treated as unrealistic survey-data errors.
 * A boiler cannot be 100+ years old; treat the age as unknown and suppress age decay.
 */
export const MAX_PLAUSIBLE_BOILER_AGE = 100;

export interface BoilerEfficiencyModelV1 {
  sedbuk: {
    seasonalEta?: number;
    source: 'gc' | 'band' | 'unknown';
    bandKey?: string;
    notes: string[];
  };
  age: { factor: number; notes: string[] };
  oversize?: {
    ratio?: number;
    band?: OversizeBand;
    penalty: number;
    notes: string[];
  };
  baselineSeasonalEta?: number;
  ageAdjustedEta?: number;
  inHomeAdjustedEta?: number;
  etaSeries96?: number[];
  disclaimerNotes: string[];
  /**
   * True when the supplied ageYears is above MAX_PLAUSIBLE_BOILER_AGE.
   * Age decay is NOT applied when true — the value is treated as unknown.
   */
  ageIsUnrealistic?: boolean;
}

/** Piecewise age multiplier shared by timeline + context outputs. */
export function ageFactor(ageYears?: number): number {
  const age = ageYears ?? 0;
  if (age <= 5) return 1.00;
  if (age <= 10) return 0.97;
  if (age <= 15) return 0.94;
  if (age <= 20) return 0.91;
  return 0.88;
}

export function oversizePenalty(band?: OversizeBand): number {
  if (!band || band === 'well_matched') return 0;
  if (band === 'mild_oversize') return 0.03;
  if (band === 'oversized') return 0.06;
  return 0.09;
}

function sedbukSource(input: SedbukLookupInput): BoilerEfficiencyModelV1['sedbuk'] {
  const result = lookupSedbukV1(input);
  const source: BoilerEfficiencyModelV1['sedbuk']['source'] =
    result.source === 'gc_lookup' ? 'gc' : result.source === 'band_fallback' ? 'band' : 'unknown';

  return {
    source,
    seasonalEta: result.seasonalEfficiency ?? undefined,
    notes: result.notes,
  };
}

function toSizedModel(
  nominalOutputKw: number | undefined,
  type: BoilerType | undefined,
  peakHeatLossKw: number | null | undefined,
): BoilerSizingResultV1 {
  return runBoilerSizingModuleV1(nominalOutputKw, type, peakHeatLossKw ?? null);
}

function clampEta(v: number): number {
  return Math.round(Math.max(MIN_ETA, Math.min(MAX_ETA, v)) * 1000) / 1000;
}

function shapeEtaSeries(
  demandHeatKw96: number[],
  baseEta: number,
  nominalOutputKw: number,
): number[] {
  const thresholdKw = nominalOutputKw * 0.2;
  return demandHeatKw96.map((d) => {
    const pointPenalty = d > 0 && d < thresholdKw ? POINT_LOW_LOAD_PENALTY : 0;
    return clampEta(baseEta - pointPenalty);
  });
}

export function buildBoilerEfficiencyModelV1(
  input: BoilerEfficiencyModelInputV1,
): BoilerEfficiencyModelV1 {
  const boilerType = input.type ?? 'unknown';
  const sedbuk = sedbukSource({
    gcNumber: input.gcNumber,
    ageYears: input.ageYears,
    condensing: input.condensing,
  });

  // Baseline priority:
  //   1. SEDBUK GC database match (highest confidence — actual boiler record)
  //   2. Surveyor/ErP-derived inputSedbukPct (specific to this boiler's label)
  //   3. SEDBUK band fallback (general estimate from condensing status + age)
  //   4. Generic unknown fallback (no boiler data whatsoever)
  //
  // inputSedbukPct takes priority over the band fallback because an ErP class label
  // (or a directly-entered SEDBUK %) is more specific than a broad age/condensing
  // band estimate. The GC lookup always wins as it names the exact appliance.
  const baselineSeasonalEta =
    sedbuk.source === 'gc' && sedbuk.seasonalEta != null
      ? sedbuk.seasonalEta
      : input.inputSedbukPct != null
        ? input.inputSedbukPct / 100
        : (sedbuk.seasonalEta ?? UNKNOWN_SEASONAL_ETA);

  // Age validation: ages above MAX_PLAUSIBLE_BOILER_AGE are survey-data errors.
  // Negative ages (bad import) and zero ages (ambiguous — could be a default/unset value)
  // are also treated as unknown to avoid propagating junk into efficiency calculations.
  const ageIsUnrealistic =
    input.ageYears !== undefined &&
    (input.ageYears < 0 || input.ageYears > MAX_PLAUSIBLE_BOILER_AGE);
  const effectiveAge = ageIsUnrealistic ? undefined : input.ageYears;

  const age = {
    factor: ageFactor(effectiveAge),
    notes: ageIsUnrealistic
      ? [
          `Boiler age input (${input.ageYears} years) is unrealistic — treated as unknown. Age decay not applied. Check survey data.`,
        ]
      : [
          `Age degradation factor applied from boiler age (${input.ageYears ?? 'unknown'} years).`,
        ],
  };

  const ageAdjustedEta = clampEta(baselineSeasonalEta * age.factor);

  let oversize: BoilerEfficiencyModelV1['oversize'];
  let inHomeAdjustedEta = ageAdjustedEta;

  if (boilerType === 'combi') {
    const sizing = toSizedModel(input.nominalOutputKw, boilerType, input.peakHeatLossKw);
    const band = classifySizingBand(sizing.oversizeRatio);
    const penalty = oversizePenalty(band);
    oversize = {
      ratio: sizing.oversizeRatio ?? undefined,
      band,
      penalty,
      notes: sizing.oversizeRatio == null
        ? ['Peak heat loss unknown — oversize penalty not applied.']
        : [`Oversize ratio ${sizing.oversizeRatio.toFixed(2)}x (${band}).`],
    };
    inHomeAdjustedEta = clampEta(ageAdjustedEta * (1 - penalty));
  }

  const etaSeries96 = input.demandHeatKw96 && input.demandHeatKw96.length > 0
    ? shapeEtaSeries(input.demandHeatKw96, inHomeAdjustedEta, input.nominalOutputKw ?? 24)
    : undefined;

  const baselineSource =
    sedbuk.source === 'gc'
      ? 'SEDBUK database (GC number match)'
      : input.inputSedbukPct != null
        ? 'ErP / SEDBUK % entered by surveyor'
        : sedbuk.source === 'band'
          ? 'SEDBUK band estimate (condensing + age)'
          : 'industry fallback (no boiler data)';

  return {
    sedbuk,
    age,
    ...(oversize ? { oversize } : {}),
    baselineSeasonalEta,
    ageAdjustedEta,
    inHomeAdjustedEta,
    ...(etaSeries96 ? { etaSeries96 } : {}),
    ...(ageIsUnrealistic ? { ageIsUnrealistic: true } : {}),
    disclaimerNotes: [
      'Modelled estimate (not measured).',
      `Baseline efficiency source: ${baselineSource}.`,
      'In-home efficiency is inferred from SEDBUK baseline, age and sizing assumptions.',
    ],
  };
}
