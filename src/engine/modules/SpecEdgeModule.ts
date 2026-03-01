import type {
  SpecEdgeInput,
  SpecEdgeResult,
  HeatExchangerMetallurgy,
} from '../schema/EngineInputV2_3';

// ─── Installation Strategy Constants ─────────────────────────────────────────

// British Gas "Full Job": oversized Type 22 radiators → 35–40°C flow
// Heat pump operates in its efficiency sweet spot; high SPF proves ROI of new rads.
const FULL_JOB_FLOW_TEMP_C = 37; // midpoint of 35–40°C band
const FULL_JOB_SPF_MIN = 3.8;
const FULL_JOB_SPF_MAX = 4.4;

// Octopus "Cosy" fast-fit: existing radiators retained → 50°C flow
// SPF collapses vs. full job, proving the long-run cost of not replacing emitters.
const HIGH_TEMP_FLOW_TEMP_C = 50;
const HIGH_TEMP_SPF_MIN = 2.9;
const HIGH_TEMP_SPF_MAX = 3.1;

// ─── Metallurgy Constants ─────────────────────────────────────────────────────

const WB_8000_MODEL = 'Worcester Bosch 8000 Series';
const VAILLANT_MODEL = 'Vaillant ecoTEC Exclusive';

// Water hardness categories that favour stainless steel without a softener
const VAILLANT_PREFERRED_HARDNESS = new Set(['soft', 'moderate']);

const WB_SOFTENER_FLAG =
  'Worcester Bosch heat exchangers are uniquely compatible with salt-water ' +
  'softeners for DHW protection, providing superior scale protection without voiding the manufacturer\'s warranty.';

// "Motorway Cruise" rule tolerance: heat loss must be within ±15% of the
// unit's modulation floor to grant the Longevity Bonus.
const MODULATION_MATCH_TOLERANCE = 0.15;

// ─── Maintenance ROI Constants ────────────────────────────────────────────────

// Magnetite sludge tax: HHIC / Boiler Plus guidance (no magnetic filter fitted)
const MAGNETITE_ENERGY_TAX_PCT = 7;   // % energy bill increase
const MAGNETITE_RAD_REDUCTION_PCT = 47; // % radiator heat output reduction

// DHW scaling tax: SEDBUK / CIBSE data for 1.6 mm scale layer
const SCALE_PENALTY_PCT = 11; // % fuel increase for DHW
// Hard-water threshold above which scale penalty applies
const HARD_WATER_CATEGORIES = new Set(['hard', 'very_hard']);

// DHW accounts for ~30% of annual gas spend (UK average)
const DHW_GAS_SHARE = 0.30;
// Heating circuit accounts for the remaining 70%
const HEATING_GAS_SHARE = 0.70;

// Assumed cost of a professional system flush (£)
const FLUSH_COST_GBP = 500;

// Educational note silicate message threshold
const VERY_HARD_CATEGORY = 'very_hard';

// ─── Mixergy Stratification Constants ────────────────────────────────────────

const MIXERGY_GAS_SAVING_PCT = 21;       // vs. conventional cylinder
const MIXERGY_FOOTPRINT_REDUCTION_PCT = 30; // vs. conventional cylinder

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * SpecEdgeModule
 *
 * Technical Specification & Commercial Edge Module.
 *
 * Mathematically proves the value of premium specification over fast-fit
 * alternatives by integrating four physics-backed analyses into a single result:
 *
 * 1. Installation Strategy Curves (British Gas "Full Job" vs Octopus "Cosy"):
 *    Forces flow temperature based on policy; proves SPF/ROI advantage of
 *    proper radiator sizing.
 *
 * 2. Premium Metallurgy Matrix (WB 8000+ Al-Si vs Vaillant Stainless Steel):
 *    Highlights heat-exchanger advantages for installers. The "Motorway Cruise"
 *    Longevity Bonus is granted when the unit modulation floor is accurately
 *    matched to the building heat loss – no short-cycling.
 *
 * 3. Salt-Water Softener Compatibility (WB Edge):
 *    Worcester Bosch is uniquely compatible with softened water on the domestic
 *    side. Triggers a softenerCompatibilityFlag installer briefing alert when
 *    hasSoftener is true.
 *
 * 4. Maintenance ROI Visualizer (Hive Premium Hook):
 *    Calculates the Annualised Cost of Inaction from magnetite sludge tax and
 *    DHW scaling tax, then models the flush payback period.
 */
