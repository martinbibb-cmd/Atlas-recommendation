import { describe, expect, it } from 'vitest';
import { educationalContentRegistry } from '../content/educationalContentRegistry';
import { runEducationalContentQa } from '../content/qa/runEducationalContentQa';
import { getConceptById } from '../taxonomy/conceptGraph';
import {
  getOpenVentedToSealedUnventedJourneySequencingPlan,
  getRegularToRegularUnventedJourneySequencingPlan,
  getHeatPumpRealityJourneySequencingPlan,
  getWaterConstraintJourneySequencingPlan,
} from '../demoJourneys';
import { getContentByConceptId } from '../content';

/**
 * The 15 new concept IDs added in golden journey educational content batch 2.
 */
const BATCH_2_CONCEPT_IDS = [
  'why_not_combi',
  'preserved_system_strength',
  'premium_hot_water_performance',
  'pressure_vs_storage',
  'sealed_system_conversion',
  'unvented_safety_reassurance',
  'hot_radiator_expectation',
  'water_main_limit_not_boiler_limit',
  'open_vented_to_unvented_upgrade',
  'regular_retained_unvented_upgrade',
  'flow_temperature_living_with_it',
  'heat_pump_defrost_expectation',
  'outdoor_unit_winter_care',
  'microbore_flow_limits',
  'radiator_clearance_and_convection',
] as const;

/**
 * Core golden journey concept IDs — those that should have authored content and
 * must not rely on the fallback "This storyboard beat is currently carried by..." text.
 */
const GOLDEN_JOURNEY_CORE_CONCEPT_IDS_BY_JOURNEY: Record<string, readonly string[]> = {
  open_vented_to_sealed_unvented: [
    'sealed_system_conversion',
    'unvented_safety_reassurance',
    'pressure_vs_storage',
    'open_vented_to_unvented_upgrade',
  ],
  regular_to_regular_unvented: [
    'preserved_system_strength',
    'premium_hot_water_performance',
    'regular_retained_unvented_upgrade',
    'unvented_safety_reassurance',
  ],
  heat_pump_reality: [
    'hot_radiator_expectation',
    'flow_temperature_living_with_it',
    'heat_pump_defrost_expectation',
    'outdoor_unit_winter_care',
    'radiator_clearance_and_convection',
  ],
  water_constraint_reality: [
    'why_not_combi',
    'water_main_limit_not_boiler_limit',
    'microbore_flow_limits',
  ],
};

