/**
 * guidedSurveySteps.ts — PR24 guided survey checklist step derivation.
 *
 * A pure, side-effect-free module that derives the eight guided-survey steps
 * from a PropertyPlan and its pre-computed PlanReadinessResult.
 *
 * Design rules
 * ────────────
 * - No rendering, no side-effects, no React imports.
 * - No new data model, no new object types, no new recommendation logic.
 * - Derives all state from existing PlanReadinessResult + plan contents.
 * - No hard blocking — every step carries a status, nothing throws.
 */

import type { PropertyPlan, FloorObjectType, EditorTool } from '../../components/floorplan/propertyPlan.types';
import type { PlanReadinessResult } from './planReadinessValidator';

// ─── Output types ─────────────────────────────────────────────────────────────

/**
 * The visual status of a single guided step.
 *
 *   done          — the required item is present and validated
 *   needs_checking — the item is present but carries a verification signal
 *   missing       — the item is absent and is required for this plan
 *   optional      — the item is absent but is not required (nice-to-have)
 */
export type GuidedStepStatus = 'done' | 'needs_checking' | 'missing' | 'optional';

/**
 * The primary action offered by a guided step.
 *
 *   switchTool   — activate an editor tool (e.g. addRoom, addFloorRoute)
 *   openLibrary  — open the object library pre-focused on a specific type
 *   enterPreview — switch to handoff-preview mode
 */
export type GuidedStepAction =
  | { kind: 'switchTool'; tool: EditorTool }
  | { kind: 'openLibrary'; highlightType: FloorObjectType }
  | { kind: 'enterPreview' };