export function runSpecEdgeModule(input: SpecEdgeInput): SpecEdgeResult {
  const notes: string[] = [];

  // ── 1. Installation strategy ──────────────────────────────────────────────
  const isFullJob = input.installationPolicy === 'full_job';

  const designFlowTempC = isFullJob ? FULL_JOB_FLOW_TEMP_C : HIGH_TEMP_FLOW_TEMP_C;
  const spfRange: [number, number] = isFullJob
    ? [FULL_JOB_SPF_MIN, FULL_JOB_SPF_MAX]
    : [HIGH_TEMP_SPF_MIN, HIGH_TEMP_SPF_MAX];
  const spfMidpoint = parseFloat(((spfRange[0] + spfRange[1]) / 2).toFixed(2));

  if (isFullJob) {
    notes.push(
      `✅ British Gas "Full Job": New oversized radiators sized for full heat load at ` +
      `${designFlowTempC}°C flow. SPF modelled at ${spfRange[0]}–${spfRange[1]} — ` +
      `heat pump operates in its efficiency sweet spot, delivering a high-ROI ` +
      `"Horizon" line on the Comfort Clock.`
    );
  } else {
    notes.push(
      `⚠️ Octopus "Cosy" Fast-Fit: Existing radiators retained; flow temperature ` +
      `forced to ${designFlowTempC}°C. SPF collapses to ${spfRange[0]}–${spfRange[1]}. ` +
      `Upgrading to a full-job specification would raise SPF by ~` +
      `${(FULL_JOB_SPF_MIN - HIGH_TEMP_SPF_MAX).toFixed(1)} points and lower running costs.`
    );
  }

  // ── 2. Metallurgy & Longevity Bonus ──────────────────────────────────────
  let recommendedMetallurgy: HeatExchangerMetallurgy;
  let wbSoftenerEdgeActive = false;
  let softenerCompatibilityFlag: string | undefined;

  if (input.preferredMetallurgy && input.preferredMetallurgy !== 'auto') {
    recommendedMetallurgy = input.preferredMetallurgy;
    if (input.hasSoftener && recommendedMetallurgy === 'stainless_steel') {
      notes.push(
        `⚠️ Softener Conflict: Stainless-steel heat exchangers (e.g. ${VAILLANT_MODEL}) ` +
        `are not certified for use with salt-water softened water in the primary circuit. ` +
        `Warranty may be voided. Consider ${WB_8000_MODEL} (Al-Si) which is fully compatible.`
      );
    }
  } else if (input.hasSoftener) {
    recommendedMetallurgy = 'al_si';
    wbSoftenerEdgeActive = true;
    softenerCompatibilityFlag = WB_SOFTENER_FLAG;
    notes.push(`⭐ WB Softener Edge Active: ${WB_SOFTENER_FLAG}`);
  } else if (VAILLANT_PREFERRED_HARDNESS.has(input.waterHardnessCategory)) {
    recommendedMetallurgy = 'stainless_steel';
    notes.push(
      `🔬 Metallurgy: ${input.waterHardnessCategory} water area without a softener. ` +
      `Stainless-steel (${VAILLANT_MODEL}) offers superior corrosion resistance ` +
      `across a wide pH band and excellent longevity.`
    );
  } else {
    recommendedMetallurgy = 'al_si';
    notes.push(
      `🔬 Metallurgy: ${input.waterHardnessCategory.replace('_', ' ')} water area. ` +
      `Al-Si (${WB_8000_MODEL}) offers high thermal conductivity. A salt-water ` +
      `softener can be added in future without voiding the manufacturer warranty – ` +
      `a unique advantage over competing brands.`
    );
  }

  // "Motorway Cruise" Longevity Bonus: unit modulation floor within ±15% of heat loss
  const heatLossKw = input.heatLossWatts / 1000;
  const modulationLow = input.unitModulationFloorKw * (1 - MODULATION_MATCH_TOLERANCE);
  const modulationHigh = input.unitModulationFloorKw * (1 + MODULATION_MATCH_TOLERANCE);
  const longevityBonusActive =
    heatLossKw >= modulationLow && heatLossKw <= modulationHigh;

  if (longevityBonusActive) {
    notes.push(
      `🏆 Longevity Bonus ("Motorway Cruise"): Building heat loss (${heatLossKw.toFixed(1)} kW) ` +
      `accurately matches unit modulation floor (${input.unitModulationFloorKw} kW). ` +
      `The boiler/heat-pump runs in its most efficient band without short-cycling, ` +
      `extending equipment life and protecting the warranty.`
    );
  } else {
    notes.push(
      `ℹ️ Modulation Match: Building heat loss (${heatLossKw.toFixed(1)} kW) vs unit ` +
      `modulation floor (${input.unitModulationFloorKw} kW). Accurate heat-loss ` +
      `modelling is essential to unlock the Longevity Bonus.`
    );
  }

  // ── 3. Maintenance ROI Visualizer ─────────────────────────────────────────
  const magnetiteSludgeTaxPct = input.hasMagneticFilter ? 0 : MAGNETITE_ENERGY_TAX_PCT;
  const radiatorHeatOutputReductionPct = input.hasMagneticFilter ? 0 : MAGNETITE_RAD_REDUCTION_PCT;
  // A fitted water softener removes scale-causing minerals from the primary and DHW
  // circuits, eliminating the DHW scaling penalty regardless of area hardness.
  const dhwScalingTaxPct =
    !input.hasSoftener && HARD_WATER_CATEGORIES.has(input.waterHardnessCategory)
      ? SCALE_PENALTY_PCT
      : 0;

  if (!input.hasMagneticFilter) {
    notes.push(
      `🔩 Magnetite Sludge Tax: No magnetic filter detected. Engine models a ` +
      `${magnetiteSludgeTaxPct}% energy bill increase and a ` +
      `${radiatorHeatOutputReductionPct}% reduction in radiator heat output. ` +
      `Fit a Fernox TF1 or equivalent to eliminate this penalty (magnetite alert active).`
    );
  } else {
    notes.push(
      `🧲 Magnetic Filter Active: Magnetite sludge is being captured. No sludge tax applied.`
    );
  }

  if (dhwScalingTaxPct > 0) {
    const silicateMessage =
      input.waterHardnessCategory === VERY_HARD_CATEGORY
        ? `Your postcode's high silicates will make scale 10× more resistant to heat transfer. `
        : '';
    notes.push(
      `🔥 DHW Scaling Tax (${dhwScalingTaxPct}% fuel increase for hot water): ` +
      `${input.waterHardnessCategory.replace('_', ' ')} water area. ` +
      `A 1.6 mm scale layer on the DHW heat exchanger triggers an ${dhwScalingTaxPct}% ` +
      `fuel increase for hot water only. ${silicateMessage}` +
      `Scale inhibitor or softener treatment recommended.`
    );
  } else if (input.hasSoftener && HARD_WATER_CATEGORIES.has(input.waterHardnessCategory)) {
    notes.push(
      `✅ DHW Scaling: Water softener fitted – DHW scaling tax cleared. ` +
      `${SCALE_PENALTY_PCT}% efficiency gain retained versus an untreated ` +
      `${input.waterHardnessCategory.replace('_', ' ')} water supply.`
    );
  } else {
    notes.push(`✅ DHW Scaling: Soft/moderate water area – no DHW scale penalty modelled.`);
  }

  // Annualised Cost of Inaction
  const annualGasSpend = input.annualGasSpendGbp ?? 0;
  const heatingSpend = annualGasSpend * HEATING_GAS_SHARE;
  const dhwSpend = annualGasSpend * DHW_GAS_SHARE;

  const sludgeCostGbp = parseFloat(((magnetiteSludgeTaxPct / 100) * heatingSpend).toFixed(2));
  const scalingCostGbp = parseFloat(((dhwScalingTaxPct / 100) * dhwSpend).toFixed(2));
  const annualCostOfInactionGbp = parseFloat((sludgeCostGbp + scalingCostGbp).toFixed(2));

  let flushPaybackYears: number | null = null;
  if (annualGasSpend > 0 && annualCostOfInactionGbp > 0) {
    flushPaybackYears = parseFloat((FLUSH_COST_GBP / annualCostOfInactionGbp).toFixed(1));
    notes.push(
      `💰 Annualised Cost of Inaction: Magnetite sludge £${sludgeCostGbp.toFixed(0)}/yr + ` +
      `DHW scale £${scalingCostGbp.toFixed(0)}/yr = £${annualCostOfInactionGbp.toFixed(0)}/yr wasted. ` +
      `A professional flush will pay for itself in ${flushPaybackYears} years.`
    );
  }

  // ── 4. Mixergy Saving ─────────────────────────────────────────────────────
  let mixergyGasSavingPct: number | undefined;
  let mixergyFootprintReductionPct: number | undefined;

  if (input.dhwTankType === 'mixergy') {
    mixergyGasSavingPct = MIXERGY_GAS_SAVING_PCT;
    mixergyFootprintReductionPct = MIXERGY_FOOTPRINT_REDUCTION_PCT;
    notes.push(
      `⚡ Mixergy Stratification: ${mixergyGasSavingPct}% gas saving via intelligent ` +
      `stratification heating – only the top portion of the cylinder is heated for ` +
      `typical draws. ${mixergyFootprintReductionPct}% footprint reduction versus a ` +
      `conventional cylinder of equivalent capacity.`
    );
  }

  return {
    designFlowTempC,
    spfRange,
    spfMidpoint,
    recommendedMetallurgy,
    longevityBonusActive,
    wbSoftenerEdgeActive,
    softenerCompatibilityFlag,
    magnetiteSludgeTaxPct,
    radiatorHeatOutputReductionPct,
    dhwScalingTaxPct,
    annualCostOfInactionGbp,
    flushPaybackYears,
    mixergyGasSavingPct,
    mixergyFootprintReductionPct,
    notes,
  };
}
