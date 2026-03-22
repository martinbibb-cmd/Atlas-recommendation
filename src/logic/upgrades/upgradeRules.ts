/**
 * upgradeRules.ts
 *
 * Individual upgrade-rule functions for the PR 4 Recommended Upgrades Engine.
 *
 * Each exported function receives the full RecommendUpgradesInputs and returns
 * either a RecommendedUpgrade or null (when the rule does not fire).
 *
 * Rules are intentionally named and single-purpose so they are easy to test
 * and extend independently.
 *
 * Design rule: all functions are deterministic — same inputs → same output.
 */

import type { HouseholdComposition } from '../../engine/schema/EngineInputV2_3';
import type { RecommendUpgradesInputs, RecommendedUpgrade } from './types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Total hot-water shortfall events (reduced + conflict). */
function hwShortfallCount(inputs: RecommendUpgradesInputs): number {
  return inputs.outcomes.hotWater.reduced + inputs.outcomes.hotWater.conflict;
}

/** Total heating shortfall events (reduced + conflict). */
function heatingShortfallCount(inputs: RecommendUpgradesInputs): number {
  return inputs.outcomes.heating.reduced + inputs.outcomes.heating.conflict;
}

/** Derive total occupancy from household composition (minimum 1). */
function occupancyFromComposition(c: HouseholdComposition): number {
  return Math.max(
    1,
    c.adultCount +
      c.youngAdultCount18to25AtHome +
      c.childCount0to4 +
      c.childCount5to10 +
      c.childCount11to17,
  );
}

/** Return a cylinder size in litres appropriate for the household and system. */
function deriveCylinderSizeLitres(inputs: RecommendUpgradesInputs): number {
  const { systemSpec, householdComposition, bathUse } = inputs;

  // Derive occupancy count — default to 2 (smallest common household: couple/pair)
  // when no composition data is available, to avoid over-sizing recommendations.
  let occupancy = 2;
  if (householdComposition) {
    occupancy = occupancyFromComposition(householdComposition);
  }

  // Base size from occupancy
  let baseLitres: number;
  if (occupancy <= 2) {
    baseLitres = 150;
  } else if (occupancy <= 4) {
    baseLitres = 180;
  } else {
    baseLitres = 210;
  }

  // Bath-use uplift
  if (bathUse === 'frequent') {
    baseLitres += 30;
  }

  // System-type adjustments
  if (systemSpec.systemType === 'heat_pump') {
    // Heat pump needs larger reserve to offset slower recovery
    baseLitres = Math.max(baseLitres + 30, 210);
  } else if (
    systemSpec.systemType === 'stored_water' &&
    (systemSpec as { cylinderType?: string }).cylinderType === 'mixergy'
  ) {
    // Mixergy can work with a slightly smaller cylinder (stratified store)
    baseLitres = Math.max(baseLitres - 30, 120);
  }

  return baseLitres;
}

// ─── Rule 1: Combi size ───────────────────────────────────────────────────────

/**
 * Recommend a larger combi output when hot-water shortfall events are high
 * and mains pressure is not the bottleneck.
 *
 * If mains pressure is the real limiting factor we surface an explanatory note
 * instead of silently recommending a bigger boiler.
 */
