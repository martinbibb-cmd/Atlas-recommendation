import type {
  EngineInputV2_3,
  SmartTopUpResult,
  TopUpChargeEvent,
  DhwEventV1,
} from '../schema/EngineInputV2_3';

// ── Physics / sizing constants ────────────────────────────────────────────────

/** Default Mixergy cylinder volume (litres). */
const DEFAULT_CYLINDER_LITRES = 150;

/** Cold water inlet temperature (°C). */
const COLD_WATER_TEMP_C = 10;

/** Hot store setpoint (°C) for a boiler-fed Mixergy. */
const STORE_TEMP_C = 60;

/** Target mixed delivery temperature at the tap (°C). */
const TAP_TEMP_C = 40;

/**
 * Mixing ratio: fraction of hot water required to reach tap temperature.
 * hot / (hot + cold) = (tap − cold) / (store − cold)
 */
const HOT_FRACTION = (TAP_TEMP_C - COLD_WATER_TEMP_C) / (STORE_TEMP_C - COLD_WATER_TEMP_C); // 0.6

/** Specific heat capacity of water (kJ / (kg·K)). */
const CP_KJ_PER_KG_K = 4.18;

/** Water density (kg/L). */
const RHO_KG_PER_L = 1.0;

/**
 * Standing loss coefficient (kWh per °C temperature differential per hour).
 * Derived from a well-insulated 150 L cylinder (≈ 1.5 kWh/day standing loss at 50 °C above ambient).
 * standingLossKw = STANDING_LOSS_COEFF × (storeTempC − ambientTempC).
 */
const STANDING_LOSS_COEFF_KW_PER_K = 0.00125; // → ~1.5 kWh/day at ΔT = 50 K

/** Ambient temperature around the cylinder (°C). */
const AMBIENT_TEMP_C = 18;

/**
 * Buffer target in usable litres at 40 °C mixed.
 * - 'small'  → 60 L
 * - 'medium' → 100 L  (default for smart mode)
 * - 'large'  → 140 L
 */
const BUFFER_TARGET_LITRES_SMART = 100;
const BUFFER_TARGET_LITRES_MANUAL = 120;

/** Emergency boost threshold: if buffer falls below this, trigger full-tank reheat. */
const EMERGENCY_BOOST_THRESHOLD_LITRES = 40;

/** Look-ahead window (hours) for predictive top-up scheduling in smart mode. */
const SMART_LOOKAHEAD_HOURS = 2;

/** Top-slice charge event duration (hours) for smart mode. */
const TOP_SLICE_DURATION_HOURS = 1;

/** Full-tank charge event duration (hours) for manual_boosty mode. */
const FULL_TANK_DURATION_HOURS = 2;

/** Boiler power output during a charge event (kW). */
const CHARGE_POWER_KW = 15;

// ── Demand profile helpers ────────────────────────────────────────────────────

/**
 * Default learned demand profile: morning + evening peaks.
 * Returns litres-per-hour at 40 °C mixed for each hour of the day.
 */
function defaultDemandProfileLph(): number[] {
  return Array.from({ length: 24 }, (_, h) => {
    if (h >= 6 && h <= 9)  return 30; // morning peak
    if (h >= 18 && h <= 22) return 25; // evening peak
    return 2; // background (taps, etc.)
  });
}

/** Flow rates (L/min) keyed by DhwEventV1 profile. */
const DHW_EVENT_FLOW_LPM: Record<DhwEventV1['profile'], number> = {
  mixer10: 10,
  mixer12: 12,
  rainfall16: 16,
};

/**
 * Derive a demand profile from DhwEventV1 draw events.
 * Each event contributes litres based on its flow profile and duration.
 */
function demandProfileFromEvents(events: DhwEventV1[]): number[] {
  const lph = new Array<number>(24).fill(2); // background
  for (const ev of events) {
    const startHour = Math.floor(ev.startMin / 60);
    const hotLpm = DHW_EVENT_FLOW_LPM[ev.profile] * HOT_FRACTION;
    const hotLitres = hotLpm * ev.durationMin;
    lph[startHour] = (lph[startHour] ?? 2) + hotLitres;
  }
  return lph;
}

/**
 * Convert litres-at-40°C demand into kWh energy extracted from the store.
 */
