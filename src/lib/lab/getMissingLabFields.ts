/**
 * getMissingLabFields.ts
 *
 * Identifies which simulation-critical fields are absent from a partial engine
 * input.  Used by the Lab Quick Inputs gate to decide which chip selectors to
 * display before opening the System Lab.
 *
 * Rules:
 *   - Only check fields that are (a) actually needed by the lab, (b) not
 *     already known from prior steps, and (c) cheap for the user to answer.
 *   - Technical fallback fields (heatLossWatts, buildingMass, etc.) are NOT
 *     surfaced here — they use safe defaults in mergeLabQuickInputs.
 */

import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';

// ── Field identifiers ─────────────────────────────────────────────────────────

export type LabQuickFieldId =
  | 'systemType'
  | 'bathroomCount'
  | 'occupancyCount'
  | 'mainsPerformance'
  | 'primaryPipeSize'
  | 'planType';

export interface LabQuickField {
  /** Stable identifier for this quick-input field. */
  id: LabQuickFieldId;
  /** Human-readable label shown in the UI. */
  label: string;
}

// ── Field definitions ─────────────────────────────────────────────────────────

const ALL_QUICK_FIELDS: Record<LabQuickFieldId, LabQuickField> = {
  systemType:      { id: 'systemType',      label: 'System type' },
  bathroomCount:   { id: 'bathroomCount',   label: 'Bathrooms' },
  occupancyCount:  { id: 'occupancyCount',  label: 'Occupancy' },
  mainsPerformance:{ id: 'mainsPerformance',label: 'Mains performance' },
  primaryPipeSize: { id: 'primaryPipeSize', label: 'Primary pipe' },
  planType:        { id: 'planType',        label: 'Heating layout' },
};

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Returns the list of quick-input fields that are not yet present in
 * `input`.  An empty array means the lab can open without asking for
 * anything extra.
 *
 * @param input  Partial engine input from Fast Choice or an empty object for
 *               the direct home → Lab path.
 */
export function getMissingLabFields(
  input: Partial<EngineInputV2_3>,
): LabQuickField[] {
  const missing: LabQuickField[] = [];

  // System type — needed for scenario context and Combi DHW gate.
  if (!input.currentHeatSourceType) {
    missing.push(ALL_QUICK_FIELDS.systemType);
  }

  // Bathrooms — required for Combi DHW / Stored DHW scoring.
  if (!input.bathroomCount || input.bathroomCount < 1) {
    missing.push(ALL_QUICK_FIELDS.bathroomCount);
  }

  // Occupancy count — needed for demand simulation and DHW sizing.
  if (!input.occupancyCount || input.occupancyCount < 1) {
    missing.push(ALL_QUICK_FIELDS.occupancyCount);
  }

  // Mains performance — needed for ASHP hydraulics and unvented eligibility.
  // Consider it present when either dynamicMainsPressure > 0 or mainsDynamicFlowLpm is set.
  const hasMainsData =
    (input.dynamicMainsPressure != null && input.dynamicMainsPressure > 0) ||
    (input.mainsDynamicFlowLpm != null && input.mainsDynamicFlowLpm > 0);
  if (!hasMainsData) {
    missing.push(ALL_QUICK_FIELDS.mainsPerformance);
  }

  // Primary pipe size — needed for ASHP hydraulics scoring.
  if (!input.primaryPipeDiameter || input.primaryPipeDiameter < 1) {
    missing.push(ALL_QUICK_FIELDS.primaryPipeSize);
  }

  // System plan type — used by CondensingRuntimeModule.  Optional but
  // surfaced here so the user can confirm rather than leave it ambiguous.
  if (!input.systemPlanType) {
    missing.push(ALL_QUICK_FIELDS.planType);
  }

  return missing;
}
