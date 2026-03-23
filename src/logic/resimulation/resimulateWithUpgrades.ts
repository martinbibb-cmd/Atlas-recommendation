/**
 * resimulateWithUpgrades.ts
 *
 * Main entry point for the PR 5 Re-simulation Engine.
 *
 * Accepts a TypicalDaySchedule, a base OutcomeSystemSpec, and a
 * RecommendedUpgradePackage.  Returns a ResimulationResult containing:
 *   - the original (simple-install) spec and its classified outcomes
 *   - the upgraded (best-fit) spec and its classified outcomes
 *   - a structured comparison with deltas and customer-readable headlines
 *
 * Critical design rule:
 *   The EXACT SAME TypicalDaySchedule is used for both runs.
 *   Only the system specification changes between runs.
 *
 * Design rule: identical inputs always produce identical output — no
 * randomness is introduced at any point in the pipeline.
 */

import type { TypicalDaySchedule } from '../events/types';
import type { OutcomeSystemSpec } from '../outcomes/types';
import type { RecommendedUpgradePackage } from '../upgrades/types';
import { classifyEventOutcomes } from '../outcomes/classifyEventOutcomes';
import { applyUpgradePackageToSpec } from './applyUpgradePackageToSpec';
import { compareOutcomeSummaries } from './compareOutcomeSummaries';
import type { ResimulationResult } from './types';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Re-simulate a typical day with the original spec and an upgraded spec, then
 * return a structured comparison.
 *
 * @param schedule  - Deterministic 24-hour event schedule (same for both runs).
 * @param baseSpec  - Original system specification (simple install).
 * @param upgrades  - Recommended upgrade package to produce the best-fit spec.
 * @returns A ResimulationResult containing both outcomes and a comparison.
 *
 * @example
 *   const result = resimulateWithUpgrades(schedule, originalSpec, upgradePackage);
 *   // result.simpleInstall — outcomes without upgrades
 *   // result.bestFitInstall — outcomes with upgrades applied
 *   // result.comparison.headlineImprovements — customer-readable improvements
 */
export function resimulateWithUpgrades(
  schedule: TypicalDaySchedule,
  baseSpec: OutcomeSystemSpec,
  upgrades: RecommendedUpgradePackage,
): ResimulationResult {
  // Step 1 — build the upgraded spec.
  const bestFitSpec = applyUpgradePackageToSpec(baseSpec, upgrades);

  // Step 2 — run the classifier twice with the SAME schedule.
  const simpleInstall  = classifyEventOutcomes(schedule, baseSpec);
  const bestFitInstall = classifyEventOutcomes(schedule, bestFitSpec);

  // Step 3 — compute the comparison.
  const comparison = compareOutcomeSummaries(simpleInstall, bestFitInstall);

  return {
    systemType:       baseSpec.systemType,
    simpleInstallSpec: baseSpec,
    bestFitSpec,
    simpleInstall,
    bestFitInstall,
    comparison,
  };
}
