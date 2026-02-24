export const ASSUMPTION_IDS = {
  // Boiler model
  BOILER_GC_MISSING: 'boiler.gc_missing',
  BOILER_GC_INVALID: 'boiler.gc_invalid',
  BOILER_AGE_MISSING: 'boiler.age_missing',
  BOILER_OUTPUT_DEFAULTED: 'boiler.nominal_output_defaulted',
  BOILER_PEAK_HEATLOSS_MISSING: 'boiler.peak_heatloss_missing',

  // Water supply
  MAINS_FLOW_MISSING: 'water.flow_missing',
  MAINS_STATIC_MISSING: 'water.static_missing',

  // Timeline
  DEFAULT_DHW_SCHEDULE: 'timeline.default_dhw_schedule',
  TAU_DERIVED_FROM_SLIDERS: 'timeline.tau_slider_derived',

  // General
  MODELLED_NOT_MEASURED: 'general.modelled_estimate',
} as const;

export type AssumptionId = typeof ASSUMPTION_IDS[keyof typeof ASSUMPTION_IDS];
