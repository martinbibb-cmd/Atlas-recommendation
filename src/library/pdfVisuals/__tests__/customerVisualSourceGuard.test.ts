import { describe, it, expect } from 'vitest';
import {
  resolveCustomerVisualSourceKind,
  isAllowedCustomerVisualSource,
  isVisualCompatibleWithRecommendedSystemType,
  assertVisualCompatibleWithRecommendation,
  ALLOWED_CUSTOMER_VISUAL_SOURCE_KINDS,
  BLOCKED_CUSTOMER_VISUAL_SURFACE_CODEIDS,
  VISUAL_ASSET_SYSTEM_TYPE_CONSTRAINTS,
  type CustomerVisualSourceKind,
} from '../customerVisualSourceGuard';

describe('resolveCustomerVisualSourceKind', () => {
  it('maps lego_technic_canonical to legoTechnix', () => {
    expect(resolveCustomerVisualSourceKind('lego_technic_canonical')).toBe('legoTechnix');
  });

  it('maps retired_non_physical to legacy', () => {
    expect(resolveCustomerVisualSourceKind('retired_non_physical')).toBe('legacy');
  });

  it('maps dev_only to candidate', () => {
    expect(resolveCustomerVisualSourceKind('dev_only')).toBe('candidate');
  });

  it('maps unlisted to fallback', () => {
    expect(resolveCustomerVisualSourceKind('unlisted')).toBe('fallback');
  });
});

describe('isAllowedCustomerVisualSource', () => {
  it('allows library', () => {
    expect(isAllowedCustomerVisualSource('library')).toBe(true);
  });

  it('allows legoTechnix', () => {
    expect(isAllowedCustomerVisualSource('legoTechnix')).toBe(true);
  });

  it('blocks legacy', () => {
    expect(isAllowedCustomerVisualSource('legacy')).toBe(false);
  });

  it('blocks fallback', () => {
    expect(isAllowedCustomerVisualSource('fallback')).toBe(false);
  });

  it('blocks candidate', () => {
    expect(isAllowedCustomerVisualSource('candidate')).toBe(false);
  });

  it('ALLOWED_CUSTOMER_VISUAL_SOURCE_KINDS contains only library and legoTechnix', () => {
    const kinds: CustomerVisualSourceKind[] = ['library', 'legoTechnix', 'legacy', 'fallback', 'candidate'];
    const allowed = kinds.filter((k) => ALLOWED_CUSTOMER_VISUAL_SOURCE_KINDS.has(k));
    expect(allowed).toEqual(['library', 'legoTechnix']);
  });
});

describe('BLOCKED_CUSTOMER_VISUAL_SURFACE_CODEIDS', () => {
  const requiredBlockedSurfaces = [
    'InsightPackDeck',
    'CustomerAdvicePrintPack',
    'AtlasFrameworkPrintPage',
    'UnifiedSimulatorView',
    'LifestyleInteractive',
    'LifestyleInteractiveCompare',
    'SealedUnventedExplainerSlicePage',
  ];

  for (const codeName of requiredBlockedSurfaces) {
    it(`blocks ${codeName}`, () => {
      expect(BLOCKED_CUSTOMER_VISUAL_SURFACE_CODEIDS.has(codeName)).toBe(true);
    });
  }
});