export function ruleCombiSize(
  inputs: RecommendUpgradesInputs,
): RecommendedUpgrade | null {
  if (inputs.systemSpec.systemType !== 'combi') return null;

  const shortfall = hwShortfallCount(inputs);
  if (shortfall === 0) return null;

  // Mains pressure bottleneck check.
  // Below ~0.3 bar dynamic pressure the combi cannot sustain adequate DHW flow
  // regardless of heat output — upsizing the boiler alone will not help.
  const pressure =
    inputs.mainsDynamicPressureBar ?? inputs.systemSpec.mainsDynamicPressureBar;
  const pressureIsBottleneck = pressure !== undefined && pressure < 0.3;

  if (pressureIsBottleneck) {
    // Bigger combi alone is not the fix — return an explanatory note upgrade
    return {
      kind: 'combi_size',
      category: 'water',
      label: 'Mains pressure improvement required before upsizing combi',
      reason:
        'Hot-water shortfall events are present but mains dynamic pressure is low. ' +
        'Upsizing the combi boiler alone will not resolve the issue; mains pressure must be addressed first.',
      effectTags: ['reduces_conflict', 'reduces_reduced_events'],
      priority: 'recommended',
    };
  }

  // Determine target output.
  // Standard residential combis top out at ~30–32 kW for DHW; the next common
  // band is 35 kW, which meaningfully increases sustained flow rate.
  // If the current output is already ≥ 32 kW, keep it (no further upsizing needed).
  const currentOutputKw = inputs.systemSpec.heatOutputKw ?? 24;
  const targetKw = currentOutputKw < 32 ? 35 : currentOutputKw;

  return {
    kind: 'combi_size',
    category: 'water',
    label: `${targetKw} kW combi boiler`,
    reason:
      'Clustered hot-water demand is producing reduced-flow or conflict events. ' +
      'A larger combi output would reduce these events under peak demand.',
    effectTags: ['reduces_conflict', 'reduces_reduced_events'],
    priority: shortfall >= 3 ? 'essential' : 'recommended',
    value: targetKw,
  };
}

// ─── Rule 2: Cylinder size ────────────────────────────────────────────────────

/**
 * Recommend an appropriately-sized cylinder for stored-water and heat-pump paths.
 * Not applicable to combi systems.
 */
export function ruleCylinderSize(
  inputs: RecommendUpgradesInputs,
): RecommendedUpgrade | null {
  const { systemType } = inputs.systemSpec;
  if (systemType === 'combi') return null;

  const shortfall = hwShortfallCount(inputs);
  // Recommend if there are shortfall events OR as a best-fit sizing suggestion
  const sizeLitres = deriveCylinderSizeLitres(inputs);

  const isMixergy =
    (inputs.systemSpec as { cylinderType?: string }).cylinderType === 'mixergy';

  const label = isMixergy
    ? `${sizeLitres} L Mixergy cylinder`
    : systemType === 'heat_pump'
      ? `${sizeLitres} L heat-pump cylinder`
      : `${sizeLitres} L hot-water cylinder`;

  const reason =
    shortfall > 0
      ? `Clustered demand is producing hot-water shortfall events. ` +
        `A ${sizeLitres} L cylinder would improve stored volume and recovery headroom.`
      : `Household profile suggests a ${sizeLitres} L cylinder as the best-fit stored volume.`;

  return {
    kind: 'cylinder_size',
    category: 'water',
    label,
    reason,
    effectTags: ['improves_hot_water_recovery', 'improves_bath_fill'],
    priority: shortfall >= 2 ? 'essential' : 'recommended',
    value: sizeLitres,
  };
}

// ─── Rule 3: System clean / power flush ──────────────────────────────────────

/**
 * Recommend a system clean / power flush when the system is in poor condition
 * or heating shortfall events suggest poor responsiveness.
 */
export function ruleSystemClean(
  inputs: RecommendUpgradesInputs,
): RecommendedUpgrade | null {
  const condition = inputs.systemCondition ?? inputs.systemSpec.systemCondition;
  const heatingShortfall = heatingShortfallCount(inputs);

  const conditionIsPoor = condition === 'poor' || condition === 'average';
  const heatingIsUnresponsive = heatingShortfall >= 2;

  if (!conditionIsPoor && !heatingIsUnresponsive) return null;

  const isPoor = condition === 'poor';

  return {
    kind: 'system_clean',
    category: 'protection',
    label: 'System clean / power flush',
    reason: isPoor
      ? 'System is in poor condition. A power flush will remove sludge and scale ' +
        'that is restricting circulation and reducing system responsiveness.'
      : 'System condition and heating performance suggest accumulated sludge or scale. ' +
        'A system clean would improve circulation and heating stability.',
    effectTags: ['improves_heating_stability', 'reduces_reduced_events'],
    priority: isPoor ? 'essential' : 'recommended',
  };
}

// ─── Rule 4: Magnetic filter ──────────────────────────────────────────────────

/**
 * Recommend a magnetic filter on most wet-heating upgrade paths.
 * Priority escalates to 'essential' when system condition is poor.
 */
