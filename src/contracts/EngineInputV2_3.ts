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
  dhw?: {
    /** DHW delivery mode — affects which notes are relevant. */
    deliveryMode?: 'unknown' | 'gravity' | 'pumped' | 'mains_mixer' | 'mains_mixer_boosted' | 'electric_cold_only';
  };
}
