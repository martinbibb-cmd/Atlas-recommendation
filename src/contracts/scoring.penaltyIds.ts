export const PENALTY_IDS = {
  // Hard reject
  OPTION_REJECTED: 'option.rejected',

  // Status
  STATUS_CAUTION: 'status.caution',

  // ASHP feasibility & risk
  ASHP_HYDRAULICS_WARN: 'ashp.hydraulics_warn',
  ASHP_FLOWTEMP_FULL_JOB: 'ashp.flowtemp_full_job',
  ASHP_FLOWTEMP_PARTIAL: 'ashp.flowtemp_partial',
  ASHP_PIPE_UPGRADE_REQUIRED: 'ashp.pipe_upgrade_required',

  // DHW
  DHW_SHORT_DRAW_WARN: 'dhw.short_draw_warn',

  // Cold-water supply
  CWS_MEASUREMENTS_MISSING: 'cws.measurements_missing',
  CWS_QUALITY_WEAK: 'cws.quality_weak',

  // Space
  SPACE_TIGHT: 'space.tight',

  // Future works
  FUTURE_LOFT_CONFLICT: 'future.loft_conflict',

  // Boiler sizing / cycling
  BOILER_OVERSIZE_MILD: 'boiler.oversize_mild',
  BOILER_OVERSIZE_MODERATE: 'boiler.oversize_moderate',
  BOILER_OVERSIZE_AGGRESSIVE: 'boiler.oversize_aggressive',

  // Mains pressure
  PRESSURE_BORDERLINE_UNVENTED: 'pressure.borderline_unvented',

  // Confidence
  CONFIDENCE_MEDIUM: 'confidence.medium',
  CONFIDENCE_LOW: 'confidence.low',
  ASSUMPTION_WARN_COUNT: 'assumption.warn_count',
} as const;

export type PenaltyId = typeof PENALTY_IDS[keyof typeof PENALTY_IDS];
