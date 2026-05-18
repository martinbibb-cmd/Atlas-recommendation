import { describe, expect, it } from 'vitest';
import { VISUAL_TOPOLOGY_REGISTRY } from '../../visualTopologies/visualTopologyRegistry';
import {
  CANONICAL_HYDRAULIC_RULES,
  HYDRAULIC_CONSTRAINTS,
  listCanonicalHydraulicTemplates,
  runHydraulicTopologyQa,
} from '..';

describe('hydraulicTruth canonical rule pack', () => {
  it('includes all required canonical rule groups', () => {
    expect(CANONICAL_HYDRAULIC_RULES.componentPlacementRules.length).toBeGreaterThan(0);
    expect(CANONICAL_HYDRAULIC_RULES.flowReturnRules.length).toBeGreaterThan(0);
    expect(CANONICAL_HYDRAULIC_RULES.closeCouplingRules.length).toBeGreaterThan(0);
    expect(CANONICAL_HYDRAULIC_RULES.pressureRules.length).toBeGreaterThan(0);
    expect(CANONICAL_HYDRAULIC_RULES.stratificationRules.length).toBeGreaterThan(0);
    expect(CANONICAL_HYDRAULIC_RULES.potablePrimarySeparationRules.length).toBeGreaterThan(0);
    expect(CANONICAL_HYDRAULIC_RULES.g3SafetyRoutingRules.length).toBeGreaterThan(0);
    expect(CANONICAL_HYDRAULIC_RULES.pumpPlacementRules.length).toBeGreaterThan(0);
    expect(CANONICAL_HYDRAULIC_RULES.abvPlacementRules.length).toBeGreaterThan(0);
    expect(CANONICAL_HYDRAULIC_RULES.magneticFilterPlacementRules.length).toBeGreaterThan(0);
    expect(CANONICAL_HYDRAULIC_RULES.fillingLoopRules.length).toBeGreaterThan(0);
  });

  it('provides canonical template mappings for all topology ids', () => {
    const mappedIds = new Set(listCanonicalHydraulicTemplates().map((item) => item.topologyId));
    expect(VISUAL_TOPOLOGY_REGISTRY.every((entry) => mappedIds.has(entry.id))).toBe(true);
  });

  it('covers the canonical template set used for future layout derivation', () => {
    const templateIds = new Set(listCanonicalHydraulicTemplates().map((item) => item.templateId));
    expect(templateIds).toEqual(
      new Set([
        'open_vented',
        'sealed_unvented',
        'combi',
        'mixergy',
        'thermal_store',
        'abv_protected_loop',
        'magnetic_filter_protection',
        'powerflush_setup',
      ]),
    );
  });

  it('contains machine-readable must-show and must-not-show constraints', () => {
    expect(HYDRAULIC_CONSTRAINTS.some((constraint) => constraint.kind === 'must_show')).toBe(true);
    expect(HYDRAULIC_CONSTRAINTS.some((constraint) => constraint.kind === 'must_not_show')).toBe(true);
    expect(HYDRAULIC_CONSTRAINTS.some((constraint) => constraint.id === 'mixergy_must_show_thermocline')).toBe(true);
    expect(HYDRAULIC_CONSTRAINTS.some((constraint) => constraint.id === 'unvented_must_not_show_thermocline')).toBe(true);
  });
});

describe('runHydraulicTopologyQa', () => {
  it('returns passing QA results for all canonical topology fixtures', () => {
    for (const topology of VISUAL_TOPOLOGY_REGISTRY) {
      const result = runHydraulicTopologyQa(topology.id);
      expect(result.passed, `${topology.id} should satisfy canonical hydraulic constraints`).toBe(true);
      expect(result.plausibilityScore).toBe(100);
      expect(result.issues).toEqual([]);
    }
  });
});
