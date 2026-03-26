import type {
  MetallurgyEdgeInput,
  MetallurgyEdgeResult,
  HeatExchangerMetallurgy,
} from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

// Worcester Bosch 8000+ uses an Aluminium-Silicon (Al-Si) heat exchanger.
// Lightweight, high thermal conductivity, and explicitly supports salt-water
// softened water on the domestic side per manufacturer guidance.
const WB_8000_MODEL = 'Worcester Bosch 8000 Series';
const WB_8000_METALLURGY: HeatExchangerMetallurgy = 'al_si';

// Vaillant Exclusive / ecoTEC Exclusive uses a stainless-steel heat exchanger.
// High corrosion resistance across a wider pH band, but Vaillant (and most
// other manufacturers) do not support artificially softened primary-circuit
// water due to increased risk of dezincification and pitting on specific alloys.
const VAILLANT_MODEL = 'Vaillant ecoTEC Exclusive';
const VAILLANT_METALLURGY: HeatExchangerMetallurgy = 'stainless_steel';

// Water hardness at which Vaillant stainless performs best (soft/moderate
// avoids scale without needing a softener; hard/very_hard benefits from WB's
// softener compatibility).
const VAILLANT_PREFERRED_HARDNESS = new Set(['soft', 'moderate']);

// Softener compatibility flag text (used by sales / installer tooling)
const WB_SOFTENER_FLAG =
  'Worcester Bosch 8000+ heat exchangers explicitly support salt-water ' +
  'softeners on the DHW circuit per manufacturer guidance. Always confirm ' +
  'softened-water compatibility with the selected appliance datasheet.';

// Primary Bypass Rule: even with a WB 8000+ Al-Si unit, the heating (primary)
// loop must still be filled with untreated hard water + Sentinel X100 inhibitor
// to satisfy warranty conditions.  Only the DHW (secondary) circuit may use
// artificially softened water.
const PRIMARY_BYPASS_RULE =
  'Primary Bypass Rule: The heating circuit (primary loop) must still be filled ' +
  'with hard water + Sentinel X100 inhibitor to satisfy WB Al-Si warranty conditions. ' +
  'Only the domestic hot-water (DHW) circuit may use artificially softened water. ' +
  'Install a bypass valve to prevent softened water from entering the primary loop.';

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * MetallurgyEdgeModule
 *
 * Models premium heat-exchanger metallurgy and the "WB Softener Edge":
 *
 *  - Al-Si (Worcester Bosch 8000+): lightweight, high thermal conductivity,
 *    uniquely compatible with salt-water softeners on the domestic side.
 *  - Stainless Steel (Vaillant Exclusive): excellent corrosion resistance
 *    across a wider pH band, but NOT recommended where a salt-water softener
 *    supplies the primary circuit.
 *
 * If the property has a softener, the engine boosts the WB 8000+ recommendation
 * and surfaces the softener compatibility flag for installer briefings.
 */
export function runMetallurgyEdgeModule(input: MetallurgyEdgeInput): MetallurgyEdgeResult {
  const notes: string[] = [];

  // ── Determine recommendation ─────────────────────────────────────────────
  let recommendedMetallurgy: HeatExchangerMetallurgy;
  let recommendedModel: string;
  let recommendationReason: string;
  let wbSoftenerEdgeActive = false;
  let softenerCompatibilityFlag: string | undefined;

  // If caller has specified a preference (not 'auto'), respect it but warn
  // when stainless is chosen alongside a softener.
  if (input.preferredMetallurgy && input.preferredMetallurgy !== 'auto') {
    recommendedMetallurgy = input.preferredMetallurgy;
    recommendedModel =
      recommendedMetallurgy === 'al_si' ? WB_8000_MODEL : VAILLANT_MODEL;
    recommendationReason = `Installer-specified metallurgy preference (${recommendedMetallurgy}).`;

    if (input.hasSoftener && recommendedMetallurgy === 'stainless_steel') {
      notes.push(
        `⚠️ Softener Conflict: Stainless-steel heat exchangers (e.g. Vaillant) are ` +
        `not certified for use with salt-water softened water in the primary circuit. ` +
        `Warranty may be voided. Consider switching to Al-Si (Worcester Bosch 8000+) ` +
        `which is fully compatible with salt-water softeners.`
      );
    }
  } else if (input.hasSoftener) {
    // Softener present → WB Al-Si is the only safe choice for full warranty coverage
    recommendedMetallurgy = WB_8000_METALLURGY;
    recommendedModel = WB_8000_MODEL;
    wbSoftenerEdgeActive = true;
    softenerCompatibilityFlag = WB_SOFTENER_FLAG;
    recommendationReason =
      `Property has a salt-water softener. Al-Si (${WB_8000_MODEL}) is the only ` +
      `major brand with full warranty coverage for softened water in the primary circuit.`;

    notes.push(`⭐ WB Softener Edge Active: ${WB_SOFTENER_FLAG}`);
    notes.push(`🔧 ${PRIMARY_BYPASS_RULE}`);
  } else if (VAILLANT_PREFERRED_HARDNESS.has(input.waterHardnessCategory)) {
    // Soft/moderate water without a softener → stainless is a fine choice;
    // no softener risk, excellent longevity.
    recommendedMetallurgy = VAILLANT_METALLURGY;
    recommendedModel = VAILLANT_MODEL;
    recommendationReason =
      `${input.waterHardnessCategory} water area without a softener. ` +
      `Stainless-steel (${VAILLANT_MODEL}) offers superior corrosion resistance ` +
      `across a wide pH band and excellent longevity.`;
  } else {
    // Hard/very-hard water without softener → Al-Si WB still recommended for
    // its thermal conductivity, and the softener edge can be deployed later.
    recommendedMetallurgy = WB_8000_METALLURGY;
    recommendedModel = WB_8000_MODEL;
    recommendationReason =
      `${input.waterHardnessCategory.replace('_', ' ')} water area. ` +
      `Al-Si (${WB_8000_MODEL}) offers high thermal conductivity and, if a ` +
      `salt-water softener is added in future, remains fully compatible ` +
      `without voiding the manufacturer warranty.`;

    notes.push(
      `💡 Softener Upgrade Path: Fitting a salt-water softener with the ` +
      `${WB_8000_MODEL} will provide superior scale protection and unlock ` +
      `full warranty coverage – a unique advantage over competing brands.`
    );
  }

  // ── General metallurgy context notes ─────────────────────────────────────
  notes.push(
    `🔬 Metallurgy Summary: Al-Si (${WB_8000_MODEL}) – lightweight, high ` +
    `thermal conductivity, softener-compatible. Stainless Steel ` +
    `(${VAILLANT_MODEL}) – high corrosion resistance, wider pH tolerance, ` +
    `not recommended with salt-water softeners in the primary circuit.`
  );

  notes.push(`📋 Recommendation: ${recommendedModel} — ${recommendationReason}`);

  return {
    recommendedMetallurgy,
    wbSoftenerEdgeActive,
    recommendationReason,
    softenerCompatibilityFlag,
    notes,
  };
}
