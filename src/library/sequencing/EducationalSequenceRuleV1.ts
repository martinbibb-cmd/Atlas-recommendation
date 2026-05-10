/**
 * Educational Sequencing and Progressive Disclosure contract.
 *
 * Controls *when* a concept is introduced — not which content to show,
 * but at what stage in the educational flow it should appear, how heavy
 * it is to process, and how to space it relative to neighbouring concepts.
 */

/** The stage within an educational journey at which a concept should be placed. */
export type SequenceStage =
  /** Opening reassurance — comfort, safety, normality. Show first. */
  | 'reassurance'
  /** Set clear, accurate expectations before lived experience begins. */
  | 'expectation'
  /** Explain what the customer will notice in daily use. */
  | 'lived_experience'
  /** Correct a common wrong mental model. */
  | 'misconception'
  /** Add meaningful depth once trust and context exist. */
  | 'deeper_understanding'
  /** Physics or engineering detail — always deferred unless requested. */
  | 'technical_detail'
  /** Only available via QR / portal — never in core pack. */
  | 'appendix_only';

/**
 * Emotional valence of the concept as the customer encounters it.
 * Use this to prevent consecutive cautionary concepts causing overload.
 */
export type EmotionalWeight = 'calming' | 'neutral' | 'cautionary';

/**
 * A single sequencing rule for one conceptId.
 * Many rules can exist per concept (e.g. one per archetype).
 */
export interface EducationalSequenceRuleV1 {
  /** Unique identifier for this rule. */
  ruleId: string;
  /** The concept this rule governs. */
  conceptId: string;
  /** Where in the journey this concept belongs. */
  sequenceStage: SequenceStage;
  /**
   * Other conceptIds that must have appeared before this one is safe to show.
   * If any prerequisite is absent from the selected set, this concept is deferred.
   */
  prerequisites?: readonly string[];
  /**
   * Concept IDs that, if already seen earlier in this session or pack,
   * allow this one to be deferred or suppressed.
   */
  deferUntilSeen?: readonly string[];
  /**
   * When true, suppress this concept if it (or a closely related one)
   * has already been explained earlier in the same sequence.
   */
  suppressIfAlreadyExplained?: boolean;
  /** Emotional weight — used to balance consecutive concept loads. */
  emotionalWeight: EmotionalWeight;
  /**
   * Maximum number of concepts that may appear simultaneously in
   * the same section as this one. Lower numbers force more spacing.
   */
  maxSimultaneousConcepts: number;
  /**
   * Number of concept slots to leave empty after this concept
   * before the next concept of equal or higher cognitive load appears.
   */
  cooldownAfter?: number;
  /**
   * Preferred UI card types when rendering this concept at this stage.
   * Purely advisory — the renderer may substitute as accessibility demands.
   */
  idealCardTypes?: readonly string[];
  /**
   * IDs of concepts that must NOT appear immediately before or after this one
   * (prevents back-to-back overload or emotional whiplash).
   */
  avoidAdjacentConceptIds?: readonly string[];
}
