import type { RecommendationReasonCategoryV1 } from './buildPortalJourneyPrintModel';

export const REASON_ICON_BY_CATEGORY: Record<RecommendationReasonCategoryV1, string> = {
  household_demand: '👥',
  bathroom_count: '🚿',
  mains_flow_pressure: '💧',
  current_system_constraint: '🛠',
  loft_cylinder_location_constraint: '📐',
  simultaneous_hot_water_use: '⚖️',
  protection_system_condition: '🛡',
  future_upgrade_readiness: '🔭',
};
