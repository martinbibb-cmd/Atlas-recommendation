import { describe, it, expect } from 'vitest';
import { runEngine } from '../Engine';
import { FAMILY_TO_ELIGIBILITY_ID } from '../OutputBuilder';

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
};

describe('EngineOutputV1 shape', () => {
  it('includes engineOutput in runEngine result', () => {
    const result = runEngine(baseInput);
    expect(result.engineOutput).toBeDefined();
  });

  it('engineOutput has required fields', () => {
    const { engineOutput } = runEngine(baseInput);
    expect(Array.isArray(engineOutput.eligibility)).toBe(true);
    expect(Array.isArray(engineOutput.redFlags)).toBe(true);
    expect(typeof engineOutput.recommendation.primary).toBe('string');
    expect(engineOutput.recommendation.primary.length).toBeGreaterThan(0);
    expect(Array.isArray(engineOutput.explainers)).toBe(true);
  });

  it('eligibility always contains on_demand, stored_vented, stored_unvented, ashp', () => {
    const { engineOutput } = runEngine(baseInput);
    const ids = engineOutput.eligibility.map(e => e.id);
    expect(ids).toContain('on_demand');
    expect(ids).toContain('stored_vented');
    expect(ids).toContain('stored_unvented');
    expect(ids).toContain('ashp');
  });

  it('eligibility items have valid status values', () => {
    const { engineOutput } = runEngine(baseInput);
    for (const item of engineOutput.eligibility) {
      expect(['viable', 'rejected', 'caution']).toContain(item.status);
    }
  });

  it('eligibility labels are stable for a given input', () => {
    const { engineOutput } = runEngine(baseInput);
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    const storedVented = engineOutput.eligibility.find(e => e.id === 'stored_vented')!;
    const storedUnvented = engineOutput.eligibility.find(e => e.id === 'stored_unvented')!;
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(onDemand.label).toBe('On Demand (Combi)');
    expect(storedVented.label).toBe('Stored hot water — Vented cylinder');
    expect(storedUnvented.label).toBe('Stored hot water — Unvented cylinder');
    expect(ashp.label).toBe('Air Source Heat Pump');
  });

  it('combi is caution (not rejected) when 2+ bathrooms + high occupancy + peakConcurrentOutlets=2 — demand-side advisory', () => {
    // Under the no-hard-stops policy, demand-side failures (simultaneous demand, large household)
    // are advisory. Combi is heavily penalised in the ranking but must remain selectable.
    const { engineOutput } = runEngine({ ...baseInput, bathroomCount: 2, highOccupancy: true, peakConcurrentOutlets: 2 });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('caution');
  });

  it('combi is caution (not rejected) when bathroomCount >= 2 — simultaneous demand is advisory under no-hard-stops policy', () => {
    // Under no-hard-stops policy, bathroomCount >= 2 triggers a 'limit' limiter
    // that heavily penalises combi in the ranking but does not prevent selection
    // when combi is still the best available option.
    const { engineOutput } = runEngine({ ...baseInput, currentHeatSourceType: 'combi' as const, bathroomCount: 2, highOccupancy: false });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('caution');
  });

  it('combi is caution (not rejected) when peakConcurrentOutlets >= 2 — advisory under no-hard-stops policy', () => {
    // Same advisory policy: concurrent outlets >= 2 is a demand-side advisory,
    // not a physical impossibility. Combi remains selectable with strong caveats.
    const { engineOutput } = runEngine({ ...baseInput, currentHeatSourceType: 'combi' as const, bathroomCount: 2, peakConcurrentOutlets: 2 });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('caution');
  });

  it('combi is viable for 1 bathroom + low occupancy + professional signature', () => {
    const { engineOutput } = runEngine(baseInput);
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('viable');
  });

  it('stored_vented is rejected when existing loft conversion present', () => {
    const { engineOutput } = runEngine({ ...baseInput, hasLoftConversion: true });
    const storedVented = engineOutput.eligibility.find(e => e.id === 'stored_vented')!;
    expect(storedVented.status).toBe('rejected');
  });

  it('ashp is caution for 22mm pipes with high heat loss', () => {
    const { engineOutput } = runEngine({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 10000 });
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(ashp.status).toBe('caution');
  });

  it('ashp is rejected for one-pipe topology', () => {
    const { engineOutput } = runEngine({ ...baseInput, pipingTopology: 'one_pipe' });
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(ashp.status).toBe('rejected');
  });

  it('red flags have valid severity values', () => {
    const { engineOutput } = runEngine({ ...baseInput, bathroomCount: 2, highOccupancy: true });
    for (const flag of engineOutput.redFlags) {
      expect(['info', 'warn', 'fail']).toContain(flag.severity);
      expect(typeof flag.title).toBe('string');
      expect(typeof flag.detail).toBe('string');
      expect(flag.title.length).toBeGreaterThan(0);
    }
  });

  it('meta block contains engineVersion and contractVersion', () => {
    const { engineOutput } = runEngine(baseInput);
    expect(engineOutput.meta?.engineVersion).toBe('0.2.0');
    expect(engineOutput.meta?.contractVersion).toBe('2.3');
  });

  it('recommendation primary is non-empty string for all occupancy signatures', () => {
    const signatures = ['professional', 'steady_home', 'shift_worker', 'steady', 'shift'] as const;
    for (const sig of signatures) {
      const { engineOutput } = runEngine({ ...baseInput, occupancySignature: sig });
      expect(typeof engineOutput.recommendation.primary).toBe('string');
      expect(engineOutput.recommendation.primary.length).toBeGreaterThan(0);
    }
  });

  // ── HydraulicModuleV1 driving ASHP eligibility ────────────────────────────

  it('ashp is caution (not rejected) when hydraulicV1 ashpRisk is fail (22mm + 14kW) — hydraulic advisory', () => {
    // Hydraulic risk is advisory under the no-hard-stops policy. ASHP remains selectable
    // with caveats. Only physical impossibilities (one-pipe topology, no outdoor space) → 'rejected'.
    const { engineOutput } = runEngine({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 14000 });
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(ashp.status).toBe('caution');
  });

  it('ashp is caution when hydraulicV1 ashpRisk is warn (22mm + 8kW)', () => {
    const { engineOutput } = runEngine({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 8000 });
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(ashp.status).toBe('caution');
  });

  it('ashp is viable for 28mm + 14kW (hydraulicV1 ashpRisk pass)', () => {
    const { engineOutput } = runEngine({ ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 14000 });
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(ashp.status).toBe('viable');
  });

  it('ashp caution for 22mm + 14kW has a reason string', () => {
    const { engineOutput } = runEngine({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 14000 });
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(typeof ashp.reason).toBe('string');
    expect((ashp.reason as string).length).toBeGreaterThan(0);
  });

  it('hydraulic ASHP explainer present when ashpRisk is not pass', () => {
    const { engineOutput } = runEngine({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 8000 });
    const explainer = engineOutput.explainers.find(e => e.id === 'hydraulic-ashp-flow');
    expect(explainer).toBeDefined();
    expect(explainer!.body).toContain('4.0×');
  });

  it('hydraulicV1 is present in full engine result', () => {
    const result = runEngine(baseInput);
    expect(result.hydraulicV1).toBeDefined();
    expect(result.hydraulicV1.boiler.flowLpm).toBeGreaterThan(0);
    expect(result.hydraulicV1.ashp.flowLpm).toBeGreaterThan(0);
  });

  // ── CombiDhwModuleV1 driving On Demand eligibility ───────────────────────

  it('on_demand is caution (not rejected) when pressure is between 0.3 and 1.0 bar', () => {
    // 0.8 bar is between 0.3 (absolute min) and 1.0 (min for max flow): warn, not reject
    // currentHeatSourceType: 'combi' is needed so CombiDhwModuleV1 runs and emits the pressure warn
    const { engineOutput } = runEngine({
      ...baseInput,
      currentHeatSourceType: 'combi' as const,
      dynamicMainsPressure: 0.8,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
    });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('caution');
  });

  it('on_demand is rejected when pressure is below 0.3 bar (absolute minimum operating condition)', () => {
    const { engineOutput } = runEngine({ ...baseInput, dynamicMainsPressure: 0.2, bathroomCount: 1 });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('rejected');
  });

  it('on_demand is caution when peakConcurrentOutlets >= 2 (simultaneous demand — advisory, not hard block)', () => {
    // Under the no-hard-stops policy, simultaneous demand risk is advisory.
    // Combi is heavily penalised in the recommendation ranking but must remain
    // selectable when it is still the best available option for the household.
    const { engineOutput } = runEngine({ ...baseInput, currentHeatSourceType: 'combi' as const, bathroomCount: 1, peakConcurrentOutlets: 2 });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('caution');
  });

  it('on_demand is caution for steady_home signature with 1 bathroom + 1 outlet', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      currentHeatSourceType: 'combi' as const,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancySignature: 'steady_home',
    });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('caution');
  });

  it('on_demand is caution for steady signature (V3 alias) with 1 bathroom + 1 outlet', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      currentHeatSourceType: 'combi' as const,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancySignature: 'steady',
    });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('caution');
  });

  it('combiDhwV1 flags are included in engineOutput.redFlags', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      currentHeatSourceType: 'combi' as const,
      dynamicMainsPressure: 0.5,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
    });
    const pressureFlag = engineOutput.redFlags.find(f => f.id === 'combi-pressure-constraint');
    expect(pressureFlag).toBeDefined();
    // 0.5 bar is between 0.3 (absolute min) and 1.0 (min for max flow) — severity is warn, not fail
    expect(pressureFlag!.severity).toBe('warn');
  });

  it('short-draw explainer present when occupancy is steady_home', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      currentHeatSourceType: 'combi' as const,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancySignature: 'steady_home',
    });
    const explainer = engineOutput.explainers.find(e => e.id === 'combi-short-draw-collapse');
    expect(explainer).toBeDefined();
    expect(explainer!.body).toContain('28 %');
  });

  it('combiDhwV1 is present in full engine result when currentHeatSourceType is combi', () => {
    const result = runEngine({ ...baseInput, currentHeatSourceType: 'combi' as const });
    expect(result.combiDhwV1).toBeDefined();
    expect(['pass', 'warn', 'fail']).toContain(result.combiDhwV1!.verdict.combiRisk);
  });

  // ── StoredDhwModuleV1 driving Stored eligibility ──────────────────────────

  it('storedDhwV1 is present in full engine result', () => {
    const result = runEngine(baseInput);
    expect(result.storedDhwV1).toBeDefined();
    expect(['pass', 'warn']).toContain(result.storedDhwV1.verdict.storedRisk);
  });

  it('stored_vented is caution when space is tight and high demand (2 bathrooms)', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      availableSpace: 'tight',
      bathroomCount: 2,
    });
    const storedVented = engineOutput.eligibility.find(e => e.id === 'stored_vented')!;
    expect(storedVented.status).toBe('caution');
  });

  it('stored_vented is viable when availableSpace is "ok" and low demand', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      availableSpace: 'ok',
      bathroomCount: 1,
    });
    const storedVented = engineOutput.eligibility.find(e => e.id === 'stored_vented')!;
    expect(storedVented.status).toBe('viable');
  });

  it('stored_vented is caution when availableSpace is not specified (space unknown)', () => {
    const { engineOutput } = runEngine({ ...baseInput, bathroomCount: 1 });
    const storedVented = engineOutput.eligibility.find(e => e.id === 'stored_vented')!;
    expect(storedVented.status).toBe('caution');
  });

  it('storedDhwV1 flags are included in engineOutput.redFlags', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      availableSpace: 'tight',
      bathroomCount: 2,
    });
    const spaceFlag = engineOutput.redFlags.find(f => f.id === 'stored-space-tight');
    expect(spaceFlag).toBeDefined();
    expect(spaceFlag!.severity).toBe('warn');
  });

  it('Mixergy explainer present when stored recommendation is mixergy', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      availableSpace: 'ok',
      bathroomCount: 2,
    });
    const explainer = engineOutput.explainers.find(e => e.id === 'stored-mixergy-suggested');
    expect(explainer).toBeDefined();
    expect(explainer!.body).toContain('Mixergy');
  });

  // ── Recommendation resolver V1 ────────────────────────────────────────────

  it('recommendation primary is "Stored hot water — Unvented cylinder" when on_demand is caution (high demand) and stored unvented is viable', () => {
    // 2 bathrooms + 2 concurrent outlets → combi_dhw_demand_risk 'limit' penalty → combi caution;
    // stored_unvented scores highest due to 14 L/min @ 2.5 bar operating point.
    // hasLoftConversion: true independently makes stored_vented caution.
    // Under no-hard-stops policy, combi is caution (not rejected) but heavily penalised in ranking.
    const { engineOutput } = runEngine({
      ...baseInput,
      currentHeatSourceType: 'combi' as const,
      bathroomCount: 2,
      peakConcurrentOutlets: 2,
      hasLoftConversion: true,   // independently makes stored_vented caution
      mainsDynamicFlowLpm: 14,   // qualifies stored_unvented (10 L/min @ 1 bar threshold)
      currentBoilerAgeYears: 10, // reduces missingKeyCount for medium confidence
      currentBoilerOutputKw: 24, // reduces missingKeyCount for medium confidence
    });
    expect(engineOutput.recommendation.primary).toBe('Stored hot water — Unvented cylinder');
  });

  it('recommendation primary is canonical bestOverall label when combi is heavily penalised and all remaining options have caveats', () => {
    // PR6a: The canonical recommendation source (bestOverall) is used.
    // Old heuristic: "Multiple options need review" when 0 viable options.
    // New canonical: bestOverall picks the highest-scoring eligible candidate
    // even when it is "suitable_with_caveats" — more actionable than withholding.
    //
    // bathroomCount: 2 + highOccupancy → combi_dhw_demand_risk 'limit' penalty (combi caution)
    // mainsDynamicFlowLpm: 6 (below 10 L/min threshold) → stored_unvented caution; Mixergy recommended (high demand)
    // futureLoftConversion: true → stored_vented caution
    // 22mm + 8kW → ASHP caution
    const result = runEngine({
      ...baseInput,
      currentHeatSourceType: 'combi' as const,
      bathroomCount: 2,
      highOccupancy: true,
      dynamicMainsPressure: 2.5,
      mainsDynamicFlowLpm: 6,       // below 10 L/min → stored_unvented caution; !meetsUnventedRequirement
      futureLoftConversion: true,   // stored_vented caution
      currentBoilerAgeYears: 10,
      currentBoilerOutputKw: 24,
    });
    const { engineOutput, recommendationResult, cwsSupplyV1, storedDhwV1 } = result;
    // The canonical bestOverall picks the highest-scoring candidate with suitability
    // !== 'not_recommended'.  Assert that engineOutput.primary matches this.
    const bestFamily = recommendationResult.bestOverall?.family;
    if (bestFamily != null) {
      // Subtype-aware alignment check: 'system' family with low mains pressure
      // resolves to Mixergy (high demand) or vented (standard demand) rather than
      // always mapping to 'stored_unvented' — this is the root bug fix.
      let expectedLabel: string;
      if (bestFamily === 'system' && !cwsSupplyV1.meetsUnventedRequirement) {
        expectedLabel = storedDhwV1?.recommended.type === 'mixergy'
          ? 'Mixergy cylinder (stored hot water — pressure-tolerant)'
          : engineOutput.eligibility.find(e => e.id === 'stored_vented')?.label ?? 'Stored hot water — Vented or Mixergy cylinder';
      } else {
        const familyToId: Record<string, string> = {
          combi: 'on_demand', system: 'stored_unvented',
          heat_pump: 'ashp', regular: 'stored_vented', open_vented: 'stored_vented',
        };
        expectedLabel = engineOutput.eligibility.find(e => e.id === familyToId[bestFamily])?.label ?? bestFamily;
      }
      expect(engineOutput.recommendation.primary).toBe(expectedLabel);
    } else {
      // No eligible candidate at all — recommendation is withheld
      expect(engineOutput.recommendation.primary).toMatch(/withheld/i);
    }
    // Combi must not be recommended when heavily penalised by simultaneous demand constraints
    expect(engineOutput.recommendation.primary).not.toBe('On Demand (Combi)');
  });

  it('recommendation primary matches bestOverall for 28mm + steady_home + caution stored options', () => {
    // PR6a: engineOutput.recommendation.primary is derived from recommendationResult.bestOverall,
    // not from the old heuristic that would pick "Air Source Heat Pump" as the sole "viable" option.
    // The evidence-based ranking may prefer stored_unvented even when it has minor caveats if its
    // overall score exceeds ASHP's score for this input profile.
    //
    // 28mm + 8kW → ASHP has no pipe constraint; on_demand has occupancy caution;
    // stored unvented gate not met (9 L/min < 10 L/min) → !meetsUnventedRequirement;
    // stored vented has loft caution.
    const result = runEngine({
      ...baseInput,
      currentHeatSourceType: 'combi' as const,
      primaryPipeDiameter: 28,
      heatLossWatts: 8000,
      occupancySignature: 'steady_home',
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      hasLoftConversion: true,   // independently rejects stored_vented
      mainsDynamicFlowLpm: 9,    // below unvented gate (< 10 L/min) → !meetsUnventedRequirement
      currentBoilerAgeYears: 10, // reduces missingKeyCount for medium confidence
      currentBoilerOutputKw: 24, // reduces missingKeyCount for medium confidence
    });
    const { engineOutput, recommendationResult, cwsSupplyV1, storedDhwV1 } = result;
    // Assert alignment: headline must match canonical bestOverall (subtype-aware)
    const bestFamily = recommendationResult.bestOverall?.family;
    if (bestFamily != null) {
      let expectedLabel: string;
      if (bestFamily === 'system' && !cwsSupplyV1.meetsUnventedRequirement) {
        // Low-pressure system family: uses Mixergy or vented label, not stored_unvented
        expectedLabel = storedDhwV1?.recommended.type === 'mixergy'
          ? 'Mixergy cylinder (stored hot water — pressure-tolerant)'
          : engineOutput.eligibility.find(e => e.id === 'stored_vented')?.label ?? 'Stored hot water — Vented or Mixergy cylinder';
      } else {
        const familyToId: Record<string, string> = {
          combi: 'on_demand', system: 'stored_unvented',
          heat_pump: 'ashp', regular: 'stored_vented', open_vented: 'stored_vented',
        };
        expectedLabel = engineOutput.eligibility.find(e => e.id === familyToId[bestFamily])?.label ?? bestFamily;
      }
      expect(engineOutput.recommendation.primary).toBe(expectedLabel);
    }
  });

  it('recommendation primary is NOT "Air Source Heat Pump" when ASHP is caution (22mm pipes + steady_home)', () => {
    // Regression: ASHP with primary-pipe caution must NOT be auto-recommended
    const { engineOutput } = runEngine({
      ...baseInput,
      primaryPipeDiameter: 22,
      heatLossWatts: 8000,
      occupancySignature: 'steady_home',
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      mainsDynamicFlowLpm: 9,    // below unvented gate → stored unvented caution
      currentBoilerAgeYears: 10,
      currentBoilerOutputKw: 24,
    });
    expect(engineOutput.recommendation.primary).not.toBe('Air Source Heat Pump');
  });

  it('recommendation primary is "Recommendation withheld" when confidence is low', () => {
    // baseInput has low confidence (missing GC, age, output, flow) → recommendation withheld
    const { engineOutput } = runEngine(baseInput);
    expect(engineOutput.recommendation.primary).toBe('Recommendation withheld — not enough measured data');
  });

  // ── Dynamic-pressure-only note deduplication ─────────────────────────────

  it('contextSummary does not duplicate pressure info when only dynamic pressure is provided', () => {
    // baseInput has only dynamicMainsPressure — no static, no flow.
    // Both PressureModule.formattedBullet and CwsSupplyModule.notes would
    // otherwise produce a "dynamic only" pressure bullet; the OutputBuilder
    // should collapse this to a single bullet.
    const { engineOutput } = runEngine(baseInput);
    const bullets = engineOutput.contextSummary?.bullets ?? [];
    const dynamicOnlyBullets = bullets.filter(b =>
      b.toLowerCase().includes('dynamic') && b.toLowerCase().includes('bar'),
    );
    expect(dynamicOnlyBullets.length).toBe(1);
  });

  it('contextSummary retains CWS flow note when flow is measured', () => {
    // When L/min is provided, the CwsSupplyModule note is NOT a duplicate.
    const { engineOutput } = runEngine({ ...baseInput, mainsDynamicFlowLpm: 14 });
    const bullets = engineOutput.contextSummary?.bullets ?? [];
    expect(bullets.some(b => b.includes('L/min'))).toBe(true);
  });

  // ── VerdictV1 comparison context ──────────────────────────────────────────

  it('verdict has context="comparison" when ASHP limiter exists but boiler is recommended', () => {
    // 22mm + high heat loss → ASHP is limited, boiler recommended
    const { engineOutput } = runEngine({
      ...baseInput,
      primaryPipeDiameter: 22,
      heatLossWatts: 14000,
    });
    expect(engineOutput.verdict?.context).toBe('comparison');
    expect(engineOutput.verdict?.comparedTechnologies).toContain('ASHP');
  });

  it('verdict has context="single-tech" when ASHP is recommended (no ASHP limiter)', () => {
    // 28mm, steady_home → ASHP viable, no pipe constraint
    const { engineOutput } = runEngine({
      ...baseInput,
      primaryPipeDiameter: 28,
      heatLossWatts: 8000,
      occupancySignature: 'steady_home' as const,
    });
    expect(engineOutput.verdict?.context).toBe('single-tech');
    expect(engineOutput.verdict?.comparedTechnologies).toBeUndefined();
  });

  it('verdict primaryReason is a non-empty string when context is comparison', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      primaryPipeDiameter: 22,
      heatLossWatts: 14000,
    });
    if (engineOutput.verdict?.context === 'comparison') {
      expect(typeof engineOutput.verdict.primaryReason).toBe('string');
      expect((engineOutput.verdict.primaryReason ?? '').length).toBeGreaterThan(0);
    }
  });
});