describe('Golden journey educational content — batch 2', () => {
  describe('taxonomy coverage', () => {
    it.each(BATCH_2_CONCEPT_IDS)(
      'concept "%s" is present in the taxonomy',
      (conceptId) => {
        expect(getConceptById(conceptId)).toBeDefined();
      },
    );
  });

  describe('content registry coverage', () => {
    it.each(BATCH_2_CONCEPT_IDS)(
      'concept "%s" has an authored content entry',
      (conceptId) => {
        const content = getContentByConceptId(conceptId);
        expect(content).toBeDefined();
      },
    );
  });

  describe('content QA', () => {
    it.each(BATCH_2_CONCEPT_IDS)(
      'content for "%s" passes QA with no errors',
      (conceptId) => {
        const content = getContentByConceptId(conceptId);
        if (!content) {
          throw new Error(`No content found for ${conceptId}`);
        }

        const findings = runEducationalContentQa([content]);
        const errors = findings.filter((f) => f.severity === 'error');
        expect(errors).toHaveLength(0);
      },
    );
  });

  describe('factual / no-analogy mode', () => {
    it.each(BATCH_2_CONCEPT_IDS)(
      'content for "%s" has a factual (family: none) analogy option',
      (conceptId) => {
        const content = getContentByConceptId(conceptId);
        if (!content) {
          throw new Error(`No content found for ${conceptId}`);
        }

        const hasFactualOption = content.analogyOptions.some((opt) => opt.family === 'none');
        expect(hasFactualOption).toBe(true);
      },
    );
  });

  describe('golden journey sequencing plans include batch 2 concepts', () => {
    it('open-vented to sealed + unvented plan includes core batch 2 concepts', () => {
      const plan = getOpenVentedToSealedUnventedJourneySequencingPlan();
      const allConceptIds = new Set([
        ...plan.orderedSequence.map((c) => c.conceptId),
        ...plan.deferredConcepts.map((c) => c.conceptId),
      ]);

      for (const conceptId of GOLDEN_JOURNEY_CORE_CONCEPT_IDS_BY_JOURNEY.open_vented_to_sealed_unvented!) {
        expect(allConceptIds).toContain(conceptId);
      }
    });

    it('regular to regular + unvented plan includes core batch 2 concepts', () => {
      const plan = getRegularToRegularUnventedJourneySequencingPlan();
      const allConceptIds = new Set([
        ...plan.orderedSequence.map((c) => c.conceptId),
        ...plan.deferredConcepts.map((c) => c.conceptId),
      ]);

      for (const conceptId of GOLDEN_JOURNEY_CORE_CONCEPT_IDS_BY_JOURNEY.regular_to_regular_unvented!) {
        expect(allConceptIds).toContain(conceptId);
      }
    });

    it('heat pump reality plan includes core batch 2 concepts', () => {
      const plan = getHeatPumpRealityJourneySequencingPlan();
      const allConceptIds = new Set([
        ...plan.orderedSequence.map((c) => c.conceptId),
        ...plan.deferredConcepts.map((c) => c.conceptId),
      ]);

      for (const conceptId of GOLDEN_JOURNEY_CORE_CONCEPT_IDS_BY_JOURNEY.heat_pump_reality!) {
        expect(allConceptIds).toContain(conceptId);
      }
    });

    it('water constraint reality plan includes core batch 2 concepts', () => {
      const plan = getWaterConstraintJourneySequencingPlan();
      const allConceptIds = new Set([
        ...plan.orderedSequence.map((c) => c.conceptId),
        ...plan.deferredConcepts.map((c) => c.conceptId),
      ]);

      for (const conceptId of GOLDEN_JOURNEY_CORE_CONCEPT_IDS_BY_JOURNEY.water_constraint_reality!) {
        expect(allConceptIds).toContain(conceptId);
      }
    });
  });

  describe('golden journeys no longer rely on missing-content fallback for core cards', () => {
    const journeyPlans: Array<{ name: string; conceptIds: readonly string[] }> = [
      {
        name: 'open_vented_to_sealed_unvented',
        conceptIds: GOLDEN_JOURNEY_CORE_CONCEPT_IDS_BY_JOURNEY.open_vented_to_sealed_unvented!,
      },
      {
        name: 'regular_to_regular_unvented',
        conceptIds: GOLDEN_JOURNEY_CORE_CONCEPT_IDS_BY_JOURNEY.regular_to_regular_unvented!,
      },
      {
        name: 'heat_pump_reality',
        conceptIds: GOLDEN_JOURNEY_CORE_CONCEPT_IDS_BY_JOURNEY.heat_pump_reality!,
      },
      {
        name: 'water_constraint_reality',
        conceptIds: GOLDEN_JOURNEY_CORE_CONCEPT_IDS_BY_JOURNEY.water_constraint_reality!,
      },
    ];

    it.each(journeyPlans)(
      'all core cards for "$name" have authored content (no fallback)',
      ({ conceptIds }) => {
        const contentById = new Map(
          educationalContentRegistry.map((entry) => [entry.conceptId, entry]),
        );

        for (const conceptId of conceptIds) {
          expect(contentById.has(conceptId)).toBe(true);
        }
      },
    );
  });

  describe('storyboard renders real copy for the four golden journeys', () => {
    it('all batch 2 content entries have non-empty printSummary suitable for storyboard rendering', () => {
      for (const conceptId of BATCH_2_CONCEPT_IDS) {
        const content = getContentByConceptId(conceptId);
        expect(content).toBeDefined();
        expect(content!.printSummary.trim().length).toBeGreaterThan(0);
        expect(content!.printSummary.length).toBeLessThanOrEqual(140);
      }
    });

    it('all batch 2 content entries have non-empty customerExplanation with standard format', () => {
      for (const conceptId of BATCH_2_CONCEPT_IDS) {
        const content = getContentByConceptId(conceptId);
        expect(content).toBeDefined();
        expect(content!.customerExplanation).toMatch(/What you may notice:/);
        expect(content!.customerExplanation).toMatch(/What this means:/);
      }
    });

    it('all batch 2 content entries have non-empty plainEnglishSummary for storyboard title resolution', () => {
      for (const conceptId of BATCH_2_CONCEPT_IDS) {
        const content = getContentByConceptId(conceptId);
        expect(content).toBeDefined();
        expect(content!.plainEnglishSummary.trim().length).toBeGreaterThan(0);
        expect(content!.title.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
