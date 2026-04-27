import { describe, it, expect } from 'vitest';
import { buildOptionMatrixV1 } from '../OptionMatrixBuilder';
import { runEngine } from '../Engine';

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

describe('buildOptionMatrixV1', () => {
  it('returns all 6 option cards', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    expect(options).toHaveLength(6);
    const ids = options.map(o => o.id);
    expect(ids).toContain('combi');
    expect(ids).toContain('stored_vented');
    expect(ids).toContain('stored_unvented');
    expect(ids).toContain('ashp');
    expect(ids).toContain('regular_vented');
    expect(ids).toContain('system_unvented');
  });

  it('each card has required fields', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    for (const card of options) {
      expect(typeof card.id).toBe('string');
      expect(typeof card.label).toBe('string');
      expect(typeof card.headline).toBe('string');
      expect(['viable', 'caution', 'rejected']).toContain(card.status);
      expect(Array.isArray(card.why)).toBe(true);
      expect(card.why.length).toBeGreaterThan(0);
      expect(Array.isArray(card.requirements)).toBe(true);
    }
  });

  it('combi card status matches combiDhwV1 verdict — caution when peakConcurrentOutlets >= 2 (no hard stop policy)', () => {
    // 2 bathrooms + 2 concurrent outlets → simultaneous demand → combi caution
    // Under the no-hard-stops policy, combi must remain selectable even with
    // high simultaneous demand — it is heavily penalised in scoring but not blocked.
    const combiInput = { ...baseInput, currentHeatSourceType: 'combi' as const, bathroomCount: 2, peakConcurrentOutlets: 2 };
    const result = runEngine(combiInput);
    const options = buildOptionMatrixV1(result, combiInput);
    const combi = options.find(o => o.id === 'combi')!;
    expect(combi.status).toBe('caution');
  });

  it('combi card is viable for single bathroom + good pressure + professional', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const combi = options.find(o => o.id === 'combi')!;
    expect(combi.status).toBe('viable');
  });

  it('stored_vented card is caution when space is tight', () => {
    // tight space → stored_vented caution
    const input = { ...baseInput, availableSpace: 'tight' as const, bathroomCount: 2 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const stored = options.find(o => o.id === 'stored_vented')!;
    expect(stored.status).toBe('caution');
  });

  it('stored_vented card is caution when futureLoftConversion is true', () => {
    const input = { ...baseInput, futureLoftConversion: true };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const stored = options.find(o => o.id === 'stored_vented')!;
    expect(stored.status).toBe('caution');
  });

  it('stored_vented card is viable even when unvented mains-flow is not confirmed (large household)', () => {
    // 4 occupants, 1 bath, unvented cold-water source, no mains flow measured.
    // StoredDhwModule emits stored-unvented-flow-unknown (warn) which should NOT
    // cascade into a caution status for the vented cylinder card — a vented cylinder
    // does not depend on the mains operating point at all.
    const input = {
      ...baseInput,
      coldWaterSource: 'mains_true' as const,
      occupancyCount: 4,
      bathroomCount: 1,
      availableSpace: 'ok' as const,
      // Deliberately omit mainsDynamicFlowLpm and mainsDynamicFlowLpmKnown
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ventedCard = options.find(o => o.id === 'stored_vented')!;
    expect(ventedCard.status).toBe('viable');
  });

  it('stored_vented card why bullets do not include unvented-specific mains-flow copy', () => {
    // Unvented mains-flow warnings are irrelevant to the vented card and should be filtered.
    const input = {
      ...baseInput,
      coldWaterSource: 'mains_true' as const,
      occupancyCount: 4,
      bathroomCount: 1,
      availableSpace: 'ok' as const,
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ventedCard = options.find(o => o.id === 'stored_vented')!;
    const whyText = ventedCard.why.join(' ');
    expect(whyText).not.toContain('unvented cylinder');
    expect(whyText).not.toContain('Mains flow');
    expect(whyText).not.toContain('stored-unvented');
  });

  it('stored_unvented why bullets do not duplicate the CWS mains-flow message', () => {
    // stored-unvented-flow-unknown and stored-unvented-low-flow are already surfaced
    // by the CWS supply check; they must not appear a second time in the why list.
    const input = {
      ...baseInput,
      coldWaterSource: 'mains_true' as const,
      occupancyCount: 4,
      bathroomCount: 1,
      availableSpace: 'ok' as const,
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unventedCard = options.find(o => o.id === 'stored_unvented')!;
    // Count occurrences of the mains-flow confirmation message
    const mainsFlowMentions = unventedCard.why.filter(w =>
      w.includes('Mains flow not confirmed') || w.includes('stored-unvented-flow-unknown'),
    );
    expect(mainsFlowMentions.length).toBeLessThanOrEqual(1);
  });

  it('stored_unvented headline leads with demand fit for large household with no measurements', () => {
    // 4+ occupants = high demand; headline should acknowledge demand suitability
    // even when mains supply hasn't been confirmed yet.
    const input = {
      ...baseInput,
      coldWaterSource: 'mains_true' as const,
      occupancyCount: 4,
      bathroomCount: 1,
      availableSpace: 'ok' as const,
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unventedCard = options.find(o => o.id === 'stored_unvented')!;
    // For a large household without measurements, the headline should lead positively
    // with demand suitability: "Unvented cylinder suits your demand profile — …"
    expect(unventedCard.headline).toContain('suits your demand profile');
    // And must mention confirming supply (the actual open constraint)
    expect(unventedCard.headline.toLowerCase()).toContain('confirm');
  });

  it('ashp card is caution when hydraulicV1 ashpRisk is fail (22mm + 14kW) — hydraulic advisory', () => {
    // Hydraulic risk is advisory — ashp card is caution, not rejected.
    // Only physical impossibilities (one-pipe topology, no outdoor space) → 'rejected'.
    const input = { ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 14000 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    expect(ashp.status).toBe('caution');
  });

  it('ashp card is viable for 28mm + 14kW', () => {
    const input = { ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 14000 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    expect(ashp.status).toBe('viable');
  });

  it('regular_vented card is rejected when futureLoftConversion is true', () => {
    const input = { ...baseInput, futureLoftConversion: true };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const regular = options.find(o => o.id === 'regular_vented')!;
    expect(regular.status).toBe('rejected');
  });

  it('system_unvented card is rejected for very low pressure (< 1.0 bar)', () => {
    const input = { ...baseInput, dynamicMainsPressure: 0.8 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'system_unvented')!;
    expect(unvented.status).toBe('rejected');
  });

  it('system_unvented card is caution for borderline pressure (1.0–1.5 bar) when no flow measured', () => {
    const input = { ...baseInput, dynamicMainsPressure: 1.2 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'system_unvented')!;
    expect(unvented.status).toBe('caution');
  });

  it('system_unvented card is viable for adequate pressure (≥ 1.5 bar)', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const unvented = options.find(o => o.id === 'system_unvented')!;
    expect(unvented.status).toBe('viable');
  });

  it('system_unvented card is viable for strong operating point (30 L/min @ 1.0 bar) — not caution', () => {
    // static 4.0 bar, dynamic 1.0 bar, flow 30 L/min: the full operating point meets the
    // unvented gate and must not be downgraded to 'caution' based on pressure alone.
    const input = {
      ...baseInput,
      staticMainsPressureBar: 4.0,
      dynamicMainsPressure: 1.0,
      mainsDynamicFlowLpm: 30,
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'system_unvented')!;
    expect(unvented.status).toBe('viable');
  });

  it('system_unvented headline does not contain "borderline" for strong operating point (30 L/min @ 1.0 bar)', () => {
    const input = {
      ...baseInput,
      staticMainsPressureBar: 4.0,
      dynamicMainsPressure: 1.0,
      mainsDynamicFlowLpm: 30,
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'system_unvented')!;
    expect(unvented.headline).not.toContain('borderline');
    expect(unvented.headline).not.toContain('Detected mains pressure');
  });

  it('stored_unvented why copy contains operating point (L/min @ bar) when flow is measured', () => {
    const input = {
      ...baseInput,
      dynamicMainsPressure: 1.0,
      mainsDynamicFlowLpm: 30,
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const stored = options.find(o => o.id === 'stored_unvented')!;
    // Should have operating point description, not just raw pressure
    const hasOperatingPoint = stored.why.some(w => w.includes('L/min') && w.includes('bar'));
    expect(hasOperatingPoint).toBe(true);
    // Should NOT say "Detected mains pressure"
    const hasOldWording = stored.why.some(w => w.includes('Detected mains pressure'));
    expect(hasOldWording).toBe(false);
  });

  it('stored_unvented requirements do not include boost pump for strong operating point (30 L/min @ 1.0 bar)', () => {
    const input = {
      ...baseInput,
      dynamicMainsPressure: 1.0,
      mainsDynamicFlowLpm: 30,
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const stored = options.find(o => o.id === 'stored_unvented')!;
    const hasBoostPump = stored.requirements.some(r => r.toLowerCase().includes('boost pump'));
    expect(hasBoostPump).toBe(false);
  });

  it('boost pump is NOT recommended when only dynamic pressure is low (no static reading)', () => {
    // Dynamic (working) pressure alone should never trigger a boost pump recommendation.
    // Only low static (standing) pressure is a valid trigger.
    const input = {
      ...baseInput,
      dynamicMainsPressure: 1.2,
      mainsDynamicFlowLpm: 15,
      // staticMainsPressureBar deliberately omitted
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);

    const stored = options.find(o => o.id === 'stored_unvented')!;
    const storedHasBoostPump =
      stored.requirements.some(r => r.toLowerCase().includes('boost pump')) ||
      (stored.typedRequirements.likelyUpgrades ?? []).some(r => r.toLowerCase().includes('boost pump'));
    expect(storedHasBoostPump).toBe(false);

    const sysUnvented = options.find(o => o.id === 'system_unvented')!;
    const sysHasBoostPump =
      sysUnvented.requirements.some(r => r.toLowerCase().includes('boost pump')) ||
      (sysUnvented.typedRequirements.likelyUpgrades ?? []).some(r => r.toLowerCase().includes('boost pump'));
    expect(sysHasBoostPump).toBe(false);

    const combi = options.find(o => o.id === 'combi')!;
    const combiHasBoostPump =
      combi.requirements.some(r => r.toLowerCase().includes('boost pump')) ||
      (combi.typedRequirements.likelyUpgrades ?? []).some(r => r.toLowerCase().includes('boost pump'));
    expect(combiHasBoostPump).toBe(false);
  });

  it('boost pump is NEVER recommended (even when static/standing pressure is low)', () => {
    // Boost pumps must never be recommended — per product requirements.
    // When static pressure is low, the recommendation should be Mixergy or vented cylinder.
    const input = {
      ...baseInput,
      dynamicMainsPressure: 1.2,
      staticMainsPressureBar: 1.2,
      mainsDynamicFlowLpm: 15,
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);

    const stored = options.find(o => o.id === 'stored_unvented')!;
    const storedHasBoostPump =
      stored.requirements.some(r => r.toLowerCase().includes('boost pump')) ||
      (stored.typedRequirements.likelyUpgrades ?? []).some(r => r.toLowerCase().includes('boost pump'));
    expect(storedHasBoostPump).toBe(false);

    const sysUnvented = options.find(o => o.id === 'system_unvented')!;
    const sysHasBoostPump =
      sysUnvented.requirements.some(r => r.toLowerCase().includes('boost pump')) ||
      (sysUnvented.typedRequirements.likelyUpgrades ?? []).some(r => r.toLowerCase().includes('boost pump'));
    expect(sysHasBoostPump).toBe(false);

    // Instead, low pressure should suggest Mixergy
    const storedSuggestsMixergy =
      stored.requirements.some(r => r.toLowerCase().includes('mixergy')) ||
      (stored.typedRequirements.likelyUpgrades ?? []).some(r => r.toLowerCase().includes('mixergy'));
    expect(storedSuggestsMixergy).toBe(true);
  });

  it('each card has heat, dhw, engineering planes', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    for (const card of options) {
      expect(card.heat).toBeDefined();
      expect(typeof card.heat.headline).toBe('string');
      expect(Array.isArray(card.heat.bullets)).toBe(true);
      expect(card.heat.bullets.length).toBeGreaterThan(0);

      expect(card.dhw).toBeDefined();
      expect(typeof card.dhw.headline).toBe('string');
      expect(Array.isArray(card.dhw.bullets)).toBe(true);
      expect(card.dhw.bullets.length).toBeGreaterThan(0);

      expect(card.engineering).toBeDefined();
      expect(typeof card.engineering.headline).toBe('string');
      expect(Array.isArray(card.engineering.bullets)).toBe(true);
      expect(card.engineering.bullets.length).toBeGreaterThan(0);
    }
  });

  it('each card has typedRequirements with mustHave, likelyUpgrades, niceToHave', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    for (const card of options) {
      expect(card.typedRequirements).toBeDefined();
      expect(Array.isArray(card.typedRequirements.mustHave)).toBe(true);
      expect(Array.isArray(card.typedRequirements.likelyUpgrades)).toBe(true);
      expect(Array.isArray(card.typedRequirements.niceToHave)).toBe(true);
    }
  });

  it('combi and stored_vented heat planes both describe same boiler wet-side physics', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const combi = options.find(o => o.id === 'combi')!;
    const stored = options.find(o => o.id === 'stored_vented')!;
    // Both should have 'ok' heat status (same wet-side physics)
    expect(combi.heat.status).toBe('ok');
    expect(stored.heat.status).toBe('ok');
  });

  it('combi DHW plane reflects combi risk verdict', () => {
    // 2 bathrooms → combi simultaneous demand → combi DHW caution
    // Must use combi family so that combiDhwV1 is populated.
    const input = { ...baseInput, currentHeatSourceType: 'combi' as const, bathroomCount: 2 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const combi = options.find(o => o.id === 'combi')!;
    expect(combi.dhw.status).toBe('caution');
  });

  it('ASHP heat plane status is caution when ashpRisk is fail', () => {
    const input = { ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 14000 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    expect(ashp.heat.status).toBe('caution');
  });

  it('ASHP heat plane headline reflects 35°C design flow for full_job emitter appetite', () => {
    const input = { ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 8000, retrofit: { emitterUpgradeAppetite: 'full_job' as const } };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    expect(ashp.heat.headline).toContain('35°C');
    expect(ashp.heat.headline).toContain('good');
  });

  it('ASHP heat plane headline reflects 50°C design flow for none emitter appetite', () => {
    const input = { ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 8000, retrofit: { emitterUpgradeAppetite: 'none' as const } };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    expect(ashp.heat.headline).toContain('50°C');
    expect(ashp.heat.headline).toContain('poor');
  });

  it('ASHP typedRequirements.likelyUpgrades changes when emitterUpgradeAppetite changes', () => {
    const inputNone = { ...baseInput, primaryPipeDiameter: 28, retrofit: { emitterUpgradeAppetite: 'none' as const } };
    const inputFull = { ...baseInput, primaryPipeDiameter: 28, retrofit: { emitterUpgradeAppetite: 'full_job' as const } };

    const optionsNone = buildOptionMatrixV1(runEngine(inputNone), inputNone);
    const optionsFull = buildOptionMatrixV1(runEngine(inputFull), inputFull);

    const ashpNone = optionsNone.find(o => o.id === 'ashp')!;
    const ashpFull = optionsFull.find(o => o.id === 'ashp')!;

    // none appetite: should mention unlocking lower flow temps
    expect(ashpNone.typedRequirements.likelyUpgrades.some(u => u.includes('unlock') || u.includes('lower flow'))).toBe(true);
    // full_job appetite: should mention full emitter upgrade
    expect(ashpFull.typedRequirements.likelyUpgrades.some(u => u.includes('full') || u.includes('35°C'))).toBe(true);
  });

  it('ASHP DHW plane always requires stored cylinder', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const ashp = options.find(o => o.id === 'ashp')!;
    expect(ashp.dhw.headline).toContain('stored cylinder');
    expect(ashp.dhw.status).toBe('ok');
  });

  it('system_unvented DHW plane status is caution for borderline pressure', () => {
    const input = { ...baseInput, dynamicMainsPressure: 1.2 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'system_unvented')!;
    expect(unvented.dhw.status).toBe('caution');
  });

  it('regular_vented engineering plane is caution when loft conversion present', () => {
    const input = { ...baseInput, futureLoftConversion: true };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const regular = options.find(o => o.id === 'regular_vented')!;
    expect(regular.engineering.status).toBe('caution');
  });
});

describe('engineOutput.options via runEngine', () => {
  it('engineOutput.options is populated when input is provided', () => {
    const { engineOutput } = runEngine(baseInput);
    expect(Array.isArray(engineOutput.options)).toBe(true);
    expect(engineOutput.options!.length).toBe(6);
  });

  it('engineOutput.options statuses are consistent with eligibility', () => {
    const { engineOutput } = runEngine(baseInput);
    const combiElig = engineOutput.eligibility.find(e => e.id === 'on_demand');
    const combiCard = engineOutput.options!.find(o => o.id === 'combi');
    expect(combiElig).toBeDefined();
    expect(combiCard).toBeDefined();
    // combi eligibility status should match card status
    expect(combiCard!.status).toBe(combiElig!.status);
  });

  it('engineOutput.contextSummary is populated with input fields', () => {
    const input = {
      ...baseInput,
      occupancyCount: 4,
      bedrooms: 3,
      currentHeatSourceType: 'combi' as const,
    };
    const { engineOutput } = runEngine(input);
    expect(engineOutput.contextSummary).toBeDefined();
    const bullets = engineOutput.contextSummary!.bullets;
    expect(bullets.some(b => b.includes('4') && b.includes('3-bed'))).toBe(true);
    expect(bullets.some(b => b.includes('Combi boiler'))).toBe(true);
  });

  it('engineOutput.contextSummary includes future flags when set', () => {
    const input = {
      ...baseInput,
      futureLoftConversion: true,
      futureAddBathroom: true,
    };
    const { engineOutput } = runEngine(input);
    const bullets = engineOutput.contextSummary!.bullets;
    expect(bullets.some(b => b.includes('Loft conversion'))).toBe(true);
    expect(bullets.some(b => b.includes('bathroom'))).toBe(true);
  });
});

describe('sensitivities on option cards', () => {
  it('all 6 option cards have a sensitivities array', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    for (const card of options) {
      expect(Array.isArray(card.sensitivities)).toBe(true);
    }
  });

  it('each sensitivity item has lever, effect, and note fields', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    for (const card of options) {
      for (const s of card.sensitivities ?? []) {
        expect(typeof s.lever).toBe('string');
        expect(s.lever.length).toBeGreaterThan(0);
        expect(['upgrade', 'downgrade']).toContain(s.effect);
        expect(typeof s.note).toBe('string');
        expect(s.note.length).toBeGreaterThan(0);
      }
    }
  });

  it('ASHP sensitivities mention pipe size threshold when hydraulics warn/fail (22mm + 14kW)', () => {
    const input = { ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 14000 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    const pipeSensitivity = ashp.sensitivities?.find(s => s.lever === 'Primary pipe size');
    expect(pipeSensitivity).toBeDefined();
    expect(pipeSensitivity!.effect).toBe('upgrade');
    expect(pipeSensitivity!.note).toContain('28mm');
    expect(pipeSensitivity!.note).toContain('22mm');
  });

  it('ASHP sensitivities include emitter upgrade lever', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const ashp = options.find(o => o.id === 'ashp')!;
    const emitterSensitivity = ashp.sensitivities?.find(s => s.lever === 'Emitter upgrade appetite');
    expect(emitterSensitivity).toBeDefined();
    expect(emitterSensitivity!.effect).toBe('upgrade');
  });

  it('ASHP sensitivities: viable pipe (28mm) shows downgrade note', () => {
    const input = { ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 14000 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    const pipeSensitivity = ashp.sensitivities?.find(s => s.lever === 'Primary pipe size');
    expect(pipeSensitivity).toBeDefined();
    expect(pipeSensitivity!.effect).toBe('downgrade');
  });

  it('combi sensitivities mention peak outlets when combi is caution (2 bathrooms — demand advisory)', () => {
    const input = { ...baseInput, currentHeatSourceType: 'combi' as const, bathroomCount: 2 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const combi = options.find(o => o.id === 'combi')!;
    const outletSensitivity = combi.sensitivities?.find(s => s.lever === 'Peak outlets at once');
    expect(outletSensitivity).toBeDefined();
    expect(outletSensitivity!.effect).toBe('upgrade');
    expect(outletSensitivity!.note).toContain('1');
  });

  it('combi sensitivities show downgrade note when combi is currently viable', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const combi = options.find(o => o.id === 'combi')!;
    const outletSensitivity = combi.sensitivities?.find(s => s.lever === 'Peak outlets at once');
    expect(outletSensitivity).toBeDefined();
    expect(outletSensitivity!.effect).toBe('downgrade');
  });

  it('stored_vented sensitivities mention space when space is tight', () => {
    const input = { ...baseInput, availableSpace: 'tight' as const };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const stored = options.find(o => o.id === 'stored_vented')!;
    const spaceSensitivity = stored.sensitivities?.find(s => s.lever === 'Available space');
    expect(spaceSensitivity).toBeDefined();
    expect(spaceSensitivity!.effect).toBe('upgrade');
  });

  it('system_unvented sensitivities mention mains pressure', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const unvented = options.find(o => o.id === 'system_unvented')!;
    const pressureSensitivity = unvented.sensitivities?.find(s => s.lever === 'Mains pressure');
    expect(pressureSensitivity).toBeDefined();
  });

  it('system_unvented: low pressure (< 1.0) shows upgrade sensitivity', () => {
    const input = { ...baseInput, dynamicMainsPressure: 0.8 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'system_unvented')!;
    const pressureSensitivity = unvented.sensitivities?.find(s => s.lever === 'Mains pressure');
    expect(pressureSensitivity!.effect).toBe('upgrade');
    expect(pressureSensitivity!.note).toContain('Mixergy');
  });

  it('regular_vented sensitivities mention loft conversion', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const regular = options.find(o => o.id === 'regular_vented')!;
    const loftSensitivity = regular.sensitivities?.find(s => s.lever === 'Loft conversion plan');
    expect(loftSensitivity).toBeDefined();
  });

  it('regular_vented: with loft conversion shows upgrade sensitivity', () => {
    const input = { ...baseInput, futureLoftConversion: true };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const regular = options.find(o => o.id === 'regular_vented')!;
    const loftSensitivity = regular.sensitivities?.find(s => s.lever === 'Loft conversion plan');
    expect(loftSensitivity!.effect).toBe('upgrade');
  });

  it('regular_vented: without loft conversion shows downgrade sensitivity', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const regular = options.find(o => o.id === 'regular_vented')!;
    const loftSensitivity = regular.sensitivities?.find(s => s.lever === 'Loft conversion plan');
    expect(loftSensitivity!.effect).toBe('downgrade');
  });

  it('stored_vented sensitivities mention loft conversion plan', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const vented = options.find(o => o.id === 'stored_vented')!;
    const loftSensitivity = vented.sensitivities?.find(s => s.lever === 'Loft conversion plan');
    expect(loftSensitivity).toBeDefined();
    expect(loftSensitivity!.effect).toBe('downgrade');
  });

  it('stored_unvented sensitivities mention mains pressure', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const unvented = options.find(o => o.id === 'stored_unvented')!;
    const pressureSensitivity = unvented.sensitivities?.find(s => s.lever === 'Mains pressure');
    expect(pressureSensitivity).toBeDefined();
  });
});

