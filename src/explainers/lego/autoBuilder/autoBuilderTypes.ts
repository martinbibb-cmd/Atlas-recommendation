/**
 * autoBuilderTypes.ts
 *
 * Type definitions for the System Architecture Visualiser auto-builder.
 *
 * The auto-builder translates a SystemConceptModel (or a SystemBuilderState)
 * into a flat list of SystemModules that the visualiser renders as
 * schematic blocks arranged in four layers:
 *
 *   Layer 1 — Heat source
 *   Layer 2 — Controls topology
 *   Layer 3 — DHW storage
 *   Layer 4 — Emitters
 *
 * In compare mode each module carries a state tag (kept / removed / added /
 * future_ready) that drives a colour overlay so users can see what changes.
 */

// ─── Module roles ─────────────────────────────────────────────────────────────

/** Which architectural layer this module belongs to. */
export type ModuleRole = 'heat_source' | 'controls' | 'dhw_storage' | 'emitters';

// ─── Module states ────────────────────────────────────────────────────────────

/**
 * ModuleState — visual state of a module in the three view modes.
 *
 *  current      — shown in the current-system view (no diff)
 *  recommended  — shown in the recommended-system view (no diff)
 *  kept         — unchanged between current and recommended (compare mode)
 *  removed      — present in current, absent in recommended (compare mode)
 *  added        — absent in current, present in recommended (compare mode)
 *  future_ready — not part of the recommended install, but the system is
 *                 prepared for it (compare mode — upgrade pathway)
 */
export type ModuleState =
  | 'current'
  | 'recommended'
  | 'kept'
  | 'removed'
  | 'added'
  | 'future_ready';

// ─── Module visual IDs ────────────────────────────────────────────────────────

/**
 * ModuleVisualId — canonical rendering identifier for the SVG graphic.
 *
 * Heat source layer
 *   regular_boiler     — open-vented boiler with feed-and-expansion tank
 *   system_boiler      — sealed-system boiler (integrated pump + expansion)
 *   combi_boiler       — system boiler with integrated plate HEX
 *   heat_pump          — air/ground source heat pump unit
 *
 * Controls layer
 *   y_plan             — 3-port mid-position diverter valve
 *   s_plan             — pair of 2-port zone valves
 *   s_plan_multi_zone  — S-plan with additional CH zones
 *   hp_diverter        — heat pump low-loss header / buffer arrangement
 *   controls_integral  — no external controls (combi — integral)
 *
 * DHW storage layer
 *   vented_cylinder    — open-vented (tank-fed) indirect cylinder
 *   unvented_cylinder  — mains-pressure sealed indirect cylinder
 *   mixergy_cylinder   — Mixergy stratified cylinder (mains-pressure)
 *   combi_on_demand    — no storage — on-demand via combi plate HEX
 *
 * Emitters layer
 *   radiators          — conventional panel radiators
 *   ufh                — underfloor heating loops
 *   mixed_emitters     — combination of radiators and UFH
 *
 * Future pathway items
 *   solar_connection   — solar thermal or PV-diverter connection point
 *   heat_pump_ready    — future ASHP upgrade pathway (emitter or primary prep)
 */
export type ModuleVisualId =
  // Heat source
  | 'regular_boiler'
  | 'system_boiler'
  | 'combi_boiler'
  | 'heat_pump'
  // Controls
  | 'y_plan'
  | 's_plan'
  | 's_plan_multi_zone'
  | 'hp_diverter'
  | 'controls_integral'
  // DHW storage
  | 'vented_cylinder'
  | 'unvented_cylinder'
  | 'mixergy_cylinder'
  | 'combi_on_demand'
  // Emitters
  | 'radiators'
  | 'ufh'
  | 'mixed_emitters'
  // Future pathway
  | 'solar_connection'
  | 'heat_pump_ready';

// ─── System module ─────────────────────────────────────────────────────────────

/**
 * SystemModule — one schematic block in the architecture visualiser.
 *
 * Each module maps to one position in the four-layer layout.  In compare mode
 * the `state` field drives a colour / badge overlay:
 *
 *   kept         → neutral grey   (no change)
 *   removed      → red fade-out   (no longer in the system)
 *   added        → green highlight (new in the recommended system)
 *   future_ready → dashed blue    (pathway, not installed)
 */
export interface SystemModule {
  /** Stable unique identifier for React keys. */
  id: string;
  /** Which architectural layer this module belongs to. */
  role: ModuleRole;
  /** SVG graphic identifier. */
  visualId: ModuleVisualId;
  /** Primary display label. */
  label: string;
  /** Optional secondary detail line (e.g. "Mains-pressure", "Tank-fed"). */
  sublabel?: string;
  /**
   * Visual state of this module.
   * In single-system views (current / recommended) all modules share
   * the same state.  In compare mode each module has its own state.
   */
  state: ModuleState;
}

// ─── System module set ────────────────────────────────────────────────────────

/**
 * SystemModuleSet — ordered flat list of SystemModules for one system.
 *
 * Modules are ordered: heat_source → controls → dhw_storage → emitters →
 * then any future_ready pathway items.
 */
export type SystemModuleSet = SystemModule[];

// ─── Diff result ──────────────────────────────────────────────────────────────

/**
 * SystemDiff — result of diffing a current system against a recommended one.
 *
 * Contains two parallel lists:
 *  - `current`     — modules for the left/top panel (with removed/kept state)
 *  - `recommended` — modules for the right/bottom panel (with kept/added/
 *                    future_ready state)
 *
 * Modules that exist in both systems with the same role are tagged 'kept' in
 * both lists.  Modules that disappear are tagged 'removed' in current and are
 * absent from recommended (or vice versa for 'added' modules).
 */
export interface SystemDiff {
  current: SystemModuleSet;
  recommended: SystemModuleSet;
}

// ─── Visualiser props ─────────────────────────────────────────────────────────

/**
 * Visualiser display mode.
 *
 *  current        — render the customer's existing system only
 *  recommendation — render the recommended replacement / upgrade system only
 *  compare        — side-by-side diff with kept/removed/added/future_ready overlays
 */
export type VisualiserMode = 'current' | 'recommendation' | 'compare';
