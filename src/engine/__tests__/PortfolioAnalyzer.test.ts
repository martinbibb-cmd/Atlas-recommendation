import { describe, it, expect } from 'vitest';
import { analysePortfolio } from '../modules/PortfolioAnalyzer';
import type { PortfolioProperty } from '../schema/EngineInputV2_3';

const CURRENT_YEAR = new Date().getFullYear();

const healthyProperty: PortfolioProperty = {
  assetId: 'PROP-001',
  address: '1 Example Street, London, SW1A 1AA',
  maintenanceInput: {
    systemAgeYears: 3,
    boilerModelYear: CURRENT_YEAR - 3,
    waterHardnessCategory: 'soft',
    hasScaleInhibitor: true,
    hasMagneticFilter: true,
    annualServicedByEngineer: true,
  },
  lastMcsReviewYear: CURRENT_YEAR - 1,
  lastLegionellaAssessmentYear: CURRENT_YEAR - 1,
  lastDynamicPressureBar: 1.5,
};

const agingProperty: PortfolioProperty = {
  assetId: 'PROP-002',
  address: '2 Old Road, Manchester, M1 1AA',
  maintenanceInput: {
    systemAgeYears: 18,
    boilerModelYear: CURRENT_YEAR - 18,
    waterHardnessCategory: 'very_hard',
    hasScaleInhibitor: false,
    hasMagneticFilter: false,
    annualServicedByEngineer: false,
  },
  lastMcsReviewYear: undefined,
  lastLegionellaAssessmentYear: undefined,
  lastDynamicPressureBar: 0.3,
};

describe('PortfolioAnalyzer', () => {
  it('returns one result per property', () => {
    const result = analysePortfolio([healthyProperty, agingProperty]);
    expect(result.properties).toHaveLength(2);
  });

  it('ranks properties by combined risk (highest first)', () => {
    const result = analysePortfolio([healthyProperty, agingProperty]);
    const [first] = result.rankedByRisk;
    expect(first.assetId).toBe('PROP-002');
  });

  it('healthy property has low risk scores', () => {
    const result = analysePortfolio([healthyProperty]);
    const prop = result.properties[0];
    expect(prop.kettlingRiskScore).toBeLessThan(5);
    expect(prop.magnetiteRiskScore).toBeLessThan(5);
  });

  it('aging property has high risk scores', () => {
    const result = analysePortfolio([agingProperty]);
    const prop = result.properties[0];
    expect(prop.kettlingRiskScore + prop.magnetiteRiskScore).toBeGreaterThan(10);
  });

  it('flags missing MCS review as compliance alert', () => {
    const result = analysePortfolio([agingProperty]);
    const prop = result.properties[0];
    const hasMcsAlert = prop.complianceAlerts.some(a => a.includes('MCS'));
    expect(hasMcsAlert).toBe(true);
  });

  it('flags missing Legionella assessment as compliance alert', () => {
    const result = analysePortfolio([agingProperty]);
    const prop = result.properties[0];
    const hasLegAlert = prop.complianceAlerts.some(a => a.includes('Legionella'));
    expect(hasLegAlert).toBe(true);
  });

  it('flags low dynamic pressure as compliance alert', () => {
    const result = analysePortfolio([agingProperty]);
    const prop = result.properties[0];
    const hasPressureAlert = prop.complianceAlerts.some(a => a.includes('Pressure'));
    expect(hasPressureAlert).toBe(true);
  });

  it('healthy property has no compliance alerts', () => {
    const result = analysePortfolio([healthyProperty]);
    expect(result.properties[0].complianceAlerts).toHaveLength(0);
  });

  it('computes fleet average health score', () => {
    const result = analysePortfolio([healthyProperty, agingProperty]);
    expect(result.fleetAverageHealthScore).toBeGreaterThan(0);
    expect(result.fleetAverageHealthScore).toBeLessThanOrEqual(100);
  });

  it('criticalAssetCount reflects high-risk properties', () => {
    const result = analysePortfolio([healthyProperty, agingProperty]);
    expect(result.criticalAssetCount).toBeGreaterThanOrEqual(1);
  });

  it('complianceFailureCount counts properties with any compliance alert', () => {
    const result = analysePortfolio([healthyProperty, agingProperty]);
    expect(result.complianceFailureCount).toBe(1); // only agingProperty has alerts
  });

  it('returns empty result for empty portfolio', () => {
    const result = analysePortfolio([]);
    expect(result.properties).toHaveLength(0);
    expect(result.fleetAverageHealthScore).toBe(0);
    expect(result.criticalAssetCount).toBe(0);
  });
});