// ─── PR6a: Recommendation source unification ─────────────────────────────────
//
// These tests assert that engineOutput.recommendation.primary is always derived
// from recommendationResult.bestOverall — so every surface (stepper headline,
// recommendation card, in-room view) reads from the same canonical ranked result.

describe('PR6a — unified recommendation source', () => {
  it('engineOutput.recommendation.primary agrees with recommendationResult.bestOverall for a combi-appropriate input', () => {
    // 1 bathroom, low occupancy, good pressure → combi should be best overall
    const result = runEngine({
      ...baseInput,
      bathroomCount: 1,
      occupancyCount: 1,
      dynamicMainsPressure: 2.5,
      dynamicMainsPressureBar: 2.5,
      mainsDynamicFlowLpm: 18,
    });

    const { engineOutput, recommendationResult } = result;
    const bestFamily = recommendationResult.bestOverall?.family;
    if (bestFamily == null) {
      // No best overall → recommendation may be withheld; primary must say so
      expect(engineOutput.recommendation.primary).toMatch(/withheld|multiple/i);
      return;
    }

    const eligibilityId = FAMILY_TO_ELIGIBILITY_ID[bestFamily];
    const expectedLabel = engineOutput.eligibility.find(e => e.id === eligibilityId)?.label;
    expect(engineOutput.recommendation.primary).toBe(expectedLabel ?? bestFamily);
  });

  it('engineOutput.recommendation.primary agrees with recommendationResult.bestOverall for a stored-system-appropriate input', () => {
    // 3 bathrooms, high occupancy → stored system should be best overall
    const result = runEngine({
      ...baseInput,
      bathroomCount: 3,
      occupancyCount: 5,
      highOccupancy: true,
      dynamicMainsPressure: 2.5,
      dynamicMainsPressureBar: 2.5,
      mainsDynamicFlowLpm: 20,
    });

    const { engineOutput, recommendationResult } = result;
    const bestFamily = recommendationResult.bestOverall?.family;
    if (bestFamily == null) return; // no best — skip (not the scenario under test)

    const eligibilityId = FAMILY_TO_ELIGIBILITY_ID[bestFamily];
    const expectedLabel = engineOutput.eligibility.find(e => e.id === eligibilityId)?.label;
    expect(engineOutput.recommendation.primary).toBe(expectedLabel ?? bestFamily);
  });

  it('engineOutput.recommendation.primary is never hard-coded to a system-boiler default when combi is bestOverall', () => {
    // Minimal single-person household → combi wins on space/disruption/eco
    const result = runEngine({
      ...baseInput,
      bathroomCount: 1,
      occupancyCount: 1,
      highOccupancy: false,
      dynamicMainsPressure: 2.5,
      dynamicMainsPressureBar: 2.5,
      mainsDynamicFlowLpm: 18,
    });

    const { engineOutput, recommendationResult } = result;
    const bestFamily = recommendationResult.bestOverall?.family;

    if (bestFamily === 'combi') {
      // combi won overall → headline must reflect combi, NOT stored/system
      expect(engineOutput.recommendation.primary).not.toMatch(/stored|system boiler/i);
      expect(engineOutput.recommendation.primary).toBe('On Demand (Combi)');
    }
  });

  it('recommendationResult is always present on runEngine output', () => {
    const result = runEngine(baseInput);
    expect(result.recommendationResult).toBeDefined();
    expect(result.recommendationResult.bestByObjective).toBeDefined();
    expect(result.recommendationResult.interventions).toBeDefined();
  });
});
