/**
 * SurveyEvidenceForCustomerPackV1.ts
 *
 * Type definitions for the survey-evidence adapter that maps raw survey fields
 * into explicit, named evidence groups for use in customer-facing packs.
 *
 * Each evidence group carries:
 *   evidencePresent   — true when at least one home-specific fact was captured
 *   facts             — home-specific sentences derived directly from survey data
 *   genericFallback   — last-resort copy used only when evidencePresent is false
 *
 * The specificity score enables quality gates in tests: a well-surveyed home
 * should produce many home-specific facts and few generic fallbacks.
 */

// ─── Evidence group ───────────────────────────────────────────────────────────

export interface SurveyEvidenceGroupV1 {
  /** True when at least one home-specific fact is available. */
  readonly evidencePresent: boolean;
  /** Home-specific sentences derived from survey data. Empty when evidencePresent is false. */
  readonly facts: readonly string[];
  /** Last-resort copy — only used when evidencePresent is false. */
  readonly genericFallback: string;
}

// ─── Specificity score ────────────────────────────────────────────────────────

export interface SurveyEvidenceSpecificityScoreV1 {
  /** Number of evidence groups with at least one home-specific fact. */
  readonly homeSpecificFactCount: number;
  /** Number of evidence groups falling back to generic copy (evidencePresent === false). */
  readonly genericFallbackCount: number;
  /** IDs of evidence groups with no home-specific evidence. */
  readonly emptyOrGenericGroupIds: readonly string[];
}

// ─── Full adapter output ──────────────────────────────────────────────────────

export interface SurveyEvidenceForCustomerPackV1 {
  readonly schemaVersion: '1.0';
  // ── Evidence groups ────────────────────────────────────────────────────────
  /** Household composition, daytime presence, and bath use frequency. */
  readonly occupancy: SurveyEvidenceGroupV1;
  /** Bathroom count and occupancy driving simultaneous hot water demand risk. */
  readonly simultaneousDemand: SurveyEvidenceGroupV1;
  /** Incoming mains static pressure, dynamic pressure, and measured flow rate. */
  readonly mainsSupply: SurveyEvidenceGroupV1;
  /** Existing hot water system type (combi / vented cylinder / unvented / thermal store). */
  readonly existingHotWaterType: SurveyEvidenceGroupV1;
  /** Existing heat source and heating circuit type. */
  readonly existingHeatingType: SurveyEvidenceGroupV1;
  /** Emitter type, pipework size, and layout — compatibility evidence for system changes. */
  readonly emitterSuitability: SurveyEvidenceGroupV1;
  /** Existing cylinder volume, age band, and observed condition. */
  readonly cylinderStorage: SurveyEvidenceGroupV1;
  /** Recovery assumptions derived from cylinder capacity and occupancy demand. */
  readonly recoveryAssumptions: SurveyEvidenceGroupV1;
  /** Bleed water colour, magnetic filter status, and cleaning history — system condition evidence. */
  readonly protectionSludgeFilter: SurveyEvidenceGroupV1;
  /** Peak heat loss estimate with confidence level, and dwelling storey count. */
  readonly heatLossStorey: SurveyEvidenceGroupV1;
  /** Upgrade constraints from emitter type, pipework access, and heating circuit type. */
  readonly futureUpgradeConstraints: SurveyEvidenceGroupV1;
  // ── Specificity score ──────────────────────────────────────────────────────
  readonly specificity: SurveyEvidenceSpecificityScoreV1;
}

// ─── Adapter input ────────────────────────────────────────────────────────────

/**
 * Raw survey inputs consumed by buildSurveyEvidenceForCustomerPackV1.
 *
 * All fields are optional. The adapter produces clean evidence groups regardless
 * of which fields are populated. Field names match the corresponding survey model
 * types (HomeState, SystemBuilderState, HeatLossState, EngineInputV2_3).
 */
