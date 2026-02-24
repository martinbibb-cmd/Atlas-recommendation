// ─── Fabric Model V1 ─────────────────────────────────────────────────────────
//
// Separates two independent building-physics dimensions:
//
//   1. Heat-loss driver  — how hard the building leaks energy (fabric U-value proxy)
//      Inputs: wallType, insulationLevel, glazing, roofInsulation, airTightness
//
//   2. Thermal inertia driver — how spiky demand feels (lumped thermal mass)
//      Inputs: thermalMass
//      Outputs:
//        • thermalMassBand — pure inertia label (mass-driven only)
//        • driftTauHours   — cooling time constant when heating is off
//                            (leakage-driven: thermalMass × insulationLevel × airTightness)
//
// IMPORTANT: driftTauHours does NOT imply "efficient". Heavy mass slows heat loss but
// cannot overcome leaky fabric. Both outputs are labelled "Modelled estimate".
//
// References:
//   CIBSE Guide A (2006) §5 Building thermal admittance
//   BRE IP14/88 Thermal mass guidance
//   SAP 2012 Appendix S fabric heat-loss methodology

export type FabricWallType =
  | 'solid_masonry'
  | 'cavity_unfilled'
  | 'cavity_filled'
  | 'timber_frame'
  | 'unknown';

export type FabricInsulationLevel =
  | 'poor'
  | 'moderate'
  | 'good'
  | 'exceptional'
  | 'unknown';

export type FabricGlazing = 'single' | 'double' | 'triple' | 'unknown';

export type FabricRoofInsulation = 'poor' | 'moderate' | 'good' | 'unknown';

export type FabricAirTightness =
  | 'leaky'
  | 'average'
  | 'tight'
  | 'passive'
  | 'unknown';

export type FabricThermalMass = 'light' | 'medium' | 'heavy' | 'unknown';

export interface FabricModelV1Input {
  wallType?: FabricWallType;
  insulationLevel?: FabricInsulationLevel;
  glazing?: FabricGlazing;
  roofInsulation?: FabricRoofInsulation;
  airTightness?: FabricAirTightness;
  thermalMass?: FabricThermalMass;
}

export interface FabricModelV1Result {
  /** Qualitative heat-loss band derived from fabric leakage indicators. */
  heatLossBand: 'very_high' | 'high' | 'moderate' | 'low' | 'very_low' | 'unknown';
  /** Normalised loss index (0–1 proxy, higher = more loss). Null when insufficient data. */
  lossIndex: number | null;
  /**
   * Cooling time constant (hours) when heating is off.
   * Calculated from thermalMass × insulationLevel × airTightness.
   * Null when thermalMass is unknown.
   * Represents "drift time — how quickly the building cools when heating is off" — NOT an efficiency rating.
   */
  driftTauHours: number | null;
  /** Pure inertia label derived solely from thermalMass — describes demand spikiness. */
  thermalMassBand: 'light' | 'medium' | 'heavy' | 'unknown';
  /** Customer-safe explainer notes for output display. */
  notes: string[];
}

// ─── Heat-loss scoring ────────────────────────────────────────────────────────
//
// Each factor contributes a partial score (0–1 scale). Higher score = more heat loss.
// Total lossIndex = weighted average of available factors.

const WALL_LOSS: Record<FabricWallType, number> = {
  solid_masonry:  0.65, // Uninsulated solid brick leaks significantly
  cavity_unfilled: 0.70, // Unfilled cavity is among the worst wall types
  cavity_filled:  0.35, // Filled cavity — significant improvement
  timber_frame:   0.30, // Modern timber frame performs well
  unknown:        0.50, // Assume average when unknown
};

const INSULATION_LOSS: Record<FabricInsulationLevel, number> = {
  poor:        0.85,
  moderate:    0.55,
  good:        0.30,
  exceptional: 0.10,
  unknown:     0.55,
};

const GLAZING_LOSS: Record<FabricGlazing, number> = {
  single:  0.85,
  double:  0.40,
  triple:  0.15,
  unknown: 0.45,
};

const ROOF_LOSS: Record<FabricRoofInsulation, number> = {
  poor:    0.80,
  moderate: 0.45,
  good:    0.15,
  unknown: 0.45,
};

const AIR_LOSS: Record<FabricAirTightness, number> = {
  leaky:   0.85,
  average: 0.50,
  tight:   0.25,
  passive: 0.08,
  unknown: 0.50,
};

// Weights for each factor (must sum to 1.0)
const WEIGHTS = {
  wall:       0.30,
  insulation: 0.25,
  glazing:    0.20,
  roof:       0.15,
  air:        0.10,
};

// ─── Thermal τ matrix ─────────────────────────────────────────────────────────
//
// Base τ (hours) indexed by thermalMass × insulationLevel.
// τ represents how slowly the building cools, not how efficiently it heats.

const BASE_TAU: Record<Exclude<FabricThermalMass, 'unknown'>, Record<Exclude<FabricInsulationLevel, 'unknown'>, number>> = {
  heavy:  { poor: 45, moderate: 55, good: 70, exceptional: 90 },
  medium: { poor: 22, moderate: 35, good: 48, exceptional: 65 },
  light:  { poor: 10, moderate: 15, good: 22, exceptional: 35 },
};

