/**
 * buildQuoteScopeFromInstallationPlan.ts
 *
 * Generates structured scope items from a `QuoteInstallationPlanV1`.
 *
 * Design rules:
 *   - Pure function, deterministic: same input always produces same output.
 *   - Does not add pricing or customer-facing copy.
 *   - Does not alter recommendation logic or customer/safety flows.
 *   - Scope item confidence is the lowest confidence of its source
 *     locations/routes.
 *   - Assumed routes produce `needsVerification: true`.
 *   - Assumed routes are never presented as confirmed.
 *   - No duplicate scope items are emitted.
 */

import type { QuoteInstallationPlanV1, QuotePlanLocationV1, QuotePlanPipeworkRouteV1 } from '../model/QuoteInstallationPlanV1';
import type { QuotePlannerLocationConfidence, PipeworkRouteKind } from '../model/QuoteInstallationPlanV1';

// ─── Scope item types ─────────────────────────────────────────────────────────

/**
 * The broad category a scope item belongs to.
 *
 * existing_removal — isolate, disconnect, and remove existing equipment.
 * new_installation — supply and fit new equipment.
 * routes           — pipe, flue, gas, or other service routes.
 * alterations      — rework, cap, make-good, or alter existing installations.
 * commissioning    — commission, test, and hand over.
 */
export type QuoteScopeItemCategory =
  | 'existing_removal'
  | 'new_installation'
  | 'routes'
  | 'alterations'
  | 'commissioning';

/**
 * Engineer-facing confidence in a scope item.
 *
 * confirmed         — derived from confirmed or measured source data.
 * estimated         — derived from drawn or estimated source data.
 * low               — derived from low-confidence or unscaled source data.
 * needs_verification — derived from a source flagged as needing verification.
 */
export type QuoteScopeItemConfidence =
  | 'confirmed'
  | 'estimated'
  | 'low'
  | 'needs_verification';

/**
 * A single structured scope item generated from the installation plan.
 *
 * Design rules:
 *   - This is structured scope for the engineer/pricing layer, not customer copy.
 *   - `needsVerification` is set when any source route or location is assumed.
 *   - `sourceStepId` links back to the planner step where the source data was
 *     entered, so the engineer can navigate directly to it for correction.
 */
export interface QuoteScopeItemV1 {
  /** Stable identifier within this scope list (e.g. "scope-0"). */
  itemId: string;
  /** The broad category this item belongs to. */
  category: QuoteScopeItemCategory;
  /** Short engineer-facing label for this scope item. */
  label: string;
  /**
   * Optional detail string derived from route data.
   * Examples: "~4.5 m run", "2 wall penetrations".
   * Absent when no quantitative data is available.
   */
  details?: string;
  /** Lowest confidence of all source locations and routes for this item. */
  confidence: QuoteScopeItemConfidence;
  /**
   * Whether this item needs on-site verification.
   *
   * True when any source route has status 'assumed' or any source location
   * has confidence 'needs_verification'.
   */
  needsVerification: boolean;
  /**
   * The planner step ID from which the source data originates.
   * Used to generate an "Edit source" link in the UI.
   *
   * Matches the `StepId` values in QuotePlannerStepper.
   */
  sourceStepId?:
    | 'place_locations'
    | 'flue_plan'
    | 'condensate_plan'
    | 'pipework_plan';
}

// ─── Confidence helpers ───────────────────────────────────────────────────────

const CONFIDENCE_RANK: Record<QuoteScopeItemConfidence, number> = {
  confirmed:          3,
  estimated:          2,
  low:                1,
  needs_verification: 0,
};

function lowestConfidence(
  ...confidences: QuoteScopeItemConfidence[]
): QuoteScopeItemConfidence {
  if (confidences.length === 0) return 'needs_verification';
  return confidences.reduce((lowest, c) =>
    CONFIDENCE_RANK[c] < CONFIDENCE_RANK[lowest] ? c : lowest,
  );
}