export interface SurveyEvidenceAdapterInputV1 {
  // ── Household (from HomeState) ─────────────────────────────────────────────
  readonly usage?: {
    readonly composition?: {
      readonly adultCount?: number;
      readonly childCount0to4?: number;
      readonly childCount5to10?: number;
      readonly childCount11to17?: number;
      readonly youngAdultCount18to25AtHome?: number;
    };
    /** Weekday daytime occupancy pattern. */
    readonly daytimeOccupancy?: 'usually_out' | 'usually_home' | 'irregular' | 'unknown';
    /** How often baths (rather than showers) are taken. */
    readonly bathUse?: 'rare' | 'sometimes' | 'frequent' | 'unknown';
    /** Number of bathrooms — drives simultaneous draw risk gating. */
    readonly bathroomCount?: number | null;
  };
  // ── System architecture (from SystemBuilderState) ──────────────────────────
  readonly systemBuilder?: {
    readonly heatSource?: 'regular' | 'system' | 'combi' | 'storage_combi' | null;
    readonly dhwType?: 'open_vented' | 'unvented' | 'thermal_store' | 'plate_hex' | 'small_store' | null;
    readonly emitters?: 'radiators_standard' | 'radiators_designer' | 'underfloor' | 'mixed' | null;
    readonly primarySize?: 15 | 22 | 28 | 'unknown' | null;
    readonly layout?: 'two_pipe' | 'one_pipe' | 'manifold' | 'microbore' | 'unknown' | null;
    readonly heatingSystemType?: 'open_vented' | 'sealed' | 'unknown' | null;
    readonly pipeworkAccess?: 'accessible' | 'buried' | 'unknown' | null;
    /** Observed bleed-water colour from System Builder condition section. */
    readonly bleedWaterColour?: 'clear' | 'slightly_discoloured' | 'dark' | 'sludge' | 'unknown' | null;
    readonly magneticFilter?: 'fitted' | 'not_fitted' | 'unknown' | null;
    readonly cleaningHistory?: 'never_cleaned' | 'cleaned_over_5_years_ago' | 'recently_cleaned' | 'unknown' | null;
    readonly cylinderVolumeL?: number | null;
    readonly cylinderAgeBand?: 'under_5' | '5_to_10' | '10_to_15' | 'over_15' | 'unknown' | null;
    readonly cylinderCondition?: 'good' | 'average' | 'poor' | 'unknown' | null;
  };
  // ── Heat loss and building fabric (from HeatLossState) ────────────────────
  readonly heatLoss?: {
    readonly estimatedPeakHeatLossW?: number | null;
    readonly heatLossConfidence?: 'measured' | 'estimated' | 'default' | 'unknown';
    /** Storey count extracted from shellModel.settings.storeys (default 2). */
    readonly storeys?: number | null;
    /** Dwelling type from shellModel.settings.dwellingType (e.g. 'detached', 'semi'). */
    readonly dwellingType?: string | null;
  };
  // ── Incoming mains measurements (from EngineInputV2_3) ────────────────────
  readonly mainsSupply?: {
    readonly dynamicMainsPressureBar?: number | null;
    readonly staticMainsPressureBar?: number | null;
    /** Measured dynamic mains flow rate (L/min). */
    readonly mainsDynamicFlowLpm?: number | null;
    /** True only when mainsDynamicFlowLpm is a confirmed measured reading. */
    readonly mainsDynamicFlowLpmKnown?: boolean;
  };
  // ── Heating circuit condition (from FullSurveyModelV1.fullSurvey.heatingCondition) ──
  readonly heatingCondition?: {
    /** Colour of water when a radiator was bled. */
    readonly bleedWaterColour?: 'clear' | 'brown' | 'black' | 'unknown';
    /** Magnetic debris or sludge found in filter. */
    readonly magneticDebrisEvidence?: boolean;
    /** Water rising up the open vent pipe under pump pressure. */
    readonly pumpingOverObserved?: boolean;
  };
  // ── DHW condition (from FullSurveyModelV1.fullSurvey.dhwCondition) ────────
  readonly dhwCondition?: {
    readonly currentCylinderPresent?: boolean;
    readonly currentCylinderVolumeLitres?: number | 'unknown';
    readonly currentCylinderAgeBand?: 'under_5' | '5_to_10' | '10_to_15' | 'over_15' | 'unknown';
    readonly currentCylinderCondition?: 'good' | 'average' | 'poor' | 'unknown';
  };
}
