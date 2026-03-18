/**
 * mapSurveyToEngineInput
 *
 * Maps a raw survey form submission (SurveyFormData) into the fields of
 * EngineInputV2_3 that the engine expects.
 *
 * Rules:
 *  - Only confirmed measured flow readings (mainsDynamicFlowLpmKnown === true)
 *    are promoted to the mains.flowRateLpm field.
 *  - Undefined values are omitted rather than defaulted to keep the engine
 *    default-fallback path clean.
 *  - This mapper is intentionally thin — it does NOT sanitise or clamp
 *    values; call sanitiseModelForEngine() after mapping when running via
 *    the full survey stepper.
 *  - Only use CONSOLE_DEMO_INPUT when isDemoMode is true.
 */

import type { EngineInputV2_3, UserPreferencesV1 } from '../../engine/schema/EngineInputV2_3';

/**
 * Raw survey form data shape.
 * Fields use snake_case to match typical form/API submission conventions.
 */
export interface SurveyFormData {
  // Required
  postcode: string;
  dynamic_pressure_bar: number;

  // Mains supply (optional — captured via flow cup or pressure gauge)
  mains_static_bar?: number;
  mains_dynamic_bar?: number;
  mains_flow_lpm?: number;
  /** Set true when mains_flow_lpm was measured (flow cup / bucket / meter). */
  mains_flow_known?: boolean;

  // Occupancy
  occupancy_count?: number;
  bathroom_count?: number;
  peak_concurrent_outlets?: number;

  // User preferences
  space_priority?: UserPreferencesV1['spacePriority'];
}

/**
 * Map a SurveyFormData submission into a partial EngineInputV2_3.
 *
 * The returned object can be spread into a full EngineInputV2_3 or passed
 * directly to runEngine() when all required fields are present.
 *
 * @param survey   Raw form data from the survey submission.
 * @param isDemoMode  When true, callers should fall back to CONSOLE_DEMO_INPUT
 *                    instead of using this mapping result.
 */
export function mapSurveyToEngineInput(
  survey: SurveyFormData,
  isDemoMode = false,
): Partial<EngineInputV2_3> {
  if (isDemoMode) {
    // Signal to callers that they should use the demo input instead.
    // The actual demo fallback is the caller's responsibility to avoid
    // importing circular or environment-specific demo fixtures here.
    return {};
  }

  const mains: EngineInputV2_3['mains'] = {
    staticPressureBar:  survey.mains_static_bar,
    dynamicPressureBar: survey.mains_dynamic_bar,
    flowRateLpm:        survey.mains_flow_lpm,
  };

  // Omit the mains object entirely when no fields were provided.
  const hasMainsData =
    mains.staticPressureBar !== undefined ||
    mains.dynamicPressureBar !== undefined ||
    mains.flowRateLpm !== undefined;

  const preferences: UserPreferencesV1 | undefined = survey.space_priority
    ? { spacePriority: survey.space_priority }
    : undefined;

  return {
    postcode:                survey.postcode,
    dynamicMainsPressure:    survey.dynamic_pressure_bar,
    ...(survey.mains_static_bar  !== undefined && { staticMainsPressureBar:  survey.mains_static_bar }),
    ...(survey.mains_dynamic_bar !== undefined && { dynamicMainsPressureBar: survey.mains_dynamic_bar }),
    ...(survey.mains_flow_lpm    !== undefined && { mainsDynamicFlowLpm:     survey.mains_flow_lpm }),
    mainsDynamicFlowLpmKnown: survey.mains_flow_known ?? false,
    ...(hasMainsData && { mains }),
    ...(survey.occupancy_count          !== undefined && { occupancyCount:         survey.occupancy_count }),
    ...(survey.bathroom_count           !== undefined && { bathroomCount:          survey.bathroom_count }),
    ...(survey.peak_concurrent_outlets  !== undefined && { peakConcurrentOutlets:  survey.peak_concurrent_outlets }),
    ...(preferences && { preferences }),
  };
}