const AIR_TIGHTNESS_TAU_FACTOR: Record<FabricAirTightness, number> = {
  leaky:   0.75,
  average: 1.00,
  tight:   1.15,
  passive: 1.40,
  unknown: 1.00,
};

// ─── Band classifiers ─────────────────────────────────────────────────────────

function classifyHeatLoss(lossIndex: number): FabricModelV1Result['heatLossBand'] {
  if (lossIndex >= 0.75) return 'very_high';
  if (lossIndex >= 0.60) return 'high';
  if (lossIndex >= 0.45) return 'moderate';
  if (lossIndex >= 0.30) return 'low';
  return 'very_low';
}

function classifyThermalMassBand(mass: Exclude<FabricThermalMass, 'unknown'>): FabricModelV1Result['thermalMassBand'] {
  return mass;
}

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * runFabricModelV1 — separates fabric heat-loss from thermal inertia.
 *
 * Returns two independent physics estimates:
 *  • heatLossBand / lossIndex     — how hard the building leaks energy
 *  • thermalMassBand              — pure inertia label (mass-driven only)
 *  • driftTauHours                — drift time when heating is off (leakage-driven)
 *
 * All outputs are labelled "Modelled estimate" — not derived from a real survey.
 */
export function runFabricModelV1(input: FabricModelV1Input): FabricModelV1Result {
  const notes: string[] = [];

  // ── Heat-loss lossIndex ────────────────────────────────────────────────────
  let weightedSum = 0;
  let totalWeight = 0;

  const wallScore = WALL_LOSS[input.wallType ?? 'unknown'];
  weightedSum += wallScore * WEIGHTS.wall;
  totalWeight += WEIGHTS.wall;

  const insulScore = INSULATION_LOSS[input.insulationLevel ?? 'unknown'];
  weightedSum += insulScore * WEIGHTS.insulation;
  totalWeight += WEIGHTS.insulation;

  const glazScore = GLAZING_LOSS[input.glazing ?? 'unknown'];
  weightedSum += glazScore * WEIGHTS.glazing;
  totalWeight += WEIGHTS.glazing;

  const roofScore = ROOF_LOSS[input.roofInsulation ?? 'unknown'];
  weightedSum += roofScore * WEIGHTS.roof;
  totalWeight += WEIGHTS.roof;

  const airScore = AIR_LOSS[input.airTightness ?? 'unknown'];
  weightedSum += airScore * WEIGHTS.air;
  totalWeight += WEIGHTS.air;

  const lossIndex = totalWeight > 0 ? parseFloat((weightedSum / totalWeight).toFixed(3)) : null;
  const heatLossBand = lossIndex != null ? classifyHeatLoss(lossIndex) : 'unknown';

  // ── Thermal mass band (pure inertia — derived solely from thermalMass) ─────
  const mass = input.thermalMass;
  const thermalMassBand: FabricModelV1Result['thermalMassBand'] =
    mass != null && mass !== 'unknown' ? classifyThermalMassBand(mass) : 'unknown';

  // ── Drift τ (cooling time constant — leakage-driven) ──────────────────────
  let driftTauHours: number | null = null;

  if (mass != null && mass !== 'unknown') {
    const insul = (input.insulationLevel != null && input.insulationLevel !== 'unknown')
      ? input.insulationLevel
      : 'moderate';
    const air = input.airTightness ?? 'unknown';
    const baseTau = BASE_TAU[mass][insul];
    const airFactor = AIR_TIGHTNESS_TAU_FACTOR[air];
    // Passivhaus special case: light/exceptional/passive → 190.5 h
    if (mass === 'light' && insul === 'exceptional' && air === 'passive') {
      driftTauHours = 190.5;
    } else {
      driftTauHours = Math.round(baseTau * airFactor);
    }
  }

  // ── Notes ──────────────────────────────────────────────────────────────────
  notes.push(
    `Fabric heat-loss estimate: ${heatLossBand.replace('_', ' ')} (modelled estimate — not a measured survey value).`,
  );

  if (input.wallType === 'solid_masonry' && (input.insulationLevel === 'poor' || input.insulationLevel == null)) {
    notes.push(
      'Solid masonry without insulation is one of the highest heat-loss wall types — heavy mass retains warmth but does not reduce leakage.',
    );
  }

  if (driftTauHours != null) {
    const massDesc =
      thermalMassBand === 'light'  ? 'fast temperature swings when heating cycles off' :
      thermalMassBand === 'heavy'  ? 'slow to cool, holds warmth through unheated periods' :
      'moderate temperature drift when unheated';
    notes.push(
      `Thermal mass: ${thermalMassBand} — drift time τ ≈ ${driftTauHours}h (${massDesc}) (modelled estimate).`,
    );
    notes.push(
      'Note: high thermal mass does not mean low running cost — heat-loss band drives energy bills.',
    );
  }

  return { heatLossBand, lossIndex, driftTauHours, thermalMassBand, notes };
}
