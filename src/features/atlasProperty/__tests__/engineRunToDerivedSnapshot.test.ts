/**
 * engineRunToDerivedSnapshot.test.ts
 */

import { describe, it, expect } from 'vitest';
import { engineRunToDerivedSnapshot } from '../adapters/engineRunToDerivedSnapshot';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { EngineRunMeta } from '../types/atlasPropertyAdapter.types';

// ─── Minimal engine output fixture ───────────────────────────────────────────

const MINIMAL_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'combi' },
  explainers: [],
  options: [
    {
      id: 'combi',
      label: 'Combination Boiler',
      status: 'viable',
      headline: 'Best fit for this property',
      requirements: [],
      why: [],
      heat:        { status: 'ok', headline: '', bullets: [] },
      dhw:         { status: 'ok', headline: '', bullets: [] },
      engineering: { status: 'ok', headline: '', bullets: [] },
      typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
    },
    {
      id: 'stored_vented',
      label: 'Regular Boiler + Vented Cylinder',
      status: 'caution',
      headline: 'Worth considering',
      requirements: [],
      why: [],
      heat:        { status: 'ok',     headline: '', bullets: [] },
      dhw:         { status: 'caution', headline: '', bullets: [] },
      engineering: { status: 'ok',     headline: '', bullets: [] },
      typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
    },
    {
      id: 'ashp',
      label: 'Air Source Heat Pump',
      status: 'rejected',
      headline: 'Not suitable — undersized emitters',
      requirements: [],
      why: [],
      heat:        { status: 'na', headline: '', bullets: [] },
      dhw:         { status: 'na', headline: '', bullets: [] },
      engineering: { status: 'na', headline: '', bullets: [] },
      typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
    },
  ],
};

const META: EngineRunMeta = {
  runId: 'run_abc123',
  ranAt: '2024-06-01T10:00:00Z',
  usedInput: {
    heatLossWatts: 8500,
    dynamicMainsPressureBar: 2.5,
    mainsDynamicFlowLpm: 18,
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('engineRunToDerivedSnapshot', () => {
  describe('derived model', () => {
    it('echoes peak heat loss from usedInput as derived.heatLoss.peakWatts', () => {
      const { derived } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, META);
      expect(derived.heatLoss?.peakWatts?.value).toBe(8500);
      expect(derived.heatLoss?.peakWatts?.source).toBe('derived');
    });

    it('echoes dynamic pressure from usedInput as derived.hydraulics.dynamicPressureBar', () => {
      const { derived } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, META);
      expect(derived.hydraulics?.dynamicPressureBar?.value).toBe(2.5);
      expect(derived.hydraulics?.dynamicPressureBar?.source).toBe('measured');
      expect(derived.hydraulics?.dynamicPressureBar?.confidence).toBe('high');
    });

    it('echoes flow rate from usedInput as derived.hydraulics.mainsFlowLpm', () => {
      const { derived } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, META);
      expect(derived.hydraulics?.mainsFlowLpm?.value).toBe(18);
    });

    it('stores engineInputSnapshot from usedInput', () => {
      const { derived } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, META);
      expect(derived.engineInputSnapshot).toEqual(META.usedInput);
    });

    it('omits heatLoss when usedInput has no peakHeatLossKw', () => {
      const meta: EngineRunMeta = { runId: 'run_x', usedInput: {} };
      const { derived } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, meta);
      expect(derived.heatLoss).toBeUndefined();
    });

    it('omits hydraulics when usedInput has no pressure or flow', () => {
      const meta: EngineRunMeta = {
        runId: 'run_x',
        usedInput: { heatLossWatts: 5000 },
      };
      const { derived } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, meta);
      expect(derived.hydraulics).toBeUndefined();
    });
  });

  describe('recommendations workspace', () => {
    it('sets engineRef to meta.runId', () => {
      const { recommendations } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, META);
      expect(recommendations.engineRef).toBe('run_abc123');
    });

    it('sets lastRunAt to meta.ranAt', () => {
      const { recommendations } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, META);
      expect(recommendations.lastRunAt).toBe('2024-06-01T10:00:00Z');
    });

    it('uses ISO timestamp when ranAt is absent', () => {
      const meta: EngineRunMeta = { runId: 'run_y' };
      const { recommendations } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, meta);
      expect(recommendations.lastRunAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('sets status to draft', () => {
      const { recommendations } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, META);
      expect(recommendations.status).toBe('draft');
    });

    it('produces one item per engine option', () => {
      const { recommendations } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, META);
      expect(recommendations.items).toHaveLength(3);
    });

    it('maps combi option id to replacement_boiler category', () => {
      const { recommendations } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, META);
      const combiItem = recommendations.items.find(i => i.label === 'Combination Boiler');
      expect(combiItem?.category).toBe('replacement_boiler');
    });

    it('maps ashp option id to air_source_heat_pump category', () => {
      const { recommendations } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, META);
      const ashpItem = recommendations.items.find(i => i.label === 'Air Source Heat Pump');
      expect(ashpItem?.category).toBe('air_source_heat_pump');
    });

    it('sets all items status to draft regardless of engine option status', () => {
      const { recommendations } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, META);
      for (const item of recommendations.items) {
        expect(item.status).toBe('draft');
      }
    });

    it('promotes primary recommendation option to rank 1', () => {
      const { recommendations } = engineRunToDerivedSnapshot(MINIMAL_OUTPUT, META);
      // recommendation.primary is 'combi' so the combi item should be rank 1
      const rank1 = recommendations.items.find(i => i.rank === 1);
      expect(rank1?.label).toBe('Combination Boiler');
    });

    it('produces empty items when engine output has no options', () => {
      const output: EngineOutputV1 = { ...MINIMAL_OUTPUT, options: undefined };
      const { recommendations } = engineRunToDerivedSnapshot(output, META);
      expect(recommendations.items).toHaveLength(0);
    });
  });
});
