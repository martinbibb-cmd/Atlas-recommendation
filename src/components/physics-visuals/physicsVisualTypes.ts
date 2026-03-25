/**
 * physicsVisualTypes.ts
 *
 * Shared type system for the Atlas Physics Visual Library.
 *
 * All animation and explainer components in this library receive data through
 * the contracts defined here. Per-visual prop extensions add only what is
 * genuinely needed above the shared base.
 */

// ─── Visual identifiers ────────────────────────────────────────────────────────

export type PhysicsVisualId =
  | 'heat_particles'
  | 'flow_split'
  | 'solar_mismatch'
  | 'cylinder_charge'
  | 'driving_style'
  | 'bees_vs_tortoise'
  | 'sponge'
  | 'u_gauge'
  | 'trv_flow'
  | 'boiler_cycling'
  | 'flow_restriction'
  | 'radiator_upgrade'
  | 'controls_upgrade';

// ─── Registry entry ────────────────────────────────────────────────────────────

export interface PhysicsVisualDefinition {
  id: PhysicsVisualId;
  title: string;
  purpose: string;
  /** Animation loop duration in milliseconds. */
  defaultDurationMs?: number;
  supportsReducedMotion?: boolean;
  category: 'heat' | 'water' | 'energy' | 'controls' | 'system_behaviour';
}

// ─── Shared visual props ───────────────────────────────────────────────────────

/**
 * Base props received by every visual component.
 * Extend this per visual to add domain-specific inputs.
 */
export interface PhysicsVisualProps {
  /** When true the visual must not auto-play or loop motion. */
  reducedMotion?: boolean;
  /** Controls how much the dominant element is emphasised. */
  emphasis?: 'low' | 'medium' | 'high';
  /** Optional accessible caption rendered below the visual. */
  caption?: string;
}

// ─── Per-visual prop extensions ───────────────────────────────────────────────

export type DrivingStyleMode = 'combi' | 'stored' | 'heat_pump';

export interface DrivingStyleVisualProps extends PhysicsVisualProps {
  /** Which heating behaviour variant to illustrate. */
  mode: DrivingStyleMode;
}

export interface FlowSplitVisualProps extends PhysicsVisualProps {
  /** Number of simultaneously active outlets (1–3). */
  outletsActive: 1 | 2 | 3;
  /** Inlet pressure band that affects stream width. */
  pressureLevel?: 'low' | 'normal' | 'high';
}

export interface SolarMismatchVisualProps extends PhysicsVisualProps {
  /** 0–23 hour index highlighting the current hour of interest. */
  highlightHour?: number;
  /** Whether a storage overlay is shown (for future cylinder variants). */
  showStorageOverlay?: boolean;
}

export interface CylinderChargeVisualProps extends PhysicsVisualProps {
  /**
   * Cylinder fill level as a fraction 0–1.
   * Drives the animated water column height.
   */
  fillLevel?: number;
  /** Emphasises top-down layering for the Mixergy variant. */
  mixergyMode?: boolean;
}

// ─── Script contract ───────────────────────────────────────────────────────────

/**
 * Short explanatory copy tied to a single visual.
 * Kept brief and dyslexia-friendly — one idea per bullet.
 */
export interface PhysicsVisualScript {
  title: string;
  summary: string;
  bullets?: string[];
  takeaway?: string;
}
