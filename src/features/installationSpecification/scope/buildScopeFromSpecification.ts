/**
 * buildScopeFromSpecification.ts
 *
 * Generates structured scope items from the layered `InstallationSpecificationSystemV1`
 * model (`proposedSpec` / `currentSpec`) on a `QuoteInstallationPlanV1`.
 *
 * This is the primary scope-generation path when the layered model is populated.
 * It supersedes the legacy family-based job-type dispatch and ensures:
 *   - Regular boiler does not imply vented cylinder.
 *   - System boiler does not imply unvented cylinder.
 *   - ASHP does not generate flue, gas, or boiler-condensate scope.
 *   - No existing wet heating path does not invent removal work.
 *   - Generated scope reflects the actual selected topology.
 *
 * Design rules:
 *   - Pure function, deterministic: same input always produces same output.
 *   - All scope copy uses surveyor-facing wording only.
 *   - Does not add pricing or customer-facing copy.
 *   - Does not alter recommendation decisions or customer/safety flows.
 *   - Legacy `family` fields are not consumed here — see `buildQuoteScopeFromInstallationPlan`
 *     for the fallback that still uses them.
 */

import type {
  QuoteInstallationPlanV1,
  InstallationSpecificationSystemV1,
  HeatSourceKindV1,
  HotWaterKindV1,
} from '../model/QuoteInstallationPlanV1';
import type {
  QuoteScopeItemV1,
  QuoteScopeItemCategory,
  QuoteScopeItemConfidence,
} from './buildQuoteScopeFromInstallationPlan';

// ─── ID counter ───────────────────────────────────────────────────────────────

function makeIdCounter() {
  let next = 0;
  return () => `scope-${next++}`;
}

// ─── Item builder ─────────────────────────────────────────────────────────────

function makeItem(
  nextId: () => string,
  category: QuoteScopeItemCategory,
  label: string,
  confidence: QuoteScopeItemConfidence,
  needsVerification: boolean,
  details?: string,
  reason?: string,
): QuoteScopeItemV1 {
  return {
    itemId: nextId(),
    category,
    label,
    confidence,
    needsVerification,
    details,
    reason,
  };
}

// ─── Spec-level helpers ───────────────────────────────────────────────────────

/**
 * Returns true when the proposed heat source is a condensing boiler type.
 * Only combi, system, regular, and storage-combi are condensing-boiler paths.
 */
export function isCondensingBoilerHeatSource(heatSource: HeatSourceKindV1): boolean {
  return (
    heatSource === 'combi_boiler' ||
    heatSource === 'system_boiler' ||
    heatSource === 'regular_boiler' ||
    heatSource === 'storage_combi'
  );
}

/**
 * Returns true when the proposed system requires a flue specification.
 * Gas and oil boiler heat sources need a flue route.
 * Heat pumps, direct electric, and `none` do not.
 */
export function requiresFlueSpecification(
  proposedSystem: InstallationSpecificationSystemV1,
): boolean {
  return isCondensingBoilerHeatSource(proposedSystem.heatSource.kind);
}

/**
 * Returns true when the proposed system requires a boiler condensate specification.
 * Only condensing boiler heat sources produce condensate.
 */
export function requiresBoilerCondensateSpecification(
  proposedSystem: InstallationSpecificationSystemV1,
): boolean {
  return isCondensingBoilerHeatSource(proposedSystem.heatSource.kind);
}

/**
 * Returns true when the proposed system requires a gas route.
 * Explicitly checks for gas boiler heat sources only.
 * Oil boilers (if added in future) must NOT be listed here — they do not need
 * a gas supply route.
 */
export function requiresGasRoute(
  proposedSystem: InstallationSpecificationSystemV1,
): boolean {
  const hs = proposedSystem.heatSource.kind;
  return (
    hs === 'combi_boiler' ||
    hs === 'system_boiler' ||
    hs === 'regular_boiler' ||
    hs === 'storage_combi'
  );
}

/**
 * Returns true when the given system has stored hot-water provision.
 *
 * `existing_retained` is included because retaining an existing arrangement
 * implies stored hot water was already present.
 */
export function hasStoredHotWater(system: InstallationSpecificationSystemV1): boolean {
  const hw = system.hotWater.kind;
  return (
    hw === 'vented_cylinder' ||
    hw === 'unvented_cylinder' ||
    hw === 'thermal_store' ||
    hw === 'mixergy_or_stratified' ||
    hw === 'integrated_store' ||
    hw === 'heat_pump_cylinder' ||
    hw === 'existing_retained'
  );
}

