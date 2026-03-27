/**
 * prioritiesTypes.ts
 *
 * UI state model for the Priorities / Objectives step.
 *
 * Captures what matters most to this household so the insight page and
 * recommendation layer can surface the most relevant reasons first —
 * without overriding physics-based suitability rankings.
 *
 * Design:
 *   Seven priority dimensions, each toggled on/off by the user.
 *   Users select the ones that matter — no forced ranking, no pricing language.
 *   Unselected priorities are treated as standard (not deprioritised, just
 *   not highlighted).
 */

// ─── Priority keys ────────────────────────────────────────────────────────────

export type PriorityKey =
  | 'performance'
  | 'reliability'
  | 'longevity'
  | 'disruption'
  | 'eco'
  | 'cost_tendency'
  | 'future_compatibility';

// ─── UI state ─────────────────────────────────────────────────────────────────

/**
 * PrioritiesState
 *
 * A simple set of selected priority keys.  The user taps chips to add or
 * remove priorities.  An empty array means no priorities have been captured
 * yet (not that none matter — treat downstream as "unknown").
 */
export interface PrioritiesState {
  selected: PriorityKey[];
}

export const INITIAL_PRIORITIES_STATE: PrioritiesState = {
  selected: [],
};

// ─── Priority metadata ────────────────────────────────────────────────────────

export interface PriorityMeta {
  key: PriorityKey;
  label: string;
  sub: string;
  emoji: string;
}

export const PRIORITY_META: PriorityMeta[] = [
  {
    key: 'performance',
    label: 'Heating performance',
    sub: 'Consistent, responsive heat output throughout the home',
    emoji: '🌡️',
  },
  {
    key: 'reliability',
    label: 'Reliability',
    sub: 'Lower breakdown risk and dependable day-to-day operation',
    emoji: '🔒',
  },
  {
    key: 'longevity',
    label: 'System longevity',
    sub: 'Built to last — minimise the need for future replacements',
    emoji: '⏳',
  },
  {
    key: 'disruption',
    label: 'Minimal disruption',
    sub: 'Prefer simpler, less-invasive installation and changeover',
    emoji: '🏠',
  },
  {
    key: 'eco',
    label: 'Low carbon',
    sub: 'Reduce carbon footprint and overall energy consumption',
    emoji: '🌱',
  },
  {
    key: 'cost_tendency',
    label: 'Running efficiency',
    sub: 'Maximise energy efficiency over the system\'s lifetime',
    emoji: '⚡',
  },
  {
    key: 'future_compatibility',
    label: 'Future compatibility',
    sub: 'Compatible with clean-energy upgrades and evolving standards',
    emoji: '🔮',
  },
];
