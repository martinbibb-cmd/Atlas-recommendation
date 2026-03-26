/**
 * buildDhwContextFromSurvey.ts
 *
 * Top-level DHW architecture router.
 *
 * This is the single safe entry point for turning a FullSurveyModelV1 into a
 * DHW context.  It detects the DHW architecture and routes to the correct
 * dedicated context builder:
 *
 *   on_demand    → no stored DHW context (combi / on-demand)
 *   standard_cylinder → buildStoredHotWaterContextFromSurvey (vented / unvented / HP)
 *   mixergy      → buildStoredHotWaterContextFromSurvey (Mixergy stratified cylinder)
 *   thermal_store → buildThermalStoreContextFromSurvey  ← dedicated builder
 *
 * CRITICAL INVARIANT:
 *   thermal_store must never be routed to buildStoredHotWaterContextFromSurvey.
 *   That function is for potable stored hot water cylinder architectures only.
 *
 * Consumers should call this function instead of calling the individual builders
 * directly, unless they have already resolved the architecture and are certain
 * of the correct path.
 */

import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import {
  buildStoredHotWaterContextFromSurvey,
  type StoredHotWaterContext,
} from './buildStoredHotWaterContextFromSurvey';
import {
  buildThermalStoreContextFromSurvey,
  type ThermalStoreContext,
} from './buildThermalStoreContextFromSurvey';

// ─── Top-level architecture discriminator ─────────────────────────────────────

/**
 * Top-level DHW architecture classification.
 *
 *   on_demand       — combi boiler or other on-demand DHW (no stored hot water)
 *   standard_cylinder — stored hot water via vented, unvented, or HP cylinder
 *   mixergy         — stored hot water via Mixergy stratified cylinder
 *   thermal_store   — stored heat (not stored hot water); DHW via heat exchanger
 */
export type DhwArchitecture =
  | 'on_demand'
  | 'standard_cylinder'
  | 'mixergy'
  | 'thermal_store';

// ─── Output union ─────────────────────────────────────────────────────────────

/**
 * Top-level DHW context union.
 *
 * Discriminated by `architecture`.  Consumers should switch on `architecture`
 * before accessing architecture-specific fields.
 */
export type DhwContext =
  | { architecture: 'on_demand' }
  | (StoredHotWaterContext & { architecture: 'standard_cylinder' })
  | (StoredHotWaterContext & { architecture: 'mixergy' })
  | ThermalStoreContext;

// ─── Architecture detection ────────────────────────────────────────────────────

/**
 * Detect the top-level DHW architecture from a FullSurveyModelV1.
 *
 * Resolution order (first match wins):
 *   1. dhwStorageType === 'thermal_store'  → 'thermal_store'
 *   2. dhwStorageType === 'mixergy' OR fullSurvey.dhwCondition.currentCylinderType === 'mixergy'
 *      → 'mixergy'
 *   3. currentCylinderPresent === false OR dhwStorageType === 'none' OR
 *      currentHeatSourceType === 'combi'  → 'on_demand'
 *   4. Any other stored cylinder signal  → 'standard_cylinder'
 */
export function detectDhwArchitecture(survey: FullSurveyModelV1): DhwArchitecture {
  // 1. Thermal store — must be checked first before any cylinder branching
  if (survey.dhwStorageType === 'thermal_store') {
    return 'thermal_store';
  }

  // 2. Mixergy — stratified cylinder, distinct from standard cylinder
  if (
    survey.dhwStorageType === 'mixergy' ||
    survey.fullSurvey?.dhwCondition?.currentCylinderType === 'mixergy'
  ) {
    return 'mixergy';
  }

  // 3. On-demand (combi / no stored DHW)
  if (
    survey.currentCylinderPresent === false ||
    survey.dhwStorageType === 'none' ||
    survey.currentHeatSourceType === 'combi'
  ) {
    return 'on_demand';
  }

  // 4. Standard cylinder (vented, unvented, heat_pump_cylinder, or inferred)
  return 'standard_cylinder';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the correct DHW context for a FullSurveyModelV1, routing to the
 * appropriate architecture-specific builder.
 *
 * This is the safe top-level entry point.  It guarantees that:
 *   - thermal_store surveys NEVER reach buildStoredHotWaterContextFromSurvey
 *   - standard cylinder and Mixergy surveys use the potable-cylinder builder
 *   - on_demand surveys return a minimal context with no cylinder data
 *
 * @param survey  Completed (or partial) FullSurveyModelV1.
 * @returns       Architecture-discriminated DhwContext.
 */
export function buildDhwContextFromSurvey(survey: FullSurveyModelV1): DhwContext {
  const architecture = detectDhwArchitecture(survey);

  switch (architecture) {
    case 'thermal_store':
      // Dedicated thermal store path — never enters stored-cylinder code
      return buildThermalStoreContextFromSurvey(survey);

    case 'mixergy': {
      const ctx = buildStoredHotWaterContextFromSurvey(survey);
      return { ...ctx, architecture: 'mixergy' };
    }

    case 'on_demand':
      return { architecture: 'on_demand' };

    case 'standard_cylinder': {
      const ctx = buildStoredHotWaterContextFromSurvey(survey);
      return { ...ctx, architecture: 'standard_cylinder' };
    }
  }
}
