import type { EngineInputV2_3, CombiStressResult } from '../schema/EngineInputV2_3';

const SAP_PURGE_PENALTY_KWH = 600; // kWh/year (standard SAP assessment)
const SHORT_DRAW_EFFICIENCY_PCT = 28; // <30% for draws < 15 seconds
const CONDENSING_RETURN_TEMP_THRESHOLD = 55; // °C
const CONDENSING_ADVANTAGE_PCT = 11; // 10-12% latent heat recovery
const WB_SOFTENER_LONGEVITY_BOOST_PCT = 15; // % longevity bonus: hasSoftener + Al-Si HX

export function runCombiStressModule(input: EngineInputV2_3): CombiStressResult {
  const notes: string[] = [];

  // Purge loss: fixed SAP penalty for pre-purge and fan-overrun
  const annualPurgeLossKwh = SAP_PURGE_PENALTY_KWH;
  notes.push(
    `📉 Combi Purge Loss: ${annualPurgeLossKwh} kWh/year discarded via flue during ` +
    `pre-purge cycles and fan overrun (SAP standard penalty).`
  );

  // Short-draw efficiency: simulates hand-washing scenarios
  const shortDrawEfficiencyPct = SHORT_DRAW_EFFICIENCY_PCT;
  notes.push(
    `💧 Short-Draw Decay: For draws < 15 seconds, boiler efficiency collapses to ~${shortDrawEfficiencyPct}%. ` +
    `Unit never reaches steady-state condensing mode before the draw ends.`
  );

  // Condensing efficiency: depends on return water temperature
  const isCondensingCompromised = input.returnWaterTemp > CONDENSING_RETURN_TEMP_THRESHOLD;
  let condensingEfficiencyPct: number;

  if (isCondensingCompromised) {
    condensingEfficiencyPct = 89; // loses ~11% latent heat advantage
    notes.push(
      `🌡️ Condensing Mode Lost: Return temperature ${input.returnWaterTemp}°C exceeds 55°C threshold. ` +
      `Boiler cannot recover latent heat, losing ${CONDENSING_ADVANTAGE_PCT}% efficiency advantage. ` +
      `Radiators are likely undersized for condensing operation.`
    );
  } else {
    condensingEfficiencyPct = 100; // full condensing mode
    notes.push(
      `✅ Condensing Mode Active: Return temperature ${input.returnWaterTemp}°C < 55°C. ` +
      `Full latent heat recovery active.`
    );
  }

  // Heat loss estimate for total penalty calculation
  const heatLossKw = input.heatLossWatts / 1000;
  const estimatedAnnualKwh = heatLossKw * 1800; // ~1800 full-load hours/year estimate
  const condensingPenaltyKwh = isCondensingCompromised
    ? (estimatedAnnualKwh * CONDENSING_ADVANTAGE_PCT) / 100
    : 0;

  const totalPenaltyKwh = annualPurgeLossKwh + condensingPenaltyKwh;

  // ── Metallurgy Advantage: WB 8000+ with softener ──────────────────────────
  // Worcester Bosch's Al-Si heat exchanger is the only major brand with full
  // warranty coverage for salt-water softened primary circuits.  When a
  // softener is fitted alongside an Al-Si heat exchanger, internal surfaces
  // remain scale-free, delivering a 15% longevity improvement.
  const isAlSiMaterial =
    input.heatExchangerMaterial === 'Al-Si' ||
    input.preferredMetallurgy === 'al_si';
  const wbLongevityBoostPct =
    (input.hasSoftener ?? false) && isAlSiMaterial
      ? WB_SOFTENER_LONGEVITY_BOOST_PCT
      : 0;

  if (wbLongevityBoostPct > 0) {
    notes.push(
      `⭐ WB Longevity Boost: Softener + Al-Si heat exchanger combination unlocks ` +
      `a ${wbLongevityBoostPct}% longevity advantage due to Worcester Bosch's unique ` +
      `softener-warranty compatibility. Scale formation rate on the primary HX is ` +
      `effectively zero, maintaining peak thermal conductivity over the unit's lifetime.`
    );
  }

  return {
    annualPurgeLossKwh,
    shortDrawEfficiencyPct,
    condensingEfficiencyPct,
    isCondensingCompromised,
    totalPenaltyKwh,
    wbLongevityBoostPct,
    notes,
  };
}
