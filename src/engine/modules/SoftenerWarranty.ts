import type {
  SoftenerWarrantyInput,
  SoftenerWarrantyResult,
} from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

// DHW scaling tax (11%) that is removed when a softener is fitted and water is
// in a hard/very_hard zone.  Source: SEDBUK / CIBSE – 8% efficiency drop per
// 1 mm scale; 1.6 mm layer triggers 11% fuel increase for DHW.
const DHW_SCALING_TAX_PCT = 11;

// Water hardness categories above which the scaling tax applies.
const HARD_CATEGORIES = new Set(['hard', 'very_hard']);

// ─── WB Softener Edge Policy ──────────────────────────────────────────────────

// Worcester Bosch Greenstar 8000+ Series uses an Al-Si heat exchanger that
// explicitly supports artificially softened water on the domestic (DHW) circuit
// per manufacturer guidance. Compatibility with softened water varies by
// manufacturer and model — always confirm with the selected appliance datasheet.
const WB_COMPATIBLE_MODELS = new Set<SoftenerWarrantyInput['boilerCompatibility']>([
  'wb_8000plus',
]);

// Primary Bypass Rule: even with a WB 8000+ unit, the heating circuit (primary
// loop) must still be filled with untreated hard water + Sentinel X100 inhibitor
// to satisfy WB warranty conditions.  Only the domestic (DHW) side of the
// secondary circuit may be supplied with softened water.
const PRIMARY_BYPASS_RULE =
  'Primary Bypass Rule: The heating circuit (primary loop) must still be filled ' +
  'with hard water + Sentinel X100 inhibitor to satisfy WB warranty conditions. ' +
  'Only the domestic hot-water (DHW) circuit may use artificially softened water. ' +
  'Install a bypass valve to prevent softened water from entering the primary loop.';

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * SoftenerWarranty
 *
 * Models the Worcester Bosch "Softener Edge":
 *
 *  - WB Greenstar 8000+ (Al-Si) explicitly allows artificially softened water on
 *    the domestic (DHW) side per manufacturer guidance.
 *    This removes the 11% "DHW Scaling Tax" in hard/very_hard water zones.
 *
 *  - PRIMARY BYPASS RULE: The heating circuit must still be filled with hard
 *    water + Sentinel X100 inhibitor to satisfy WB warranty conditions.
 *    A bypass valve must be installed to prevent softened water from reaching
 *    the primary loop.
 *
 *  - Softened-water compatibility varies by manufacturer and model. Always
 *    confirm compatibility with the selected appliance datasheet.
 *
 * Commercial value: Justifies the premium WB 8000+ specification over competitors
 * in hard/very_hard postcodes where a softener is fitted or planned.
 */
export function runSoftenerWarranty(input: SoftenerWarrantyInput): SoftenerWarrantyResult {
  const notes: string[] = [];

  const isHardWater = HARD_CATEGORIES.has(input.waterHardnessCategory);
  // Treat unspecified boilerCompatibility as WB-compatible (safe default).
  const allowsSoftenerOnDhw =
    !input.boilerCompatibility ||
    WB_COMPATIBLE_MODELS.has(input.boilerCompatibility);

  // ── DHW scaling tax relief ────────────────────────────────────────────────
  // The softener removes limescale-forming ions from the DHW feed, eliminating
  // the 11% fuel increase caused by scale accumulation on the heat exchanger.
  const dhwScalingTaxClearedPct =
    input.hasSoftener && isHardWater ? DHW_SCALING_TAX_PCT : 0;

  if (input.hasSoftener && isHardWater) {
    notes.push(
      `✅ DHW Scaling Tax Cleared: Softener fitted in ${input.waterHardnessCategory.replace('_', ' ')} ` +
      `water area. The ${DHW_SCALING_TAX_PCT}% DHW fuel increase from scale accumulation ` +
      `is eliminated. Hot water efficiency gain is retained.`
    );
  } else if (input.hasSoftener && !isHardWater) {
    notes.push(
      `ℹ️ Softener fitted but water hardness (${input.waterHardnessCategory}) is below the ` +
      `hard-water threshold. No DHW scaling tax to clear – softener provides marginal benefit.`
    );
  } else if (!input.hasSoftener && isHardWater) {
    notes.push(
      `🔴 DHW Scaling Tax Active: No softener fitted in ` +
      `${input.waterHardnessCategory.replace('_', ' ')} water area. ` +
      `A 1.6 mm scale layer will trigger an ${DHW_SCALING_TAX_PCT}% fuel increase for hot water. ` +
      `Fitting a softener + WB 8000+ removes this penalty without voiding the warranty.`
    );
  }

  // ── WB Softener Edge ──────────────────────────────────────────────────────
  const wbEdgeActive = input.hasSoftener && allowsSoftenerOnDhw;

  if (wbEdgeActive) {
    notes.push(
      `⭐ WB Softener Edge Active: Worcester Bosch 8000+ (Al-Si) explicitly allows ` +
      `artificially softened water on the domestic (DHW) side per manufacturer guidance. ` +
      `Always confirm softened-water compatibility with the selected appliance datasheet — ` +
      `manufacturer guidance on softened water varies by model and circuit.`
    );
  } else if (input.hasSoftener && input.boilerCompatibility === 'vaillant') {
    notes.push(
      `⚠️ Softener Conflict (Vaillant): Vaillant units are not certified for use ` +
      `with artificially softened water in the primary circuit. Risk of ` +
      `dezincification and pitting on internal alloys. Warranty may be voided. ` +
      `Confirm compatibility requirements with the manufacturer before specifying ` +
      `a water softener.`
    );
  }

  // ── Primary Bypass Rule ───────────────────────────────────────────────────
  // This rule always applies when a softener is in use with a WB unit.
  const primaryBypassRequired = wbEdgeActive;

  if (primaryBypassRequired) {
    notes.push(`🔧 ${PRIMARY_BYPASS_RULE}`);
  }

  return {
    dhwScalingTaxClearedPct,
    primaryBypassRequired,
    primaryBypassRule: primaryBypassRequired ? PRIMARY_BYPASS_RULE : '',
    wbEdgeActive,
    notes,
  };
}
