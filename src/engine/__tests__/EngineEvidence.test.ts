import { describe, it, expect } from 'vitest';
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

describe('EngineOutputV1 evidence block', () => {
  it('evidence array is present in engineOutput', () => {
    const { engineOutput } = runEngine(baseInput);
    expect(Array.isArray(engineOutput.evidence)).toBe(true);
    expect((engineOutput.evidence ?? []).length).toBeGreaterThan(0);
  });

  it('all evidence items have required fields', () => {
    const { engineOutput } = runEngine(baseInput);
    for (const item of engineOutput.evidence ?? []) {
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.fieldPath).toBe('string');
      expect(typeof item.label).toBe('string');
      expect(typeof item.value).toBe('string');
      expect(['manual', 'assumed', 'placeholder', 'derived']).toContain(item.source);
      expect(['high', 'medium', 'low']).toContain(item.confidence);
      expect(Array.isArray(item.affectsOptionIds)).toBe(true);
    }
  });

  it('evidence items have unique ids', () => {
    const { engineOutput } = runEngine(baseInput);
    const ids = (engineOutput.evidence ?? []).map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mains pressure evidence item includes units (bar)', () => {
    const { engineOutput } = runEngine(baseInput);
    const pressureItem = engineOutput.evidence?.find(e => e.id === 'ev-mains-pressure-dynamic');
    expect(pressureItem).toBeDefined();
    expect(pressureItem!.value).toContain('bar');
  });

  it('mains pressure evidence value matches input', () => {
    const { engineOutput } = runEngine(baseInput);
    const pressureItem = engineOutput.evidence?.find(e => e.id === 'ev-mains-pressure-dynamic');
    expect(pressureItem).toBeDefined();
    expect(pressureItem!.value).toContain('2.5');
  });

  it('mains pressure evidence is manual source when provided in input', () => {
    const { engineOutput } = runEngine(baseInput);
    const pressureItem = engineOutput.evidence?.find(e => e.id === 'ev-mains-pressure-dynamic');
    expect(pressureItem!.source).toBe('manual');
    expect(pressureItem!.confidence).toBe('high');
  });

  it('mains pressure drop item present when staticMainsPressureBar is provided', () => {
    const input = { ...baseInput, staticMainsPressureBar: 3.5 };
    const { engineOutput } = runEngine(input);
    const dropItem = engineOutput.evidence?.find(e => e.id === 'ev-mains-pressure-drop');
    expect(dropItem).toBeDefined();
    expect(dropItem!.value).toContain('bar');
    expect(dropItem!.source).toBe('manual');
  });

  it('mains pressure drop item absent when only dynamic pressure provided', () => {
    const { engineOutput } = runEngine(baseInput);
    const dropItem = engineOutput.evidence?.find(e => e.id === 'ev-mains-pressure-drop');
    expect(dropItem).toBeUndefined();
  });

  it('primary pipe evidence includes units (mm)', () => {
    const { engineOutput } = runEngine(baseInput);
    const pipeItem = engineOutput.evidence?.find(e => e.id === 'ev-primary-pipe');
    expect(pipeItem).toBeDefined();
    expect(pipeItem!.value).toContain('mm');
  });

  it('primary pipe evidence is manual source and high confidence when provided', () => {
    const { engineOutput } = runEngine(baseInput);
    const pipeItem = engineOutput.evidence?.find(e => e.id === 'ev-primary-pipe');
    expect(pipeItem!.source).toBe('manual');
    expect(pipeItem!.confidence).toBe('high');
  });

  it('primary pipe evidence affects ashp option', () => {
    const { engineOutput } = runEngine(baseInput);
    const pipeItem = engineOutput.evidence?.find(e => e.id === 'ev-primary-pipe');
    expect(pipeItem!.affectsOptionIds).toContain('ashp');
  });

  it('ASHP flow evidence is derived and high confidence', () => {
    const { engineOutput } = runEngine(baseInput);
    const ashpFlowItem = engineOutput.evidence?.find(e => e.id === 'ev-ashp-flow');
    expect(ashpFlowItem).toBeDefined();
    expect(ashpFlowItem!.source).toBe('derived');
    expect(ashpFlowItem!.confidence).toBe('high');
  });

  it('ASHP flow evidence value contains L/min', () => {
    const { engineOutput } = runEngine(baseInput);
    const ashpFlowItem = engineOutput.evidence?.find(e => e.id === 'ev-ashp-flow');
    expect(ashpFlowItem!.value).toContain('L/min');
  });

  it('combi simultaneity evidence is manual when bathroomCount provided', () => {
    const { engineOutput } = runEngine(baseInput);
    const simItem = engineOutput.evidence?.find(e => e.id === 'ev-combi-simultaneity');
    expect(simItem).toBeDefined();
    expect(simItem!.source).toBe('manual');
    expect(simItem!.affectsOptionIds).toContain('combi');
  });

  it('heat loss evidence includes kW units', () => {
    const { engineOutput } = runEngine(baseInput);
    const heatLossItem = engineOutput.evidence?.find(e => e.id === 'ev-heat-loss');
    expect(heatLossItem).toBeDefined();
    expect(heatLossItem!.value).toContain('kW');
  });

  it('heat loss evidence affects all 6 options', () => {
    const { engineOutput } = runEngine(baseInput);
    const heatLossItem = engineOutput.evidence?.find(e => e.id === 'ev-heat-loss');
    const allOptions = ['combi', 'stored_vented', 'stored_unvented', 'ashp', 'regular_vented', 'system_unvented'];
    for (const opt of allOptions) {
      expect(heatLossItem!.affectsOptionIds).toContain(opt);
    }
  });

  it('source/confidence classification: combi risk verdict is derived/high', () => {
    const { engineOutput } = runEngine(baseInput);
    const riskItem = engineOutput.evidence?.find(e => e.id === 'ev-combi-risk');
    expect(riskItem).toBeDefined();
    expect(riskItem!.source).toBe('derived');
    expect(riskItem!.confidence).toBe('high');
  });

  it('available space evidence is manual when provided', () => {
    const { engineOutput } = runEngine(baseInput);
    const spaceItem = engineOutput.evidence?.find(e => e.id === 'ev-available-space');
    expect(spaceItem).toBeDefined();
    expect(spaceItem!.source).toBe('manual');
    expect(spaceItem!.confidence).toBe('high');
  });

  it('available space evidence is placeholder when not provided', () => {
    // Create input without availableSpace (using a type cast to omit the field)
    const inputWithoutSpace = Object.fromEntries(
      Object.entries(baseInput).filter(([k]) => k !== 'availableSpace'),
    ) as typeof baseInput;
    const { engineOutput } = runEngine(inputWithoutSpace);
    const spaceItem = engineOutput.evidence?.find(e => e.id === 'ev-available-space');
    expect(spaceItem).toBeDefined();
    expect(spaceItem!.source).toBe('placeholder');
    expect(spaceItem!.confidence).toBe('low');
  });

  it('evidence affectsOptionIds contains valid option IDs only', () => {
    const validIds = new Set(['combi', 'stored_vented', 'stored_unvented', 'ashp', 'regular_vented', 'system_unvented']);
    const { engineOutput } = runEngine(baseInput);
    for (const item of engineOutput.evidence ?? []) {
      for (const optId of item.affectsOptionIds) {
        expect(validIds.has(optId)).toBe(true);
      }
    }
  });
});