describe('isVisualCompatibleWithRecommendedSystemType', () => {
  it('heat-pump-only visual is incompatible with regular_vented recommendation', () => {
    expect(isVisualCompatibleWithRecommendedSystemType('warm_vs_hot_radiators', 'regular_vented')).toBe(false);
  });

  it('heat-pump-only visual is incompatible with combi recommendation', () => {
    expect(isVisualCompatibleWithRecommendedSystemType('warm_vs_hot_radiators', 'combi')).toBe(false);
  });

  it('heat-pump-only visual is compatible with heat_pump recommendation', () => {
    expect(isVisualCompatibleWithRecommendedSystemType('warm_vs_hot_radiators', 'heat_pump')).toBe(true);
  });

  it('open_vented_to_unvented is compatible with regular_vented', () => {
    expect(isVisualCompatibleWithRecommendedSystemType('open_vented_to_unvented', 'regular_vented')).toBe(true);
  });

  it('open_vented_to_unvented is compatible with system_unvented', () => {
    expect(isVisualCompatibleWithRecommendedSystemType('open_vented_to_unvented', 'system_unvented')).toBe(true);
  });

  it('open_vented_to_unvented is NOT compatible with heat_pump', () => {
    expect(isVisualCompatibleWithRecommendedSystemType('open_vented_to_unvented', 'heat_pump')).toBe(false);
  });

  it('unconstrained visual is compatible with any system type', () => {
    // system_fit_decision_map has no constraint entry — universal
    expect(isVisualCompatibleWithRecommendedSystemType('system_fit_decision_map', 'regular_vented')).toBe(true);
    expect(isVisualCompatibleWithRecommendedSystemType('system_fit_decision_map', 'heat_pump')).toBe(true);
  });

  it('warm_radiator_emitter_sizing is only compatible with heat_pump', () => {
    expect(isVisualCompatibleWithRecommendedSystemType('warm_radiator_emitter_sizing', 'heat_pump')).toBe(true);
    expect(isVisualCompatibleWithRecommendedSystemType('warm_radiator_emitter_sizing', 'combi')).toBe(false);
    expect(isVisualCompatibleWithRecommendedSystemType('warm_radiator_emitter_sizing', 'regular_vented')).toBe(false);
  });

  it('weather_compensation_curve is compatible with heat_pump and combi', () => {
    expect(isVisualCompatibleWithRecommendedSystemType('weather_compensation_curve', 'heat_pump')).toBe(true);
    expect(isVisualCompatibleWithRecommendedSystemType('weather_compensation_curve', 'combi')).toBe(true);
    expect(isVisualCompatibleWithRecommendedSystemType('weather_compensation_curve', 'regular_vented')).toBe(false);
  });
});

describe('assertVisualCompatibleWithRecommendation', () => {
  it('returns compatible:true for unconstrained visual', () => {
    const result = assertVisualCompatibleWithRecommendation({
      visualAssetId: 'pressure_vs_storage',
      recommendedSystemType: 'regular_vented',
    });
    expect(result.compatible).toBe(true);
  });

  it('returns compatible:false with reason for heat-pump visual on regular boiler route', () => {
    const result = assertVisualCompatibleWithRecommendation({
      visualAssetId: 'warm_vs_hot_radiators',
      recommendedSystemType: 'regular_vented',
    });
    expect(result.compatible).toBe(false);
    if (!result.compatible) {
      expect(result.reason).toContain('warm_vs_hot_radiators');
      expect(result.reason).toContain('regular_vented');
      expect(result.compatibleSystemTypes).toContain('heat_pump');
    }
  });

  it('ASHP fallback graphic cannot render for regular boiler recommendation', () => {
    // warm_vs_hot_radiators is an ASHP-specific visual
    const result = assertVisualCompatibleWithRecommendation({
      visualAssetId: 'warm_vs_hot_radiators',
      recommendedSystemType: 'regular_vented',
    });
    expect(result.compatible).toBe(false);
  });

  it('warm_radiator_emitter_sizing cannot render for combi recommendation', () => {
    const result = assertVisualCompatibleWithRecommendation({
      visualAssetId: 'warm_radiator_emitter_sizing',
      recommendedSystemType: 'combi',
    });
    expect(result.compatible).toBe(false);
  });
});

describe('VISUAL_ASSET_SYSTEM_TYPE_CONSTRAINTS coverage', () => {
  it('all constrained visuals are known customer PDF visual asset IDs', () => {
    // All constrained IDs come from the approved registry
    const approvedIds = new Set([
      'system_fit_decision_map',
      'pressure_vs_storage',
      'stored_hot_water_recovery_timeline',
      'flow_restriction_bottleneck',
      'system_pressure_window',
      'powerflush_condition_led',
      'magnetic_filter_capture',
      'weather_compensation_curve',
      'warm_vs_hot_radiators',
      'open_vented_to_unvented',
      'water_main_limitation',
      'warm_radiator_emitter_sizing',
      'stratified_cylinder_mixergy',
    ]);
    for (const id of VISUAL_ASSET_SYSTEM_TYPE_CONSTRAINTS.keys()) {
      expect(approvedIds.has(id), `${id} should be in approved registry`).toBe(true);
    }
  });
});
