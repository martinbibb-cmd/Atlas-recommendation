import type {
  MixergyLayerState,
  MixergyStratificationInput,
  MixergyStratificationResult,
} from '../schema/EngineInputV2_3';

// ─── Physical constants ────────────────────────────────────────────────────────

/** Specific heat capacity of water (J / kg·°C). */
const CP_WATER_J_PER_KG_C = 4190;

/** Density of water (kg/L). */
const DENSITY_KG_PER_L = 1.0;

/** Number of stratification layers. */
const LAYER_COUNT = 5;

/**
 * Optional inter-layer diffusion fraction applied after advection.
 * Smooths numerically sharp temperature fronts between adjacent layers.
 * A 1 % blend is small enough to not materially shift the thermocline
 * (< 0.1 °C effect per tick at typical gradients) but prevents unbounded
 * step discontinuities from accumulating over long simulations.
 */
const DIFFUSION_FRACTION = 0.01;

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Build an initial MixergyLayerState with a uniform temperature across all layers.
 *
 * @param totalVolumeLitres  Total cylinder volume (litres).
 * @param initialTempC       Starting temperature of all layers (°C).
 */
export function buildInitialMixergyState(
  totalVolumeLitres: number,
  initialTempC: number,
): MixergyLayerState {
  const layerVolLitres = totalVolumeLitres / LAYER_COUNT;
  return {
    temp: [
      initialTempC,
      initialTempC,
      initialTempC,
      initialTempC,
      initialTempC,
    ],
    layerVolLitres,
  };
}

// ─── Core timestep ────────────────────────────────────────────────────────────

/**
 * Mixergy 5-layer stratification model — single timestep.
 *
 * Three sequential processes are applied each call:
 *
 *   **Step A – Draw-off**
 *   Removes `drawLitres` from layer 0 (top draw-off point).  Volume is
 *   shifted upward through the stack (layer 1 → 0, 2 → 1, … ) and
 *   `drawLitres` of cold make-up water at `coldInTempC` is diffused into
 *   layer 4 (base).  This naturally moves the thermocline upward under
 *   heavy draw, matching real Mixergy behaviour.
 *
 *   **Step B – Heating**
 *   Heat energy (kW × dt_s) is injected exclusively into layer 0, matching
 *   the real coil/immersion location in the top ~20 % of the cylinder.
 *
 *   **Step C – Pump recirculation**
 *   The Mixergy pump draws cold water from the base (layer 4) and injects it
 *   over the top of the heat exchanger region (layer 0).  This is modelled as
 *   directional (downward) advection:
 *
 *   ```
 *   for i = 4 downto 1:
 *       temp[i] = (1−f)·temp[i] + f·temp[i−1]
 *   temp[0] = (1−f)·temp[0] + f·temp[4_prior]
 *   ```
 *
 *   where f = clamp(L_p / layerVolLitres, 0, 1) and L_p is the volume pumped
 *   in this timestep.  A 1 % inter-layer diffusion pass is then applied to
 *   avoid numerically sharp fronts.
 *
 *   The net effect: with the pump running, the hot band expands downward
 *   over successive timesteps, matching Mixergy's "State of Charge grows
 *   from the top" marketing claim.
 *
 * @param input  Timestep inputs — see {@link MixergyStratificationInput}.
 * @returns      Updated layer state and derived metrics.
 */
export function stepMixergyStratification(
  input: MixergyStratificationInput,
): MixergyStratificationResult {
  const { state, dtSeconds, drawLitres, coldInTempC, heatPowerKw, pumpFlowLpm, targetDhwTempC } =
    input;

  // Work on a mutable copy so the caller's state object is never mutated.
  const temp: [number, number, number, number, number] = [...state.temp] as [
    number,
    number,
    number,
    number,
    number,
  ];
  const layerVol = state.layerVolLitres;

  // ── Step A: Draw-off ───────────────────────────────────────────────────────
  if (drawLitres > 0) {
    const fraction = Math.min(drawLitres / layerVol, 1);
    // Shift volume upward: each layer i receives a fraction from layer i+1
    // (colder water below fills the depleted layer).
    for (let i = 0; i < LAYER_COUNT - 1; i++) {
      temp[i] = (1 - fraction) * temp[i] + fraction * temp[i + 1];
    }
    // Layer 4 (base) receives cold make-up water via the diffused inlet.
    temp[4] = (1 - fraction) * temp[4] + fraction * coldInTempC;
  }

  // ── Step B: Heating (top layer only) ──────────────────────────────────────
  if (heatPowerKw > 0 && dtSeconds > 0) {
    const massKg = layerVol * DENSITY_KG_PER_L;
    const deltaT = (heatPowerKw * 1000 * dtSeconds) / (massKg * CP_WATER_J_PER_KG_C);
    temp[0] += deltaT;
  }

  // ── Step C: Pump recirculation (directional advection) ────────────────────
  if (pumpFlowLpm > 0 && dtSeconds > 0) {
    const dtMin = dtSeconds / 60;
    const pumpedLitres = pumpFlowLpm * dtMin;
    const f = Math.min(pumpedLitres / layerVol, 1);

    // Capture the pre-advection bottom temperature as the "injected cold"
    // arriving at the top of the HEX region.
    const bottomPrior = temp[4];

    // Directional advection downward (hot zone expands toward the base):
    //   layer i inherits a fraction f from the layer above it (i−1),
    //   effectively pushing the thermocline downward.
    for (let i = LAYER_COUNT - 1; i >= 1; i--) {
      temp[i] = (1 - f) * temp[i] + f * temp[i - 1];
    }
    // Layer 0 receives the cold water that the pump drew from the base,
    // displacing the hottest water down into layer 1.
    temp[0] = (1 - f) * temp[0] + f * bottomPrior;

    // Optional micro-diffusion: 1 % blend between adjacent layers to smooth
    // numerically sharp fronts without materially shifting the thermocline.
    // Layer 0 is deliberately excluded: it is the heat injection zone and the
    // hottest point in a correctly stratified cylinder.  Blending layer 0
    // downward with the cooler layer 1 would incorrectly reduce the delivered
    // outlet temperature.
    for (let i = 1; i < LAYER_COUNT; i++) {
      const blended = (1 - DIFFUSION_FRACTION) * temp[i] + DIFFUSION_FRACTION * temp[i - 1];
      temp[i] = blended;
    }
  }

  // ── Output metrics ─────────────────────────────────────────────────────────
  const deliveredTempC = temp[0];
  const usableThreshold = targetDhwTempC - 5;
  let usableHotLitres = 0;
  for (let i = 0; i < LAYER_COUNT; i++) {
    if (temp[i] >= usableThreshold) {
      usableHotLitres += layerVol;
    }
  }

  const nextState: MixergyLayerState = { temp, layerVolLitres: layerVol };
  return { nextState, deliveredTempC, usableHotLitres };
}