describe('PR4: stored_vented and stored_unvented status logic', () => {
  it('both stored_vented and stored_unvented cards exist in output', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const ids = options.map(o => o.id);
    expect(ids).toContain('stored_vented');
    expect(ids).toContain('stored_unvented');
    expect(ids).not.toContain('stored');
  });

  it('stored_unvented is caution when mains pressure < 1.0 bar (no flow measurement — need to confirm with flow test)', () => {
    // With new flow-based gate: low pressure alone → caution (not rejected), because 12 L/min at 0 bar is valid
    const input = { ...baseInput, dynamicMainsPressure: 0.8 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'stored_unvented')!;
    // No flow measurement → hasMeasurements false → caution
    expect(unvented.status).toBe('caution');
  });

  it('stored_unvented is caution when hasMeasurements=false (no flow measurement)', () => {
    // Without mainsDynamicFlowLpm, cwsSupplyV1.hasMeasurements will be false
    const input = { ...baseInput, dynamicMainsPressure: 2.0 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'stored_unvented')!;
    // hasMeasurements=false when no flow measurement is given
    expect(unvented.status).toBe('caution');
  });

  it('stored_vented is not blocked by missing mains measurements', () => {
    // stored_vented does not require mains flow/pressure measurements
    const input = { ...baseInput, dynamicMainsPressure: 2.0 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const vented = options.find(o => o.id === 'stored_vented')!;
    // Should be viable (no loft conversion, adequate space, no storedRisk warn)
    expect(vented.status).toBe('viable');
  });

  it('stored_vented is caution when futureLoftConversion is true', () => {
    const input = { ...baseInput, futureLoftConversion: true };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const vented = options.find(o => o.id === 'stored_vented')!;
    expect(vented.status).toBe('caution');
  });

  it('stored_vented is caution when availableSpace is tight', () => {
    const input = { ...baseInput, availableSpace: 'tight' as const };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const vented = options.find(o => o.id === 'stored_vented')!;
    expect(vented.status).toBe('caution');
  });

  it('stored_vented label uses correct customer-facing copy', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const vented = options.find(o => o.id === 'stored_vented')!;
    expect(vented.label).toBe('Stored hot water — Vented cylinder');
  });

  it('stored_unvented label uses correct customer-facing copy', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const unvented = options.find(o => o.id === 'stored_unvented')!;
    expect(unvented.label).toBe('Stored hot water — Unvented cylinder');
  });

  it('stored_unvented requirements mention sealed circuit and system boiler', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const unvented = options.find(o => o.id === 'stored_unvented')!;
    const allReqs = [...unvented.requirements, ...unvented.typedRequirements.mustHave];
    expect(allReqs.some(r => r.toLowerCase().includes('sealed') || r.toLowerCase().includes('g3'))).toBe(true);
  });

  it('stored_vented requirements mention loft tanks', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const vented = options.find(o => o.id === 'stored_vented')!;
    const allReqs = [...vented.requirements, ...vented.typedRequirements.mustHave];
    expect(allReqs.some(r => r.toLowerCase().includes('loft'))).toBe(true);
  });

  // ── confidenceBadge ─────────────────────────────────────────────────────────

  it('every option card has a confidenceBadge field', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    for (const card of options) {
      expect(card.confidenceBadge).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(card.confidenceBadge!.level);
      expect(typeof card.confidenceBadge!.label).toBe('string');
      expect(card.confidenceBadge!.label.length).toBeGreaterThan(0);
    }
  });

  it('all cards share the same confidence level (it is engine-level, not per-option)', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const levels = options.map(c => c.confidenceBadge!.level);
    // All cards should have the same level since it comes from buildAssumptionsV1
    expect(new Set(levels).size).toBe(1);
  });

  it('confidenceBadge label includes "High confidence" when mainsDynamicFlowLpm is provided', () => {
    const wellMeasuredInput = {
      ...baseInput,
      mainsDynamicFlowLpm: 12,
      staticMainsPressureBar: 3.0,
      currentSystem: {
        boiler: { gcNumber: '47-583-01', ageYears: 5, nominalOutputKw: 24, condensing: 'yes' as const },
      },
    };
    const result = runEngine(wellMeasuredInput);
    const options = buildOptionMatrixV1(result, wellMeasuredInput);
    expect(options[0].confidenceBadge!.label).toContain('High confidence');
  });

  it('confidenceBadge label includes "Low confidence" when most inputs are missing', () => {
    const bareInput = {
      ...baseInput,
      // No flow measurement, no static pressure, no boiler details
    };
    const result = runEngine(bareInput);
    const options = buildOptionMatrixV1(result, bareInput);
    // With multiple missing inputs, level should be low or medium
    expect(['medium', 'low']).toContain(options[0].confidenceBadge!.level);
  });

  describe('system_unvented cylinder space gate', () => {
    it('system_unvented is caution (not viable) when availableSpace is none', () => {
      // Regression: system_unvented must not show as viable when no cylinder space is
      // confirmed — a system boiler requires a hot water cylinder to function.
      const noSpaceInput = {
        ...baseInput,
        availableSpace: 'none' as const,
        dynamicMainsPressure: 2.5,
        mainsDynamicFlowLpm: 25,
        mainsDynamicFlowLpmKnown: true,
      };
      const result = runEngine(noSpaceInput);
      const options = buildOptionMatrixV1(result, noSpaceInput);
      const sysCard = options.find(o => o.id === 'system_unvented')!;
      expect(sysCard.status).toBe('caution');
    });

    it('system_unvented headline explains the space constraint when availableSpace is none', () => {
      const noSpaceInput = {
        ...baseInput,
        availableSpace: 'none' as const,
      };
      const result = runEngine(noSpaceInput);
      const options = buildOptionMatrixV1(result, noSpaceInput);
      const sysCard = options.find(o => o.id === 'system_unvented')!;
      expect(sysCard.headline).toContain('no space');
    });

    it('system_unvented is viable when availableSpace is ok and pressure is adequate', () => {
      // Confirm the space gate does not affect cases with adequate space
      const okSpaceInput = {
        ...baseInput,
        availableSpace: 'ok' as const,
        dynamicMainsPressure: 2.0,
        mainsDynamicFlowLpm: 20,
        mainsDynamicFlowLpmKnown: true,
      };
      const result = runEngine(okSpaceInput);
      const options = buildOptionMatrixV1(result, okSpaceInput);
      const sysCard = options.find(o => o.id === 'system_unvented')!;
      expect(sysCard.status).toBe('viable');
    });
  });
});