function locationConfidenceToScope(
  c: QuotePlannerLocationConfidence,
): QuoteScopeItemConfidence {
  switch (c) {
    case 'high':               return 'confirmed';
    case 'medium':             return 'estimated';
    case 'low':                return 'low';
    case 'needs_verification': return 'needs_verification';
  }
}

// ─── Pipework route helpers ───────────────────────────────────────────────────

function findPipeworkRoutes(
  plan: QuoteInstallationPlanV1,
  kind: PipeworkRouteKind,
): QuotePlanPipeworkRouteV1[] {
  return plan.pipeworkRoutes.filter((r) => r.routeKind === kind);
}

function pipeworkRoutesConfidence(
  routes: QuotePlanPipeworkRouteV1[],
): QuoteScopeItemConfidence {
  if (routes.length === 0) return 'needs_verification';
  const confidences = routes.map<QuoteScopeItemConfidence>((r) => {
    switch (r.calculation.lengthConfidence) {
      case 'measured_on_plan': return 'confirmed';
      case 'manual':           return 'estimated';
      case 'estimated':        return 'estimated';
      case 'needs_scale':      return 'low';
    }
  });
  return lowestConfidence(...confidences);
}

function pipeworkRoutesNeedVerification(routes: QuotePlanPipeworkRouteV1[]): boolean {
  return routes.some((r) => r.status === 'assumed');
}

/**
 * Build a human-readable length detail string from a set of pipework routes.
 * Returns undefined when no measured length is available.
 */
function routeLengthDetail(routes: QuotePlanPipeworkRouteV1[]): string | undefined {
  const lengths = routes
    .map((r) => r.calculation.lengthM)
    .filter((l): l is number => l !== null);
  if (lengths.length === 0) return undefined;
  const totalM = lengths.reduce((sum, l) => sum + l, 0);
  return `~${totalM.toFixed(1)} m`;
}

// ─── Location helpers ─────────────────────────────────────────────────────────

function findActiveLocation(
  plan: QuoteInstallationPlanV1,
  kind: QuotePlanLocationV1['kind'],
): QuotePlanLocationV1 | undefined {
  return plan.locations.find((l) => l.kind === kind && !l.rejected);
}

function locationConfidence(
  location: QuotePlanLocationV1 | undefined,
): QuoteScopeItemConfidence {
  if (!location) return 'needs_verification';
  return locationConfidenceToScope(location.confidence);
}

function locationNeedsVerification(location: QuotePlanLocationV1 | undefined): boolean {
  if (!location) return true;
  return location.confidence === 'needs_verification';
}

// ─── Item builder ─────────────────────────────────────────────────────────────

/**
 * Create a counter closure that generates sequential IDs scoped to one
 * buildQuoteScopeFromInstallationPlan call.  This keeps the function pure
 * (no module-level mutable state) while maintaining deterministic IDs.
 */
function makeIdCounter() {
  let next = 0;
  return () => `scope-${next++}`;
}

function makeItem(
  nextId: () => string,
  category: QuoteScopeItemCategory,
  label: string,
  confidence: QuoteScopeItemConfidence,
  needsVerification: boolean,
  options?: {
    details?: string;
    sourceStepId?: QuoteScopeItemV1['sourceStepId'];
  },
): QuoteScopeItemV1 {
  return {
    itemId:           nextId(),
    category,
    label,
    confidence,
    needsVerification,
    details:          options?.details,
    sourceStepId:     options?.sourceStepId,
  };
}

// ─── Route scope helpers ──────────────────────────────────────────────────────

/**
 * Build a scope item for a specific pipework route kind.
 * Falls back to 'needs_verification' confidence when no drawn route exists.
 */
function makePipeworkRouteItem(
  nextId: () => string,
  plan: QuoteInstallationPlanV1,
  kind: PipeworkRouteKind,
  label: string,
  baseConfidence?: QuoteScopeItemConfidence,
): QuoteScopeItemV1 {
  const routes = findPipeworkRoutes(plan, kind);
  const routeConf = routes.length > 0
    ? pipeworkRoutesConfidence(routes)
    : (baseConfidence ?? 'needs_verification');
  const needsVerif = pipeworkRoutesNeedVerification(routes);
  const details = routeLengthDetail(routes);
  return makeItem(nextId, 'routes', label, routeConf, needsVerif, {
    details,
    sourceStepId: 'pipework_plan',
  });
}

