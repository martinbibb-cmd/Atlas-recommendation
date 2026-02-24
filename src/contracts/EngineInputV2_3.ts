/** Normalized input contract accepted by the engine (V2.3). */
export interface EngineInputV2_3Contract {
  infrastructure: {
    /** Primary pipe size in mm. */
    primaryPipeSizeMm: 15 | 22 | 28 | 35;
  };
  property: {
    /** Peak heat loss in kilowatts. */
    peakHeatLossKw: number;
  };
  occupancy: {
    /** Occupancy pattern driving DHW demand profile. */
    signature: 'professional' | 'steady' | 'shift';
    /** Number of outlets that may run simultaneously at peak demand. */
    peakConcurrentOutlets: number;
  };
  dhw: {
    /** DHW heating architecture. */
    architecture: 'on_demand' | 'stored_standard' | 'stored_mixergy' | 'unknown';
    /** DHW delivery mode — affects which notes are relevant.
     * Standardised modes: gravity / pumped_from_tank / mains_mixer / accumulator_supported / break_tank_booster / electric_cold_only.
     * 'pumped' and 'tank_pumped' are accepted as legacy aliases for 'pumped_from_tank'.
     */
    deliveryMode?: 'unknown' | 'gravity' | 'pumped_from_tank' | 'tank_pumped' | 'pumped' | 'mains_mixer' | 'accumulator_supported' | 'break_tank_booster' | 'electric_cold_only';
  };
  services?: {
    /** Static mains pressure (bar) — measured with no flow. */
    mainsStaticPressureBar?: number;
    /** Dynamic mains pressure (bar) — measured under flow. */
    mainsDynamicPressureBar?: number;
    /** Dynamic flow rate at pressure (L/min) — required for a meaningful dynamic point. */
    mainsDynamicFlowLpm?: number;
    /** Cold-water supply source. Defaults to 'unknown'. */
    coldWaterSource?: 'unknown' | 'mains_true' | 'mains_shared' | 'loft_tank';
  };
  /** Optional current system context — used for SEDBUK baseline and tail-off model. */
  currentSystem?: {
    boiler?: {
      /** Gas Council (GC) number — used for SEDBUK database lookup. */
      gcNumber?: string;
      /** Approximate age in years. */
      ageYears?: number;
      /** Boiler architecture. */
      type?: 'combi' | 'system' | 'regular' | 'back_boiler' | 'unknown';
      /** Whether the boiler is condensing. */
      condensing?: 'yes' | 'no' | 'unknown';
      /** Nominal rated output in kW (nameplate). Used for oversize ratio calculation. */
      nominalOutputKw?: number;
    };
  };
}