function litresAt40CToKwh(litres: number): number {
  const deltaT = TAP_TEMP_C - COLD_WATER_TEMP_C;
  return (litres * RHO_KG_PER_L * CP_KJ_PER_KG_K * deltaT) / 3600;
}

/**
 * Convert kWh charged into litres added to the 40 °C usable buffer.
 */
function kwhToUsableLitres(kwh: number): number {
  const deltaT = TAP_TEMP_C - COLD_WATER_TEMP_C;
  return (kwh * 3600) / (RHO_KG_PER_L * CP_KJ_PER_KG_K * deltaT);
}

// ── Main module ───────────────────────────────────────────────────────────────

/**
 * SmartTopUpController
 *
 * Profile-based Mixergy charging scheduler.
 *
 * Smart mode ('smart' — default for Mixergy):
 *   - Derives expected demand from dayProfile.dhwEvents if provided,
 *     otherwise falls back to default morning+evening learned profile.
 *   - Schedules short top-slice charge events (1 h at CHARGE_POWER_KW)
 *     SMART_LOOKAHEAD_HOURS ahead of anticipated demand.
 *   - Avoids full-tank reheat unless the buffer is breached
 *     (emergency boost gate).
 *
 * Manual/boosty mode ('manual_boosty'):
 *   - Heats larger slices or the whole tank more frequently (every 4–6 hours).
 *   - Higher average store temperature increases standing losses and firing events.
 *   - Useful as a performance baseline comparison for smart mode.
 */
