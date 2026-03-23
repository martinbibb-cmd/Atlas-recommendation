/**
 * applyUpgradePackageToSpec.ts
 *
 * Pure function that converts a RecommendedUpgradePackage into an updated
 * OutcomeSystemSpec (the "best-fit" spec).
 *
 * Rules are deterministic and transparent.  Only the fields that an upgrade
 * directly addresses are mutated; all other fields are carried through
 * unchanged from the original spec.
 *
 * Design rule: identical inputs always produce identical output — no
 * randomness is introduced at any point.
 */

import type { OutcomeSystemSpec } from '../outcomes/types';
import type { RecommendedUpgradePackage } from '../upgrades/types';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply a recommended upgrade package to a base system spec and return the
 * resulting best-fit spec.
 *
 * The original spec is never mutated — a fresh object is returned.
 *
 * Upgrade application rules by kind:
 *
 *   combi_size
 *     → raise heatOutputKw to the value carried in upgrade.value (kW)
 *       when it is greater than the current value; also raise
 *       peakHotWaterCapacityLpm proportionally if the field is set.
 *
 *   cylinder_size
 *     → set hotWaterStorageLitres to upgrade.value (litres).
 *
 *   cylinder_type
 *     → no direct OutcomeSystemSpec field; preserved as metadata (no-op here).
 *
 *   system_clean
 *     → set systemCondition = 'clean'.
 *
 *   magnetic_filter
 *     → no direct OutcomeSystemSpec field; preserved as metadata (no-op here).
 *
 *   controls_upgrade
 *     → set controlsQuality = 'good' when current is 'basic';
 *       set controlsQuality = 'excellent' when current is already 'good'.
 *
 *   system_controls_plan
 *     → no direct OutcomeSystemSpec field; preserved as metadata (no-op here).
 *
 *   primary_pipe_upgrade
 *     → set primaryPipeSizeMm = 28 (the standard best-fit bore for heat pumps).
 *
 * @param baseSpec  - Original system specification (not mutated).
 * @param upgrades  - Recommended upgrade package to apply.
 * @returns A new OutcomeSystemSpec reflecting all applicable upgrades.
 */
export function applyUpgradePackageToSpec(
  baseSpec: OutcomeSystemSpec,
  upgrades: RecommendedUpgradePackage,
): OutcomeSystemSpec {
  // Shallow copy — we will layer field mutations on top.
  let spec: OutcomeSystemSpec = { ...baseSpec };

  for (const upgrade of upgrades.upgrades) {
    switch (upgrade.kind) {
      case 'combi_size': {
        if (typeof upgrade.value !== 'number') break;
        const targetKw = upgrade.value;
        if (targetKw > (spec.heatOutputKw ?? 0)) {
          // Scale peakHotWaterCapacityLpm proportionally when it is present.
          if (spec.peakHotWaterCapacityLpm !== undefined && spec.heatOutputKw) {
            const ratio = targetKw / spec.heatOutputKw;
            spec = {
              ...spec,
              heatOutputKw: targetKw,
              peakHotWaterCapacityLpm: Math.round(spec.peakHotWaterCapacityLpm * ratio),
            };
          } else {
            spec = { ...spec, heatOutputKw: targetKw };
          }
        }
        break;
      }

      case 'cylinder_size': {
        if (typeof upgrade.value !== 'number') break;
        const targetLitres = upgrade.value;
        // Guard: only increase storage — never downgrade.  When
        // hotWaterStorageLitres is unset, use the same defaults as
        // buildFamilySpec (buildResimulationFromSurvey.ts):
        //   stored_water → 210 L (standard UK unvented cylinder)
        //   heat_pump    → 250 L (standard ASHP cylinder)
        const effectiveBaseline = spec.hotWaterStorageLitres
          ?? (spec.systemType === 'heat_pump' ? 250 : 210);
        if (targetLitres > effectiveBaseline) {
          spec = { ...spec, hotWaterStorageLitres: targetLitres };
        }
        break;
      }

      case 'system_clean': {
        spec = { ...spec, systemCondition: 'clean' };
        break;
      }

      case 'controls_upgrade': {
        const current = spec.controlsQuality;
        if (current === 'basic') {
          spec = { ...spec, controlsQuality: 'good' };
        } else if (current === 'good') {
          spec = { ...spec, controlsQuality: 'excellent' };
        }
        // already 'excellent' → no change needed
        break;
      }

      case 'primary_pipe_upgrade': {
        // Upgrade to 28 mm primaries (canonical best-fit bore for heat pumps).
        spec = { ...spec, primaryPipeSizeMm: 28 };
        break;
      }

      // cylinder_type, magnetic_filter, system_controls_plan:
      // No direct OutcomeSystemSpec field — preserved as metadata only.
      case 'cylinder_type':
      case 'magnetic_filter':
      case 'system_controls_plan':
        break;

      default: {
        // Exhaustiveness guard — any future UpgradeKind that reaches here is
        // a no-op until explicitly handled above.
        break;
      }
    }
  }

  // Clear the cached heat-source behaviour model so the event classifier
  // rebuilds it from the upgraded spec parameters.  Without this, the best-fit
  // re-simulation would reuse stale physics derived from the pre-upgrade spec
  // (e.g. the old combi flow rate or pre-upgrade cylinder volume), producing
  // outcomes that do not reflect the actual improvements.
  //
  // Destructure to remove the key entirely rather than setting it to undefined,
  // so that callers checking `spec.heatSourceBehaviour != null` see a clean miss.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { heatSourceBehaviour: _discarded, ...specWithoutBehaviour } = spec;
  return specWithoutBehaviour;
}
