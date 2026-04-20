/**
 * systemBuilderNormalizer.ts
 *
 * Maps the UI-level SystemBuilderState into a canonical structured object
 * suitable for later binding into EngineInputV2_3.
 *
 * This is a first-pass normalizer — the output shape mirrors the target
 * engine contract but is intentionally a plain object (not the full
 * EngineInputV2_3) so it can be inspected in dev output before full wiring.
 *
 * DHW semantics enforcement
 * ─────────────────────────
 * Open-vented cylinders are fed from a cold water storage cistern (loft tank)
 * under gravity.  It is physically impossible to have a mains-fed open-vented
 * cylinder.  Unvented cylinders are fed from the mains at mains pressure.
 *
 * These facts are encoded here (data level) rather than relying on UI
 * constraints alone.  The derived pressureSource and pressureClass fields
 * make the semantics explicit in the normalised output:
 *
 *   open_vented   → pressureSource: 'loft_tank',  pressureClass: 'gravity'
 *   unvented      → pressureSource: 'mains',       pressureClass: 'pressurised'
 *   thermal_store → pressureSource: 'mains',        pressureClass: 'pressurised'
 *   plate_hex     → pressureSource: 'mains',        pressureClass: 'pressurised'
 *   small_store   → pressureSource: 'mains',        pressureClass: 'pressurised'
 */

import type {
  SystemBuilderState,
  PrimaryPipeSize,
  SedbukBand,
  DhwType,
  CylinderAgeBand,
  CylinderInsulationType,
  CylinderCondition,
} from './systemBuilderTypes';
// ─── DHW pressure semantics ────────────────────────────────────────────────────

export type DhwPressureSource =
  | 'loft_tank'    // cold water storage cistern — gravity fed
  | 'mains'        // directly from mains supply — pressurised
  | 'unknown';

export type DhwPressureClass =
  | 'gravity'      // open-vented: low pressure, head-dependent
  | 'pressurised'  // mains-fed or combi: full mains pressure
  | 'unknown';

/**
 * Derive the physical pressure source and pressure class from DHW type.
 *
 * This enforcement is authoritative — no UI input can override these
 * physics constraints.
 */
function deriveDhwPressureSemantics(dhwType: DhwType | null): {
  pressureSource: DhwPressureSource;
  pressureClass: DhwPressureClass;
} {
  switch (dhwType) {
    case 'open_vented':
      // Open-vented cylinder is ALWAYS gravity-fed from a loft cistern.
      // Mains-fed open-vented is a physical impossibility.
      return { pressureSource: 'loft_tank', pressureClass: 'gravity' };
    case 'unvented':
      // Unvented cylinder is ALWAYS mains-fed and pressurised.
      return { pressureSource: 'mains', pressureClass: 'pressurised' };
    case 'thermal_store':
      // A thermal store holds primary water, but DHW delivered to taps is
      // generated on demand from incoming mains cold water via an internal coil
      // or plate heat exchanger — giving mains-pressure hot water at outlets.
      return { pressureSource: 'mains', pressureClass: 'pressurised' };
    case 'plate_hex':
      // Combi plate heat exchanger draws directly from mains on the DHW side.
      return { pressureSource: 'mains', pressureClass: 'pressurised' };
    case 'small_store':
      // Storage combi integral store is mains-fed.
      return { pressureSource: 'mains', pressureClass: 'pressurised' };
    default:
      return { pressureSource: 'unknown', pressureClass: 'unknown' };
  }
}

// ─── Canonical output shape ────────────────────────────────────────────────────

export type NormalisedCurrentSystem = {
  currentSystem: {
    heatSourceType: string | null;
    dhwType: string | null;
    /** Derived DHW pressure source — enforced at data level. */
    dhwPressureSource: DhwPressureSource;
    /** Derived DHW pressure class — enforced at data level. */
    dhwPressureClass: DhwPressureClass;
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
    /**
     * Current cylinder details — only present when a separate cylinder is
     * physically part of the system (regular or system boiler).
     */
    cylinder?: {
      ageBand: CylinderAgeBand | null;
      volumeL: number | null;
      insulationType: CylinderInsulationType | null;
      condition: CylinderCondition | null;
      hasImmersion: boolean | null;
    };
    systemConditionSignals?: {
      bleedWaterColour: 'clear' | 'slightly_discoloured' | 'dark' | 'sludge' | 'unknown' | null;
      radiatorPerformance: 'all_even' | 'some_cold_spots' | 'many_cold' | null;
      circulationIssues: 'none' | 'occasional_noise' | 'frequent_noise_or_poor_flow' | null;
      magneticFilter: 'fitted' | 'not_fitted' | 'unknown' | null;
      cleaningHistory: 'never_cleaned' | 'cleaned_over_5_years_ago' | 'recently_cleaned' | 'unknown' | null;
    };
    /** Only present when heatSourceType === 'regular'. */
    regularSystemDetail?: {
      heatingSystemType: string | null;
      pipeworkAccess: string | null;
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
 *
 * DHW pressure semantics (pressureSource + pressureClass) are ALWAYS derived
 * from dhwType and cannot be overridden by any other survey input.
 */
export function normaliseSystemBuilder(state: SystemBuilderState): NormalisedCurrentSystem {
  const { pressureSource, pressureClass } = deriveDhwPressureSemantics(state.dhwType);

  // A cylinder is present when the heat source is regular or system boiler.
  const hasCylinder = state.heatSource === 'regular' || state.heatSource === 'system';

  return {
    currentSystem: {
      heatSourceType: state.heatSource,
      dhwType: state.dhwType,
      dhwPressureSource: pressureSource,
      dhwPressureClass: pressureClass,
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
      ...(hasCylinder ? {
        cylinder: {
          ageBand: state.cylinderAgeBand,
          volumeL: state.cylinderVolumeL,
          insulationType: state.cylinderInsulationType,
          condition: state.cylinderCondition,
          hasImmersion: state.cylinderHasImmersion,
        },
      } : {}),
      systemConditionSignals: {
        bleedWaterColour: state.bleedWaterColour,
        radiatorPerformance: state.radiatorPerformance,
        circulationIssues: state.circulationIssues,
        magneticFilter: state.magneticFilter,
        cleaningHistory: state.cleaningHistory,
      },
      ...(state.heatSource === 'regular' ? {
        regularSystemDetail: {
          heatingSystemType: state.heatingSystemType,
          pipeworkAccess: state.pipeworkAccess,
        },
      } : {}),
    },
  };
}