/**
 * Build flue route scope item from the first active flue route.
 */
function makeFlueItem(
  nextId: () => string,
  plan: QuoteInstallationPlanV1,
  label: string,
): QuoteScopeItemV1 {
  const flue = plan.flueRoutes[0];
  const conf: QuoteScopeItemConfidence = flue
    ? flue.confidence === 'measured'
      ? 'confirmed'
      : flue.confidence === 'drawn'
        ? 'estimated'
        : 'low'
    : 'needs_verification';
  const needsVerif = !flue;
  const details = flue?.calculation
    ? `~${flue.calculation.physicalLengthM.toFixed(1)} m`
    : undefined;
  return makeItem(nextId, 'routes', label, conf, needsVerif, {
    details,
    sourceStepId: 'flue_plan',
  });
}

// ─── Per-job-type scope builders ──────────────────────────────────────────────

function buildLikeForLikeScope(
  nextId: () => string,
  plan: QuoteInstallationPlanV1,
): QuoteScopeItemV1[] {
  const items: QuoteScopeItemV1[] = [];
  const existingBoiler = findActiveLocation(plan, 'existing_boiler');
  const proposedBoiler = findActiveLocation(plan, 'proposed_boiler');

  // 1. Isolate and remove existing boiler.
  items.push(makeItem(
    nextId,
    'existing_removal',
    'Isolate and remove existing boiler',
    locationConfidence(existingBoiler),
    locationNeedsVerification(existingBoiler),
    { sourceStepId: 'place_locations' },
  ));

  // 2. Fit new boiler at same location.
  items.push(makeItem(
    nextId,
    'new_installation',
    'Fit new boiler at existing location',
    locationConfidence(proposedBoiler ?? existingBoiler),
    locationNeedsVerification(proposedBoiler ?? existingBoiler),
    { sourceStepId: 'place_locations' },
  ));

  // 3. Flue route / terminal.
  items.push(makeFlueItem(nextId, plan, 'Flue route — reuse or replace terminal'));

  // 4. Condensate route.
  items.push(makePipeworkRouteItem(nextId, plan, 'condensate', 'Condensate route'));

  // 5. Gas supply route — always include (verification item when not drawn).
  items.push(makePipeworkRouteItem(
    nextId,
    plan,
    'gas',
    'Gas supply route — confirm or verify existing',
    'estimated',
  ));

  // 6. Commission and handover.
  items.push(makeItem(nextId, 'commissioning', 'Commission, test, and hand over', 'confirmed', false));

  return items;
}

