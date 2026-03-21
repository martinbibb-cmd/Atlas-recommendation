/**
 * Educational explainer data model.
 *
 * Each explainer is a concise, self-contained 1-minute topic that supports
 * user understanding of Atlas recommendations.  They are distinct from
 * What-If myth-busting scenarios, which challenge specific edge-case
 * assumptions.
 *
 * Terminology must comply with docs/atlas-terminology.md.
 */

/**
 * Topic category for hamburger grouping and relevance filtering.
 *
 *   physics         — building heat-loss and thermal behaviour
 *   energy          — efficiency, running style, and energy consumption
 *   water           — hot water generation, storage, and delivery
 *   space           — installation requirements and spatial constraints
 *   system_behaviour — heating controls, zoning, and system scheduling
 */
export type ExplainerCategory =
  | 'physics'
  | 'energy'
  | 'water'
  | 'space'
  | 'system_behaviour';

export interface EducationalExplainer {
  /** Unique stable identifier (snake_case). */
  id: string;

  /** Short topic title (≤ 60 characters). */
  title: string;

  /**
   * One-sentence summary of the core concept.
   * This is the single most important fact a reader should take away.
   */
  point: string;

  /**
   * Three to five concise bullet facts.
   * Each bullet should be a standalone statement — no sub-lists.
   */
  bullets: readonly string[];

  /**
   * Topic category — used to group explainers in the hamburger menu.
   * All explainers must declare a category.
   */
  category: ExplainerCategory;

  /**
   * Optional identifier of a simulator panel this topic relates to.
   * Used to render a "see it in simulator" reference.
   */
  simulatorPanelId?: string;

  /** Human-readable label for the simulator link (e.g. "Draw-Off panel"). */
  simulatorLabel?: string;
}
