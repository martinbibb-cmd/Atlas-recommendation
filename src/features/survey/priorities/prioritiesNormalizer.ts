/**
 * prioritiesNormalizer.ts
 *
 * Translates raw PrioritiesState into a normalised, boolean-keyed output that
 * is easy for the insight and recommendation layers to consume.
 *
 * The normalised shape avoids array lookups at the call site — downstream
 * code can do a simple `if (normalised.reliability)` check.
 */

import type { PrioritiesState } from './prioritiesTypes';

// ─── Normalised output ────────────────────────────────────────────────────────

export interface NormalisedPriorities {
  /** Consistent, comfortable heat output is important to this household. */
  performance: boolean;
  /** Minimal breakdowns and long service life are important. */
  reliability: boolean;
  /** Maximising system lifespan and minimising replacements is important. */
  longevity: boolean;
  /** Low-disruption install or changeover is preferred. */
  lowDisruption: boolean;
  /** Reducing carbon footprint is important. */
  eco: boolean;
  /** Energy efficiency over the lifetime is important. */
  runningEfficiency: boolean;
  /** Future compatibility with clean-energy upgrades is important. */
  futureCompatibility: boolean;
  /** True when at least one priority has been selected. */
  hasPriorities: boolean;
  /** Number of priorities selected. */
  count: number;
}

// ─── Normaliser ───────────────────────────────────────────────────────────────

export function normalisePriorities(state: PrioritiesState): NormalisedPriorities {
  const s = new Set(state.selected);
  return {
    performance:       s.has('performance'),
    reliability:       s.has('reliability'),
    longevity:         s.has('longevity'),
    lowDisruption:     s.has('disruption'),
    eco:               s.has('eco'),
    runningEfficiency: s.has('cost_tendency'),
    futureCompatibility: s.has('future_compatibility'),
    hasPriorities:     state.selected.length > 0,
    count:             state.selected.length,
  };
}