/**
 * Returns true when the proposed system requires a cylinder location to be specified.
 *
 * `existing_retained` is excluded — the location is already known.
 * `instantaneous_from_combi` and `none` are excluded — no cylinder required.
 */
export function requiresCylinderLocation(
  proposedSystem: InstallationSpecificationSystemV1,
): boolean {
  const hw = proposedSystem.hotWater.kind;
  return (
    hw === 'vented_cylinder' ||
    hw === 'unvented_cylinder' ||
    hw === 'thermal_store' ||
    hw === 'mixergy_or_stratified' ||
    hw === 'heat_pump_cylinder'
  );
}

/**
 * Returns true when the proposed system requires a discharge route.
 *
 * Unvented cylinders, Mixergy/stratified stores, and heat pump cylinders all
 * require a pressure-relief discharge termination point.
 * Vented cylinders, combi (instantaneous), and `none` do not.
 */
export function requiresDischargeRoute(
  proposedSystem: InstallationSpecificationSystemV1,
): boolean {
  const hw = proposedSystem.hotWater.kind;
  return (
    hw === 'unvented_cylinder' ||
    hw === 'mixergy_or_stratified' ||
    hw === 'heat_pump_cylinder'
  );
}

/**
 * Returns true only when the current selected hot-water arrangement actually
 * includes a cylinder or tank that may need to be removed or capped.
 *
 * Do not infer tank removal from heat source alone:
 *   - `regular_boiler` with `hotWater.kind === 'none'` → false.
 *   - `regular_boiler` with `hotWater.kind === 'vented_cylinder'` → true.
 * If the proposed system retains the existing cylinder, no removal is needed.
 */
export function requiresTankRemovalDecision(
  currentSystem: InstallationSpecificationSystemV1,
  proposedSystem: InstallationSpecificationSystemV1,
): boolean {
  const currentHw = currentSystem.hotWater.kind;
  const currentHasStorage = (
    currentHw === 'vented_cylinder' ||
    currentHw === 'unvented_cylinder' ||
    currentHw === 'thermal_store' ||
    currentHw === 'mixergy_or_stratified' ||
    currentHw === 'integrated_store' ||
    currentHw === 'heat_pump_cylinder'
  );
  if (!currentHasStorage) return false;
  // Retaining the existing cylinder means no removal work.
  if (proposedSystem.hotWater.kind === 'existing_retained') return false;
  return true;
}

// ─── Cylinder type labels ─────────────────────────────────────────────────────

/**
 * Human-readable surveyor label for a cylinder / store type.
 * Never returns "unvented cylinder" for Mixergy — always use the specific label.
 */
function cylinderTypeLabel(hw: HotWaterKindV1): string {
  switch (hw) {
    case 'vented_cylinder':       return 'vented cylinder';
    case 'unvented_cylinder':     return 'unvented cylinder';
    case 'thermal_store':         return 'thermal store';
    case 'mixergy_or_stratified': return 'Mixergy / stratified cylinder';
    case 'integrated_store':      return 'integrated store';
    case 'heat_pump_cylinder':    return 'heat pump cylinder';
    default:                      return 'cylinder';
  }
}

// ─── Gate: ASHP → gas boiler ──────────────────────────────────────────────────

/**
 * Detects the technically exceptional path: replacing a heat pump with a
 * gas boiler.  This requires a surveyor justification note and must not
 * silently produce a normal gas-boiler quote.
 *
 * Explicitly enumerates gas boiler types so that future non-gas condensing
 * appliances (e.g. oil boilers) do not trigger this gate unnecessarily.
 */
function isHeatPumpToGasBoiler(
  currentSystem: InstallationSpecificationSystemV1,
  proposedSystem: InstallationSpecificationSystemV1,
): boolean {
  const proposedHs = proposedSystem.heatSource.kind;
  const proposedIsGasBoiler = (
    proposedHs === 'combi_boiler' ||
    proposedHs === 'system_boiler' ||
    proposedHs === 'regular_boiler' ||
    proposedHs === 'storage_combi'
  );
  return currentSystem.heatSource.kind === 'heat_pump' && proposedIsGasBoiler;
}

// ─── Spec-based scope sections ────────────────────────────────────────────────