function buildRelocationScope(
  nextId: () => string,
  plan: QuoteInstallationPlanV1,
): QuoteScopeItemV1[] {
  const items: QuoteScopeItemV1[] = [];
  const existingBoiler = findActiveLocation(plan, 'existing_boiler');
  const proposedBoiler = findActiveLocation(plan, 'proposed_boiler');
  const existingTerminal = findActiveLocation(plan, 'flue_terminal');

  // 1. Remove existing boiler.
  items.push(makeItem(
    nextId,
    'existing_removal',
    'Remove existing boiler',
    locationConfidence(existingBoiler),
    locationNeedsVerification(existingBoiler),
    { sourceStepId: 'place_locations' },
  ));

  // 2. Cap/rework redundant pipework at old location.
  items.push(makeItem(
    nextId,
    'alterations',
    'Cap or rework redundant pipework at old boiler location',
    locationConfidence(existingBoiler),
    locationNeedsVerification(existingBoiler),
    { sourceStepId: 'place_locations' },
  ));

  // 3. Fit new boiler at proposed location.
  items.push(makeItem(
    nextId,
    'new_installation',
    'Fit new boiler at proposed location',
    locationConfidence(proposedBoiler),
    locationNeedsVerification(proposedBoiler),
    { sourceStepId: 'place_locations' },
  ));

  // 4. New/reworked gas supply route.
  items.push(makePipeworkRouteItem(nextId, plan, 'gas', 'New or reworked gas supply route'));

  // 5. New flue route with wall core / opening.
  items.push(makeFlueItem(nextId, plan, 'New flue route — new wall core or roof opening required'));

  // 6. Make good old flue opening if a previous terminal exists.
  if (existingTerminal) {
    items.push(makeItem(
      nextId,
      'alterations',
      'Make good old flue opening at previous terminal position',
      locationConfidence(existingTerminal),
      locationNeedsVerification(existingTerminal),
      { sourceStepId: 'place_locations' },
    ));
  }

  // 7. Condensate route.
  items.push(makePipeworkRouteItem(nextId, plan, 'condensate', 'Condensate route'));

  // 8. Heating flow/return alterations.
  const flowRoutes  = findPipeworkRoutes(plan, 'heating_flow');
  const returnRoutes = findPipeworkRoutes(plan, 'heating_return');
  const allHeatRoutes = [...flowRoutes, ...returnRoutes];
  const heatConf = allHeatRoutes.length > 0
    ? pipeworkRoutesConfidence(allHeatRoutes)
    : 'estimated';
  const heatNeedsVerif = pipeworkRoutesNeedVerification(allHeatRoutes);
  const heatDetails = routeLengthDetail(allHeatRoutes);
  items.push(makeItem(
    nextId,
    'alterations',
    'Heating flow and return alterations to new boiler position',
    heatConf,
    heatNeedsVerif,
    { details: heatDetails, sourceStepId: 'pipework_plan' },
  ));

  return items;
}

function buildConversionScope(
  nextId: () => string,
  plan: QuoteInstallationPlanV1,
): QuoteScopeItemV1[] {
  const items: QuoteScopeItemV1[] = [];
  const existingBoiler = findActiveLocation(plan, 'existing_boiler');
  const existingCylinder = findActiveLocation(plan, 'cylinder');
  const proposedBoiler = findActiveLocation(plan, 'proposed_boiler');

  // 1. Remove existing heat source.
  items.push(makeItem(
    nextId,
    'existing_removal',
    'Remove existing heat source (boiler or back boiler)',
    locationConfidence(existingBoiler),
    locationNeedsVerification(existingBoiler),
    { sourceStepId: 'place_locations' },
  ));

  // 2. Remove/cap redundant cylinder and tank pipework.
  {
    const conf = lowestConfidence(
      locationConfidence(existingCylinder),
      locationConfidence(existingBoiler),
    );
    const needsVerif =
      locationNeedsVerification(existingCylinder) ||
      locationNeedsVerification(existingBoiler);
    items.push(makeItem(
      nextId,
      'existing_removal',
      'Remove or cap redundant cylinder and tank pipework',
      conf,
      needsVerif,
      { sourceStepId: 'place_locations' },
    ));
  }

  // 3. Fit combi at proposed location.
  items.push(makeItem(
    nextId,
    'new_installation',
    'Fit new combi boiler at proposed location',
    locationConfidence(proposedBoiler),
    locationNeedsVerification(proposedBoiler),
    { sourceStepId: 'place_locations' },
  ));

  // 4. New hot and cold water connections.
  {
    const hotRoutes  = findPipeworkRoutes(plan, 'hot_water');
    const coldRoutes = findPipeworkRoutes(plan, 'cold_main');
    const allRoutes  = [...hotRoutes, ...coldRoutes];
    const conf = allRoutes.length > 0 ? pipeworkRoutesConfidence(allRoutes) : 'estimated';
    const needsVerif = pipeworkRoutesNeedVerification(allRoutes);
    const details = routeLengthDetail(allRoutes);
    items.push(makeItem(
      nextId,
      'routes',
      'New hot and cold water connections to combi',
      conf,
      needsVerif,
      { details, sourceStepId: 'pipework_plan' },
    ));
  }

  // 5. Heating flow/return alterations.
  {
    const flowRoutes   = findPipeworkRoutes(plan, 'heating_flow');
    const returnRoutes = findPipeworkRoutes(plan, 'heating_return');
    const allRoutes    = [...flowRoutes, ...returnRoutes];
    const conf = allRoutes.length > 0 ? pipeworkRoutesConfidence(allRoutes) : 'estimated';
    const needsVerif = pipeworkRoutesNeedVerification(allRoutes);
    const details = routeLengthDetail(allRoutes);
    items.push(makeItem(
      nextId,
      'alterations',
      'Heating flow and return alterations',
      conf,
      needsVerif,
      { details, sourceStepId: 'pipework_plan' },
    ));
  }

  // 6. Flue route.
  items.push(makeFlueItem(nextId, plan, 'Flue route — new wall core or roof opening'));

  // 7. Condensate route.
  items.push(makePipeworkRouteItem(nextId, plan, 'condensate', 'Condensate route'));

  // 8. Gas supply route.
  items.push(makePipeworkRouteItem(nextId, plan, 'gas', 'Gas supply route'));

  // 9. Commission and handover.
  items.push(makeItem(nextId, 'commissioning', 'Commission, test, and hand over', 'confirmed', false));

  return items;
}

