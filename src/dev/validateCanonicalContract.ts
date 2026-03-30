/**
 * validateCanonicalContract.ts
 *
 * DEV-only runtime guard that checks the sanitised survey model conforms to the
 * canonical data contract defined in docs/atlas-canonical-contract.md.
 *
 * Must be called after sanitiseModelForEngine() and only in DEV builds:
 *
 *   if (import.meta.env.DEV) {
 *     validateCanonicalContract(sanitisedModel);
 *   }
 *
 * On contract violation:
 *   - console.error with the field path and reason
 *   - Returns an array of ContractViolation items (empty = valid)
 *
 * This module is intentionally not tree-shaken from DEV builds so that
 * violations surface immediately during development.
 */

import type { FullSurveyModelV1 } from '../ui/fullSurvey/FullSurveyModelV1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContractViolation {
  /** JSON-path-style field reference, e.g. "heatLossWatts". */
  fieldPath: string;
  /** Human-readable description of the violation. */
  reason: string;
  /** Severity of the violation. */
  severity: 'error' | 'warn';
}

// ─── Required field checks ────────────────────────────────────────────────────

/**
 * Fields that must always be present and non-null after sanitisation.
 * These are the minimum required for the engine to produce a meaningful result.
 */
const REQUIRED_FIELDS: Array<{
  path: string;
  get: (m: FullSurveyModelV1) => unknown;
}> = [
  { path: 'postcode',            get: m => m.postcode },
  { path: 'heatLossWatts',       get: m => m.heatLossWatts },
  { path: 'buildingMass',        get: m => m.buildingMass },
  { path: 'primaryPipeDiameter', get: m => m.primaryPipeDiameter },
  { path: 'radiatorCount',       get: m => m.radiatorCount },
  { path: 'returnWaterTemp',     get: m => m.returnWaterTemp },
  { path: 'bathroomCount',       get: m => m.bathroomCount },
  { path: 'occupancySignature',  get: m => m.occupancySignature },
];

/**
 * Fields that should be present when a related source field is populated.
 * These are conditional derived-field checks.
 */
const CONDITIONAL_DERIVED_FIELD_CHECKS: Array<{
  condition: (m: FullSurveyModelV1) => boolean;
  path: string;
  get: (m: FullSurveyModelV1) => unknown;
  reason: string;
}> = [
  {
    condition: m => m.householdComposition != null,
    path: 'occupancyCount',
    get: m => m.occupancyCount,
    reason: 'occupancyCount must be derived when householdComposition is present',
  },
  {
    condition: m => m.householdComposition != null && !m.demandPresetIsManualOverride,
    path: 'demandPreset',
    get: m => m.demandPreset,
    reason: 'demandPreset must be derived when householdComposition is present (unless demandPresetIsManualOverride)',
  },
  {
    condition: m => m.householdComposition != null && !m.demandPresetIsManualOverride,
    path: 'occupancySignature',
    get: m => m.occupancySignature,
    reason: 'occupancySignature must be synced from demandPreset when householdComposition drives demand',
  },
  {
    condition: m => m.fullSurvey?.heatLoss?.estimatedPeakHeatLossW != null,
    path: 'heatLossWatts',
    get: m => m.heatLossWatts,
    reason: 'heatLossWatts must be populated from fullSurvey.heatLoss.estimatedPeakHeatLossW',
  },
];

// ─── Forbidden raw-structure leakage checks ───────────────────────────────────

/**
 * Fields that are survey-layer internal structures and must not be consumed
 * directly by engine modules or presentation without going through the sanitiser
 * bridges.
 *
 * These checks warn (not error) because the nested structures are legitimately
 * present on FullSurveyModelV1 — what is forbidden is bypassing the bridge.
 * The bridge outputs (plateHexFoulingFactor, cylinderInsulationFactor, etc.)
 * are what the engine actually reads.
 */
const RAW_STRUCTURE_WARNINGS: Array<{
  condition: (m: FullSurveyModelV1) => boolean;
  path: string;
  reason: string;
}> = [
  {
    // When combi plate HEX evidence is present and the fouling factor was NOT
    // derived, the bridge in sanitiseModelForEngine may have been skipped.
    condition: m =>
      m.fullSurvey?.dhwCondition?.hotWaterPerformanceBand != null
      && (m.currentHeatSourceType === 'combi' || m.currentHeatSourceType == null)
      && m.plateHexFoulingFactor == null,
    path: 'plateHexFoulingFactor',
    reason:
      'fullSurvey.dhwCondition contains plate HEX evidence but plateHexFoulingFactor was not derived. ' +
      'Check that sanitiseModelForEngine ran the plate HEX condition bridge.',
  },
  {
    // When cylinder evidence is present for a stored system and insulation factor not derived
    condition: m =>
      m.fullSurvey?.dhwCondition?.cylinderRetentionBand != null
      && m.currentHeatSourceType !== 'combi'
      && m.cylinderInsulationFactor == null,
    path: 'cylinderInsulationFactor',
    reason:
      'fullSurvey.dhwCondition contains cylinder evidence but cylinderInsulationFactor was not derived. ' +
      'Check that sanitiseModelForEngine ran the cylinder condition bridge.',
  },
];

