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

// ─── Budget sensitivity ───────────────────────────────────────────────────────

/**
 * How sensitive the customer is to upfront installation cost.
 *  - 'price_sensitive'  — Keep costs down; lower upfront spend preferred.
 *  - 'balanced'         — Willing to invest for better performance/value.
 *  - 'long_term'        — Will spend more now to reduce running costs over time.
 *  - 'unknown'          — Not yet captured.
 */
export type BudgetSensitivity =
  | 'price_sensitive'
  | 'balanced'
  | 'long_term'
  | 'unknown';

// ─── Disruption tolerance ─────────────────────────────────────────────────────

/**
 * How much installation disruption the customer will tolerate.
 *  - 'minimal'       — As little disruption as possible; like-for-like swap preferred.
 *  - 'some_ok'       — Some works acceptable; willing to have trades in for a few days.
 *  - 'open_to_major' — Open to enabling works, pipe runs, or a larger project.
 *  - 'unknown'       — Not yet captured.
 */
export type CustomerDisruptionTolerance =
  | 'minimal'
  | 'some_ok'
  | 'open_to_major'
  | 'unknown';

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
 *
 * Also captures future plans (loft conversion, extra bathroom, heat pump
 * interest) and customer constraints (budget sensitivity, disruption
 * tolerance).  These are stored here because they represent what the
 * customer wants, not physics facts about the property.
 */
export interface PrioritiesState {
  selected: PriorityKey[];
  // ── Future plans ────────────────────────────────────────────────────────
  /** Whether a loft conversion is planned (or has been completed). Wired to futureLoftConversion. */
  futureLoftConversion?: boolean | null;
  /** Whether an additional bathroom is planned. Wired to futureAddBathroom. */
  futureAddBathroom?: boolean | null;
  /** Whether the customer has expressed interest in a heat pump in future. */
  heatPumpInterest?: boolean | null;
  // ── Customer constraints ─────────────────────────────────────────────────
  /** How sensitive the customer is to upfront installation cost. */
  budgetSensitivity?: BudgetSensitivity;
  /** How much installation disruption the customer will tolerate. Wired to preferences.disruptionTolerance. */
  disruptionTolerance?: CustomerDisruptionTolerance;
}

export const INITIAL_PRIORITIES_STATE: PrioritiesState = {
  selected: [],
  futureLoftConversion: null,
  futureAddBathroom: null,
  heatPumpInterest: null,
  budgetSensitivity: 'unknown',
  disruptionTolerance: 'unknown',
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

// ─── Budget sensitivity metadata ─────────────────────────────────────────────

export interface BudgetSensitivityMeta {
  value: BudgetSensitivity;
  label: string;
  sub: string;
  emoji: string;
}

export const BUDGET_SENSITIVITY_META: BudgetSensitivityMeta[] = [
  {
    value: 'price_sensitive',
    label: 'Keep costs down',
    sub:   'Lower upfront spend is important — like-for-like or budget option preferred',
    emoji: '💰',
  },
  {
    value: 'balanced',
    label: 'Balanced investment',
    sub:   'Willing to invest a little more for better performance or reliability',
    emoji: '⚖️',
  },
  {
    value: 'long_term',
    label: 'Long-term value',
    sub:   'Spend more now to reduce running costs and replacements over time',
    emoji: '📈',
  },
];

// ─── Disruption tolerance metadata ───────────────────────────────────────────

export interface DisruptionToleranceMeta {
  value: CustomerDisruptionTolerance;
  label: string;
  sub: string;
  emoji: string;
}

export const DISRUPTION_TOLERANCE_META: DisruptionToleranceMeta[] = [
  {
    value: 'minimal',
    label: 'Minimal disruption',
    sub:   'Prefer a straightforward swap — keep trades in and out as quickly as possible',
    emoji: '🏃',
  },
  {
    value: 'some_ok',
    label: 'Some disruption OK',
    sub:   'Happy to have trades in for a few days for the right result',
    emoji: '🔨',
  },
  {
    value: 'open_to_major',
    label: 'Open to major works',
    sub:   'Prepared for enabling works, new pipe runs, or a more involved project',
    emoji: '🏗️',
  },
];
