import type {
  ThermalInertiaInput,
  ThermalInertiaResult,
  ThermalInertiaDataPoint,
} from '../schema/EngineInputV2_3';

// ─── Thermal Time Constant Matrix ─────────────────────────────────────────────
//
// The thermal time constant (τ) describes how quickly a building loses heat
// when the heating source is off.  A larger τ means the fabric retains heat
// longer before the indoor temperature decays to the outdoor ambient.
//
//  Solid Brick (1930s): High thermal mass from ~225 mm solid brick walls.
//    Heat is stored in the masonry itself.  τ ≈ 55 hours.
//    Consequence: slow to heat up, but holds warmth effectively all day.
//
//  Lightweight / New Build: Low thermal mass from timber frame, cavity wall,
//    and lightweight blockwork.  τ ≈ 15 hours.
//    Consequence: fast response, but rapid temperature decay when unheated.
//
// Source: CIBSE Guide A (2006) – Table 5.13 building thermal admittance;
//         BRE Information Paper IP14/88; Thermal mass modelling guidance.

const TAU_HOURS: Record<ThermalInertiaInput['fabricType'], number> = {
  solid_brick_1930s: 55,
  '1970s_cavity_wall': 35,
  lightweight_new: 15,
  passivhaus_standard: 190.5,
};

const FABRIC_LABEL: Record<ThermalInertiaInput['fabricType'], string> = {
  solid_brick_1930s: '1930s solid brick semi',
  '1970s_cavity_wall': '1970s cavity wall semi',
  lightweight_new: 'lightweight / new-build flat',
  passivhaus_standard: 'Passivhaus super-insulated build',
};

/** Default away-all-day unheated window (hours) for the Professional profile. */
const PROFESSIONAL_AWAY_HOURS = 10; // 08:00 → 18:00

/**
 * Typical inter-cycle gap (hours) when someone is home all day.
 * Heating fires briefly then shuts off; the building coasts for ~2 hours
 * before the next cycle.
 */
const HOME_ALL_DAY_CYCLE_HOURS = 2;

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * ThermalInertiaModule – Building Fabric Decay Simulator
 *
 * Uses the lumped-capacitance exponential decay model to predict indoor
 * temperature over an unheated period:
 *
 *   T(t) = T_outdoor + (T_initial − T_outdoor) × e^(−t / τ)
 *
 * This lets the POC demonstrate, side-by-side, how a 1930s solid-brick home
 * retains heat through the working day while a lightweight new-build drops
 * rapidly towards the outdoor ambient.
 *
 * @param input  Fabric type, occupancy profile, and temperature boundary conditions.
 */
export function runThermalInertiaModule(input: ThermalInertiaInput): ThermalInertiaResult {
  const notes: string[] = [];

  const tau = TAU_HOURS[input.fabricType];
  const label = FABRIC_LABEL[input.fabricType];

  const hours =
    input.unheatedHours != null
      ? input.unheatedHours
      : input.occupancyProfile === 'professional'
        ? PROFESSIONAL_AWAY_HOURS
        : HOME_ALL_DAY_CYCLE_HOURS;

  const { initialTempC, outdoorTempC } = input;
  const deltaT = initialTempC - outdoorTempC;

  // ── Generate hour-by-hour temperature trace ───────────────────────────────
  const trace: ThermalInertiaDataPoint[] = [];
  for (let h = 0; h <= hours; h++) {
    const tempC = parseFloat(
      (outdoorTempC + deltaT * Math.exp(-h / tau)).toFixed(1),
    );
    trace.push({ hourOffset: h, tempC });
  }

  const finalTempC = trace[trace.length - 1].tempC;
  const totalDropC = parseFloat((initialTempC - finalTempC).toFixed(1));

  // ── Notes ─────────────────────────────────────────────────────────────────
  notes.push(
    `🏠 Building fabric: ${label}. Thermal time constant τ = ${tau} hours.`,
  );
  notes.push(
    `🌡️ Starting temperature: ${initialTempC}°C. Outdoor: ${outdoorTempC}°C. ` +
    `Unheated window: ${hours} hours.`,
  );
  notes.push(
    `📉 After ${hours} hours the indoor temperature drops by ${totalDropC}°C ` +
    `to ${finalTempC}°C.`,
  );

  if (input.fabricType === 'lightweight_new' && finalTempC < 16) {
    notes.push(
      `⚠️ Comfort alert: indoor temperature falls to ${finalTempC}°C during the away period. ` +
      `This is below the 16°C WHO minimum comfort threshold and will feel cold on return. ` +
      `A Hive smart thermostat with "Eco Away" mode can prevent over-shooting the reheat.`,
    );
  }

  // ── Narrative ─────────────────────────────────────────────────────────────
  const narrative = buildNarrative(input, label, tau, hours, finalTempC, totalDropC);

  return { tauHours: tau, finalTempC, totalDropC, trace, narrative, notes };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNarrative(
  input: ThermalInertiaInput,
  label: string,
  tau: number,
  hours: number,
  finalTempC: number,
  totalDropC: number,
): string {
  const profileLabel =
    input.occupancyProfile === 'professional' ? 'Professional (Away All Day)' : 'Home All Day';

  if (input.fabricType === 'solid_brick_1930s') {
    return (
      `${profileLabel} profile – ${label} (τ = ${tau} h): ` +
      `The heavy masonry retains the morning heat effectively. ` +
      `After ${hours} hours without heating the indoor temperature drops by only ${totalDropC}°C ` +
      `to ${finalTempC}°C – well within the comfort band. ` +
      `The high thermal inertia reduces peak gas demand because the building is still warm when occupants return.`
    );
  } else if (input.fabricType === '1970s_cavity_wall') {
    return (
      `${profileLabel} profile – ${label} (τ = ${tau} h): ` +
      `The cavity wall construction offers moderate thermal storage. ` +
      `After ${hours} hours without heating the indoor temperature drops by ${totalDropC}°C ` +
      `to ${finalTempC}°C. ` +
      `A Hive smart schedule can pre-heat this building efficiently before occupants return, ` +
      `avoiding unnecessary heat loss during extended unoccupied periods.`
    );
  } else if (input.fabricType === 'passivhaus_standard') {
    return (
      `${profileLabel} profile – ${label} (τ = ${tau} h): ` +
      `The super-insulated Passivhaus fabric retains heat exceptionally well. ` +
      `After ${hours} hours without heating the indoor temperature drops by only ${totalDropC}°C ` +
      `to ${finalTempC}°C – far above the comfort threshold. ` +
      `The very high thermal inertia makes this building ideal for "low and slow" heat pump operation.`
    );
  } else {
    return (
      `${profileLabel} profile – ${label} (τ = ${tau} h): ` +
      `The lightweight fabric offers little thermal storage. ` +
      `After ${hours} hours without heating the indoor temperature drops by ${totalDropC}°C ` +
      `to ${finalTempC}°C. ` +
      `${finalTempC < 16
        ? `At ${finalTempC}°C the home is cold on return and requires a high-power reheat burst, ` +
          `which increases peak gas demand and reduces boiler efficiency.`
        : `Smart scheduling (e.g. Hive Active Heating) can pre-heat this building efficiently ` +
          `before occupants return.`
      }`
    );
  }
}
