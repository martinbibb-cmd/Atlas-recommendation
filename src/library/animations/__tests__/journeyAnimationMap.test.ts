import { describe, expect, it } from 'vitest';
import { educationalAnimationRegistry } from '../educationalAnimationRegistry';
import {
  getAnimationsForJourney,
  getAnimationIdsForJourney,
  getRoutedJourneyIds,
} from '../journeyAnimationMap';

// ─── Canonical journey IDs from golden-journey archetypes ────────────────────

const CANONICAL_JOURNEYS = [
  'open_vented_to_sealed_unvented',
  'regular_to_regular_unvented',
  'heat_pump_reality',
  'water_constraint_reality',
] as const;

// ─── Expected animation coverage per journey ─────────────────────────────────

const EXPECTED_COVERAGE: Record<string, string[]> = {
  open_vented_to_sealed_unvented: [
    'stored_hot_water_recovery',
    'shower_overlap_reserve',
    'cylinder_safety_path',
    'water_main_bottleneck',
  ],
  regular_to_regular_unvented: [
    'stored_hot_water_recovery',
    'shower_overlap_reserve',
    'cylinder_safety_path',
  ],
  heat_pump_reality: [
    'warm_radiator_steady_heat',
    'weather_compensation_day',
  ],
  water_constraint_reality: [
    'water_main_bottleneck',
  ],
};

describe('journeyAnimationMap', () => {
  it('every canonical animation appears in at least one routed customer journey', () => {
    const routedJourneyIds = getRoutedJourneyIds();
    expect(routedJourneyIds.length).toBeGreaterThan(0);

    for (const animation of educationalAnimationRegistry) {
      const appearsInAtLeastOneJourney = animation.journeyIds.some((journeyId) =>
        routedJourneyIds.includes(journeyId),
      );
      expect(
        appearsInAtLeastOneJourney,
        `Animation "${animation.animationId}" does not appear in any routed customer journey`,
      ).toBe(true);
    }
  });

  it('all four canonical golden journeys have at least one registered animation', () => {
    for (const journeyId of CANONICAL_JOURNEYS) {
      const animations = getAnimationsForJourney(journeyId);
      expect(
        animations.length,
        `Journey "${journeyId}" has no registered animations`,
      ).toBeGreaterThan(0);
    }
  });

  it('open_vented_to_sealed_unvented journey includes stored-hot-water recovery and safety animations', () => {
    const ids = getAnimationIdsForJourney('open_vented_to_sealed_unvented');
    expect(ids).toContain('stored_hot_water_recovery');
    expect(ids).toContain('shower_overlap_reserve');
    expect(ids).toContain('cylinder_safety_path');
    expect(ids).toContain('water_main_bottleneck');
  });

  it('regular_to_regular_unvented journey includes stored-hot-water and safety animations', () => {
    const ids = getAnimationIdsForJourney('regular_to_regular_unvented');
    expect(ids).toContain('stored_hot_water_recovery');
    expect(ids).toContain('shower_overlap_reserve');
    expect(ids).toContain('cylinder_safety_path');
  });

  it('heat_pump_reality journey includes warm radiator and weather compensation animations', () => {
    const ids = getAnimationIdsForJourney('heat_pump_reality');
    expect(ids).toContain('warm_radiator_steady_heat');
    expect(ids).toContain('weather_compensation_day');
  });

  it('water_constraint_reality journey includes water main bottleneck animation', () => {
    const ids = getAnimationIdsForJourney('water_constraint_reality');
    expect(ids).toContain('water_main_bottleneck');
  });

  it('returns empty array for an unknown journey ID', () => {
    expect(getAnimationsForJourney('not_a_real_journey')).toEqual([]);
    expect(getAnimationIdsForJourney('not_a_real_journey')).toEqual([]);
  });

  it('all expected animations per journey are covered', () => {
    for (const [journeyId, expectedIds] of Object.entries(EXPECTED_COVERAGE)) {
      const actualIds = getAnimationIdsForJourney(journeyId);
      for (const expectedId of expectedIds) {
        expect(
          actualIds,
          `Journey "${journeyId}" is missing expected animation "${expectedId}"`,
        ).toContain(expectedId);
      }
    }
  });

  it('every returned animation has a reduced-motion fallback and print fallback', () => {
    for (const journeyId of CANONICAL_JOURNEYS) {
      for (const animation of getAnimationsForJourney(journeyId)) {
        expect(
          animation.reducedMotionFallback.trim().length,
          `Animation "${animation.animationId}" (journey "${journeyId}") lacks a reducedMotionFallback`,
        ).toBeGreaterThan(0);
        expect(
          animation.printFallback.trim().length,
          `Animation "${animation.animationId}" (journey "${journeyId}") lacks a printFallback`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
