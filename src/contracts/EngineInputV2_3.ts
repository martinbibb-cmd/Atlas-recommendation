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

/**
 * Normalised input contract accepted by the engine (V2.3).
 *
 * Field naming and structure notes (SCHEMA ALIGNMENT):
 *
 *   • The engine's internal schema (`EngineInputV2_3` in `src/engine/schema/`) uses a
 *     **flat** structure.  All fields here map 1-to-1 to the same flat field names:
 *       - `primaryPipeDiameter`  — NOT `infrastructure.primaryPipeSizeMm`
 *       - `heatLossWatts`        — in WATTS, NOT `property.peakHeatLossKw` in kilowatts
 *       - `occupancySignature`   — NOT `occupancy.signature`
 *       - `peakConcurrentOutlets`— optional, NOT required
 *
 *   • The logic layer (`src/logic/`) uses `primaryPipeSizeMm` in its own
 *     `OutcomeSystemSpec` type.  That is a separate type for a separate layer and
 *     must not be confused with this input contract.
 *
 *   • For V3 callers: `EngineInputV3` (in `src/engine/schema/EngineInputV3.ts`)
 *     narrows `primaryPipeDiameter` to `15 | 22 | 28` (35 mm dropped) and requires
 *     `drawFrequency` and `pipingTopology`.
 */
export interface EngineInputV2_3Contract {
  // ── Location ──────────────────────────────────────────────────────────────
  /** UK postcode — used for hardness-zone lookup (scale/decay model). */
  postcode: string;

  // ── Building ──────────────────────────────────────────────────────────────
  /**
   * Peak fabric heat loss in **Watts** (not kilowatts).
   *
   * ⚠ UNIT: W  (e.g. 8 000 W = 8 kW design heat loss).
   * Field name in the engine schema: `heatLossWatts`.
   *
   * Previous incorrect documentation listed this as `property.peakHeatLossKw`.
   * That was a naming and unit error — the engine schema has always used `heatLossWatts`.
   */
  heatLossWatts: number;
  /**
   * Nominal bore of the primary distribution pipework (mm).
   * Valid values: 15, 22, 28, or 35.
   *
   * Field name in the engine schema: `primaryPipeDiameter`.
   * Previous incorrect documentation listed this as `infrastructure.primaryPipeSizeMm`.
   *
   * V3 note: `EngineInputV3` narrows this to `15 | 22 | 28` (35 mm is not valid in V3).
   */
  primaryPipeDiameter: 15 | 22 | 28 | 35;
  /** Number of radiators / emitters (used for system-volume estimate). */
  radiatorCount: number;
  /** Whether the property has or plans a loft conversion (affects pipework adequacy). */
  hasLoftConversion: boolean;
  /** Design return water temperature (°C). Typical: 55–65 °C for gas, 40–50 °C for ASHP. */
  returnWaterTemp: number;
  /** Building thermal mass — affects heating demand spikiness and τ. */
  buildingMass: 'light' | 'medium' | 'heavy';

  // ── Mains services ────────────────────────────────────────────────────────
  /**
   * Dynamic mains pressure (bar) — legacy required field for backward compatibility.
   * Prefer using the `mains` object for new integrations.
   */
  dynamicMainsPressure: number;
  /**
   * Static mains pressure (bar) — measured with no flow.
   * Preferred alias: `mains.staticPressureBar`.
   */
  staticMainsPressureBar?: number;
  /**
   * Dynamic mains pressure (bar) — measured under flow.
   * Preferred alias: `mains.dynamicPressureBar`.
   */
  dynamicMainsPressureBar?: number;
  /** Dynamic mains flow rate (L/min). Preferred alias: `mains.flowRateLpm`. */
  mainsDynamicFlowLpm?: number;
  /**
   * Nested mains supply object — preferred for new integrations.
   * Values here take precedence over the flat `staticMainsPressureBar`,
   * `dynamicMainsPressureBar`, and `mainsDynamicFlowLpm` fields.
   */
  mains?: {
    staticPressureBar?: number;
    dynamicPressureBar?: number;
    flowRateLpm?: number;
  };
  /** Cold-water supply source. Defaults to 'unknown'. */
  coldWaterSource?: 'unknown' | 'mains_true' | 'mains_shared' | 'loft_tank';
  /**
   * DHW delivery mode.
   * Standardised modes: gravity / pumped_from_tank / mains_mixer /
   * accumulator_supported / break_tank_booster / electric_cold_only.
   * 'pumped' and 'tank_pumped' are accepted as legacy aliases for 'pumped_from_tank'.
   */
  dhwDeliveryMode?: 'unknown' | 'gravity' | 'pumped_from_tank' | 'tank_pumped' | 'pumped' | 'mains_mixer' | 'accumulator_supported' | 'break_tank_booster' | 'electric_cold_only';

  // ── Occupancy ─────────────────────────────────────────────────────────────
  /** Number of bathrooms (used for simultaneous-demand gating). */
  bathroomCount: number;
  /**
   * Occupancy pattern driving the DHW demand profile.
   *
   * V2 names (full):   'professional' | 'steady_home' | 'shift_worker'
   * V3 aliases (short): 'steady' (≡ steady_home) | 'shift' (≡ shift_worker)
   *
   * The engine schema (`OccupancySignature`) accepts both V2 names and V3 aliases.
   * V3 simplified names are preferred for new integrations.
   *
   * Field name in the engine schema: `occupancySignature`.
   * Previous incorrect documentation listed this as `occupancy.signature`.
   */
  occupancySignature: 'professional' | 'steady_home' | 'shift_worker' | 'steady' | 'shift';
  /** Whether the property is considered high-occupancy (drives stored-DHW sizing). */
  highOccupancy: boolean;
  /**
   * Peak simultaneous DHW outlets (e.g. 1 = single shower, 2 = shower + basin).
   * Optional — when absent the engine falls back to occupancy and bathroom-count heuristics.
   *
   * Previous incorrect documentation marked this as required. It is optional.
   */
  peakConcurrentOutlets?: number;
  /** Number of people regularly resident — used for stored DHW sizing. */
  occupancyCount?: number;

  // ── Current system context ────────────────────────────────────────────────
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
  /** Flat alias for currentSystem.boiler.type — preferred for simple integrations. */
  currentHeatSourceType?: 'combi' | 'system' | 'regular' | 'ashp' | 'other';
  /** Current boiler age in years (flat alias for currentSystem.boiler.ageYears). */
  currentBoilerAgeYears?: number;
  /** Nominal boiler output in kW (flat alias for currentSystem.boiler.nominalOutputKw). */
  currentBoilerOutputKw?: number;

  // ── Preferences ───────────────────────────────────────────────────────────
  /** Whether the user explicitly prefers a combi system. */
  preferCombi: boolean;
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