function buildStoredHotWaterUpgradeScope(
  nextId: () => string,
  plan: QuoteInstallationPlanV1,
): QuoteScopeItemV1[] {
  const items: QuoteScopeItemV1[] = [];
  const proposedBoiler  = findActiveLocation(plan, 'proposed_boiler');
  const cylinderLocation = findActiveLocation(plan, 'cylinder');

  // 1. Fit or retain heat source.
  items.push(makeItem(
    nextId,
    'new_installation',
    'Fit or retain heat source (boiler) at selected location',
    locationConfidence(proposedBoiler),
    locationNeedsVerification(proposedBoiler),
    { sourceStepId: 'place_locations' },
  ));

  // 2. Fit cylinder/store at proposed location.
  items.push(makeItem(
    nextId,
    'new_installation',
    'Fit hot-water cylinder or store at proposed location',
    locationConfidence(cylinderLocation),
    locationNeedsVerification(cylinderLocation),
    { sourceStepId: 'place_locations' },
  ));

  // 3. Hot and cold water connections.
  {
    const hotRoutes  = findPipeworkRoutes(plan, 'hot_water');
    const coldRoutes = findPipeworkRoutes(plan, 'cold_main');
    const allRoutes  = [...hotRoutes, ...coldRoutes];
    const conf = allRoutes.length > 0 ? pipeworkRoutesConfidence(allRoutes) : 'needs_verification';
    const needsVerif = pipeworkRoutesNeedVerification(allRoutes);
    const details = routeLengthDetail(allRoutes);
    items.push(makeItem(
      nextId,
      'routes',
      'Hot and cold water route connections to cylinder',
      conf,
      needsVerif,
      { details, sourceStepId: 'pipework_plan' },
    ));
  }

  // 4. Discharge route — verify termination point.
  {
    const dischargeRoutes = findPipeworkRoutes(plan, 'discharge');
    const conf = dischargeRoutes.length > 0
      ? pipeworkRoutesConfidence(dischargeRoutes)
      : 'needs_verification';
    const needsVerif = dischargeRoutes.length > 0
      ? pipeworkRoutesNeedVerification(dischargeRoutes)
      : true;
    const details = routeLengthDetail(dischargeRoutes);
    items.push(makeItem(
      nextId,
      'routes',
      'Discharge route — verify termination point complies with regulations',
      conf,
      needsVerif,
      { details, sourceStepId: 'pipework_plan' },
    ));
  }

  // 5. Primary flow/return routes.
  {
    const flowRoutes   = findPipeworkRoutes(plan, 'heating_flow');
    const returnRoutes = findPipeworkRoutes(plan, 'heating_return');
    const allRoutes    = [...flowRoutes, ...returnRoutes];
    const conf = allRoutes.length > 0 ? pipeworkRoutesConfidence(allRoutes) : 'needs_verification';
    const needsVerif = pipeworkRoutesNeedVerification(allRoutes);
    const details = routeLengthDetail(allRoutes);
    items.push(makeItem(
      nextId,
      'routes',
      'Primary flow and return routes from boiler to cylinder',
      conf,
      needsVerif,
      { details, sourceStepId: 'pipework_plan' },
    ));
  }

  // 6. Controls wiring route — only if controls routes are drawn.
  {
    const controlsRoutes = findPipeworkRoutes(plan, 'controls');
    if (controlsRoutes.length > 0) {
      const conf = pipeworkRoutesConfidence(controlsRoutes);
      const needsVerif = pipeworkRoutesNeedVerification(controlsRoutes);
      const details = routeLengthDetail(controlsRoutes);
      items.push(makeItem(
        nextId,
        'routes',
        'Controls wiring route',
        conf,
        needsVerif,
        { details, sourceStepId: 'pipework_plan' },
      ));
    }
  }

  return items;
}

