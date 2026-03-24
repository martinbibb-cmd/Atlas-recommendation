/**
 * presentationTypes.ts — Presentation Layer v1: shared types.
 *
 * Defines the SurveyorContext type and related helpers used by the
 * PresentationFlow and its child components.
 */

// ─── Surveyor context ─────────────────────────────────────────────────────────

/**
 * Contextual flags the surveyor can set during the in-room presentation.
 *
 * These flags do not feed back into the engine — they are display-only hints
 * that may optionally highlight relevant recommendations or cause cards.
 */
export interface SurveyorContext {
  /** Household uses hot water heavily (large family, long showers, multiple bathrooms). */
  highHotWaterUse: boolean;
  /** Future upgrades (e.g. EV, heat pump) are important to the customer. */
  futureProofingImportant: boolean;
  /** Physical space in the home is constrained (small utility, flat, no loft). */
  spaceIsLimited: boolean;
  /** Customer prioritises system reliability over upfront cost. */
  wantsReliability: boolean;
  /** Customer is budget-conscious and price-sensitive. */
  costSensitive: boolean;
}

/** Default all-off context. */
export const DEFAULT_SURVEYOR_CONTEXT: SurveyorContext = {
  highHotWaterUse: false,
  futureProofingImportant: false,
  spaceIsLimited: false,
  wantsReliability: false,
  costSensitive: false,
};

// ─── Presentation mode ────────────────────────────────────────────────────────

/**
 * Whether the StoryCanvas is showing current system issues or proposed solution.
 *
 *   current  — highlights problems in the existing system (warm/amber tone)
 *   proposed — highlights improvements with the recommended system (green tone)
 */
export type PresentationMode = 'current' | 'proposed';
