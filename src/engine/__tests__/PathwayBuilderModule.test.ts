import { describe, it, expect } from 'vitest';
import { buildPathwaysV1, snapshotFromResult } from '../modules/PathwayBuilderModule';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { ExpertAssumptionsV1 } from '../schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseEngineOutput: EngineOutputV1 = {
  eligibility: [
    { id: 'on_demand', label: 'Combi', status: 'viable', reason: '' },
    { id: 'stored_vented', label: 'Stored Vented', status: 'viable', reason: '' },
    { id: 'stored_unvented', label: 'Stored Unvented', status: 'viable', reason: '' },
    { id: 'ashp', label: 'ASHP', status: 'viable', reason: '' },
  ],
  redFlags: [],
  recommendation: { primary: 'Combi boiler recommended' },
  explainers: [],
};

const ashpViableOutput: EngineOutputV1 = {
  ...baseEngineOutput,
  eligibility: [
    { id: 'on_demand', label: 'Combi', status: 'caution', reason: '' },
    { id: 'stored_vented', label: 'Stored Vented', status: 'viable', reason: '' },
    { id: 'stored_unvented', label: 'Stored Unvented', status: 'viable', reason: '' },
    { id: 'ashp', label: 'ASHP', status: 'viable', reason: '' },
  ],
  recommendation: { primary: 'ASHP recommended' },
};

// ─── Test: screed risk + ASHP viable => boiler_mixergy_enablement ranked #1 ──

describe('buildPathwaysV1 — fixture a: screed risk + ASHP viable', () => {
  it('includes boiler_mixergy_enablement ranked #1 when futureReadinessPriority=high', () => {
    const assumptions: ExpertAssumptionsV1 = {
      disruptionTolerance: 'med',
      screedLeakRiskTolerance: 'cautious',
      dhwExperiencePriority: 'high',
      futureReadinessPriority: 'high',
      comfortVsCost: 'balanced',
    };

    const plan = buildPathwaysV1(
      {
        engineOutput: ashpViableOutput,
        ashpViable: true,
        ashpHydraulicPass: true,
        screedLeakRisk: true,
        primaryPipeConstraintFail: false,
        combiViable: true,
        mainsDynamicFlowLpm: 15,
      },
      assumptions,
    );

    const mixergyPathway = plan.pathways.find(p => p.id === 'boiler_mixergy_enablement');
    expect(mixergyPathway).toBeDefined();
    expect(mixergyPathway!.rank).toBe(1);
    // direct_ashp should NOT be offered when screed risk is present
    expect(plan.pathways.find(p => p.id === 'direct_ashp')).toBeUndefined();
  });

  it('boiler_mixergy_enablement prerequisites include screed-remediation', () => {
    const plan = buildPathwaysV1(
      {
        engineOutput: ashpViableOutput,
        ashpViable: true,
        ashpHydraulicPass: true,
        screedLeakRisk: true,
        primaryPipeConstraintFail: false,
        combiViable: false,
        mainsDynamicFlowLpm: 15,
      },
      undefined,
    );

    const mixergyPathway = plan.pathways.find(p => p.id === 'boiler_mixergy_enablement');
    expect(mixergyPathway).toBeDefined();
    const prereq = mixergyPathway!.prerequisites.find(p => p.id === 'screed-remediation');
    expect(prereq).toBeDefined();
    expect(prereq!.limiterRef).toBe('screed-leak-risk');
  });
});

// ─── Test: mains flow < 10 => convert_later_unvented with triggerEvent ────────

