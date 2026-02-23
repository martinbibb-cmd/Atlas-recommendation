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
    architecture: 'instantaneous' | 'stored_standard' | 'stored_mixergy' | 'unknown';
  };
  services?: {
    /** Dynamic mains pressure (bar). Optional but supported. */
    mainsDynamicPressureBar?: number;
  };
}
