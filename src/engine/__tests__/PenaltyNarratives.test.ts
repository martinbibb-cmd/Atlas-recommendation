import { describe, it, expect } from 'vitest';
import { PENALTY_NARRATIVES, NARRATIVE_EXCLUDED_IDS, selectTopNarrativePenalties } from '../scoring/penaltyNarratives';
import { PENALTY_IDS } from '../../contracts/scoring.penaltyIds';
import { buildOptionMatrixV1 } from '../OptionMatrixBuilder';
import { runEngine } from '../Engine';
import { buildEngineOutputV1 } from '../OutputBuilder';

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

describe('PENALTY_NARRATIVES — mapping shape', () => {
  it('cws.measurements_missing maps to expected why string', () => {
    const narrative = PENALTY_NARRATIVES[PENALTY_IDS.CWS_MEASUREMENTS_MISSING];
    expect(narrative).toBeDefined();
    expect(narrative!.why).toContain('flow @ pressure');
    expect(narrative!.requirement).toBeUndefined();
  });

  it('boiler.oversize_aggressive maps to expected why string', () => {
    const narrative = PENALTY_NARRATIVES[PENALTY_IDS.BOILER_OVERSIZE_AGGRESSIVE];
    expect(narrative).toBeDefined();
    expect(narrative!.why).toContain('short-cycle');
  });

  it('ashp.pipe_upgrade_required maps to requirement (no why)', () => {
    const narrative = PENALTY_NARRATIVES[PENALTY_IDS.ASHP_PIPE_UPGRADE_REQUIRED];
    expect(narrative).toBeDefined();
    expect(narrative!.requirement).toContain('28mm');
    expect(narrative!.why).toBeUndefined();
  });

  it('future.loft_conflict maps to requirement (no why)', () => {
    const narrative = PENALTY_NARRATIVES[PENALTY_IDS.FUTURE_LOFT_CONFLICT];
    expect(narrative).toBeDefined();
    expect(narrative!.requirement).toContain('Loft conversion');
    expect(narrative!.why).toBeUndefined();
  });

  it('pressure.borderline_unvented maps to both why and requirement', () => {
    const narrative = PENALTY_NARRATIVES[PENALTY_IDS.PRESSURE_BORDERLINE_UNVENTED];
    expect(narrative).toBeDefined();
    expect(narrative!.why).toContain('borderline');
    expect(narrative!.requirement).toContain('1.5 bar');
  });
});

describe('NARRATIVE_EXCLUDED_IDS — confidence penalties are excluded', () => {
  it('confidence.medium is in excluded set', () => {
    expect(NARRATIVE_EXCLUDED_IDS.has(PENALTY_IDS.CONFIDENCE_MEDIUM)).toBe(true);
  });

  it('confidence.low is in excluded set', () => {
    expect(NARRATIVE_EXCLUDED_IDS.has(PENALTY_IDS.CONFIDENCE_LOW)).toBe(true);
  });

  it('assumption.warn_count is in excluded set', () => {
    expect(NARRATIVE_EXCLUDED_IDS.has(PENALTY_IDS.ASSUMPTION_WARN_COUNT)).toBe(true);
  });

  it('option.rejected is in excluded set', () => {
    expect(NARRATIVE_EXCLUDED_IDS.has(PENALTY_IDS.OPTION_REJECTED)).toBe(true);
  });

  it('cws.measurements_missing is NOT in excluded set', () => {
    expect(NARRATIVE_EXCLUDED_IDS.has(PENALTY_IDS.CWS_MEASUREMENTS_MISSING)).toBe(false);
  });
});

