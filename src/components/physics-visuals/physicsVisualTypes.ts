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

// ─── Display mode ──────────────────────────────────────────────────────────────

/**
 * Three-state display contract shared by every visual.
 *
 *   preview  — gallery / demo thumbnail (current default)
 *   inline   — compact version used inside a presentation page
 *   focus    — expanded interactive version with full copy
 */
export type VisualDisplayMode = 'preview' | 'inline' | 'focus';

// ─── Registry entry ────────────────────────────────────────────────────────────

export interface PhysicsVisualDefinition {
  id: PhysicsVisualId;
  title: string;
  /** One-sentence plain-English concept statement. */
  concept: string;
  /** Longer developer-facing description of what the visual illustrates. */
  purpose: string;
  /** Animation loop duration in milliseconds. */
  defaultDurationMs?: number;
  supportsReducedMotion?: boolean;
  category: 'heat' | 'water' | 'energy' | 'controls' | 'system_behaviour';
  /** Which display modes this visual fully supports. */
  displayModes: VisualDisplayMode[];
  /** Whether the visual has interactive controls (e.g. sliders, toggles). */
  supportsInteraction?: boolean;
  /**
   * Presentation page types where this visual is appropriate.
   * Used by the page layer to select visuals declaratively.
   */
  applicablePages?: string[];
  /**
   * System families this visual is relevant to.
   * Matches the family identifiers used by the recommendation engine.
   */
  applicableSystemFamilies?: string[];
  /**
   * Engine signal keys that trigger or enrich this visual.
   * Used for future signal-driven visual selection.
   */
  applicableSignalTypes?: string[];
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
  /**
   * Display context. Defaults to 'preview' when omitted.
   *   inline  — compact layout for use inside a presentation page
   *   focus   — expanded layout with full interactive controls
   *   preview — default gallery/demo size
   */
  displayMode?: VisualDisplayMode;
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

export interface HeatParticlesVisualProps extends PhysicsVisualProps {
  /**
   * Wall construction type — affects how quickly particles conduct
   * through the wall section.
   */
  wallType?: 'solid_masonry' | 'cavity_insulated' | 'cavity_uninsulated';
}

// ─── Script contract ───────────────────────────────────────────────────────────

/**
 * Short explanatory copy tied to a single visual.
 * Kept brief and dyslexia-friendly — one idea per bullet.
 *
 * focusCopy is optional longer prose shown only in focus mode.
 */
export interface PhysicsVisualScript {
  title: string;
  summary: string;
  bullets?: string[];
  takeaway?: string;
  /** Extended copy shown only in focus display mode. */
  focusCopy?: string;
}
