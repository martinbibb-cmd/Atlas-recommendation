import { lookupSedbukV1, type SedbukLookupInput } from './SedbukModule';
import {
  runBoilerSizingModuleV1,
  classifySizingBand,
  type BoilerSizingResultV1,
} from './BoilerSizingModule';

export type BoilerType = 'combi' | 'system' | 'regular' | 'back_boiler' | 'unknown';
export type OversizeBand = 'well_matched' | 'mild_oversize' | 'oversized' | 'aggressive';

const UNKNOWN_SEASONAL_ETA = 0.84;
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
}

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

  const baselineSeasonalEta = sedbuk.seasonalEta ?? UNKNOWN_SEASONAL_ETA;
  const age = {
    factor: ageFactor(input.ageYears),
    notes: [
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

  return {
    sedbuk,
    age,
    ...(oversize ? { oversize } : {}),
    baselineSeasonalEta,
    ageAdjustedEta,
    inHomeAdjustedEta,
    ...(etaSeries96 ? { etaSeries96 } : {}),
    disclaimerNotes: [
      'Modelled estimate (not measured).',
      'In-home efficiency is inferred from SEDBUK baseline, age and sizing assumptions.',
    ],
  };
}