/**
 * Builds removal scope items for the current heat source and hot-water
 * arrangement when the property has an existing wet-heating system.
 *
 * Rules:
 *   - Always remove the existing heat source (unless no wet heating).
 *   - Remove/cap cylinder only when `requiresTankRemovalDecision` is true.
 *   - When the current cylinder was unvented (or HP), also cap the discharge pipe.
 */
function buildRemovalScope(
  nextId: () => string,
  currentSystem: InstallationSpecificationSystemV1,
  proposedSystem: InstallationSpecificationSystemV1,
): QuoteScopeItemV1[] {
  const items: QuoteScopeItemV1[] = [];

  // Remove existing heat source.
  items.push(makeItem(
    nextId,
    'existing_removal',
    'Remove existing heat source',
    'estimated',
    false,
    undefined,
    'The existing heat source must be isolated, disconnected, and removed before the new system can be installed.',
  ));

  // Cylinder / tank decisions — driven by hot-water selection, not heat source alone.
  if (requiresTankRemovalDecision(currentSystem, proposedSystem)) {
    const currentHw = currentSystem.hotWater.kind;
    const hwLabel = cylinderTypeLabel(currentHw);
    items.push(makeItem(
      nextId,
      'existing_removal',
      `Remove or cap existing ${hwLabel}`,
      'estimated',
      false,
      undefined,
      `The proposed system uses a different hot-water arrangement, so the existing ${hwLabel} must be removed or capped off.`,
    ));

    // Unvented and heat pump cylinders have a discharge pipe that must also be capped.
    if (
      currentHw === 'unvented_cylinder' ||
      currentHw === 'mixergy_or_stratified' ||
      currentHw === 'heat_pump_cylinder'
    ) {
      items.push(makeItem(
        nextId,
        'existing_removal',
        'Cap off existing discharge pipe at cylinder removal',
        'estimated',
        false,
        undefined,
        'The existing cylinder has a pressure-relief discharge pipe that must be safely capped when the cylinder is removed.',
      ));
    }
  }

  return items;
}

/**
 * Builds the cylinder / hot-water install scope for the proposed system.
 * Only called when a new cylinder is being installed (not `existing_retained`
 * and not `instantaneous_from_combi` / `none`).
 */
function buildCylinderInstallScope(
  nextId: () => string,
  proposedSystem: InstallationSpecificationSystemV1,
): QuoteScopeItemV1[] {
  const items: QuoteScopeItemV1[] = [];
  const hw = proposedSystem.hotWater.kind;
  const hwLabel = cylinderTypeLabel(hw);

  // Install the cylinder / store.
  items.push(makeItem(
    nextId,
    'new_installation',
    `Fit new ${hwLabel}`,
    'estimated',
    false,
    undefined,
    `The proposed system requires a ${hwLabel} to provide stored hot water.`,
  ));

  // Location must be specified.
  if (requiresCylinderLocation(proposedSystem)) {
    items.push(makeItem(
      nextId,
      'new_installation',
      'Specify cylinder location',
      'needs_verification',
      true,
      undefined,
      'A suitable location for the cylinder must be confirmed on site before installation can proceed.',
    ));
  }

  // Hot and cold water connections to the cylinder.
  items.push(makeItem(
    nextId,
    'routes',
    'Hot and cold water connections to cylinder',
    'needs_verification',
    true,
    undefined,
    'The cylinder requires hot and cold water pipework connections; routes need on-site confirmation.',
  ));

  // Discharge route — only for unvented / Mixergy / heat pump cylinders.
  if (requiresDischargeRoute(proposedSystem)) {
    items.push(makeItem(
      nextId,
      'routes',
      'Add discharge route',
      'needs_verification',
      true,
      undefined,
      'An unvented or pressure-managed stored hot-water installation requires a safe pressure-relief discharge route to an appropriate termination point.',
    ));
  }

  return items;
}

/**
 * Builds the primary-circuit conversion scope when the primary circuit type
 * is changing from open-vented to sealed, or when a technical review is needed.
 */
