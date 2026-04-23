/**
 * VisualRegistry.tsx — Declarative visual registry for the CustomerDeck renderer.
 *
 * Maps a VisualBlock's `visualKey` to a React element (artwork, icon, or accent
 * colour) that the CustomerDeck renders in the large visual area of each page.
 *
 * Design rules:
 *   - All entries are static look-ups; no render logic lives here.
 *   - visualKey values are semantic identifiers derived from AtlasDecisionV1 /
 *     ScenarioResult. They are never computed inside this file.
 *   - Unknown keys fall back to a neutral placeholder — the deck never crashes.
 *   - Do NOT import recommendation logic here.
 */

import type { VisualBlock } from '../../../contracts/VisualBlock';

// ─── Entry shape ──────────────────────────────────────────────────────────────

export interface VisualEntry {
  /** Emoji glyph or SVG string shown in the large visual area. */
  icon: string;
  /** Accent colour used for the block background gradient and icon ring. */
  accentColor: string;
  /** Accessible description of the visual for screen readers. */
  ariaLabel: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const VISUAL_REGISTRY: Record<string, VisualEntry> = {
  // Hero keys
  heat_pump_hero:             { icon: '🌿', accentColor: '#059669', ariaLabel: 'Heat pump system' },
  system_boiler_hero:         { icon: '🔵', accentColor: '#2563eb', ariaLabel: 'System boiler with cylinder' },
  combi_boiler_hero:          { icon: '🔥', accentColor: '#dc2626', ariaLabel: 'Combination boiler' },
  regular_boiler_hero:        { icon: '🏠', accentColor: '#7c3aed', ariaLabel: 'Regular boiler system' },

  // Problem keys
  ashp_pipe_limit_problem:    { icon: '⚠️', accentColor: '#d97706', ariaLabel: 'Pipe diameter constraint' },
  combi_flow_risk_problem:    { icon: '💧', accentColor: '#ef4444', ariaLabel: 'Simultaneous demand risk' },
  pressure_low_problem:       { icon: '📉', accentColor: '#f59e0b', ariaLabel: 'Low mains pressure' },
  high_temp_required_problem: { icon: '🌡️', accentColor: '#ea580c', ariaLabel: 'High flow temperature required' },

  // Solution keys
  stored_hot_water_solution:  { icon: '💧', accentColor: '#0284c7', ariaLabel: 'Stored hot water solution' },
  heat_pump_solution:         { icon: '🌿', accentColor: '#059669', ariaLabel: 'Heat pump solution' },
  combi_solution:             { icon: '🔥', accentColor: '#dc2626', ariaLabel: 'Combi boiler solution' },
  mixergy_solution:           { icon: '⚡', accentColor: '#7c3aed', ariaLabel: 'Mixergy smart cylinder' },

  // Warning / lifecycle keys
  boiler_lifecycle_warning:   { icon: '⏰', accentColor: '#d97706', ariaLabel: 'Boiler approaching end of life' },
  boiler_at_risk_warning:     { icon: '🔴', accentColor: '#dc2626', ariaLabel: 'Boiler at risk of failure' },
  compatibility_warning:      { icon: '🔧', accentColor: '#9333ea', ariaLabel: 'Compatibility note' },

  // Facts keys
  home_facts:                 { icon: '📊', accentColor: '#0369a1', ariaLabel: 'Home facts and data' },
  energy_facts:               { icon: '⚡', accentColor: '#ca8a04', ariaLabel: 'Energy performance data' },

  // Daily-use keys
  daily_use_heat_pump:        { icon: '🌿', accentColor: '#059669', ariaLabel: 'Heat pump daily experience' },
  daily_use_stored_hw:        { icon: '🚿', accentColor: '#0284c7', ariaLabel: 'Stored hot water daily experience' },
  daily_use_combi:            { icon: '🔥', accentColor: '#dc2626', ariaLabel: 'Combi boiler daily experience' },

  // Included-scope keys
  included_scope_standard:    { icon: '✅', accentColor: '#16a34a', ariaLabel: 'Included installation scope' },

  // Future-upgrade keys
  future_upgrade_solar:       { icon: '☀️', accentColor: '#ca8a04', ariaLabel: 'Solar upgrade pathway' },
  future_upgrade_ev:          { icon: '🚗', accentColor: '#2563eb', ariaLabel: 'EV-ready upgrade pathway' },
  future_upgrade_heat_pump:   { icon: '🌿', accentColor: '#059669', ariaLabel: 'Heat pump upgrade pathway' },
  future_upgrade_paths:       { icon: '🔮', accentColor: '#7c3aed', ariaLabel: 'Future upgrade options' },

  // Portal CTA key
  portal_cta:                 { icon: '📱', accentColor: '#0ea5e9', ariaLabel: 'Customer portal' },
};

// ─── Fallback ─────────────────────────────────────────────────────────────────

const FALLBACK_ENTRY: VisualEntry = {
  icon: '🏡',
  accentColor: '#64748b',
  ariaLabel: 'Recommendation visual',
};

// ─── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Returns the VisualEntry for the given visualKey.
 * Falls back to a neutral placeholder when the key is not registered,
 * so the deck never crashes on an unknown key.
 */
export function getVisualEntry(visualKey: string): VisualEntry {
  return VISUAL_REGISTRY[visualKey] ?? FALLBACK_ENTRY;
}

/**
 * Convenience wrapper: resolves the entry directly from a VisualBlock.
 */
export function getVisualEntryForBlock(block: Pick<VisualBlock, 'visualKey'>): VisualEntry {
  return getVisualEntry(block.visualKey);
}

export default VISUAL_REGISTRY;
