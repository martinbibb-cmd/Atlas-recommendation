/**
 * explainerRegistry.ts
 *
 * PR5 — Single source of truth for explainer metadata.
 *
 * Each entry declares an explainer's category, placement kind, and the
 * engine signals that make it relevant to a given recommendation.
 *
 * Rules:
 *   - presentation layer only: no engine/scoring changes.
 *   - category must match the EducationalExplainer category in content.ts.
 *   - relevanceTriggers are engine explainer IDs (from engineOutput.explainers).
 *   - kind 'inline' → shown only via "Learn why" links, never in hamburger library.
 *   - kind 'menu'   → shown in hamburger library only.
 *   - kind 'both'   → shown in both contexts.
 */

import type { ExplainerCategory } from '../../explainers/educational/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExplainerKind = 'inline' | 'menu' | 'both';

/**
 * Registry entry for a single educational explainer.
 *
 * Bridges the educational explainer content (educational/content.ts) with
 * placement rules and relevance signals.
 */
export interface ExplainerDefinition {
  /** Must match an id in EDUCATIONAL_EXPLAINERS. */
  id: string;
  /** Short customer-facing title (matches EducationalExplainer.title). */
  title: string;
  /** Topic category for hamburger grouping. */
  category: ExplainerCategory;
  /**
   * Where this explainer is surfaced:
   *   'inline'  — only via behaviour-card "Learn why" links
   *   'menu'    — only in the hamburger library
   *   'both'    — both inline and in the library
   */
  kind: ExplainerKind;
  /**
   * Component identifier — the EducationalExplainer id that renders this topic.
   * Usually the same as `id`; kept explicit to support future aliasing.
   */
  component: string;
  /**
   * Engine explainer IDs (from engineOutput.explainers) that make this
   * explainer relevant to the current recommendation. When any of these
   * signals are present, this explainer surfaces under "For this
   * recommendation" in the overlay.
   */
  relevanceTriggers?: readonly string[];
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Central registry of all educational explainers with their placement and
 * relevance metadata.
 *
 * Ordering within this array determines the display order within each
 * category group in the hamburger menu.
 */
export const EXPLAINER_REGISTRY: readonly ExplainerDefinition[] = [
  // ── Water and hot water behaviour ────────────────────────────────────────
  {
    id: 'on_demand_vs_stored',
    title: 'On-demand vs stored hot water',
    category: 'water',
    kind: 'both',
    component: 'on_demand_vs_stored',
    relevanceTriggers: ['stored-mixergy-suggested', 'stored-cylinder-condition'],
  },
  {
    id: 'shared_mains_flow',
    title: 'Why flow is shared across your home',
    category: 'water',
    kind: 'both',
    component: 'shared_mains_flow',
  },
  {
    id: 'pressure_vs_flow',
    title: 'Pressure and flow rate',
    category: 'water',
    kind: 'menu',
    component: 'pressure_vs_flow',
  },
  {
    id: 'multiple_taps',
    title: 'Why simultaneous outlets matter',
    category: 'water',
    kind: 'both',
    component: 'multiple_taps',
  },
  {
    id: 'standard_vs_mixergy',
    title: 'Standard cylinder vs Mixergy',
    category: 'water',
    kind: 'both',
    component: 'standard_vs_mixergy',
    relevanceTriggers: ['stored-mixergy-suggested'],
  },
  {
    id: 'cylinder_age_condition',
    title: 'Why cylinder age and condition matter',
    category: 'water',
    kind: 'menu',
    component: 'cylinder_age_condition',
    relevanceTriggers: ['stored-cylinder-condition'],
  },

  // ── Energy and running style ──────────────────────────────────────────────
  {
    id: 'low_and_slow',
    title: 'Why some systems work best low and slow',
    category: 'energy',
    kind: 'both',
    component: 'low_and_slow',
    relevanceTriggers: ['hydraulic-ashp-flow'],
  },
  {
    id: 'cycling_efficiency',
    title: 'Why boiler cycling hurts efficiency',
    category: 'energy',
    kind: 'menu',
    component: 'cycling_efficiency',
    relevanceTriggers: ['condensing-compromised'],
  },
  {
    id: 'condensing_return_temp',
    title: 'Why condensing mode needs a low return temperature',
    category: 'energy',
    kind: 'menu',
    component: 'condensing_return_temp',
    relevanceTriggers: ['condensing-compromised'],
  },
  {
    id: 'heat_pump_flow_temp',
    title: 'Why heat pumps prefer low flow temperatures',
    category: 'energy',
    kind: 'menu',
    component: 'heat_pump_flow_temp',
    relevanceTriggers: ['hydraulic-ashp-flow'],
  },

  // ── Heating behaviour (physics + system_behaviour) ────────────────────────
  {
    id: 'thermal_mass_inertia',
    title: 'How building mass shapes your heating strategy',
    category: 'physics',
    kind: 'menu',
    component: 'thermal_mass_inertia',
    relevanceTriggers: ['thermal-mass-heavy'],
  },
  {
    id: 'splan_vs_yplan',
    title: 'S-plan vs Y-plan zone control',
    category: 'system_behaviour',
    kind: 'menu',
    component: 'splan_vs_yplan',
    relevanceTriggers: ['splan-confirmed'],
  },

  // ── Space and installation ────────────────────────────────────────────────
  {
    id: 'pipe_capacity',
    title: 'Why primary pipe size limits heat pump output',
    category: 'space',
    kind: 'menu',
    component: 'pipe_capacity',
    relevanceTriggers: ['hydraulic-ashp-flow'],
  },
  {
    id: 'water_quality_scale',
    title: 'How water hardness affects heating system life',
    category: 'space',
    kind: 'menu',
    component: 'water_quality_scale',
    relevanceTriggers: ['water-hardness'],
  },

  // ── Building physics and airflow ──────────────────────────────────────────
  {
    id: 'convection_airflow',
    title: 'How opening windows moves heat — not just air',
    category: 'physics',
    kind: 'both',
    component: 'convection_airflow',
    relevanceTriggers: ['thermal-mass-heavy'],
  },

  // ── Analogy explainers ────────────────────────────────────────────────────
  {
    id: 'sponge_heat_transfer',
    title: 'How heat pumps absorb energy from the air',
    category: 'analogy',
    kind: 'both',
    component: 'sponge_heat_transfer',
    relevanceTriggers: ['hydraulic-ashp-flow'],
  },
  {
    id: 'cars_running_style',
    title: 'Burst vs steady: how heating systems differ',
    category: 'analogy',
    kind: 'both',
    component: 'cars_running_style',
    relevanceTriggers: ['condensing-compromised', 'thermal-mass-heavy'],
  },
  {
    id: 'bees_energy_sources',
    title: 'Why energy sources behave differently',
    category: 'analogy',
    kind: 'both',
    component: 'bees_energy_sources',
    relevanceTriggers: ['hydraulic-ashp-flow', 'condensing-compromised'],
  },
] as const;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Returns the registry entry for a given explainer id, or undefined. */
export function getRegistryEntry(id: string): ExplainerDefinition | undefined {
  return EXPLAINER_REGISTRY.find(e => e.id === id);
}