describe('buildPathwaysV1 — fixture b: mains flow < 10 L/min', () => {
  it('includes convert_later_unvented when mainsDynamicFlowLpm < 10', () => {
    const plan = buildPathwaysV1(
      {
        engineOutput: baseEngineOutput,
        ashpViable: false,
        ashpHydraulicPass: false,
        screedLeakRisk: false,
        primaryPipeConstraintFail: false,
        combiViable: true,
        mainsDynamicFlowLpm: 7,
      },
      undefined,
    );

    const pathway = plan.pathways.find(p => p.id === 'convert_later_unvented');
    expect(pathway).toBeDefined();
  });

  it('convert_later_unvented has triggerEvent mains-upgrade', () => {
    const plan = buildPathwaysV1(
      {
        engineOutput: baseEngineOutput,
        ashpViable: false,
        ashpHydraulicPass: false,
        screedLeakRisk: false,
        primaryPipeConstraintFail: false,
        combiViable: true,
        mainsDynamicFlowLpm: 5,
      },
      undefined,
    );

    const pathway = plan.pathways.find(p => p.id === 'convert_later_unvented');
    expect(pathway).toBeDefined();
    const prereq = pathway!.prerequisites.find(p => p.triggerEvent === 'mains-upgrade');
    expect(prereq).toBeDefined();
    expect(prereq!.limiterRef).toBe('mains-flow-constraint');
  });

  it('confidence is low when flow is unknown', () => {
    const plan = buildPathwaysV1(
      {
        engineOutput: baseEngineOutput,
        ashpViable: false,
        ashpHydraulicPass: false,
        screedLeakRisk: false,
        primaryPipeConstraintFail: false,
        combiViable: true,
        mainsDynamicFlowLpm: undefined,
      },
      undefined,
    );

    const pathway = plan.pathways.find(p => p.id === 'convert_later_unvented');
    expect(pathway).toBeDefined();
    expect(pathway!.confidence.level).toBe('low');
    expect(pathway!.confidence.unknowns).toContain('Dynamic mains flow not measured');
  });
});

// ─── Test: low disruptionTolerance => combi_single_tech can outrank others ────

describe('buildPathwaysV1 — fixture c: low disruption tolerance', () => {
  it('includes combi_single_tech when disruptionTolerance=low and combi viable', () => {
    const assumptions: ExpertAssumptionsV1 = {
      disruptionTolerance: 'low',
      screedLeakRiskTolerance: 'normal',
      dhwExperiencePriority: 'normal',
      futureReadinessPriority: 'normal',
      comfortVsCost: 'cost',
    };

    const plan = buildPathwaysV1(
      {
        engineOutput: baseEngineOutput,
        ashpViable: false,
        ashpHydraulicPass: false,
        screedLeakRisk: false,
        primaryPipeConstraintFail: false,
        combiViable: true,
        mainsDynamicFlowLpm: 15,
      },
      assumptions,
    );

    const combiPathway = plan.pathways.find(p => p.id === 'combi_single_tech');
    expect(combiPathway).toBeDefined();
  });

  it('combi_single_tech is ranked #1 when it is the only viable pathway', () => {
    const assumptions: ExpertAssumptionsV1 = {
      disruptionTolerance: 'low',
      screedLeakRiskTolerance: 'normal',
      dhwExperiencePriority: 'normal',
      futureReadinessPriority: 'normal',
      comfortVsCost: 'cost',
    };

    const plan = buildPathwaysV1(
      {
        engineOutput: baseEngineOutput,
        ashpViable: false,
        ashpHydraulicPass: false,
        screedLeakRisk: false,
        primaryPipeConstraintFail: false,
        combiViable: true,
        mainsDynamicFlowLpm: 15,
      },
      assumptions,
    );

    const combiPathway = plan.pathways.find(p => p.id === 'combi_single_tech');
    expect(combiPathway!.rank).toBe(1);
  });

  it('combi_single_tech is NOT offered when disruptionTolerance is med or high', () => {
    const assumptions: ExpertAssumptionsV1 = {
      disruptionTolerance: 'med',
      screedLeakRiskTolerance: 'normal',
      dhwExperiencePriority: 'normal',
      futureReadinessPriority: 'normal',
      comfortVsCost: 'balanced',
    };

    const plan = buildPathwaysV1(
      {
        engineOutput: baseEngineOutput,
        ashpViable: false,
        ashpHydraulicPass: false,
        screedLeakRisk: false,
        primaryPipeConstraintFail: false,
        combiViable: true,
        mainsDynamicFlowLpm: 15,
      },
      assumptions,
    );

    expect(plan.pathways.find(p => p.id === 'combi_single_tech')).toBeUndefined();
  });
});

// ─── Test: direct_ashp offered when no blockers ───────────────────────────────

