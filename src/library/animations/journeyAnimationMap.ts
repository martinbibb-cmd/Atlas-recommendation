import { educationalAnimationRegistry } from './educationalAnimationRegistry';
import type { EducationalAnimationV1 } from './EducationalAnimationV1';

/**
 * Derives the journey → animation mapping from the canonical animation registry.
 *
 * Each animation declares the journeyIds it belongs to via its `journeyIds` field.
 * This module provides the inverse view: given a journey, which animations are
 * registered for it?
 *
 * Supported journey IDs:
 *   open_vented_to_sealed_unvented  — tank-fed → sealed + unvented upgrade
 *   regular_to_regular_unvented     — regular boiler + unvented cylinder upgrade
 *   heat_pump_reality               — heat pump trust and expectation journey
 *   water_constraint_reality        — water mains constraint expectation journey
 */

function buildJourneyAnimationMap(): Map<string, EducationalAnimationV1[]> {
  const map = new Map<string, EducationalAnimationV1[]>();

  for (const animation of educationalAnimationRegistry) {
    for (const journeyId of animation.journeyIds) {
      let entries = map.get(journeyId);
      if (entries == null) {
        entries = [];
        map.set(journeyId, entries);
      }
      entries.push(animation);
    }
  }

  return map;
}

const JOURNEY_ANIMATION_MAP = buildJourneyAnimationMap();

/**
 * Returns all canonical animations registered for the given journey ID.
 * Returns an empty array for unknown or unmapped journey IDs.
 */
export function getAnimationsForJourney(journeyId: string): EducationalAnimationV1[] {
  return JOURNEY_ANIMATION_MAP.get(journeyId) ?? [];
}

/**
 * Returns the animation IDs registered for the given journey ID.
 * Returns an empty array for unknown or unmapped journey IDs.
 */
export function getAnimationIdsForJourney(journeyId: string): string[] {
  return getAnimationsForJourney(journeyId).map((animation) => animation.animationId);
}

/**
 * Returns all journey IDs that have at least one registered animation.
 */
export function getRoutedJourneyIds(): string[] {
  return [...JOURNEY_ANIMATION_MAP.keys()];
}
