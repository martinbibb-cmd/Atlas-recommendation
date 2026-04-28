/**
 * ScenarioDisplayIdentity.ts — The single authoritative display contract for a scenario.
 *
 * Every customer-facing surface (portal, print pack, comparison card, daily-use card,
 * Atlas Pick badge, hero headline) must use these fields rather than reconstructing
 * names from family → map → generic string.
 *
 * Resolved once by buildScenarioDisplayIdentity() and stored on ScenarioResult.display.
 * Surfaces that receive a pre-populated ScenarioResult read scenario.display directly;
 * surfaces that construct scenarios inline call buildScenarioDisplayIdentity() once.
 */

export interface ScenarioDisplayIdentity {
  /**
   * Primary customer-facing system title.
   * e.g. "Mixergy cylinder", "Combi boiler", "System boiler", "Air source heat pump".
   */
  title: string;

  /**
   * Compact title for badge / chip contexts where horizontal space is limited.
   * e.g. "Mixergy", "Combi", "System boiler", "Heat pump".
   */
  shortTitle: string;

  /**
   * Broad category label describing the hot-water delivery family.
   * e.g. "Stored hot water", "On-demand hot water", "Heat pump".
   */
  familyLabel: string;

  /**
   * Label used on the Atlas Pick badge and recommendation callout.
   * Usually the same as title but may be shorter for space-constrained surfaces.
   * e.g. "Mixergy cylinder", "Combi boiler".
   */
  atlasPickLabel: string;

  /**
   * One-sentence recommendation headline for hero / decision context.
   * e.g. "A Mixergy cylinder / pressure-tolerant stored hot water system is the right fit for this home."
   */
  headline: string;

  /**
   * Alternate headline used when the customer has selected this (combi) system
   * despite it being non-viable per Atlas physics analysis.
   *
   * Only populated for combi scenarios where a stored-water system is preferred.
   * Surfaces decide whether to show headline or compromiseHeadline based on
   * customer selection state — this field is never shown unprompted.
   */
  compromiseHeadline?: string;

  /**
   * Physics-constraint-aware description for detailed scenario views.
   * Populated when a key constraint shapes the recommendation narrative
   * (e.g. Mixergy selected due to tank-fed supply pressure).
   */
  constraintAwareDescription?: string;
}