function buildPrimaryCircuitScope(
  nextId: () => string,
  currentSystem: InstallationSpecificationSystemV1,
  proposedSystem: InstallationSpecificationSystemV1,
): QuoteScopeItemV1[] {
  const items: QuoteScopeItemV1[] = [];
  const currentPrimary = currentSystem.primaryCircuit?.kind;
  const proposedPrimary = proposedSystem.primaryCircuit?.kind;

  if (proposedPrimary === 'needs_technical_review' || currentPrimary === 'needs_technical_review') {
    items.push(makeItem(
      nextId,
      'alterations',
      'Primary circuit decision required',
      'needs_verification',
      true,
      undefined,
      'The primary circuit type is uncertain and needs a technical decision before installation can proceed.',
    ));
    items.push(makeItem(
      nextId,
      'alterations',
      'Surveyor note required',
      'needs_verification',
      true,
      undefined,
      'A surveyor note is required to document the primary circuit decision and any remedial work needed.',
    ));
    return items;
  }

  if (
    currentPrimary === 'open_vented_primary' &&
    proposedPrimary === 'sealed_primary'
  ) {
    items.push(makeItem(
      nextId,
      'alterations',
      'Primary circuit rework — convert open-vented to sealed system',
      'estimated',
      false,
      undefined,
      'The current system uses an open-vented primary circuit. The proposed system requires a sealed circuit, so the feed and expansion tank must be removed and the system converted.',
    ));
  }

  return items;
}

/**
 * Builds the boiler-specific routes scope (flue, condensate, gas).
 * Only called for gas/oil boiler proposed systems.
 */
function buildBoilerRoutesScope(
  nextId: () => string,
  proposedSystem: InstallationSpecificationSystemV1,
): QuoteScopeItemV1[] {
  const items: QuoteScopeItemV1[] = [];

  if (requiresFlueSpecification(proposedSystem)) {
    items.push(makeItem(
      nextId,
      'routes',
      'Flue route required',
      'needs_verification',
      true,
      undefined,
      'A condensing boiler requires a compliant flue route to safely discharge combustion gases. The route must be specified and verified on site.',
    ));
  }

  if (requiresBoilerCondensateSpecification(proposedSystem)) {
    items.push(makeItem(
      nextId,
      'routes',
      'Condensate route required',
      'needs_verification',
      true,
      undefined,
      'A condensing boiler produces acidic condensate that must be safely discharged. A suitable route to an internal or external drain must be confirmed on site.',
    ));
  }

  if (requiresGasRoute(proposedSystem)) {
    items.push(makeItem(
      nextId,
      'routes',
      'Gas route required',
      'needs_verification',
      true,
      undefined,
      'The proposed gas boiler requires a gas supply route to be confirmed. Any new or extended gas pipework must be pressure-tested and certified.',
    ));
  }

  return items;
}

/**
 * Builds scope for a heat pump proposed system.
 * No flue, condensate, or gas items are generated.
 */
function buildHeatPumpProposedScope(
  nextId: () => string,
  proposedSystem: InstallationSpecificationSystemV1,
): QuoteScopeItemV1[] {
  const items: QuoteScopeItemV1[] = [];

  // Outdoor unit siting.
  items.push(makeItem(
    nextId,
    'new_installation',
    'Outdoor unit — location to confirm',
    'needs_verification',
    true,
    undefined,
    'The heat pump outdoor unit requires a suitable external location with adequate clearances, airflow, and access. The site must be assessed on visit.',
  ));

  // Cylinder / hot water (heat pump cylinder or existing retained).
  const hw = proposedSystem.hotWater.kind;
  if (hw !== 'existing_retained') {
    items.push(...buildCylinderInstallScope(nextId, proposedSystem));
  }

  // Hydraulic connection.
  items.push(makeItem(
    nextId,
    'routes',
    'Hydraulic connection route',
    'needs_verification',
    true,
    undefined,
    'A hydraulic connection route is required between the heat pump and the heating system. The route must be assessed and planned on site.',
  ));

  // Electrical supply.
  items.push(makeItem(
    nextId,
    'routes',
    'Electrical supply route',
    'needs_verification',
    true,
    undefined,
    'The heat pump requires a dedicated electrical supply. The supply route and circuit capacity must be confirmed with an electrician.',
  ));

  return items;
}

// ─── buildScopeFromSpecification ─────────────────────────────────────────────

/**
 * Generate structured scope items from the layered `InstallationSpecificationSystemV1`
 * selections on a `QuoteInstallationPlanV1`.
 *
 * Called by `buildQuoteScopeFromInstallationPlan` when `plan.proposedSpec` is
 * present.  Returns an empty array when `proposedSpec` is absent (callers must
 * guard before calling this function).
 *
 * @param plan - The installation plan with populated `proposedSpec`.
 * @returns    An ordered array of `QuoteScopeItemV1` items.
 */
