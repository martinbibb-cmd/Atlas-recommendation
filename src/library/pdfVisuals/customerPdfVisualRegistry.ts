export type CustomerPdfVisualComponentName =
  | 'SystemRecommendationHeroVisual'
  | 'HotWaterSupplyVisual'
  | 'WaterPressureVisual'
  | 'PowerflushVisual'
  | 'MagneticFilterVisual'
  | 'ControlsAndZonesVisual'
  | 'InstallationScopeVisual'
  | 'WhatChangesInTheHomeVisual';

export interface CustomerPdfVisualRegistryEntry {
  readonly component: CustomerPdfVisualComponentName;
  readonly visualAssetIds: readonly string[];
}

export const CUSTOMER_PDF_VISUAL_REGISTRY: readonly CustomerPdfVisualRegistryEntry[] = [
  {
    component: 'SystemRecommendationHeroVisual',
    visualAssetIds: ['system_fit_decision_map'],
  },
  {
    component: 'HotWaterSupplyVisual',
    visualAssetIds: ['pressure_vs_storage', 'stored_hot_water_recovery_timeline'],
  },
  {
    component: 'WaterPressureVisual',
    visualAssetIds: ['flow_restriction_bottleneck', 'system_pressure_window'],
  },
  {
    component: 'PowerflushVisual',
    visualAssetIds: ['powerflush_condition_led'],
  },
  {
    component: 'MagneticFilterVisual',
    visualAssetIds: ['magnetic_filter_capture'],
  },
  {
    component: 'ControlsAndZonesVisual',
    visualAssetIds: ['weather_compensation_curve', 'warm_vs_hot_radiators'],
  },
  {
    component: 'InstallationScopeVisual',
    visualAssetIds: ['open_vented_to_unvented'],
  },
  {
    component: 'WhatChangesInTheHomeVisual',
    visualAssetIds: ['water_main_limitation', 'warm_radiator_emitter_sizing', 'stratified_cylinder_mixergy'],
  },
] as const;

export const CUSTOMER_PDF_APPROVED_VISUAL_ASSET_IDS = new Set(
  CUSTOMER_PDF_VISUAL_REGISTRY.flatMap((entry) => entry.visualAssetIds),
);

export function isApprovedCustomerPdfVisualAssetId(visualAssetId: string): boolean {
  return CUSTOMER_PDF_APPROVED_VISUAL_ASSET_IDS.has(visualAssetId);
}