// ─── Value range checks ───────────────────────────────────────────────────────

/**
 * Numeric field range guards — catches clamping failures in sanitiser.
 */
const RANGE_CHECKS: Array<{
  path: string;
  get: (m: FullSurveyModelV1) => number | undefined;
  min?: number;
  max?: number;
}> = [
  { path: 'currentBoilerAgeYears', get: m => m.currentBoilerAgeYears, max: 50 },
  { path: 'mainsDynamicFlowLpm',   get: m => m.mainsDynamicFlowLpm,   max: 60 },
  { path: 'staticMainsPressureBar',get: m => m.staticMainsPressureBar, max: 10 },
  { path: 'heatLossWatts',         get: m => m.heatLossWatts,         min: 0   },
];

// ─── Main validator ───────────────────────────────────────────────────────────

/**
 * Validates the sanitised survey model against the canonical data contract.
 *
 * @param model - The output of sanitiseModelForEngine().
 * @returns An array of ContractViolation items. Empty array means no violations.
 *
 * @remarks DEV builds only. In production this function is a no-op.
 */
export function validateCanonicalContract(model: FullSurveyModelV1): ContractViolation[] {
  if (!import.meta.env.DEV) return [];

  const violations: ContractViolation[] = [];

  // 1. Required field presence
  for (const { path, get } of REQUIRED_FIELDS) {
    const value = get(model);
    if (value == null) {
      violations.push({
        fieldPath: path,
        reason: `Required field "${path}" is missing or null after sanitisation.`,
        severity: 'error',
      });
      console.error(
        `[Atlas Contract] Required field missing: "${path}"`,
        '\nSee: docs/atlas-canonical-contract.md §2 (Required fields)',
      );
    }
  }

  // 2. Conditional derived field checks
  for (const { condition, path, get, reason } of CONDITIONAL_DERIVED_FIELD_CHECKS) {
    if (condition(model) && get(model) == null) {
      violations.push({ fieldPath: path, reason, severity: 'error' });
      console.error(
        `[Atlas Contract] Derived field not populated: "${path}"`,
        '\nReason:', reason,
        '\nSee: docs/atlas-canonical-contract.md §4 (Derived Fields)',
      );
    }
  }

  // 3. Raw structure leakage warnings
  for (const { condition, path, reason } of RAW_STRUCTURE_WARNINGS) {
    if (condition(model)) {
      violations.push({ fieldPath: path, reason, severity: 'warn' });
      console.warn(
        `[Atlas Contract] Possible bridge bypass: "${path}"`,
        '\nReason:', reason,
        '\nSee: docs/atlas-canonical-contract.md §5 (Sanitiser as Single Authority)',
      );
    }
  }

  // 4. Value range checks
  for (const { path, get, min, max } of RANGE_CHECKS) {
    const value = get(model);
    if (value == null) continue;
    if (min !== undefined && value < min) {
      violations.push({
        fieldPath: path,
        reason: `"${path}" value ${value} is below minimum ${min}. Sanitiser clamping may have been bypassed.`,
        severity: 'error',
      });
      console.error(`[Atlas Contract] Range violation: "${path}" = ${value} (min: ${min})`);
    }
    if (max !== undefined && value > max) {
      violations.push({
        fieldPath: path,
        reason: `"${path}" value ${value} exceeds maximum ${max}. Sanitiser clamping may have been bypassed.`,
        severity: 'error',
      });
      console.error(`[Atlas Contract] Range violation: "${path}" = ${value} (max: ${max})`);
    }
  }

  // 5. Dynamic pressure must not exceed static when both are present
  const staticP = model.staticMainsPressureBar;
  const dynamicP = model.dynamicMainsPressureBar ?? model.dynamicMainsPressure;
  if (staticP != null && dynamicP != null && dynamicP > staticP) {
    violations.push({
      fieldPath: 'dynamicMainsPressureBar',
      reason: `Dynamic pressure (${dynamicP} bar) exceeds static pressure (${staticP} bar). Sanitiser correction may have been bypassed.`,
      severity: 'error',
    });
    console.error(
      `[Atlas Contract] Pressure inconsistency: dynamic (${dynamicP}) > static (${staticP})`,
    );
  }

  if (violations.length > 0) {
    console.group(`[Atlas Contract] ${violations.length} violation(s) detected`);
    violations.forEach(v =>
      (v.severity === 'error' ? console.error : console.warn)(
        `  [${v.severity.toUpperCase()}] ${v.fieldPath}: ${v.reason}`,
      ),
    );
    console.groupEnd();
  }

  return violations;
}

/**
 * Returns true if the sanitised model passes all contract checks.
 * Convenience wrapper for use in conditional guards.
 */
export function isCanonicalContractValid(model: FullSurveyModelV1): boolean {
  return validateCanonicalContract(model).length === 0;
}
