import type {
  MixergyLegacyInput,
  MixergyLegacyResult,
} from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

// British Gas historically held an exclusivity agreement with Mixergy for
// installer-network deployments.  This flag models that commercial context.
const BG_EXCLUSIVITY_MIN_VOLUME_LITRES = 150; // minimum Mixergy tank size for BG installs

// IoT tier thresholds
// 'full' tier requires both BG installer network AND an existing IoT hub/thermostat
// 'basic' tier is available for independent installers with IoT integration
// 'none' when no IoT hub present and no BG network
const BG_IOT_TIER = 'full' as const;
const INDEPENDENT_IOT_TIER = 'basic' as const;
const NO_IOT_TIER = 'none' as const;

// Annual DHW saving estimate for a Mixergy cylinder vs conventional storage
// Mixergy's top-down stratification means only the volume actually required is
// heated, avoiding full-tank reheat cycles.  Typical saving: 15–25% of DHW energy.
// Using a 120 kWh/year base (average UK DHW energy for single occupant) ×
// tank volume scaling factor.
const BASE_ANNUAL_DHW_KWH_PER_100L = 200; // kWh/year per 100 L of tank at average use
const MIXERGY_SAVING_PCT = 0.20; // 20% central estimate

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * MixergyLegacyModule
 *
 * Models the Mixergy cylinder's:
 *  1. British Gas exclusivity context – BG was Mixergy's initial exclusive
 *     installer network, unlocking 'full' IoT tier with BG's Smart Home platform.
 *  2. IoT integration tier – ranges from 'none' through 'basic' (independent
 *     installer with smart hub) to 'full' (BG network with full platform access).
 *  3. Estimated annual DHW energy saving versus a conventional cylinder, driven
 *     by Mixergy's active top-down stratification.
 */
export function runMixergyLegacyModule(input: MixergyLegacyInput): MixergyLegacyResult {
  const notes: string[] = [];

  // ── BG exclusivity ───────────────────────────────────────────────────────
  const bgExclusivityActive =
    input.installerNetwork === 'british_gas' &&
    input.dhwStorageLitres >= BG_EXCLUSIVITY_MIN_VOLUME_LITRES;

  if (bgExclusivityActive) {
    notes.push(
      `⭐ British Gas Exclusivity Active: Mixergy cylinder (${input.dhwStorageLitres}L) ` +
      `installed via British Gas network. Full BG Smart Home IoT integration ` +
      `and priority technical support unlocked.`
    );
  } else if (input.installerNetwork === 'british_gas') {
    notes.push(
      `ℹ️ British Gas Installer Network: Tank size ${input.dhwStorageLitres}L is below ` +
      `the ${BG_EXCLUSIVITY_MIN_VOLUME_LITRES}L minimum for BG exclusivity terms. ` +
      `Standard BG installer terms apply.`
    );
  }

  // ── IoT tier ─────────────────────────────────────────────────────────────
  let iotTier: 'none' | 'basic' | 'full';
  if (bgExclusivityActive && input.hasIotIntegration) {
    iotTier = BG_IOT_TIER;
    notes.push(
      `📡 IoT Tier: FULL — Mixergy cylinder paired with BG Smart Home platform. ` +
      `Remote scheduling, demand response, and Mixergy Solar X integration available.`
    );
  } else if (input.hasIotIntegration) {
    iotTier = INDEPENDENT_IOT_TIER;
    notes.push(
      `📡 IoT Tier: BASIC — IoT hub detected. Mixergy app scheduling and remote ` +
      `monitoring active. Upgrade to BG installer network to unlock full platform ` +
      `integration including demand-side response and tariff optimisation.`
    );
  } else {
    iotTier = NO_IOT_TIER;
    notes.push(
      `📡 IoT Tier: NONE — No smart hub detected. Mixergy cylinder will operate in ` +
      `standard time-clock mode. Adding a compatible hub (Hive, Nest, or Mixergy ` +
      `Controller) unlocks smart scheduling and up to 20% additional energy saving.`
    );
  }

  // ── Estimated annual DHW saving ───────────────────────────────────────────
  const baseAnnualDhwKwh =
    (input.dhwStorageLitres / 100) * BASE_ANNUAL_DHW_KWH_PER_100L;
  const estimatedAnnualSavingKwh = parseFloat(
    (baseAnnualDhwKwh * MIXERGY_SAVING_PCT).toFixed(0)
  );

  notes.push(
    `💡 Estimated Annual Saving: ~${estimatedAnnualSavingKwh} kWh/year versus a ` +
    `conventional ${input.dhwStorageLitres}L cylinder. Mixergy's top-down ` +
    `stratification heats only the water required, avoiding full-tank reheat cycles.`
  );

  return {
    bgExclusivityActive,
    iotTier,
    estimatedAnnualSavingKwh,
    notes,
  };
}
