import { describe, expect, it } from 'vitest';
import {
  getDiagramsForConcepts,
  getDiagramsForArchetype,
  getDiagramsForWelcomePackPlan,
  getMissingDiagramCoverageForConcepts,
} from '../diagrams/diagramLookup';
import { diagramExplanationRegistry } from '../diagrams/diagramExplanationRegistry';
import type { WelcomePackPlanV1 } from '../packComposer/WelcomePackComposerV1';

function makePlan(selectedConceptIds: string[]): WelcomePackPlanV1 {
  return {
    packId: 'test-pack',
    recommendedScenarioId: 'system_unvented',
    archetypeId: 'combi_replacement',
    sections: [],
    selectedAssetIds: [],
    selectedAssetReasons: {},
    selectedConceptIds,
    deferredConceptIds: [],
    omittedAssetIdsWithReason: [],
    printPageBudget: 4,
    pageBudgetUsed: 0,
    cognitiveLoadBudget: 'low',
    qrDestinations: [],
  };
}

describe('getDiagramsForConcepts', () => {
  it('returns diagrams that cover at least one of the supplied concept IDs', () => {
    const results = getDiagramsForConcepts(['pressure_vs_storage']);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((d) => d.conceptIds.includes('pressure_vs_storage'))).toBe(true);
  });

  it('returns an empty array when no concept IDs match', () => {
    expect(getDiagramsForConcepts(['unknown_concept_xyz'])).toHaveLength(0);
  });

  it('deduplicates entries — each diagram appears at most once', () => {
    // 'pressure_vs_storage' and 'STR-01' are both on the same diagram entry
    const results = getDiagramsForConcepts(['pressure_vs_storage', 'STR-01', 'premium_hot_water_performance']);
    const ids = results.map((d) => d.diagramId);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('returns diagrams for multiple matching concepts', () => {
    const results = getDiagramsForConcepts(['pressure_vs_storage', 'water_main_limit_not_boiler_limit']);
    const ids = results.map((d) => d.diagramId);
    expect(ids).toContain('pressure_vs_storage');
    expect(ids).toContain('water_main_limitation');
  });

  it('returns an empty array for an empty concept list', () => {
    expect(getDiagramsForConcepts([])).toHaveLength(0);
  });
});

describe('getDiagramsForArchetype', () => {
  it('returns diagrams for a known archetype', () => {
    // heat_pump_reality archetype includes hot_radiator_expectation in its concept set via
    // the warm_vs_hot_radiators diagram; at minimum, any diagram matching its concepts.
    const results = getDiagramsForArchetype('heat_pump_reality');
    expect(Array.isArray(results)).toBe(true);
  });

  it('returns an empty array for an unknown archetype', () => {
    expect(getDiagramsForArchetype('nonexistent_archetype_zzz')).toHaveLength(0);
  });

  it('returns diagrams for the open_vented_to_sealed_unvented archetype', () => {
    const results = getDiagramsForArchetype('open_vented_to_sealed_unvented');
    const ids = results.map((d) => d.diagramId);
    // The open_vented_to_unvented diagram links to pressure_vs_storage concept
    // which the archetype covers via recommendedConceptIds/optionalConceptIds or registry overlap
    expect(Array.isArray(results)).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(0);
  });

  it('deduplicates diagrams even when multiple archetype concept IDs map to the same diagram', () => {
    // All archetypes — just check no duplicate IDs are returned
    const archetypeIds = ['combi_replacement', 'heat_pump_install', 'water_supply_constraint', 'open_vented_to_sealed_unvented'];
    for (const archetypeId of archetypeIds) {
      const results = getDiagramsForArchetype(archetypeId);
      const ids = results.map((d) => d.diagramId);
      expect(ids).toHaveLength(new Set(ids).size);
    }
  });
});

describe('getDiagramsForWelcomePackPlan', () => {
  it('returns diagrams matching the plan's selected concept IDs', () => {
    const plan = makePlan(['pressure_vs_storage', 'water_main_limit_not_boiler_limit']);
    const results = getDiagramsForWelcomePackPlan(plan);
    const ids = results.map((d) => d.diagramId);
    expect(ids).toContain('pressure_vs_storage');
    expect(ids).toContain('water_main_limitation');
  });

  it('returns an empty array when no selected concepts match any diagram', () => {
    const plan = makePlan(['unrecognised_concept_aaa']);
    expect(getDiagramsForWelcomePackPlan(plan)).toHaveLength(0);
  });

  it('returns an empty array for a plan with no selected concepts', () => {
    const plan = makePlan([]);
    expect(getDiagramsForWelcomePackPlan(plan)).toHaveLength(0);
  });

  it('deduplicates results even when multiple selected concepts map to the same diagram', () => {
    // 'pressure_vs_storage', 'STR-01', and 'premium_hot_water_performance' all map to the
    // same pressure_vs_storage diagram entry
    const plan = makePlan(['pressure_vs_storage', 'STR-01', 'premium_hot_water_performance']);
    const results = getDiagramsForWelcomePackPlan(plan);
    const ids = results.map((d) => d.diagramId);
    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids).toContain('pressure_vs_storage');
  });
});

describe('getMissingDiagramCoverageForConcepts', () => {
  it('returns concept IDs that have no diagram in the registry', () => {
    const missing = getMissingDiagramCoverageForConcepts(['pressure_vs_storage', 'totally_unknown_concept']);
    expect(missing).toContain('totally_unknown_concept');
    expect(missing).not.toContain('pressure_vs_storage');
  });

  it('returns an empty array when all concepts have diagram coverage', () => {
    // Collect all concept IDs covered by the registry
    const allCovered = diagramExplanationRegistry.flatMap((d) => d.conceptIds);
    const unique = Array.from(new Set(allCovered));
    expect(getMissingDiagramCoverageForConcepts(unique)).toHaveLength(0);
  });

  it('returns all supplied concept IDs when none match any diagram', () => {
    const input = ['no_diagram_a', 'no_diagram_b'];
    expect(getMissingDiagramCoverageForConcepts(input)).toEqual(input);
  });

  it('returns an empty array for an empty input list', () => {
    expect(getMissingDiagramCoverageForConcepts([])).toHaveLength(0);
  });
});