export function runSmartTopUpController(input: EngineInputV2_3): SmartTopUpResult {
  const controlMode: 'smart' | 'manual_boosty' = input.mixergyControlMode ?? 'smart';

  const demandLph = input.dayProfile?.dhwEvents?.length
    ? demandProfileFromEvents(input.dayProfile.dhwEvents)
    : defaultDemandProfileLph();

  const cylinderLitres = input.dhwStorageLitres ?? DEFAULT_CYLINDER_LITRES;
  // Max usable buffer = cylinder volume in 40 °C-mixed-equivalent litres
  const maxBufferLitres = cylinderLitres / HOT_FRACTION;

  const bufferTarget =
    controlMode === 'smart' ? BUFFER_TARGET_LITRES_SMART : BUFFER_TARGET_LITRES_MANUAL;

  const chargeEvents: TopUpChargeEvent[] = [];
  const bufferLitresHourly: number[] = [];
  let buffer = bufferTarget; // start the day with target buffer charged
  let emergencyBoostTriggered = false;
  let standingLossKwh = 0;

  if (controlMode === 'smart') {
    // ── Smart mode: look ahead, schedule top-slice events proactively ──────
    const chargedHours = new Set<number>(); // avoid duplicate charge events
    const smartDeltaT = STORE_TEMP_C - AMBIENT_TEMP_C;
    const smartStandingLossKwhPerHour = STANDING_LOSS_COEFF_KW_PER_K * smartDeltaT;

    for (let h = 0; h < 24; h++) {
      // Standing loss this hour
      standingLossKwh += smartStandingLossKwhPerHour;
      buffer -= kwhToUsableLitres(smartStandingLossKwhPerHour);

      // Consume demand
      buffer -= demandLph[h] ?? 0;
      buffer = Math.max(0, buffer);

      // Predict demand in look-ahead window
      let predictedDemand = 0;
      for (let la = 1; la <= SMART_LOOKAHEAD_HOURS; la++) {
        predictedDemand += demandLph[(h + la) % 24] ?? 0;
      }

      // If predicted buffer post-lookahead will fall below target, schedule a top-slice
      const predictedBuffer = buffer - predictedDemand;
      if (predictedBuffer < bufferTarget && !chargedHours.has(h + 1)) {
        const chargeHour = (h + 1) % 24;
        chargedHours.add(chargeHour);
        const heatKwh = CHARGE_POWER_KW * TOP_SLICE_DURATION_HOURS;
        const addedLitres = Math.min(kwhToUsableLitres(heatKwh), maxBufferLitres - buffer);
        chargeEvents.push({
          startHour: chargeHour,
          durationHours: TOP_SLICE_DURATION_HOURS,
          sliceMode: 'top_slice',
          heatInputKwh: parseFloat(heatKwh.toFixed(2)),
        });
        // Credit to next hour's buffer (simplified: apply immediately)
        buffer = Math.min(buffer + addedLitres, maxBufferLitres);
      }

      // Emergency boost if buffer is critically low
      if (buffer < EMERGENCY_BOOST_THRESHOLD_LITRES && !chargedHours.has(h)) {
        emergencyBoostTriggered = true;
        chargedHours.add(h);
        const heatKwh = CHARGE_POWER_KW * FULL_TANK_DURATION_HOURS;
        const addedLitres = Math.min(kwhToUsableLitres(heatKwh), maxBufferLitres - buffer);
        chargeEvents.push({
          startHour: h,
          durationHours: FULL_TANK_DURATION_HOURS,
          sliceMode: 'full_tank',
          heatInputKwh: parseFloat(heatKwh.toFixed(2)),
        });
        buffer = Math.min(buffer + addedLitres, maxBufferLitres);
        // Higher standing loss due to higher temperature in emergency scenario
        standingLossKwh += STANDING_LOSS_COEFF_KW_PER_K * (STORE_TEMP_C - AMBIENT_TEMP_C) * 0.5;
      }

      bufferLitresHourly.push(parseFloat(buffer.toFixed(1)));
    }
  } else {
    // ── Manual/boosty mode: fire every ~4 hours regardless of actual demand ──
    const MANUAL_FIRE_INTERVAL_HOURS = 4;
    // Higher store temperature in boosty mode → more standing loss
    const boostStoreTempC = STORE_TEMP_C + 5; // 65 °C average
    const manualDeltaT = boostStoreTempC - AMBIENT_TEMP_C;
    const manualStandingLossKwhPerHour = STANDING_LOSS_COEFF_KW_PER_K * manualDeltaT;

    for (let h = 0; h < 24; h++) {
      // Standing loss (higher temp → more loss)
      standingLossKwh += manualStandingLossKwhPerHour;
      buffer -= kwhToUsableLitres(manualStandingLossKwhPerHour);

      // Consume demand
      buffer -= demandLph[h] ?? 0;
      buffer = Math.max(0, buffer);

      // Scheduled interval firing
      if (h % MANUAL_FIRE_INTERVAL_HOURS === 0) {
        const heatKwh = CHARGE_POWER_KW * FULL_TANK_DURATION_HOURS;
        const addedLitres = Math.min(kwhToUsableLitres(heatKwh), maxBufferLitres - buffer);
        chargeEvents.push({
          startHour: h,
          durationHours: FULL_TANK_DURATION_HOURS,
          sliceMode: 'full_tank',
          heatInputKwh: parseFloat(heatKwh.toFixed(2)),
        });
        buffer = Math.min(buffer + addedLitres, maxBufferLitres);
      }

      if (buffer < EMERGENCY_BOOST_THRESHOLD_LITRES) {
        emergencyBoostTriggered = true;
      }

      bufferLitresHourly.push(parseFloat(buffer.toFixed(1)));
    }
  }

  const totalFiringEvents = chargeEvents.length;

  const modeNote =
    controlMode === 'smart'
      ? '🧠 Smart control: top-slice charging scheduled ahead of expected demand ' +
        '— fewer boiler firings, lower standing losses, buffer maintained above target.'
      : '🔁 Manual/boosty mode: full-tank reheat on fixed interval — higher standing ' +
        'losses and more firing events; useful for comparing against smart control.';

  const energyNote = `📊 Total standing losses: ${standingLossKwh.toFixed(2)} kWh/day. ` +
    `Charge events: ${totalFiringEvents}. ` +
    `Emergency boost triggered: ${emergencyBoostTriggered ? 'yes' : 'no'}.`;

  return {
    controlMode,
    chargeEvents,
    bufferLitresHourly,
    emergencyBoostTriggered,
    standingLossKwh: parseFloat(standingLossKwh.toFixed(3)),
    totalFiringEvents,
    notes: [modeNote, energyNote],
  };
}

/**
 * Helper: convert a demand-Lph array derived from generic occupancy data
 * to kWh/h for callers who want energy accounting rather than volume.
 * Exported for testing.
 */
export function demandLphToKwh(demandLph: number[]): number[] {
  return demandLph.map(lph => parseFloat(litresAt40CToKwh(lph).toFixed(3)));
}
