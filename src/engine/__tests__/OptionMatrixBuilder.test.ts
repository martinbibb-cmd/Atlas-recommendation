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
  it('returns all 5 option cards', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    expect(options).toHaveLength(5);
    const ids = options.map(o => o.id);
    expect(ids).toContain('combi');
    expect(ids).toContain('stored');
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

  it('combi card status matches combiDhwV1 verdict', () => {
    // 2 bathrooms → simultaneous demand → combi rejected
    const result = runEngine({ ...baseInput, bathroomCount: 2 });
    const options = buildOptionMatrixV1(result, { ...baseInput, bathroomCount: 2 });
    const combi = options.find(o => o.id === 'combi')!;
    expect(combi.status).toBe('rejected');
  });

  it('combi card is viable for single bathroom + good pressure + professional', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const combi = options.find(o => o.id === 'combi')!;
    expect(combi.status).toBe('viable');
  });

  it('stored card status matches storedDhwV1 verdict', () => {
    // tight space + high demand → stored caution
    const input = { ...baseInput, availableSpace: 'tight' as const, bathroomCount: 2 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const stored = options.find(o => o.id === 'stored')!;
    expect(stored.status).toBe('caution');
  });

  it('stored card is rejected when loft conversion present', () => {
    const input = { ...baseInput, hasLoftConversion: true };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const stored = options.find(o => o.id === 'stored')!;
    expect(stored.status).toBe('rejected');
  });

  it('ashp card status matches hydraulicV1 verdict', () => {
    // 22mm + 14kW → ashp rejected
    const input = { ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 14000 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    expect(ashp.status).toBe('rejected');
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

  it('system_unvented card is caution for borderline pressure (1.0–1.5 bar)', () => {
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

  it('combi and stored heat planes both describe same boiler wet-side physics', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const combi = options.find(o => o.id === 'combi')!;
    const stored = options.find(o => o.id === 'stored')!;
    // Both should have 'ok' heat status (same wet-side physics)
    expect(combi.heat.status).toBe('ok');
    expect(stored.heat.status).toBe('ok');
  });

  it('combi DHW plane reflects combi risk verdict', () => {
    // 2 bathrooms → combi simultaneous demand → combi DHW caution
    const input = { ...baseInput, bathroomCount: 2 };
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
    expect(engineOutput.options!.length).toBe(5);
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