export function buildScopeFromSpecification(
  plan: QuoteInstallationPlanV1,
): QuoteScopeItemV1[] {
  const { proposedSpec, currentSpec } = plan;

  // Guard: should not be called without a proposedSpec.
  if (!proposedSpec) return [];

  const nextId = makeIdCounter();
  const items: QuoteScopeItemV1[] = [];

  // ── Gate: heat pump → gas boiler requires technical review ──────────────────
  if (currentSpec && isHeatPumpToGasBoiler(currentSpec, proposedSpec)) {
    items.push(makeItem(
      nextId,
      'alterations',
      'Technical review required — heat pump to gas boiler conversion',
      'needs_verification',
      true,
      undefined,
      'Replacing a heat pump with a gas boiler is an exceptional installation path that requires a documented technical justification and surveyor sign-off.',
    ));
    items.push(makeItem(
      nextId,
      'alterations',
      'Surveyor note required',
      'needs_verification',
      true,
      undefined,
      'A surveyor note is required to document the reasons for this conversion and confirm any enabling works needed.',
    ));
    return items;
  }

  // ── Determine existing wet-heating context ───────────────────────────────────
  const hasExistingWetHeating = currentSpec?.hasExistingWetHeating ?? 'yes';

  // ── Partial / abandoned system ───────────────────────────────────────────────
  if (hasExistingWetHeating === 'partial') {
    items.push(makeItem(
      nextId,
      'alterations',
      'Surveyor note required — assess abandoned components for retention or removal',
      'needs_verification',
      true,
      undefined,
      'The survey indicates a partially abandoned heating system. Abandoned components must be assessed to determine whether they can be retained, capped, or removed.',
    ));
  }

  // ── Removal scope (only when an existing system is present) ─────────────────
  if (hasExistingWetHeating !== 'no' && currentSpec) {
    items.push(...buildRemovalScope(nextId, currentSpec, proposedSpec));
  }

  // ── Proposed heat pump ───────────────────────────────────────────────────────
  if (proposedSpec.heatSource.kind === 'heat_pump') {
    items.push(...buildHeatPumpProposedScope(nextId, proposedSpec));
    items.push(makeItem(
      nextId,
      'commissioning',
      'Commission, test, and hand over',
      'confirmed',
      false,
      undefined,
      'Commissioning ensures the heat pump system operates correctly, meets manufacturer requirements, and is handed over to the customer.',
    ));
    return items;
  }

  // ── Proposed gas / oil boiler ────────────────────────────────────────────────

  // Fit new boiler.
  const proposedHeatSource = proposedSpec.heatSource.kind;
  const boilerLabel = proposedHeatSource === 'combi_boiler'   ? 'combi boiler'
                    : proposedHeatSource === 'system_boiler'  ? 'system boiler'
                    : proposedHeatSource === 'regular_boiler' ? 'regular boiler'
                    : proposedHeatSource === 'storage_combi'  ? 'storage combi'
                    : 'boiler';

  items.push(makeItem(
    nextId,
    'new_installation',
    `Fit new ${boilerLabel}`,
    'estimated',
    false,
    undefined,
    `The recommended solution requires a new ${boilerLabel} to be supplied and installed.`,
  ));

  // Cylinder scope — driven entirely by hot-water selection, not heat source.
  const proposedHw = proposedSpec.hotWater.kind;

  if (
    proposedHw !== 'instantaneous_from_combi' &&
    proposedHw !== 'none' &&
    proposedHw !== 'existing_retained' &&
    proposedHw !== 'other'
  ) {
    // New cylinder is being installed.
    items.push(...buildCylinderInstallScope(nextId, proposedSpec));
  }
  // `existing_retained`: no cylinder install, cylinder in-place note not needed unless unvented to confirm.
  // `instantaneous_from_combi` / `none`: no cylinder.

  // Primary circuit.
  if (currentSpec) {
    items.push(...buildPrimaryCircuitScope(nextId, currentSpec, proposedSpec));
  }

  // Boiler service routes (flue, condensate, gas).
  items.push(...buildBoilerRoutesScope(nextId, proposedSpec));

  // Commission and handover.
  items.push(makeItem(
    nextId,
    'commissioning',
    'Commission, test, and hand over',
    'confirmed',
    false,
    undefined,
    'Commissioning ensures the new boiler system operates correctly, complies with Gas Safe requirements, and is handed over to the customer.',
  ));

  return items;
}
