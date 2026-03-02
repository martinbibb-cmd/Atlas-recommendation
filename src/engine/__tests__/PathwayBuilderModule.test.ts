import { describe, it, expect } from 'vitest';
import { runEngine } from '../Engine';
import { buildPathwaysV1 } from '../modules/PathwayBuilderModule';

const baseInput = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium' as const,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional' as const,
  highOccupancy: false,
  preferCombi: true,
  availableSpace: 'ok' as const,
};

describe('PathwayBuilderModule', () => {
  describe('buildPathwaysV1 basic shape', () => {
    it('returns a PlanV1 with pathways and sharedConstraints', () => {
      const result = runEngine(baseInput);
      const plan = buildPathwaysV1(result, baseInput);
      expect(plan).toBeDefined();
      expect(Array.isArray(plan.pathways)).toBe(true);
      expect(Array.isArray(plan.sharedConstraints)).toBe(true);
    });

    it('returns 1–3 pathways', () => {
      const result = runEngine(baseInput);
      const plan = buildPathwaysV1(result, baseInput);
      expect(plan.pathways.length).toBeGreaterThanOrEqual(1);
      expect(plan.pathways.length).toBeLessThanOrEqual(3);
    });

    it('each pathway has required fields', () => {
      const result = runEngine(baseInput);
      const plan = buildPathwaysV1(result, baseInput);
      for (const pathway of plan.pathways) {
        expect(typeof pathway.id).toBe('string');
        expect(pathway.id.length).toBeGreaterThan(0);
        expect(typeof pathway.title).toBe('string');
        expect(typeof pathway.rationale).toBe('string');
        expect(typeof pathway.outcomeToday).toBe('string');
        expect(Array.isArray(pathway.prerequisites)).toBe(true);
        expect(typeof pathway.rank).toBe('number');
        expect(pathway.confidence).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(pathway.confidence.level);
        expect(Array.isArray(pathway.confidence.reasons)).toBe(true);
      }
    });

    it('pathways are sorted by rank ascending', () => {
      const result = runEngine(baseInput);
      const plan = buildPathwaysV1(result, baseInput);
      for (let i = 1; i < plan.pathways.length; i++) {
        expect(plan.pathways[i].rank).toBeGreaterThanOrEqual(plan.pathways[i - 1].rank);
      }
    });
  });

  describe('screed risk scenario — boiler+Mixergy enablement pathway', () => {
    // Microbore topology is a proxy for screed-embedded UFH pipework
    const screedInput = {
      ...baseInput,
      pipingTopology: 'microbore' as const,
      primaryPipeDiameter: 8,
      // ASHP would be blocked by microbore (hydraulic constraint)
    };

    it('includes boiler_mixergy_enablement pathway when screed risk present', () => {
      const result = runEngine(screedInput);
      const plan = buildPathwaysV1(result, screedInput, { screedLeakRiskTolerance: 'cautious' });
      const pathwayIds = plan.pathways.map(p => p.id);
      expect(pathwayIds).toContain('boiler_mixergy_enablement');
    });

    it('boiler_mixergy_enablement pathway includes screed-related prerequisite', () => {
      const result = runEngine(screedInput);
      const plan = buildPathwaysV1(result, screedInput, { screedLeakRiskTolerance: 'cautious' });
      const enablement = plan.pathways.find(p => p.id === 'boiler_mixergy_enablement')!;
      expect(enablement).toBeDefined();
      const prereqDescriptions = enablement.prerequisites.map(p => p.description.toLowerCase());
      const hasScreedPrereq = prereqDescriptions.some(d => d.includes('screed'));
      expect(hasScreedPrereq).toBe(true);
    });

    it('sharedConstraints mentions screed constraint when screed risk present', () => {
      const result = runEngine(screedInput);
      const plan = buildPathwaysV1(result, screedInput, { screedLeakRiskTolerance: 'cautious' });
      const hasScreedConstraint = plan.sharedConstraints.some(c => c.toLowerCase().includes('screed'));
      expect(hasScreedConstraint).toBe(true);
    });

    it('screed pathway includes ASHP as the future outcome after trigger', () => {
      const result = runEngine(screedInput);
      const plan = buildPathwaysV1(result, screedInput, { screedLeakRiskTolerance: 'cautious' });
      const enablement = plan.pathways.find(p => p.id === 'boiler_mixergy_enablement')!;
      expect(enablement.outcomeAfterTrigger).toBeDefined();
      expect(enablement.outcomeAfterTrigger!.toLowerCase()).toContain('ashp');
    });
  });

  describe('low mains flow scenario — convert later pathway', () => {
    const lowMainsInput = {
      ...baseInput,
      dynamicMainsPressure: 0.8,
      mainsDynamicFlowLpm: 7, // below 10 L/min threshold for unvented
      mainsDynamicFlowLpmKnown: true,
    };

    it('includes convert_later_unvented pathway when mains flow is below threshold', () => {
      const result = runEngine(lowMainsInput);
      const plan = buildPathwaysV1(result, lowMainsInput);
      const pathwayIds = plan.pathways.map(p => p.id);
      expect(pathwayIds).toContain('convert_later_unvented');
    });

    it('convert_later_unvented pathway references the mains flow value', () => {
      const result = runEngine(lowMainsInput);
      const plan = buildPathwaysV1(result, lowMainsInput);
      const convertPathway = plan.pathways.find(p => p.id === 'convert_later_unvented')!;
      expect(convertPathway).toBeDefined();
      expect(convertPathway.rationale).toContain('7');
    });

    it('convert_later_unvented pathway includes mains supply upgrade as prerequisite', () => {
      const result = runEngine(lowMainsInput);
      const plan = buildPathwaysV1(result, lowMainsInput);
      const convertPathway = plan.pathways.find(p => p.id === 'convert_later_unvented')!;
      expect(convertPathway.prerequisites.length).toBeGreaterThan(0);
      const hasSupplyPrereq = convertPathway.prerequisites.some(
        p => p.description.toLowerCase().includes('mains') || p.description.toLowerCase().includes('supply'),
      );
      expect(hasSupplyPrereq).toBe(true);
    });

    it('sharedConstraints mentions low mains flow when below threshold', () => {
      const result = runEngine(lowMainsInput);
      const plan = buildPathwaysV1(result, lowMainsInput);
      const hasFlowConstraint = plan.sharedConstraints.some(
        c => c.toLowerCase().includes('mains') || c.toLowerCase().includes('flow'),
      );
      expect(hasFlowConstraint).toBe(true);
    });

    it('convert_later_unvented pathway confidence has unknowns or medium/low level', () => {
      const result = runEngine(lowMainsInput);
      const plan = buildPathwaysV1(result, lowMainsInput);
      const convertPathway = plan.pathways.find(p => p.id === 'convert_later_unvented')!;
      expect(['medium', 'low']).toContain(convertPathway.confidence.level);
    });
  });

  describe('unknown mains flow scenario', () => {
    const unknownFlowInput = {
      ...baseInput,
      // No mainsDynamicFlowLpm set
    };

    it('includes convert_later_unvented pathway when mains flow is unknown', () => {
      const result = runEngine(unknownFlowInput);
      const plan = buildPathwaysV1(result, unknownFlowInput);
      const pathwayIds = plan.pathways.map(p => p.id);
      expect(pathwayIds).toContain('convert_later_unvented');
    });

    it('shared constraint mentions mains flow not measured when unknown', () => {
      const result = runEngine(unknownFlowInput);
      const plan = buildPathwaysV1(result, unknownFlowInput);
      const hasUnknownConstraint = plan.sharedConstraints.some(
        c => c.toLowerCase().includes('not measured') || c.toLowerCase().includes('unknown'),
      );
      expect(hasUnknownConstraint).toBe(true);
    });
  });

  describe('expert assumptions influence pathway ranking', () => {
    it('futureReadinessPriority=high puts boiler_mixergy_enablement or direct_ashp as rank 1', () => {
      const result = runEngine({
        ...baseInput,
        mainsDynamicFlowLpm: 20,
        mainsDynamicFlowLpmKnown: true,
      });
      const plan = buildPathwaysV1(result, {
        ...baseInput,
        mainsDynamicFlowLpm: 20,
        mainsDynamicFlowLpmKnown: true,
      }, {
        futureReadinessPriority: 'high',
        disruptionTolerance: 'high',
      });
      // Rank 1 pathway should be an ASHP-oriented one
      const rank1 = plan.pathways.find(p => p.rank === 1);
      expect(rank1).toBeDefined();
      expect(['direct_ashp', 'boiler_mixergy_enablement']).toContain(rank1!.id);
    });

    it('expertAssumptions=undefined uses defaults and still produces valid pathways', () => {
      const result = runEngine(baseInput);
      const plan = buildPathwaysV1(result, baseInput, undefined);
      expect(plan.pathways.length).toBeGreaterThan(0);
    });
  });

  describe('engineOutput.plans is populated by runEngine', () => {
    it('runEngine includes plans in engineOutput when input provided', () => {
      const { engineOutput } = runEngine(baseInput);
      expect(engineOutput.plans).toBeDefined();
      expect(Array.isArray(engineOutput.plans!.pathways)).toBe(true);
    });

    it('plans.pathways has at least one entry', () => {
      const { engineOutput } = runEngine(baseInput);
      expect(engineOutput.plans!.pathways.length).toBeGreaterThanOrEqual(1);
    });
  });
});
