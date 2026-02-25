/**
 * LifestyleInteractiveHelpers
 *
 * Physics helpers for the LifestyleInteractive "Day Painter" component.
 * Separated into a plain module so the component file can satisfy the
 * react-refresh/only-export-components lint rule while keeping the helpers
 * unit-testable in isolation.
 */

// ─── Delivery mode type ───────────────────────────────────────────────────────

/**
 * Canonical DHW delivery modes.
 * Legacy aliases ('pumped', 'tank_pumped', 'mixer_pump') are normalised to
 * canonical values via normaliseDeliveryMode().
 */
export type DeliveryMode =
  | 'unknown'
  | 'gravity'
  | 'pumped_from_tank'
  | 'mains_mixer'
  | 'accumulator_supported'
  | 'break_tank_booster'
  | 'electric_cold_only';

/** Legacy alias inputs accepted for backward compatibility. */
type DeliveryModeInput = DeliveryMode | 'pumped' | 'tank_pumped' | 'mixer_pump' | 'electric' | 'electric_shower';

/** All valid canonical DeliveryMode values (used for safe fall-through validation). */
const CANONICAL_DELIVERY_MODES: ReadonlySet<DeliveryMode> = new Set<DeliveryMode>([
  'unknown',
  'gravity',
  'pumped_from_tank',
  'mains_mixer',
  'accumulator_supported',
  'break_tank_booster',
  'electric_cold_only',
]);

/**
 * Normalise a raw/legacy delivery mode string to the canonical DeliveryMode.
 * Always call this once at the boundary (UI or engine entry point) before
 * passing the mode into any physics helper.
 *
 * Case-insensitive: 'Electric', 'ELECTRIC', 'electric_shower' all → 'electric_cold_only'.
 * Unknown values fall back to 'unknown' (they never pass through as invalid strings).
 */
export function normaliseDeliveryMode(raw: string): DeliveryMode {
  const lower = raw.trim().toLowerCase() as DeliveryModeInput;
  switch (lower) {
    case 'pumped':
    case 'tank_pumped':
      return 'pumped_from_tank';
    case 'mixer_pump':
      return 'mains_mixer';
    case 'electric':
    case 'electric_shower':
      return 'electric_cold_only';
    default:
      // Return the value if it's already canonical, otherwise reject to 'unknown'
      return CANONICAL_DELIVERY_MODES.has(lower as DeliveryMode) ? (lower as DeliveryMode) : 'unknown';
  }
}

/**
 * Returns true when a given DHW event should create a hot-water draw on the
 * heating system.  Electric showers heat cold mains directly and never draw
 * from the stored cylinder or combi DHW circuit — but only for shower events.
 * Bath, sink, and tap events still draw stored hot water even with an electric
 * shower delivery mode.
 *
 * DHW suppression exists in three layers — keep them in sync:
 *  1. This function (Solver24hV1 per-event gate and helper mode-level gate)
 *  2. mixergySoCByHour — treats 'dhw_demand' hours as shower-peak; 'home' hours
 *     retain a background draw (−4 %) representing taps / kitchen / bath.
 *  3. boilerSteppedCurve — skips combi service-switching conflict for electric.
 *
 * When called without an eventKind (mode-level check for helpers), electric_cold_only
 * conservatively returns false to preserve existing helper behaviour.
 *
 * @param mode      Canonical DHW delivery mode.
 * @param eventKind Optional event kind (e.g. 'shower', 'bath', 'sink').
 *                  If provided, suppression is applied only to 'shower' events.
 */
export function isHotWaterDrawEvent(mode: DeliveryMode, eventKind?: string): boolean {
  if (mode !== 'electric_cold_only') return true;
  // Electric cold-only: suppress shower draws only.
  // Bath, sink, and tap events still draw from the stored cylinder.
  if (eventKind !== undefined) return eventKind !== 'shower';
  // Mode-level check (no event kind) — conservative: no draw (backward compatible).
  return false;
}

// ─── Hour State type ──────────────────────────────────────────────────────────

export type HourState = 'away' | 'home' | 'dhw_demand';

export const STATE_LABELS: Record<HourState, string> = {
  away: 'Away',
  home: 'At Home',
  dhw_demand: 'High DHW',
};

export const STATE_COLOURS: Record<HourState, string> = {
  away: '#bee3f8',
  home: '#9ae6b4',
  dhw_demand: '#fc8181',
};

export const STATE_CYCLE: HourState[] = ['away', 'home', 'dhw_demand'];

// ─── Default pattern ──────────────────────────────────────────────────────────

