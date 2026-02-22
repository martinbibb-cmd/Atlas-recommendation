import { describe, it, expect } from 'vitest';
import { runSystemOptimizationModule } from '../modules/SystemOptimizationModule';
import type { SystemOptimizationInput } from '../schema/EngineInputV2_3';

const fullJobInput: SystemOptimizationInput = {
  installationPolicy: 'full_job',
  heatLossWatts: 8000,
  radiatorCount: 10,
};

const highTempInput: SystemOptimizationInput = {
  installationPolicy: 'high_temp_retrofit',
  heatLossWatts: 8000,
  radiatorCount: 10,
};

describe('SystemOptimizationModule', () => {
  it('full_job policy produces a lower design flow temperature than high_temp_retrofit', () => {
    const fullJob = runSystemOptimizationModule(fullJobInput);
    const highTemp = runSystemOptimizationModule(highTempInput);
    expect(fullJob.designFlowTempC).toBeLessThan(highTemp.designFlowTempC);
  });

  it('full_job policy produces a higher SPF midpoint than high_temp_retrofit', () => {
    const fullJob = runSystemOptimizationModule(fullJobInput);
    const highTemp = runSystemOptimizationModule(highTempInput);
    expect(fullJob.spfMidpoint).toBeGreaterThan(highTemp.spfMidpoint);
  });

  it('full_job SPF range is within 3.8–4.4', () => {
    const result = runSystemOptimizationModule(fullJobInput);
    expect(result.spfRange[0]).toBeGreaterThanOrEqual(3.8);
    expect(result.spfRange[1]).toBeLessThanOrEqual(4.4);
  });

  it('high_temp_retrofit SPF range is within 2.9–3.1', () => {
    const result = runSystemOptimizationModule(highTempInput);
    expect(result.spfRange[0]).toBeGreaterThanOrEqual(2.9);
    expect(result.spfRange[1]).toBeLessThanOrEqual(3.1);
  });

  it('full_job flow temperature is in the 35–40 °C band', () => {
    const result = runSystemOptimizationModule(fullJobInput);
    expect(result.designFlowTempC).toBeGreaterThanOrEqual(35);
    expect(result.designFlowTempC).toBeLessThanOrEqual(40);
  });

  it('high_temp_retrofit flow temperature is 50 °C', () => {
    const result = runSystemOptimizationModule(highTempInput);
    expect(result.designFlowTempC).toBe(50);
  });

  it('both policies support condensing mode (return < 55 °C)', () => {
    expect(runSystemOptimizationModule(fullJobInput).condensingModeAvailable).toBe(true);
    expect(runSystemOptimizationModule(highTempInput).condensingModeAvailable).toBe(true);
  });

  it('returns the correct installation policy in the result', () => {
    expect(runSystemOptimizationModule(fullJobInput).installationPolicy).toBe('full_job');
    expect(runSystemOptimizationModule(highTempInput).installationPolicy).toBe('high_temp_retrofit');
  });

  it('emits a warning note when watts-per-radiator exceeds 800 W on high_temp_retrofit', () => {
    const result = runSystemOptimizationModule({
      installationPolicy: 'high_temp_retrofit',
      heatLossWatts: 10000,
      radiatorCount: 5, // 2000 W/rad – clearly undersized
    });
    expect(result.notes.some(n => n.includes('Undersized Emitters'))).toBe(true);
  });

  it('does NOT emit undersized warning on full_job regardless of W/rad', () => {
    const result = runSystemOptimizationModule({
      ...fullJobInput,
      heatLossWatts: 20000,
      radiatorCount: 5,
    });
    expect(result.notes.some(n => n.includes('Undersized Emitters'))).toBe(false);
  });

  it('notes array is non-empty for both policies', () => {
    expect(runSystemOptimizationModule(fullJobInput).notes.length).toBeGreaterThan(0);
    expect(runSystemOptimizationModule(highTempInput).notes.length).toBeGreaterThan(0);
  });
});