export interface GuidedStep {
  /** Stable key for programmatic use and test assertions. */
  key: string;
  /** Short surveyor-facing step label. */
  label: string;
  /** One-line description of what to capture. */
  description: string;
  /** Current status derived from plan state. */
  status: GuidedStepStatus;
  /** Label for the primary action button. */
  actionLabel: string;
  /** What happens when the action button is clicked. */
  action: GuidedStepAction;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface GuidedSurveyOptions {
  /**
   * True when the active scenario requires a stored-hot-water cylinder.
   * Controls whether the cylinder step is shown as `missing` or `optional`.
   * Defaults to false.
   */
  needsStoredHotWater?: boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function allFloorObjects(plan: PropertyPlan) {
  return plan.floors.flatMap((f) => f.floorObjects ?? []);
}

function hasRadiators(plan: PropertyPlan, objects: ReturnType<typeof allFloorObjects>): boolean {
  // Radiator floor objects placed via the object library
  if (objects.some((o) => o.type === 'radiator')) return true;
  // Radiator_loop placement nodes placed via the lego palette
  return plan.placementNodes.some((n) => n.type === 'radiator_loop');
}

function hasHotWaterOutlets(objects: ReturnType<typeof allFloorObjects>): boolean {
  return objects.some(
    (o) => o.type === 'sink' || o.type === 'bath' || o.type === 'shower',
  );
}

// ─── Status mapping ───────────────────────────────────────────────────────────

/**
 * Map a PlanChecklistItem's status to a GuidedStepStatus.
 * 'assumed' maps to 'needs_checking' since both warrant on-site verification.
 */
function fromChecklistStatus(
  readiness: PlanReadinessResult,
  key: string,
): GuidedStepStatus {
  const item = readiness.items.find((i) => i.key === key);
  if (!item) return 'optional';
  switch (item.status) {
    case 'complete':       return 'done';
    case 'needs_checking': return 'needs_checking';
    case 'assumed':        return 'needs_checking';
    case 'missing':        return 'missing';
  }
}

// ─── Step definitions ─────────────────────────────────────────────────────────

function stepConfirmRooms(readiness: PlanReadinessResult): GuidedStep {
  const status = fromChecklistStatus(readiness, 'rooms_present');
  return {
    key:         'confirm_rooms',
    label:       'Confirm rooms',
    description: 'Draw or confirm all rooms on the floor plan.',
    status,
    actionLabel: 'Select room',
    action:      { kind: 'switchTool', tool: 'select' },
  };
}

function stepMarkBoiler(readiness: PlanReadinessResult): GuidedStep {
  const status = fromChecklistStatus(readiness, 'heat_source_recorded');
  return {
    key:         'mark_boiler',
    label:       'Mark boiler',
    description: 'Place the boiler or heat source on the plan.',
    status,
    actionLabel: 'Add boiler',
    action:      { kind: 'openLibrary', highlightType: 'boiler' },
  };
}

function stepMarkFlue(readiness: PlanReadinessResult): GuidedStep {
  const status = fromChecklistStatus(readiness, 'flue_recorded');
  return {
    key:         'mark_flue',
    label:       'Mark flue',
    description: 'Record the flue exit point on the external wall.',
    status,
    actionLabel: 'Add flue',
    action:      { kind: 'openLibrary', highlightType: 'flue' },
  };
}

function stepMarkCylinder(
  readiness: PlanReadinessResult,
  needsStoredHotWater: boolean,
): GuidedStep {
  const status: GuidedStepStatus = needsStoredHotWater
    ? fromChecklistStatus(readiness, 'cylinder_recorded')
    : 'optional';
  return {
    key:         'mark_cylinder',
    label:       'Mark cylinder',
    description: 'Place the hot-water storage cylinder on the plan.',
    status,
    actionLabel: 'Add cylinder',
    action:      { kind: 'openLibrary', highlightType: 'cylinder' },
  };
}

function stepMarkRadiators(plan: PropertyPlan, objects: ReturnType<typeof allFloorObjects>): GuidedStep {
  const status: GuidedStepStatus = hasRadiators(plan, objects) ? 'done' : 'missing';
  return {
    key:         'mark_radiators',
    label:       'Mark radiators / emitters',
    description: 'Place radiators or other heat emitters in each room.',
    status,
    actionLabel: 'Add radiator',
    action:      { kind: 'openLibrary', highlightType: 'radiator' },
  };
}

function stepMarkOutlets(objects: ReturnType<typeof allFloorObjects>): GuidedStep {
  const status: GuidedStepStatus = hasHotWaterOutlets(objects) ? 'done' : 'optional';
  return {
    key:         'mark_outlets',
    label:       'Mark key hot-water outlets',
    description: 'Record sinks, baths, and showers to capture demand.',
    status,
    actionLabel: 'Add outlet',
    action:      { kind: 'openLibrary', highlightType: 'sink' },
  };
}

function stepMarkRoutes(readiness: PlanReadinessResult): GuidedStep {
  const status = fromChecklistStatus(readiness, 'key_routes');
  return {
    key:         'mark_routes',
    label:       'Mark pipe / service routes',
    description: 'Draw key pipe runs and service routes across the plan.',
    status,
    actionLabel: 'Draw route',
    action:      { kind: 'switchTool', tool: 'addFloorRoute' },
  };
}

function stepReviewHandoff(readiness: PlanReadinessResult): GuidedStep {
  const overall = readiness.overallStatus;
  const status: GuidedStepStatus =
    overall === 'ready'          ? 'done' :
    overall === 'needs_checking' ? 'needs_checking' :
    'missing';
  return {
    key:         'review_handoff',
    label:       'Review handoff',
    description: 'Preview the plan readiness before passing to the engineer.',
    status,
    actionLabel: 'Preview handoff',
    action:      { kind: 'enterPreview' },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derive the eight guided-survey steps from a PropertyPlan and its
 * pre-computed PlanReadinessResult.
 *
 * This is a pure function — it never mutates its inputs and has no
 * side-effects.  Call it whenever the plan changes to get fresh step state.
 *
 * @param plan      The current PropertyPlan.
 * @param readiness Pre-computed readiness result (from validatePlanReadiness).
 * @param options   Optional configuration (e.g. needsStoredHotWater).
 */
export function deriveGuidedSteps(
  plan: PropertyPlan,
  readiness: PlanReadinessResult,
  options: GuidedSurveyOptions = {},
): GuidedStep[] {
  const { needsStoredHotWater = false } = options;
  // Compute the flat floor-objects list once and share it across steps that
  // need it — avoids redundant iteration over plan.floors.
  const objects = allFloorObjects(plan);

  return [
    stepConfirmRooms(readiness),
    stepMarkBoiler(readiness),
    stepMarkFlue(readiness),
    stepMarkCylinder(readiness, needsStoredHotWater),
    stepMarkRadiators(plan, objects),
    stepMarkOutlets(objects),
    stepMarkRoutes(readiness),
    stepReviewHandoff(readiness),
  ];
}