// ─── Honest framing: combi recommended within constraints ─────────────────────

describe('honest framing: combi headline when recommended despite demand risk', () => {
  it('combi headline uses "not advisable" copy when demand risk is fail and combi is NOT the recommended family', () => {
    // Without the recommendedFamily hint, the legacy "not advisable" copy is used.
    const highDemandInput = {
      ...baseInput,
      bathroomCount: 2,
      peakConcurrentOutlets: 2,
    };
    const result = runEngine(highDemandInput);
    const options = buildOptionMatrixV1(result, highDemandInput); // no recommendedFamily
    const combi = options.find(o => o.id === 'combi')!;
    expect(combi.status).toBe('caution');
    expect(combi.headline).toContain('not advisable');
  });

  it('combi headline uses honest "recommended within current constraints" framing when combi IS the recommended family', () => {
    // Simulate the scenario where combi is the only feasible option:
    // no cylinder space → stored options blocked, combi is recommended.
    const noSpaceHighDemandInput = {
      ...baseInput,
      bathroomCount: 2,
      peakConcurrentOutlets: 2,
      availableSpace: 'none' as const,
    };
    const result = runEngine(noSpaceHighDemandInput);
    const options = buildOptionMatrixV1(result, noSpaceHighDemandInput, 'combi');
    const combi = options.find(o => o.id === 'combi')!;
    expect(combi.status).toBe('caution');
    // Should NOT say "not advisable" when combi is recommended
    expect(combi.headline).not.toContain('not advisable');
    // Should acknowledge it is recommended within constraints
    expect(combi.headline).toContain('recommended');
    // Should still mention the demand risk honestly
    expect(combi.headline.toLowerCase()).toContain('demand');
  });

  it('combi DHW plane headline uses honest framing when combi is recommended with demand risk', () => {
    const noSpaceHighDemandInput = {
      ...baseInput,
      bathroomCount: 2,
      peakConcurrentOutlets: 2,
      availableSpace: 'none' as const,
    };
    const result = runEngine(noSpaceHighDemandInput);
    const options = buildOptionMatrixV1(result, noSpaceHighDemandInput, 'combi');
    const combi = options.find(o => o.id === 'combi')!;
    // DHW plane should not say "makes combi unsuitable" when combi is recommended
    expect(combi.dhw.headline).not.toContain('unsuitable');
    expect(combi.dhw.headline.toLowerCase()).toContain('demand');
  });

  it('combi mustHave requirement uses upgrade framing when combi is recommended with demand risk', () => {
    const noSpaceHighDemandInput = {
      ...baseInput,
      bathroomCount: 2,
      peakConcurrentOutlets: 2,
      availableSpace: 'none' as const,
    };
    const result = runEngine(noSpaceHighDemandInput);
    const options = buildOptionMatrixV1(result, noSpaceHighDemandInput, 'combi');
    const combi = options.find(o => o.id === 'combi')!;
    const mustHave = combi.typedRequirements.mustHave.join(' ');
    // Should NOT say "usually a better fit" (contradicts recommendation)
    expect(mustHave).not.toContain('usually a better fit');
    // Should instead suggest a future upgrade path
    expect(mustHave.toLowerCase()).toContain('upgrade');
  });

  it('honest framing does NOT activate when combi is viable (no demand risk)', () => {
    // When combiRisk is not fail, no honest framing needed — should stay "viable"
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput, 'combi');
    const combi = options.find(o => o.id === 'combi')!;
    expect(combi.status).toBe('viable');
    expect(combi.headline).toContain('suits your');
  });
});