/**
 * Returns the default 24-hour pattern for a professional double-peak routine:
 *  06–08 → High DHW (morning shower)
 *  09–16 → Away
 *  17–21 → At Home
 *  all other hours → Away
 */
export function defaultHours(): HourState[] {
  return Array.from({ length: 24 }, (_, h) => {
    if (h >= 6 && h <= 8) return 'dhw_demand';
    if (h >= 9 && h <= 16) return 'away';
    if (h >= 17 && h <= 21) return 'home';
    return 'away';
  });
}

/**
 * Cycles to the next HourState in the painter: away → home → dhw_demand → away.
 */
export function nextState(current: HourState): HourState {
  const idx = STATE_CYCLE.indexOf(current);
  return STATE_CYCLE[(idx + 1) % STATE_CYCLE.length];
}

// ─── Physics helpers ──────────────────────────────────────────────────────────

/**
 * Derive hot-water reserve State of Charge (%) hour-by-hour.
 *
 * Tank charges during Octopus Agile off-peak slots (01:00–06:00, +8 %/hr)
 * and from any Solar PV window (10:00–16:00, +5 %/hr).
 * DHW demand is drawn for each 'dhw_demand' hour (−18 %) and 'home' hour (−4 %)
 * UNLESS the delivery mode is electric_cold_only (electric showers never draw
 * from the stored cylinder or combi DHW circuit).
 */
export function mixergySoCByHour(hours: HourState[], deliveryMode: DeliveryMode = 'unknown'): number[] {
  const drawsHotWater = isHotWaterDrawEvent(deliveryMode);
  const soc: number[] = [];
  let current = 60; // start at 60% SoC
  for (let h = 0; h < 24; h++) {
    const isOffPeak = h >= 1 && h <= 5;
    const isSolar = h >= 10 && h <= 15;
    const isHighDhw = hours[h] === 'dhw_demand';
    const isHome = hours[h] === 'home';

    if (isOffPeak) {
      current = Math.min(100, current + 8);
    } else if (isSolar) {
      current = Math.min(100, current + 5);
    } else if (isHighDhw && drawsHotWater) {
      current = Math.max(0, current - 18); // shower / bath draw
    } else if (isHome) {
      current = Math.max(0, current - 4);  // background DHW draw
    }
    soc.push(parseFloat(current.toFixed(1)));
  }
  return soc;
}

/**
 * Boiler "Stepped" Curve – room temperature response (°C).
 *
 * At home : rapid 30 kW recovery; hits ~21 °C combi setpoint.
 * Away    : setback to 16 °C.
 * High DHW: if high-flow delivery (pumped/mixer+pump) is active, DHW competition drops room temp to 17.5 °C.
 *           Electric shower (cold only) does NOT cause a DHW/space-heat conflict.
 */
export function boilerSteppedCurve(hours: HourState[], hasHighFlowDelivery: boolean, deliveryMode: DeliveryMode = 'unknown'): number[] {
  const drawsHotWater = isHotWaterDrawEvent(deliveryMode);
  return hours.map((state, h) => {
    if (state === 'dhw_demand') {
      if (!drawsHotWater) {
        // Electric shower: no hot-water draw → no combi service-switching conflict
        return parseFloat((21 + Math.sin((h / 24) * Math.PI * 2) * 0.5).toFixed(2));
      }
      // combi "service switching": DHW steals heat from space heating
      return hasHighFlowDelivery ? 17.5 : 19.5;
    }
    if (state === 'home') {
      // fast reheat + slight sinusoidal variation across the day
      return parseFloat((21 + Math.sin((h / 24) * Math.PI * 2) * 0.5).toFixed(2));
    }
    return 16; // setback when away
  });
}

/**
 * HP "Horizon" Curve – room temperature stability (°C).
 *
 * Full Job (SPF ≈ 4.2, 35 °C flow) → efficiency factor ≈ 1.0 → flat horizon.
 * Fast Fit (SPF ≈ 3.0, 50 °C flow) → factor ≈ 0.71 → dips on cold mornings.
 */
export function hpHorizonCurve(
  hours: HourState[],
  spfMidpoint: number,
  designFlowTempC: number,
): number[] {
  const efficiencyFactor = spfMidpoint / 4.2;
  return hours.map((state, h) => {
    const base = state === 'away' ? 17 : 20;
    // Cold morning dip when high flow temp reduces efficiency
    const coldDip = h >= 0 && h < 7 ? (1 - efficiencyFactor) * 2 : 0;
    // Additional penalty for high flow temperature (Fast Fit)
    const flowPenalty = designFlowTempC > 45 ? 0.5 : 0;
    return parseFloat((base - coldDip - flowPenalty).toFixed(2));
  });
}