function buildHeatPumpPlaceholderScope(
  nextId: () => string,
  plan: QuoteInstallationPlanV1,
): QuoteScopeItemV1[] {
  const items: QuoteScopeItemV1[] = [];

  // Heat-pump scope is a basic placeholder — full module to follow.
  const outdoorUnit = findActiveLocation(plan, 'proposed_boiler'); // closest equivalent for now
  items.push(makeItem(
    nextId,
    'new_installation',
    'Outdoor unit — candidate location to confirm',
    locationConfidence(outdoorUnit),
    locationNeedsVerification(outdoorUnit),
    { sourceStepId: 'place_locations' },
  ));

  {
    const hydraulicRoutes = findPipeworkRoutes(plan, 'heating_flow');
    const conf = hydraulicRoutes.length > 0
      ? pipeworkRoutesConfidence(hydraulicRoutes)
      : 'needs_verification';
    const needsVerif = hydraulicRoutes.length > 0
      ? pipeworkRoutesNeedVerification(hydraulicRoutes)
      : true;
    items.push(makeItem(
      nextId,
      'routes',
      'Hydraulic connection route — outdoor unit to indoor unit',
      conf,
      needsVerif,
      { sourceStepId: 'pipework_plan' },
    ));
  }

  items.push(makeItem(
    nextId,
    'routes',
    'Electrical supply route — outdoor unit',
    'needs_verification',
    true,
    { sourceStepId: 'pipework_plan' },
  ));

  items.push(makeItem(
    nextId,
    'commissioning',
    'Full heat-pump scope — detailed module to follow',
    'needs_verification',
    true,
  ));

  return items;
}

// ─── buildQuoteScopeFromInstallationPlan ──────────────────────────────────────

/**
 * Generate structured scope items from a `QuoteInstallationPlanV1`.
 *
 * Scope generation is deterministic and pure.  The same plan always produces
 * the same scope items in the same order.
 *
 * @param plan - The installation plan to generate scope from.
 * @returns    - An ordered array of `QuoteScopeItemV1` items.
 *               Empty when `jobClassification.jobType === 'needs_review'`.
 */
export function buildQuoteScopeFromInstallationPlan(
  plan: QuoteInstallationPlanV1,
): QuoteScopeItemV1[] {
  // Create a counter scoped to this call — keeps the function pure.
  const nextId = makeIdCounter();

  const { jobType } = plan.jobClassification;

  switch (jobType) {
    case 'like_for_like':
      return buildLikeForLikeScope(nextId, plan);
    case 'relocation':
      return buildRelocationScope(nextId, plan);
    case 'conversion':
      return buildConversionScope(nextId, plan);
    case 'stored_hot_water_upgrade':
      return buildStoredHotWaterUpgradeScope(nextId, plan);
    case 'low_carbon_conversion':
      return buildHeatPumpPlaceholderScope(nextId, plan);
    case 'needs_review':
      return [];
  }
}
