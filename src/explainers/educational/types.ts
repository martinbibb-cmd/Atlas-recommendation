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
   * Optional identifier of a simulator panel this topic relates to.
   * Used to render a "see it in simulator" reference.
   */
  simulatorPanelId?: string;

  /** Human-readable label for the simulator link (e.g. "Draw-Off panel"). */
  simulatorLabel?: string;
}
