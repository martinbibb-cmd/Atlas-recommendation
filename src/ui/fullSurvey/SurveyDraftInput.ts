/**
 * SurveyDraftInput.ts — Strict split between raw survey capture and
 * engine-normalized state.
 *
 * Design rules:
 *   1. SurveyDraftInput holds exactly what the user typed / selected.
 *   2. Fields the user has not touched are `undefined` — never phantom-defaulted.
 *   3. Each field carries provenance metadata: 'user' | 'inferred' | 'defaulted'.
 *   4. Normalization into EngineInputV2_3 happens in a single explicit
 *      transform (`normalizeDraftToEngineInput`), not scattered across
 *      useEffect callbacks.
 *   5. Form controls must never show 'inferred' or 'defaulted' values in
 *      editable inputs — only in summary / trust-strip areas.
 */

// ─── Provenance ───────────────────────────────────────────────────────────────

/** How a field value was obtained. */
export type FieldSource = 'user' | 'inferred' | 'defaulted';

/**
 * A field value with provenance metadata.
 *
 * `value`  — the raw value (may be undefined if not yet entered)
 * `source` — how the value was obtained
 */
export interface ProvenanceField<T> {
  value: T | undefined;
  source: FieldSource;
}

/** Helper to create a user-entered provenance field. */
export function userField<T>(value: T): ProvenanceField<T> {
  return { value, source: 'user' };
}

/** Helper to create a defaulted provenance field. */
export function defaultedField<T>(value: T): ProvenanceField<T> {
  return { value, source: 'defaulted' };
}

/** Helper to create an inferred provenance field. */
export function inferredField<T>(value: T): ProvenanceField<T> {
  return { value, source: 'inferred' };
}

/** Helper to create an empty (not yet entered) provenance field. */
export function emptyField<T>(): ProvenanceField<T> {
  return { value: undefined, source: 'defaulted' };
}

// ─── Survey Draft Input ───────────────────────────────────────────────────────

/**
 * SurveyDraftInput — the raw survey state as the user entered it.
 *
 * All physics-sensitive fields are ProvenanceField<T> so that the UI can
 * distinguish "user typed 1.0 bar" from "we assumed 1.0 bar because you
 * skipped this question".
 *
 * Fields identified as phantom-default risks:
 *   - dynamicMainsPressure (was: 1.0 bar default)
 *   - heatLossWatts (was: 8000 W default)
 *   - bathroomCount (was: 2 default)
 *   - occupancySignature (was: 'professional' default)
 *   - buildingMass (was: 'heavy' default)
 *   - primaryPipeDiameter (was: 22 mm default)
 *   - radiatorCount (was: 10 default)
 *   - returnWaterTemp (was: 45 °C default)
 */
export interface SurveyDraftInput {
  /** Postcode — user-entered, may be empty string if not yet provided. */
  postcode: ProvenanceField<string>;

  // ── Hydraulic / mains supply ────────────────────────────────────────────────
  /** Dynamic mains pressure (bar) — a critical phantom default risk field. */
  dynamicMainsPressure: ProvenanceField<number>;
  /** Static mains pressure (bar) — optional measured value. */
  staticMainsPressureBar: ProvenanceField<number>;
  /** Dynamic mains pressure (bar) — preferred alias. */
  dynamicMainsPressureBar: ProvenanceField<number>;
  /** Mains dynamic flow rate (L/min) — optional measured value. */
  mainsDynamicFlowLpm: ProvenanceField<number>;

  // ── Building fabric ─────────────────────────────────────────────────────────
  /** Building mass / thermal inertia. */
  buildingMass: ProvenanceField<string>;
  /** Primary pipe diameter (mm). */
  primaryPipeDiameter: ProvenanceField<number>;
  /** Heat loss estimate (W). */
  heatLossWatts: ProvenanceField<number>;
  /** Number of radiators. */
  radiatorCount: ProvenanceField<number>;
  /** Return water temperature (°C). */
  returnWaterTemp: ProvenanceField<number>;

  // ── Demographics ────────────────────────────────────────────────────────────
  /** Number of bathrooms — a phantom default risk field. */
  bathroomCount: ProvenanceField<number>;
  /** Daytime occupancy pattern. */
  occupancySignature: ProvenanceField<string>;
  /** Whether high occupancy applies. */
  highOccupancy: ProvenanceField<boolean>;

  // ── Preferences / flags ─────────────────────────────────────────────────────
  hasLoftConversion: ProvenanceField<boolean>;
  preferCombi: ProvenanceField<boolean>;
  hasMagneticFilter: ProvenanceField<boolean>;
  installationPolicy: ProvenanceField<string>;
  dhwTankType: ProvenanceField<string>;
  installerNetwork: ProvenanceField<string>;
}

// ─── Initial empty draft ──────────────────────────────────────────────────────

/**
 * The initial draft state — all physics-sensitive fields are empty (undefined)
 * so the UI never displays phantom defaults in editable inputs.
 *
 * Non-physics preference fields are set to conservative defaults with 'defaulted'
 * provenance since they have minimal impact on recommendations.
 */