describe('Narrative injection — why bullets are appended from penalties', () => {
  it('ashp.pipe_upgrade_required injects requirement bullet for ASHP', () => {
    // 22mm pipe triggers ashp.pipe_upgrade_required penalty
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const ashp = options.find(o => o.id === 'ashp')!;

    const hasPipeReq = ashp.requirements.some(r => r.includes('28mm'));
    expect(hasPipeReq).toBe(true);
  });

  it('confidence penalties do not appear in why bullets', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    for (const card of options) {
      const confidenceNarrative = [
        'Confidence: medium',
        'Confidence: low',
        'assumption(s)',
      ];
      for (const bullet of card.why) {
        for (const fragment of confidenceNarrative) {
          expect(bullet).not.toContain(fragment);
        }
      }
    }
  });

  it('no duplicate why bullets are injected', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    for (const card of options) {
      const seen = new Set<string>();
      for (const bullet of card.why) {
        expect(seen.has(bullet)).toBe(false);
        seen.add(bullet);
      }
    }
  });

  it('no duplicate requirement bullets are injected', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    for (const card of options) {
      const seen = new Set<string>();
      for (const req of card.requirements) {
        expect(seen.has(req)).toBe(false);
        seen.add(req);
      }
    }
  });

  it('loft conflict injects requirement into stored_vented', () => {
    const input = { ...baseInput, futureLoftConversion: true };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const storedVented = options.find(o => o.id === 'stored_vented')!;

    const hasLoftReq = storedVented.requirements.some(r => r.includes('Loft conversion'));
    expect(hasLoftReq).toBe(true);
  });

  it('cws.measurements_missing injects why bullet for unvented options', () => {
    // No mains supply measurements provided (hasMeasurements = false)
    const input = { ...baseInput, dynamicMainsPressure: 1.2 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'stored_unvented')!;

    const hasWhyBullet = unvented.why.some(w => w.includes('flow @ pressure'));
    expect(hasWhyBullet).toBe(true);
  });
});

describe('Narrative grouping — at most one narrative per group per card', () => {
  it('multiple water_supply penalties → only one narrative bullet injected', () => {
    // cws.measurements_missing (water_supply) and pressure.borderline_unvented (water_supply)
    // cannot both appear because they share the same group.
    // At 1.2 bar with no measurements, both penalties apply to stored_unvented;
    // but the higher-penalty one wins and the second is skipped.
    const input = { ...baseInput, dynamicMainsPressure: 1.2 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'stored_unvented')!;

    const waterSupplyNarratives = Object.entries(PENALTY_NARRATIVES)
      .filter(([, n]) => n?.group === 'water_supply')
      .map(([, n]) => n!);

    const injectedWaterSupplyBullets = unvented.why.filter(w =>
      waterSupplyNarratives.some(n => n.why && w === n.why),
    ).concat(
      unvented.requirements.filter(r =>
        waterSupplyNarratives.some(n => n.requirement && r === n.requirement),
      ),
    );

    expect(injectedWaterSupplyBullets.length).toBeLessThanOrEqual(1);
  });

  it('selectTopNarrativePenalties skips second item sharing the same group', () => {
    const breakdown = [
      { id: PENALTY_IDS.CWS_MEASUREMENTS_MISSING, penalty: 8 },
      { id: PENALTY_IDS.CWS_QUALITY_WEAK, penalty: 12 },
      { id: PENALTY_IDS.BOILER_OVERSIZE_MODERATE, penalty: 8 },
    ];
    const selected = selectTopNarrativePenalties(breakdown, 3);
    // cws.quality_weak (12) wins over cws.measurements_missing (8) in water_supply group
    expect(selected.map(s => s.id)).not.toContain(PENALTY_IDS.CWS_MEASUREMENTS_MISSING);
    expect(selected.map(s => s.id)).toContain(PENALTY_IDS.CWS_QUALITY_WEAK);
    expect(selected.length).toBe(2);
  });
});

describe('explainerId wiring — explainer stub is surfaced in EngineOutputV1', () => {
  it('pressure.borderline_unvented explainerId results in explainer in engineOutput', () => {
    // 1.2 bar dynamic with flow measurement: hasMeasurements=true, triggers pressure.borderline_unvented
    const input = {
      ...baseInput,
      dynamicMainsPressure: 1.2,
      mainsDynamicFlowLpm: 14,
    };
    const result = runEngine(input);
    const output = buildEngineOutputV1(result, input);

    const narrative = PENALTY_NARRATIVES[PENALTY_IDS.PRESSURE_BORDERLINE_UNVENTED]!;
    expect(narrative.explainerId).toBeDefined();

    const explainerIds = output.explainers.map(e => e.id);
    expect(explainerIds).toContain(narrative.explainerId!);
  });

  it('explainer stub has non-empty body and id matching the narrative explainerId', () => {
    const input = {
      ...baseInput,
      dynamicMainsPressure: 1.2,
      mainsDynamicFlowLpm: 14,
    };
    const result = runEngine(input);
    const output = buildEngineOutputV1(result, input);

    const narrative = PENALTY_NARRATIVES[PENALTY_IDS.PRESSURE_BORDERLINE_UNVENTED]!;
    const explainer = output.explainers.find(e => e.id === narrative.explainerId);
    expect(explainer).toBeDefined();
    expect(explainer!.body.length).toBeGreaterThan(0);
  });
});
