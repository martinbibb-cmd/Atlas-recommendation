import { describe, it, expect } from 'vitest';
import { mapSurveyToEngineInput } from '../mappers/mapSurveyToEngineInput';
import type { SurveyFormData } from '../mappers/mapSurveyToEngineInput';

const baseSurvey: SurveyFormData = {
  postcode: 'SW1A 1AA',
  dynamic_pressure_bar: 2.5,
};

describe('mapSurveyToEngineInput', () => {
  it('returns empty object when isDemoMode is true', () => {
    const result = mapSurveyToEngineInput(baseSurvey, true);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('maps postcode and pressure correctly', () => {
    const result = mapSurveyToEngineInput(baseSurvey);
    expect(result.postcode).toBe('SW1A 1AA');
    expect(result.dynamicMainsPressure).toBe(2.5);
  });

  it('maps mains nested object when mains fields are provided', () => {
    const result = mapSurveyToEngineInput({
      ...baseSurvey,
      mains_static_bar: 3.0,
      mains_dynamic_bar: 2.5,
      mains_flow_lpm: 15,
    });
    expect(result.mains).toBeDefined();
    expect(result.mains!.staticPressureBar).toBe(3.0);
    expect(result.mains!.dynamicPressureBar).toBe(2.5);
    expect(result.mains!.flowRateLpm).toBe(15);
  });

  it('omits mains object when no mains fields provided', () => {
    const result = mapSurveyToEngineInput(baseSurvey);
    expect(result.mains).toBeUndefined();
  });

  it('maps space_priority to preferences.spacePriority', () => {
    const result = mapSurveyToEngineInput({
      ...baseSurvey,
      space_priority: 'high',
    });
    expect(result.preferences?.spacePriority).toBe('high');
  });

  it('omits preferences when space_priority is absent', () => {
    const result = mapSurveyToEngineInput(baseSurvey);
    expect(result.preferences).toBeUndefined();
  });

  it('maps disruption_tolerance to preferences.disruptionTolerance', () => {
    const result = mapSurveyToEngineInput({
      ...baseSurvey,
      disruption_tolerance: 'low',
    });
    expect(result.preferences?.disruptionTolerance).toBe('low');
  });

  it('maps both space_priority and disruption_tolerance into preferences', () => {
    const result = mapSurveyToEngineInput({
      ...baseSurvey,
      space_priority: 'high',
      disruption_tolerance: 'medium',
    });
    expect(result.preferences?.spacePriority).toBe('high');
    expect(result.preferences?.disruptionTolerance).toBe('medium');
  });

  it('omits preferences when neither space_priority nor disruption_tolerance is present', () => {
    const result = mapSurveyToEngineInput(baseSurvey);
    expect(result.preferences).toBeUndefined();
  });

  it('sets mainsDynamicFlowLpmKnown=true when mains_flow_known=true', () => {
    const result = mapSurveyToEngineInput({
      ...baseSurvey,
      mains_flow_lpm: 12,
      mains_flow_known: true,
    });
    expect(result.mainsDynamicFlowLpmKnown).toBe(true);
  });

  it('sets mainsDynamicFlowLpmKnown=false when mains_flow_known is absent', () => {
    const result = mapSurveyToEngineInput({
      ...baseSurvey,
      mains_flow_lpm: 12,
    });
    expect(result.mainsDynamicFlowLpmKnown).toBe(false);
  });

  it('maps low vs high flow correctly to flat fields', () => {
    const lowFlow = mapSurveyToEngineInput({ ...baseSurvey, mains_flow_lpm: 5 });
    const highFlow = mapSurveyToEngineInput({ ...baseSurvey, mains_flow_lpm: 25 });
    expect(lowFlow.mainsDynamicFlowLpm).toBe(5);
    expect(highFlow.mainsDynamicFlowLpm).toBe(25);
  });
});