export const INITIAL_SURVEY_DRAFT: SurveyDraftInput = {
  postcode:               emptyField(),

  // Hydraulic — all empty until measured
  dynamicMainsPressure:   emptyField(),
  staticMainsPressureBar: emptyField(),
  dynamicMainsPressureBar: emptyField(),
  mainsDynamicFlowLpm:    emptyField(),

  // Building — all empty until assessed
  buildingMass:           emptyField(),
  primaryPipeDiameter:    emptyField(),
  heatLossWatts:          emptyField(),
  radiatorCount:          emptyField(),
  returnWaterTemp:        emptyField(),

  // Demographics — empty until user enters
  bathroomCount:          emptyField(),
  occupancySignature:     emptyField(),
  highOccupancy:          emptyField(),

  // Preferences — conservative defaults are acceptable
  hasLoftConversion:      defaultedField(false),
  preferCombi:            defaultedField(false),
  hasMagneticFilter:      defaultedField(false),
  installationPolicy:     defaultedField('full_job'),
  dhwTankType:            defaultedField('standard'),
  installerNetwork:       defaultedField('british_gas'),
};

// ─── Normalization ────────────────────────────────────────────────────────────

import type { FullSurveyModelV1 } from './FullSurveyModelV1';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';

/**
 * Engine-safe defaults applied during normalization when the user has not
 * entered a value.  These are the same values that were previously hardcoded
 * in `defaultInput` — but now they are explicitly tagged as 'defaulted'.
 */
const ENGINE_SAFE_DEFAULTS: Record<string, unknown> = {
  dynamicMainsPressure:  1.0,
  buildingMass:          'heavy',
  primaryPipeDiameter:   22,
  heatLossWatts:         8000,
  radiatorCount:         10,
  returnWaterTemp:       45,
  bathroomCount:         2,
  occupancySignature:    'professional',
  highOccupancy:         false,
};

/**
 * Normalize a SurveyDraftInput into a FullSurveyModelV1 suitable for the
 * engine.  Applies engine-safe defaults only for fields the user has not entered.
 *
 * This is the single point where phantom defaults are introduced — and they
 * are always tagged with 'defaulted' provenance.
 */
export function normalizeDraftToEngineInput(draft: SurveyDraftInput): FullSurveyModelV1 {
  function resolve<T>(field: ProvenanceField<T>, key: string): T {
    if (field.value !== undefined) return field.value;
    const fallback = ENGINE_SAFE_DEFAULTS[key];
    if (fallback !== undefined) return fallback as T;
    // No value and no engine-safe default — return undefined.  This is
    // expected for optional fields (e.g. staticMainsPressureBar); required
    // fields must have an entry in ENGINE_SAFE_DEFAULTS.
    return undefined as T;
  }

  return {
    postcode:               resolve(draft.postcode, 'postcode') ?? '',
    dynamicMainsPressure:   resolve(draft.dynamicMainsPressure, 'dynamicMainsPressure'),
    buildingMass:           resolve(draft.buildingMass, 'buildingMass') as EngineInputV2_3['buildingMass'],
    primaryPipeDiameter:    resolve(draft.primaryPipeDiameter, 'primaryPipeDiameter'),
    heatLossWatts:          resolve(draft.heatLossWatts, 'heatLossWatts'),
    radiatorCount:          resolve(draft.radiatorCount, 'radiatorCount'),
    hasLoftConversion:      resolve(draft.hasLoftConversion, 'hasLoftConversion'),
    returnWaterTemp:        resolve(draft.returnWaterTemp, 'returnWaterTemp'),
    bathroomCount:          resolve(draft.bathroomCount, 'bathroomCount'),
    occupancySignature:     resolve(draft.occupancySignature, 'occupancySignature') as EngineInputV2_3['occupancySignature'],
    highOccupancy:          resolve(draft.highOccupancy, 'highOccupancy'),
    preferCombi:            resolve(draft.preferCombi, 'preferCombi'),
    hasMagneticFilter:      resolve(draft.hasMagneticFilter, 'hasMagneticFilter'),
    installationPolicy:     resolve(draft.installationPolicy, 'installationPolicy') as EngineInputV2_3['installationPolicy'],
    dhwTankType:            resolve(draft.dhwTankType, 'dhwTankType') as EngineInputV2_3['dhwTankType'],
    installerNetwork:       resolve(draft.installerNetwork, 'installerNetwork') as EngineInputV2_3['installerNetwork'],
    // Optional measured fields — only present if user entered them
    ...(draft.staticMainsPressureBar.value !== undefined && {
      staticMainsPressureBar: draft.staticMainsPressureBar.value,
    }),
    ...(draft.dynamicMainsPressureBar.value !== undefined && {
      dynamicMainsPressureBar: draft.dynamicMainsPressureBar.value,
    }),
    ...(draft.mainsDynamicFlowLpm.value !== undefined && {
      mainsDynamicFlowLpm: draft.mainsDynamicFlowLpm.value,
    }),
    fullSurvey: {
      manualEvidence: {},
      telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
    },
  };
}

// ─── Provenance summary ───────────────────────────────────────────────────────

export interface DraftProvenanceSummary {
  /** Fields the user explicitly entered. */
  userEntered: string[];
  /** Fields inferred from other data. */
  inferred: string[];
  /** Fields using engine-safe defaults (phantom defaults). */
  defaulted: string[];
  /** Fields with no value at all. */
  empty: string[];
}

/**
 * Summarize the provenance of all fields in a draft — useful for trust strips,
 * summary panels, and debugging.
 */
export function summarizeDraftProvenance(draft: SurveyDraftInput): DraftProvenanceSummary {
  const result: DraftProvenanceSummary = {
    userEntered: [],
    inferred: [],
    defaulted: [],
    empty: [],
  };

  for (const [key, field] of Object.entries(draft)) {
    const pf = field as ProvenanceField<unknown>;
    if (pf.value === undefined) {
      result.empty.push(key);
    } else if (pf.source === 'user') {
      result.userEntered.push(key);
    } else if (pf.source === 'inferred') {
      result.inferred.push(key);
    } else {
      result.defaulted.push(key);
    }
  }

  return result;
}