export function ruleMagneticFilter(
  inputs: RecommendUpgradesInputs,
): RecommendedUpgrade | null {
  const condition = inputs.systemCondition ?? inputs.systemSpec.systemCondition;
  const isPoor = condition === 'poor';

  return {
    kind: 'magnetic_filter',
    category: 'protection',
    label: 'Magnetic system filter',
    reason:
      'A magnetic filter traps metallic debris before it can accumulate in the ' +
      'boiler heat exchanger or cylinder coil, protecting long-term system performance.',
    effectTags: ['protects_system'],
    priority: isPoor ? 'essential' : 'recommended',
  };
}

// ─── Rule 5: Controls upgrade ─────────────────────────────────────────────────

/**
 * Recommend modern time and temperature controls when controls are basic
 * and heating shortfall events indicate the system is not being managed well.
 */
export function ruleControlsUpgrade(
  inputs: RecommendUpgradesInputs,
): RecommendedUpgrade | null {
  const quality = inputs.controlsQuality ?? inputs.systemSpec.controlsQuality;
  if (quality !== 'basic') return null;

  const heatingShortfall = heatingShortfallCount(inputs);
  if (heatingShortfall === 0 && inputs.outcomes.heating.outsideTargetEventCount === 0) {
    return null;
  }

  return {
    kind: 'controls_upgrade',
    category: 'controls',
    label: 'Modern time and temperature controls',
    reason:
      "Basic controls are limiting the system’s ability to respond to demand patterns " +
      'in this household. Modern time and temperature controls would improve scheduling ' +
      'and reduce missed heating windows.',
    effectTags: ['improves_heating_stability'],
    priority: 'recommended',
  };
}

// ─── Rule 6: System controls plan ────────────────────────────────────────────

/**
 * Recommend S-plan (or Y-plan) controls for stored-water systems where
 * independent control of heating and stored hot water would be beneficial.
 *
 * Not applicable to combi systems (no cylinder to zone independently).
 */
export function ruleSystemControlsPlan(
  inputs: RecommendUpgradesInputs,
): RecommendedUpgrade | null {
  const { systemType } = inputs.systemSpec;
  if (systemType === 'combi') return null;

  return {
    kind: 'system_controls_plan',
    category: 'controls',
    label: 'S-plan zone controls',
    reason:
      'S-plan controls allow independent scheduling of space heating and stored ' +
      'hot water. This reduces unnecessary cylinder reheats during heating-only periods ' +
      'and vice versa, improving overall system efficiency.',
    effectTags: ['improves_heating_stability', 'improves_hot_water_recovery'],
    priority: 'recommended',
  };
}

// ─── Rule 7: Primary pipe upgrade ─────────────────────────────────────────────

/**
 * Recommend an upgrade to 28 mm primaries for heat-pump paths where the current
 * pipe bore would restrict the flow rates required for low-temperature operation.
 *
 * Only fires for heat_pump system type with primaries < 28 mm.
 */
export function rulePrimaryPipeUpgrade(
  inputs: RecommendUpgradesInputs,
): RecommendedUpgrade | null {
  if (inputs.systemSpec.systemType !== 'heat_pump') return null;

  const pipeSizeMm =
    inputs.primaryPipeSizeMm ?? inputs.systemSpec.primaryPipeSizeMm;

  // Only trigger when we know the pipe size is too small
  if (pipeSizeMm === undefined || pipeSizeMm >= 28) return null;

  const hwConflict = inputs.outcomes.hotWater.conflict;
  const heatingConflict = inputs.outcomes.heating.conflict;
  const hasFlowConstraintEvents = hwConflict > 0 || heatingConflict > 0;

  return {
    kind: 'primary_pipe_upgrade',
    category: 'infrastructure',
    label: 'Upgrade primary pipework to 28 mm',
    reason:
      `Current primary pipework is ${pipeSizeMm} mm, which is likely to restrict ` +
      `the higher flow rates required for efficient heat-pump operation at low flow ` +
      `temperatures. Upgrading to 28 mm primaries is normally essential for best-fit ` +
      `heat-pump performance.`,
    effectTags: ['improves_low_temp_suitability', 'reduces_conflict'],
    priority: hasFlowConstraintEvents ? 'essential' : 'best_fit',
    value: 28,
  };
}
