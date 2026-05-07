/**
 * Expert assumption overrides — inputs to pathway ranking, not the physics simulation.
 * All fields are optional; defaults are applied when absent.
 */
export interface ExpertAssumptionsV1 {
  /** How much disruption to the property the customer will accept. Default: 'low'. */
  disruptionTolerance?: 'low' | 'med' | 'high';
  /** Risk appetite for screed-floor pipe leaks during underfloor heating work. Default: 'cautious'. */
  screedLeakRiskTolerance?: 'cautious' | 'normal';
  /** Whether DHW experience (reliable hot water) is a priority. Default: 'normal'. */
  dhwExperiencePriority?: 'high' | 'normal';
  /** Whether future-readiness (heat-pump pathway) is a priority. Default: 'normal'. */
  futureReadinessPriority?: 'high' | 'normal';
  /** Comfort vs running cost trade-off. Default: 'balanced'. */
  comfortVsRunningCost?: 'comfort' | 'balanced' | 'cost';
  /**
   * How important it is to save space / avoid a hot-water cylinder.
   * 'high' — boosts combi in scoring and allows it to surface in borderline cases.
   * 'medium' — slight bias toward compact systems.
   * 'low' (default) — no bias; physics/performance dominate.
   */
  spaceSavingPriority?: 'low' | 'medium' | 'high' | null;
}

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
  /** Expert assumption overrides — ranking and messaging only; physics unchanged. */
  expertAssumptions?: ExpertAssumptionsV1;
  /**
   * Hive-style day profile — single-day schedule for the Day Painter.
   * When present, overrides the legacy dayProgram and occupancy-based demand.
   * This is the primary input path; painter → dayProfile → engine → timeline output.
   */
  dayProfile?: DayProfileV1;
}

/**
 * A single heating schedule band (Hive-style).
 * startMin / endMin are minutes elapsed since midnight (0–1439).
 * targetC is the desired room temperature in °C.
 */
export interface HeatingBandV1 {
  startMin: number;
  endMin: number;
  targetC: number;
}

/**
 * A single hot-water schedule band.
 * ON = cylinder heating enabled; OFF = setback / economy.
 */
export interface DhwHeatBandV1 {
  startMin: number;
  endMin: number;
  on: boolean;
}

/**
 * A single DHW draw event.
 * Demand is derived from flow profile + duration only — fixture label has no effect on physics.
 * profile drives the L/min rate used for heat-demand calculation.
 */
export interface DhwEventV1 {
  startMin: number;
  durationMin: number;
  kind: 'taps';
  /** Flow profile — mixer10 ≈ 10 L/min, mixer12 ≈ 12 L/min, rainfall16 ≈ 16 L/min. */
  profile: 'mixer10' | 'mixer12' | 'rainfall16';
}

/**
 * Water supply profile — separates supply capacity from pressure comfort.
 *
 * Design principle:
 *   - Supply capacity   = can the system fundamentally work?  (driven by fullBoreFlowLpm)
 *   - Pressure comfort  = how strong will it feel?           (driven by retainedFlow points)
 *   - storedTopologyViability depends mainly on full-bore sustainable flow + refill capability.
 *   - combiTopologyViability depends on retained pressure + simultaneous draw degradation.
 *
 * "0 bar" is NOT a failure — it is a full-bore flow test result:
 *   fullBoreFlowLpm at 0 retained pressure = maximum achievable incoming mains supply.
 */
export interface WaterSupplyProfileV2 {
  /** Standing pressure (bar) — measured with no flow running. */
  standingPressureBar?: number;
  /** Retained flow (L/min) at 2 bar — combi maximum rated DHW flow. */
  retainedFlowAt2BarLpm?: number;
  /** Retained flow (L/min) at 1 bar — minimum for combi maximum rated flow. */
  retainedFlowAt1BarLpm?: number;
  /** Retained flow (L/min) at 0.5 bar — combi reduced-flow zone. */
  retainedFlowAt05BarLpm?: number;
  /**
   * Full-bore flow (L/min) at 0 retained pressure.
   * This IS the maximum achievable incoming mains supply, not a pressure failure.
   * Use this as the primary supply capacity indicator for stored system viability.
   */
  fullBoreFlowLpm?: number;
  /**
   * Pressure comfort band — describes the customer shower/outlet experience.
   * NOT a topology viability gate.
   *   'excellent' — standing ≥ 3 bar; comfortable at all outlets.
   *   'good'      — standing 2–3 bar; adequate for most configurations.
   *   'reduced'   — standing 1–2 bar; showers may feel less powerful.
   *   'poor'      — standing < 1 bar; outlet intensity noticeably reduced.
   */
  pressureComfortBand?: 'excellent' | 'good' | 'reduced' | 'poor';
  /**
   * Stored topology viability — driven by full-bore sustainable flow.
   *   'preferred'         — fullBoreFlowLpm ≥ 14 and multi-bathroom.
   *   'viable'            — fullBoreFlowLpm ≥ 12.
   *   'limited'           — fullBoreFlowLpm < 12; refill may be slow.
   *   'not_recommended'   — fullBoreFlowLpm < 8; tank-fed vented preferred.
   */
  storedTopologyViability?: 'preferred' | 'viable' | 'limited' | 'not_recommended';
  /**
   * Combi topology viability — driven by retained pressure and simultaneous draw.
   *   'preferred'         — retainedFlowAt1BarLpm ≥ 12 and single bathroom.
   *   'viable'            — retainedFlowAt1BarLpm ≥ 10 and peakConcurrentOutlets ≤ 1.
   *   'limited'           — retainedFlowAt1BarLpm < 10 OR simultaneousBathrooms ≥ 2.
   *   'not_recommended'   — pressure below minimum operating condition (< 0.3 bar dynamic).
   */
  combiTopologyViability?: 'preferred' | 'viable' | 'limited' | 'not_recommended';
}

/**
 * Hive-style single-day profile — the canonical Day Painter input.
 * This replaces the legacy heatIntent/dhwLpm/coldLpm arrays.
 */
export interface DayProfileV1 {
  /** Heating schedule bands (thermostat setpoints across 24 h). */
  heatingBands: HeatingBandV1[];
  /** Hot-water heating schedule bands (cylinder charge schedule). */
  dhwHeatBands: DhwHeatBandV1[];
  /** DHW draw events (shower, bath, taps) positioned on the 24 h timeline. */
  dhwEvents: DhwEventV1[];
}
