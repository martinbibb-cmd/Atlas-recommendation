/**
 * systemBuilderNormalizer.ts
 *
 * Maps the UI-level SystemBuilderState into a canonical structured object
 * suitable for later binding into EngineInputV2_3.
 *
 * This is a first-pass normalizer — the output shape mirrors the target
 * engine contract but is intentionally a plain object (not the full
 * EngineInputV2_3) so it can be inspected in dev output before full wiring.
 */

import type {
  SystemBuilderState,
  PrimaryPipeSize,
  SedbukBand,
} from './systemBuilderTypes';

// ─── Canonical output shape ────────────────────────────────────────────────────

export type NormalisedCurrentSystem = {
  currentSystem: {
    heatSourceType: string | null;
    dhwType: string | null;
    emitters: string | null;
    pipework: {
      primarySizeMm: number | 'unknown' | null;
      layout: string | null;
    };
    controls: {
      family: string | null;
      thermostatStyle: string | null;
    };
    assetHealth: {
      boilerAgeYears: number | null;
      sedbukBand: string | null;
      serviceHistory: string | null;
    };
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalisePipeSize(size: PrimaryPipeSize | null): number | 'unknown' | null {
  if (size === null) return null;
  if (size === 'unknown') return 'unknown';
  return size;
}

function normaliseSedbuk(band: SedbukBand | null): string | null {
  if (band === null) return null;
  return band;
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

/**
 * Produce a canonical current-system object from raw SystemBuilderState.
 *
 * Null values in the output represent fields that were left blank by the
 * surveyor (not the same as the surveyor selecting 'unknown').
 */
export function normaliseSystemBuilder(state: SystemBuilderState): NormalisedCurrentSystem {
  return {
    currentSystem: {
      heatSourceType: state.heatSource,
      dhwType: state.dhwType,
      emitters: state.emitters,
      pipework: {
        primarySizeMm: normalisePipeSize(state.primarySize),
        layout: state.layout,
      },
      controls: {
        family: state.controlFamily,
        thermostatStyle: state.thermostatStyle,
      },
      assetHealth: {
        boilerAgeYears: state.boilerAgeYears,
        sedbukBand: normaliseSedbuk(state.sedbukBand),
        serviceHistory: state.serviceHistory,
      },
    },
  };
}
