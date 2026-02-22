import { describe, it, expect } from 'vitest';
import { runPredictiveMaintenanceModule } from '../modules/PredictiveMaintenanceModule';
import type { PredictiveMaintenanceInput } from '../schema/EngineInputV2_3';

const healthyInput: PredictiveMaintenanceInput = {
  systemAgeYears: 3,
  boilerModelYear: 2021,
  waterHardnessCategory: 'soft',
  hasScaleInhibitor: true,
  hasMagneticFilter: true,
  annualServicedByEngineer: true,
};

const neglectedInput: PredictiveMaintenanceInput = {
  systemAgeYears: 12,
  boilerModelYear: 2012,
  waterHardnessCategory: 'very_hard',
  hasScaleInhibitor: false,
  hasMagneticFilter: false,
  annualServicedByEngineer: false,
};

describe('PredictiveMaintenanceModule', () => {
  it('assigns a high overall health score to a well-maintained system', () => {
    const result = runPredictiveMaintenanceModule(healthyInput);
    expect(result.overallHealthScore).toBeGreaterThan(60);
  });

  it('assigns a low overall health score to a neglected system', () => {
    const result = runPredictiveMaintenanceModule(neglectedInput);
    expect(result.overallHealthScore).toBeLessThan(40);
  });

  it('kettling risk is higher without scale inhibitor in hard water', () => {
    const withInhibitor = runPredictiveMaintenanceModule({ ...neglectedInput, hasScaleInhibitor: true });
    const withoutInhibitor = runPredictiveMaintenanceModule(neglectedInput);
    expect(withoutInhibitor.kettlingRiskScore).toBeGreaterThan(withInhibitor.kettlingRiskScore);
  });

  it('magnetite risk is higher without a magnetic filter', () => {
    const withFilter = runPredictiveMaintenanceModule({ ...neglectedInput, hasMagneticFilter: true });
    const withoutFilter = runPredictiveMaintenanceModule(neglectedInput);
    expect(withoutFilter.magnetiteRiskScore).toBeGreaterThan(withFilter.magnetiteRiskScore);
  });

  it('scores are bounded between 0 and 10 for individual risks', () => {
    const result = runPredictiveMaintenanceModule(neglectedInput);
    expect(result.kettlingRiskScore).toBeGreaterThanOrEqual(0);
    expect(result.kettlingRiskScore).toBeLessThanOrEqual(10);
    expect(result.magnetiteRiskScore).toBeGreaterThanOrEqual(0);
    expect(result.magnetiteRiskScore).toBeLessThanOrEqual(10);
  });

  it('overall health score is bounded between 0 and 100', () => {
    const result = runPredictiveMaintenanceModule(neglectedInput);
    expect(result.overallHealthScore).toBeGreaterThanOrEqual(0);
    expect(result.overallHealthScore).toBeLessThanOrEqual(100);
  });

  it('issues a critical alert for very old boiler', () => {
    const result = runPredictiveMaintenanceModule({ ...neglectedInput, systemAgeYears: 16 });
    expect(result.criticalAlerts.some(a => a.includes('End of Design Life'))).toBe(true);
  });

  it('estimated remaining life is zero or positive', () => {
    const result = runPredictiveMaintenanceModule(neglectedInput);
    expect(result.estimatedRemainingLifeYears).toBeGreaterThanOrEqual(0);
  });

  it('recommends scale inhibitor when absent in hard water', () => {
    const result = runPredictiveMaintenanceModule({
      ...healthyInput,
      hasScaleInhibitor: false,
      waterHardnessCategory: 'hard',
    });
    expect(result.recommendations.some(r => r.includes('Scale Inhibitor'))).toBe(true);
  });

  it('recommends magnetic filter when absent', () => {
    const result = runPredictiveMaintenanceModule({ ...healthyInput, hasMagneticFilter: false });
    expect(result.recommendations.some(r => r.includes('Magnetic Filter'))).toBe(true);
  });

  it('annualCostOfDecayGbp is zero when annualGasSpendGbp is not provided', () => {
    const result = runPredictiveMaintenanceModule(neglectedInput);
    expect(result.annualCostOfDecayGbp).toBe(0);
    expect(result.flushRoiYears).toBeNull();
  });

  it('annualCostOfDecayGbp is positive for neglected system with annual gas spend', () => {
    const result = runPredictiveMaintenanceModule({ ...neglectedInput, annualGasSpendGbp: 1200 });
    expect(result.annualCostOfDecayGbp).toBeGreaterThan(0);
  });

  it('flushRoiYears is calculated when annualGasSpendGbp is provided and there is decay', () => {
    const result = runPredictiveMaintenanceModule({ ...neglectedInput, annualGasSpendGbp: 1200 });
    expect(result.flushRoiYears).not.toBeNull();
    expect(result.flushRoiYears!).toBeGreaterThan(0);
  });

  it('silicate level increases annualCostOfDecayGbp', () => {
    const withoutSilicate = runPredictiveMaintenanceModule({ ...neglectedInput, annualGasSpendGbp: 1200 });
    const withSilicate = runPredictiveMaintenanceModule({ ...neglectedInput, annualGasSpendGbp: 1200, silicateLevelMgL: 80 });
    expect(withSilicate.annualCostOfDecayGbp).toBeGreaterThan(withoutSilicate.annualCostOfDecayGbp);
  });

  it('annualCostOfDecayGbp is bounded (efficiency loss ≤ 25%)', () => {
    const result = runPredictiveMaintenanceModule({
      ...neglectedInput,
      annualGasSpendGbp: 1200,
      silicateLevelMgL: 500, // extreme silicate
    });
    // Max cost = 25% × £1200 = £300
    expect(result.annualCostOfDecayGbp).toBeLessThanOrEqual(300);
  });
});
