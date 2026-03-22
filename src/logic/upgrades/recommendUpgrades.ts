/**
 * recommendUpgrades.ts
 *
 * Main entry point for the PR 4 Recommended Upgrades Engine.
 *
 * Accepts a selected system spec and a PR 3 ClassifiedDaySchedule (plus
 * optional survey / engine context) and returns a deterministic
 * RecommendedUpgradePackage containing grouped, reasoned, tagged upgrades.
 *
 * Design rule: identical inputs always produce identical output — no
 * randomness is introduced at any point in the pipeline.
 */

import type {
  RecommendUpgradesInputs,
  RecommendedUpgrade,
  RecommendedUpgradePackage,
} from './types';
import {
  ruleCombiSize,
  ruleCylinderSize,
  ruleSystemClean,
  ruleMagneticFilter,
  ruleControlsUpgrade,
  ruleSystemControlsPlan,
  rulePrimaryPipeUpgrade,
} from './upgradeRules';

// ─── Rule pipeline ────────────────────────────────────────────────────────────

/**
 * Ordered list of upgrade rules.  Each rule either fires (returning a
 * RecommendedUpgrade) or is skipped (returning null).  Order within the
 * array determines the presentation order within each category group.
 */
type UpgradeRule = (inputs: RecommendUpgradesInputs) => RecommendedUpgrade | null;

const UPGRADE_RULES: UpgradeRule[] = [
  ruleCombiSize,
  ruleCylinderSize,
  rulePrimaryPipeUpgrade,
  ruleSystemClean,
  ruleMagneticFilter,
  ruleControlsUpgrade,
  ruleSystemControlsPlan,
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a deterministic upgrade package for the given system and outcomes.
 *
 * Each upgrade rule is evaluated in order.  Rules that do not apply to the
 * current system type or inputs silently return null and are excluded from
 * the final package.
 *
 * @param inputs - System spec, classified outcomes, and survey context.
 * @returns A RecommendedUpgradePackage with grouped, reasoned, tagged upgrades.
 *
 * @example
 *   const pkg = recommendUpgrades({
 *     systemSpec: { systemType: 'heat_pump', primaryPipeSizeMm: 22 },
 *     outcomes:   classifiedSchedule,
 *     controlsQuality: 'basic',
 *   });
 *   // pkg.upgrades will include primary_pipe_upgrade and controls_upgrade
 */
export function recommendUpgrades(
  inputs: RecommendUpgradesInputs,
): RecommendedUpgradePackage {
  const upgrades: RecommendedUpgrade[] = [];

  for (const rule of UPGRADE_RULES) {
    const result = rule(inputs);
    if (result !== null) {
      upgrades.push(result);
    }
  }

  return {
    systemType: inputs.systemSpec.systemType,
    upgrades,
  };
}