describe('buildPathwaysV1 — direct ASHP offer', () => {
  it('offers direct_ashp when ASHP viable, hydraulics pass, no screed risk', () => {
    const plan = buildPathwaysV1(
      {
        engineOutput: ashpViableOutput,
        ashpViable: true,
        ashpHydraulicPass: true,
        screedLeakRisk: false,
        primaryPipeConstraintFail: false,
        combiViable: false,
        mainsDynamicFlowLpm: 15,
      },
      undefined,
    );

    const pathway = plan.pathways.find(p => p.id === 'direct_ashp');
    expect(pathway).toBeDefined();
    expect(pathway!.rank).toBe(1);
  });

  it('does NOT offer direct_ashp when ASHP hydraulics fail', () => {
    const plan = buildPathwaysV1(
      {
        engineOutput: ashpViableOutput,
        ashpViable: true,
        ashpHydraulicPass: false,
        screedLeakRisk: false,
        primaryPipeConstraintFail: true,
        combiViable: true,
        mainsDynamicFlowLpm: 15,
      },
      undefined,
    );

    expect(plan.pathways.find(p => p.id === 'direct_ashp')).toBeUndefined();
  });
});

// ─── Test: snapshotFromResult utility ────────────────────────────────────────

describe('snapshotFromResult', () => {
  it('detects primary-pipe constraint fail from limiters', () => {
    const output: EngineOutputV1 = {
      ...baseEngineOutput,
      limiters: {
        limiters: [
          {
            id: 'primary-pipe-constraint',
            title: 'Primary Pipe Constraint',
            severity: 'fail',
            observed: { label: 'Velocity', value: 2.1, unit: 'm/s' },
            limit: { label: 'Max velocity', value: 1.5, unit: 'm/s' },
            impact: { summary: 'Pipe too small for ASHP flow rates' },
            confidence: 'high',
            sources: [],
            suggestedFixes: [],
          },
        ],
      },
    };

    const snapshot = snapshotFromResult(output, { mainsDynamicFlowLpm: 15 });
    expect(snapshot.primaryPipeConstraintFail).toBe(true);
  });

  it('correctly identifies ASHP as not viable from eligibility', () => {
    const output: EngineOutputV1 = {
      ...baseEngineOutput,
      eligibility: [
        { id: 'on_demand', label: 'Combi', status: 'viable', reason: '' },
        { id: 'stored_vented', label: 'Stored Vented', status: 'viable', reason: '' },
        { id: 'stored_unvented', label: 'Stored Unvented', status: 'viable', reason: '' },
        { id: 'ashp', label: 'ASHP', status: 'rejected', reason: 'Not viable' },
      ],
    };

    const snapshot = snapshotFromResult(output);
    expect(snapshot.ashpViable).toBe(false);
  });
});

// ─── Test: shared constraints populated from limiters ─────────────────────────

describe('buildPathwaysV1 — shared constraints', () => {
  it('populates sharedConstraints from engine limiters', () => {
    const output: EngineOutputV1 = {
      ...baseEngineOutput,
      limiters: {
        limiters: [
          {
            id: 'mains-flow-constraint',
            title: 'Mains Flow Constraint',
            severity: 'warn',
            observed: { label: 'Flow', value: 8, unit: 'L/min' },
            limit: { label: 'Min flow', value: 10, unit: 'L/min' },
            impact: { summary: 'Mains flow below unvented threshold' },
            confidence: 'medium',
            sources: [],
            suggestedFixes: [],
          },
        ],
      },
    };

    const plan = buildPathwaysV1(
      snapshotFromResult(output, { mainsDynamicFlowLpm: 8 }),
      undefined,
    );

    expect(plan.sharedConstraints).toHaveLength(1);
    expect(plan.sharedConstraints[0].limiterId).toBe('mains-flow-constraint');
    expect(plan.sharedConstraints[0].summary).toBe('Mains flow below unvented threshold');
  });
});

// ─── Test: always at least one pathway returned ────────────────────────────────

describe('buildPathwaysV1 — fallback', () => {
  it('returns at least one pathway even with no viable options', () => {
    const noAshpOutput: EngineOutputV1 = {
      ...baseEngineOutput,
      eligibility: [
        { id: 'on_demand', label: 'Combi', status: 'rejected', reason: '' },
        { id: 'stored_vented', label: 'Stored Vented', status: 'rejected', reason: '' },
        { id: 'stored_unvented', label: 'Stored Unvented', status: 'rejected', reason: '' },
        { id: 'ashp', label: 'ASHP', status: 'rejected', reason: '' },
      ],
    };

    const plan = buildPathwaysV1(
      {
        engineOutput: noAshpOutput,
        ashpViable: false,
        ashpHydraulicPass: false,
        screedLeakRisk: false,
        primaryPipeConstraintFail: false,
        combiViable: false,
        mainsDynamicFlowLpm: 15,
      },
      undefined,
    );

    expect(plan.pathways.length).toBeGreaterThan(0);
  });
});
