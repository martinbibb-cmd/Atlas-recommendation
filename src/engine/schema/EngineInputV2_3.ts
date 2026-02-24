import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
export type { EngineOutputV1 };
import type { PressureAnalysis } from '../modules/PressureModule';
export type { PressureAnalysis };
import type { CwsSupplyV1Result } from '../modules/CwsSupplyModule';
export type { CwsSupplyV1Result };
import type { SedbukResultV1 } from '../modules/SedbukModule';
export type { SedbukResultV1 };
import type { BoilerSizingResultV1 } from '../modules/BoilerSizingModule';
export type { BoilerSizingResultV1 };

export type OccupancySignature =
  | 'professional'
  | 'steady_home'
  | 'shift_worker'
  /**
   * V3 aliases – accepted alongside the V2 names for forward-compatibility.
   * 'steady' maps to the same behaviour as 'steady_home' (continuous occupancy,
   * ASHP recommended).
   */
  | 'steady'
  /**
   * V3 alias for 'shift_worker' – irregular/offset demand, stored water
   * recommended.
   */
  | 'shift';

export type BuildingMass = 'light' | 'medium' | 'heavy';

export type PipingTopology = 'two_pipe' | 'one_pipe' | 'microbore';

export interface EngineInputV2_3 {
  // Location & Water
  postcode: string;
  dynamicMainsPressure: number; // bar (legacy field — always required for backward compatibility)
  /** Static mains pressure (bar) — measured with no flow. */
  staticMainsPressureBar?: number;
  /** Dynamic mains pressure (bar) — preferred alias for new integrations. Falls back to dynamicMainsPressure. */
  dynamicMainsPressureBar?: number;
  /** Dynamic flow rate at pressure (L/min) — required for a meaningful dynamic point. */
  mainsDynamicFlowLpm?: number;
  /** Cold-water supply source. Defaults to 'unknown'. */
  coldWaterSource?: 'unknown' | 'mains_true' | 'mains_shared' | 'loft_tank';
  /** DHW delivery mode — affects CWS supply notes.
   * Standardised modes: gravity / pumped_from_tank / mains_mixer / accumulator_supported / break_tank_booster / electric_cold_only.
   * 'pumped' and 'tank_pumped' are accepted as legacy aliases for 'pumped_from_tank'.
   */
  dhwDeliveryMode?: 'unknown' | 'gravity' | 'pumped_from_tank' | 'tank_pumped' | 'pumped' | 'mains_mixer' | 'accumulator_supported' | 'break_tank_booster' | 'electric_cold_only';

  // Building
  buildingMass: BuildingMass;
  primaryPipeDiameter: number; // mm, e.g. 22 or 28
  heatLossWatts: number; // W
  radiatorCount: number;
  hasLoftConversion: boolean;
  returnWaterTemp: number; // °C

  // Legacy infrastructure (optional, defaults to two_pipe)
  pipingTopology?: PipingTopology;
  microboreInternalDiameterMm?: 8 | 10; // set only when pipingTopology is 'microbore'; ignored otherwise
  supplyTempC?: number; // °C flow temperature (default 70°C)

  // Occupancy
  bathroomCount: number;
  /** Number of people regularly resident – used for stored DHW sizing. */
  occupancyCount?: number;
  /** Number of bedrooms – used for context summary narrative. */
  bedrooms?: number;
  occupancySignature: OccupancySignature;
  highOccupancy: boolean;
  /** Peak simultaneous DHW outlets (e.g. 1 = single shower, 2 = shower + basin). */
  peakConcurrentOutlets?: number;
  /** Cylinder / airing-cupboard space availability. */
  availableSpace?: 'tight' | 'ok' | 'unknown';

  // Future works (for context summary and feasibility notes)
  /** Whether a loft conversion is planned or completed. */
  futureLoftConversion?: boolean;
  /** Whether an additional bathroom is planned. */
  futureAddBathroom?: boolean;

  // Preferences
  preferCombi: boolean;

  // Current system context (survey metadata)
  currentHeatSourceType?: 'combi' | 'system' | 'regular' | 'ashp' | 'other';
  currentBoilerAgeYears?: number;
  currentBoilerOutputKw?: number;
  makeModelText?: string;
  /** Structured current system context — used for SEDBUK baseline and tail-off model. */
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

  // Sludge vs Scale inputs
  hasMagneticFilter?: boolean;
  systemAgeYears?: number;
  annualGasSpendGbp?: number;

  // Behaviour
  drawFrequency?: 'low' | 'high';

  // System optimization
  installationPolicy?: InstallationPolicy;

  // Metallurgy edge
  hasSoftener?: boolean;
  preferredMetallurgy?: HeatExchangerMetallurgy | 'auto';
  /** V3 heat exchanger material designation ('Al-Si' | 'stainless_steel'). */
  heatExchangerMaterial?: 'Al-Si' | 'stainless_steel';

  // Mixergy legacy
  hasIotIntegration?: boolean;
  installerNetwork?: InstallerNetwork;
  dhwStorageLitres?: number;

  // Spec edge
  unitModulationFloorKw?: number;
  dhwTankType?: DhwTankType;

  // Grid flex
  gridFlexInput?: GridFlexInput;

  // Retrofit / ASHP temperature regime
  retrofit?: {
    /** Appetite for emitter upgrades when installing a heat pump. */
    emitterUpgradeAppetite?: 'none' | 'some' | 'full_job';
  };

  /** Optional engine configuration — allows callers to customise engine behaviour without changing survey data. */
  engineConfig?: {
    /** Explicit pair of system IDs for the 24-hour comparative timeline. Defaults to ['current', primary recommendation]. */
    timelinePair?: [string, string];
  };

  /**
   * Optional lifestyle profile — drives DHW event generation in the 24-hour timeline.
   * When present, the timeline uses input-derived events instead of the default template.
   */
  lifestyleProfileV1?: {
    /** Whether there is a morning shower/bath peak (roughly 06:00–09:00). */
    morningPeakEnabled: boolean;
    /** Whether there is an evening shower/bath peak (roughly 18:00–22:00). */
    eveningPeakEnabled: boolean;
    /** Whether a bath is taken (adds a higher-intensity DHW event vs shower-only). */
    hasBath: boolean;
    /**
     * Whether a dishwasher is run.
     * Modern UK dishwashers are cold-fill: they do NOT create a DHW thermal spike.
     * This generates a cold-water flow event (8–12 L/min) — not a heat demand entry.
     */
    hasDishwasher: boolean;
    /**
     * Whether a washing machine is run.
     * Modern UK washing machines are cold-fill: they do NOT create a DHW thermal spike.
     * This generates a cold-water flow event (6–8 L/min pulses) — not a heat demand entry.
     */
    hasWashingMachine: boolean;
    /** Whether two bathrooms are in use simultaneously — also feeds combi gate. */
    twoSimultaneousBathrooms: boolean;
  };
}

export interface HydraulicResult {
  flowRateLs: number;         // L/s
  velocityMs: number;         // m/s
  isBottleneck: boolean;
  isSafetyCutoffRisk: boolean;
  ashpRequires28mm: boolean;
  notes: string[];
}

/** HydraulicModuleV1 – structured flow-and-risk result. */
export interface HydraulicModuleV1Result {
  boiler:  { deltaT: number; flowLpm: number };
  ashp:    { deltaT: number; flowLpm: number };
  verdict: { boilerRisk: 'pass' | 'warn' | 'fail'; ashpRisk: 'pass' | 'warn' | 'fail' };
  notes: string[];
}

export interface CombiStressResult {
  annualPurgeLossKwh: number;
  shortDrawEfficiencyPct: number;
  condensingEfficiencyPct: number;
  isCondensingCompromised: boolean;
  totalPenaltyKwh: number;
  /**
   * Worcester Bosch longevity bonus (%).  Set to 15 when hasSoftener is true
   * and the heat exchanger is Al-Si, reflecting WB's unique softener-warranty
   * compatibility.  0 otherwise.
   */
  wbLongevityBoostPct: number;
  notes: string[];
}

/** Structured red-flag item for CombiDhwModuleV1. */
export interface CombiDhwFlagItem {
  id: 'combi-pressure-lockout' | 'combi-simultaneous-demand' | 'combi-short-draw-collapse';
  severity: 'fail' | 'warn';
  title: string;
  detail: string;
}

/** Result returned by CombiDhwModuleV1. */
export interface CombiDhwV1Result {
  verdict: {
    /** 'fail' = hard reject; 'warn' = caution; 'pass' = clear. */
    combiRisk: 'fail' | 'warn' | 'pass';
  };
  flags: CombiDhwFlagItem[];
  assumptions: string[];
}

/** Structured flag item for StoredDhwModuleV1. */
export interface StoredDhwFlagItem {
  id:
    | 'stored-space-tight'
    | 'stored-space-unknown'
    | 'stored-high-demand'
    | 'stored-solves-simultaneous-demand';
  severity: 'info' | 'warn';
  title: string;
  detail: string;
}

/** Result returned by StoredDhwModuleV1. */
export interface StoredDhwV1Result {
  verdict: {
    /** 'warn' = caution needed; 'pass' = clear. */
    storedRisk: 'warn' | 'pass';
  };
  recommended: {
    type: 'standard' | 'mixergy' | 'unknown';
    volumeBand: 'small' | 'medium' | 'large';
  };
  flags: StoredDhwFlagItem[];
  assumptions: string[];
}

export interface MixergyResult {
  equivalentConventionalLitres: number;
  mixergyLitres: number;
  footprintSavingPct: number;
  heatPumpCopMultiplierPct: number;
  /**
   * Gas saving (%) delivered by Mixergy's active top-down stratification versus
   * a conventional cylinder of equivalent capacity.  Based on Mixergy field data:
   * only the volume actually required is heated, avoiding full-tank reheat cycles.
   */
  gasSavingPct: number;
  notes: string[];
}

export interface OccupancyHour {
  hour: number;       // 0-23
  demandKw: number;   // kW demand
  boilerTempC: number;
  heatPumpTempC: number;
  storedWaterTempC: number;
}

export interface LifestyleResult {
  signature: OccupancySignature;
  recommendedSystem: 'boiler' | 'ashp' | 'stored_water';
  hourlyData: OccupancyHour[];
  notes: string[];
}

export interface NormalizerOutput {
  cacO3Level: number;    // mg/L
  silicaLevel: number;   // mg/L
  waterHardnessCategory: 'soft' | 'moderate' | 'hard' | 'very_hard';
  systemVolumeL: number; // estimated from radiator count (or 6 L/kW proxy)
  canUseVentedSystem: boolean;
  scaleRf: number;       // thermal resistance factor
  tenYearEfficiencyDecayPct: number;
  /**
   * Silicate scaling scaffold coefficient – 10.0 for high-silica areas
   * (London / Essex geology), 1.0 elsewhere.  Silicates form a porous
   * ceramic scaffold that is ~10× harder to remove than CaCO₃ alone.
   */
  scalingScaffoldCoefficient: number;
  /**
   * Sludge Potential (Primary circuit): 0–1 factor representing magnetite
   * sludge risk linked to system age and piping topology.  At 1.0, full Baxi
   * research impact applies: 47% radiator heat output reduction / 7% bill increase.
   */
  sludgePotential: number;
  /**
   * Scaling Potential (Secondary/DHW): 0–1 factor representing DHW heat-exchanger
   * scale risk linked to postcode CaCO₃ hardness and silicate scaffold presence.
   * Based on research: 8% efficiency drop for every 1 mm of scale accumulation.
   */
  scalingPotential: number;
  /**
   * Primary Sludge Risk (0–1): independent coefficient for the primary (closed
   * heating) circuit magnetite sludge stressor.  Alias for sludgePotential,
   * returned as a dedicated two-water output field.
   */
  primarySludgeRisk: number;
  /**
   * Secondary Scale Risk (0–1): independent coefficient for the secondary (open
   * DHW) circuit CaCO₃/silicate scale stressor.  Alias for scalingPotential,
   * returned as a dedicated two-water output field.
   */
  secondaryScaleRisk: number;
}

// ─── Maintenance ROI ──────────────────────────────────────────────────────────

export interface MaintenanceROIInput {
  /** True if an inline magnetic filter is fitted on the primary return */
  hasMagneticFilter: boolean;
  /** CaCO₃ level from the Geochemical Normalizer (mg/L) – drives scale penalty */
  cacO3LevelMgL: number;
  /** True if a salt-based water softener is fitted (clears scale penalty) */
  hasSoftener: boolean;
  /** Annual gas spend (GBP) – used to monetise efficiency penalties */
  annualGasSpendGbp: number;
  /** True when the postcode overlies high-silica geology (London Basin / Thames Estuary) */
  isHighSilica?: boolean;
}

export interface MaintenanceROIResult {
  /** Annual cost due to magnetite sludge (GBP) – 0 when magnetic filter is fitted */
  sludgePenaltyGbpPerYear: number;
  /** Annual cost due to DHW scale (GBP) – 0 when softener is fitted or water is <200 ppm */
  scalingPenaltyGbpPerYear: number;
  /** Combined annualised Cost of Inaction (GBP/year) */
  totalAnnualCostGbp: number;
  /** Years for a £500 professional flush to pay back through restored efficiency (null if no cost) */
  flushPaybackYears: number | null;
  /** Human-readable sell message for the Hive HomeCare / British Gas subscription hook */
  message: string;
  /** True when magnetite sludge is actively degrading radiator heat output (no magnetic filter) */
  sluggishRadiatorActive: boolean;
  /** Radiator heat output reduction (%) due to magnetite sludge – 47% when active, 0 otherwise */
  radiatorHeatOutputReductionPct: number;
  notes: string[];
}

export interface RedFlagResult {
  rejectCombi: boolean;
  /** Preferred field name for stored hot-water architecture eligibility. */
  rejectStored: boolean;
  /** @deprecated Backward-compatible alias for rejectStored. */
  rejectVented: boolean;
  flagAshp: boolean;
  /** True when one-pipe topology is detected – ASHP cannot operate without return temp >55°C */
  rejectAshp: boolean;
  reasons: string[];
}

export interface BomItem {
  name: string;
  model: string;
  quantity: number;
  notes: string;
  /** Indicative trade unit price in GBP (populated by WholesalerPricingAdapter) */
  unitPriceGbp?: number;
}

// ─── Legacy Infrastructure ────────────────────────────────────────────────────

export interface RadiatorTemperatureProfile {
  position: number;       // 1-based index in the loop
  inletTempC: number;     // °C at inlet to this radiator
  outletTempC: number;    // °C at outlet from this radiator
  meanWaterTempC: number; // °C average
  isCondensingCompatible: boolean; // outlet < 55°C
}

export interface LegacyInfrastructureResult {
  pipingTopology: PipingTopology;
  onePipe?: {
    radiatorProfiles: RadiatorTemperatureProfile[];
    averageReturnTempC: number;
    isCondensingCompatible: boolean;
    lastRadiatorInletTempC: number;
    coolRadiatorEffect: boolean; // last radiator inlet significantly lower than supply
  };
  microbore?: {
    internalDiameterMm: number;
    velocityMs: number;
    frictionLossPerMetrePa: number;
    isNoiseRisk: boolean;
    isErosionRisk: boolean;
    requiresBufferTank: boolean;
  };
  notes: string[];
}

// ─── Parity Calibrator ────────────────────────────────────────────────────────

export interface CalibrationDataPoint {
  period: string;           // human-readable label, e.g. "Jan 2024"
  energyKwh: number;        // measured energy consumed in period
  avgIndoorTempC: number;   // average indoor temperature
  avgOutdoorTempC: number;  // average outdoor temperature
  heatingHours: number;     // hours the heating was active
}

export interface CalibrationInput {
  dataPoints: CalibrationDataPoint[];
  floorAreaM2: number;
}

export interface CalibrationResult {
  heatLossCoefficientWperK: number;       // derived UA value (W/K)
  estimatedHeatLossAtDesignW: number;     // at -3°C external, 21°C internal
  thermalMassKjPerK: number;              // estimated effective thermal mass
  confidenceScore: number;                // 0–1
  calibratedVsTheoreticalRatio: number;  // >1 = measured > theoretical (common in older stock)
  /** True when measured heat loss deviates >30% from theoretical – indicates performance gap */
  performanceGapDetected: boolean;
  notes: string[];
}

// ─── Predictive Maintenance ───────────────────────────────────────────────────

export interface PredictiveMaintenanceInput {
  systemAgeYears: number;
  boilerModelYear: number;
  waterHardnessCategory: NormalizerOutput['waterHardnessCategory'];
  hasScaleInhibitor: boolean;
  hasMagneticFilter: boolean;
  annualServicedByEngineer: boolean;
  /** Silica level from geochemical normalizer (mg/L) – drives silicate-tax efficiency decay */
  silicateLevelMgL?: number;
  /** Annual gas spend (GBP) – used to convert efficiency decay into £/year cost */
  annualGasSpendGbp?: number;
}

export interface PredictiveMaintenanceResult {
  kettlingRiskScore: number;            // 0–10 (10 = imminent)
  magnetiteRiskScore: number;           // 0–10
  overallHealthScore: number;           // 0–100 (100 = perfect)
  estimatedRemainingLifeYears: number;
  /** Estimated annual cost of running the system in its degraded state (GBP) */
  annualCostOfDecayGbp: number;
  /** Years for a £500 system flush to pay back through restored efficiency (null if no spend provided) */
  flushRoiYears: number | null;
  recommendations: string[];
  criticalAlerts: string[];
}

// ─── Anti-Legionella / DHW Controls ──────────────────────────────────────────

export interface AntiLegionellaInput {
  dhwStorageLitres: number;
  systemType: 'conventional' | 'mixergy';
  weeklyHighTempCycleEnabled: boolean;
  highTempCycleTempC: number;           // typically 60–65°C
  mixergyStratificationEnabled?: boolean;
  nominalSCOP: number;                  // baseline SCOP without Legionella penalty
}

export interface AntiLegionellaResult {
  annualLegionellaCycles: number;
  energyPerCycleKwh: number;
  annualPenaltyKwh: number;
  effectiveSCOP: number;
  scopPenaltyPct: number;
  mixergyBenefit?: {
    stratificationTempC: number;
    sterilizationTempC: number;
    energySavingVsConventionalKwh: number;
    safeSterilizationPossible: boolean;
  };
  notes: string[];
}

// ─── MCS Compliance Report ────────────────────────────────────────────────────

export interface RoomHeatLoss {
  roomName: string;
  floorAreaM2: number;
  heatLossW: number;
  requiredRadiatorOutputW: number;
}

export interface MCSReportInput {
  propertyAddress: string;
  installerMcsNumber: string;
  designFlowTempC: number;
  designReturnTempC: number;
  externalDesignTempC: number;
  internalDesignTempC: number;
  rooms: RoomHeatLoss[];
  primaryPipeDiameter: number;
  hydraulicResult: HydraulicResult;
  systemType: 'ashp' | 'gshp' | 'boiler';
  /** Total primary circuit water volume (litres) – required for expansion vessel sizing */
  primaryVolumeL?: number;
}

export interface MCSComplianceCheck {
  check: string;
  passed: boolean;
  detail: string;
}

export interface MCSReport {
  referenceNumber: string;
  generatedAt: string;
  totalHeatLossW: number;
  designFlowTempC: number;
  hydraulicVelocityMs: number;
  isVelocityCompliant: boolean;
  noiseAnalysis: string;
  roomByRoomSchedule: RoomHeatLoss[];
  complianceChecks: MCSComplianceCheck[];
  mcsPackSections: string[];
  /** Minimum expansion vessel size (litres) sized at 15% of primary volume */
  expansionVesselSizingL: number;
}

// ─── Heat Pump Regime Module V1 ───────────────────────────────────────────────

/** Flag item emitted by HeatPumpRegimeModuleV1. */
export interface HeatPumpRegimeFlagItem {
  id: 'regime-flow-temp-elevated' | 'regime-cop-penalty' | 'regime-full-job-unlocks-low-temp';
  severity: 'info' | 'warn';
  title: string;
  detail: string;
}

/** Result returned by HeatPumpRegimeModuleV1. */
export interface HeatPumpRegimeModuleV1Result {
  /** Design flow temperature band: 35°C (low-temp full job), 45°C (partial upgrade), 50°C (minimal change). */
  designFlowTempBand: 35 | 45 | 50;
  /** Seasonal Performance Factor band at the derived flow temp. */
  spfBand: 'good' | 'ok' | 'poor';
  flags: HeatPumpRegimeFlagItem[];
  assumptions: string[];
}

// ─── Updated FullEngineResult ─────────────────────────────────────────────────

/** Core module outputs — everything except the derived engineOutput contract. */
export interface FullEngineResultCore {
  hydraulic: HydraulicResult;
  hydraulicV1: HydraulicModuleV1Result;
  combiStress: CombiStressResult;
  combiDhwV1: CombiDhwV1Result;
  storedDhwV1: StoredDhwV1Result;
  mixergy: MixergyResult;
  lifestyle: LifestyleResult;
  normalizer: NormalizerOutput;
  redFlags: RedFlagResult;
  bomItems: BomItem[];
  legacyInfrastructure: LegacyInfrastructureResult;
  sludgeVsScale: SludgeVsScaleResult;
  systemOptimization: SystemOptimizationResult;
  metallurgyEdge: MetallurgyEdgeResult;
  mixergyLegacy: MixergyLegacyResult;
  specEdge: SpecEdgeResult;
  gridFlex?: GridFlexResult;
  heatPumpRegime: HeatPumpRegimeModuleV1Result;
  pressureAnalysis: PressureAnalysis;
  cwsSupplyV1: CwsSupplyV1Result;
  /** SEDBUK boiler efficiency baseline result (present when current system boiler info provided). */
  sedbukV1?: SedbukResultV1;
  /** Boiler sizing result (present when current system boiler info provided). */
  sizingV1?: BoilerSizingResultV1;
}

/** Full engine result including the canonical V1 output contract. */
export type FullEngineResult = FullEngineResultCore & {
  /** Canonical engine output (V1 contract). */
  engineOutput: EngineOutputV1;
};

// ─── Connected Insights V2.4 ──────────────────────────────────────────────────

export type InsightProviderSource = 'octopus' | 'hive' | 'ovo' | 'manual' | 'dcc_link';
export type InsightAuthType = 'api_key' | 'oauth_credential' | 'magic_link';
export type SmartTariff = 'octopus_agile' | 'octopus_cosy' | 'standard_fixed';

export interface ConnectedEngineInputV2_4 {
  insightProvider: {
    source: InsightProviderSource;
    authType: InsightAuthType;
    lastSynced: string; // ISO 8601
  };
  historicalData: {
    /** Half-hourly gas consumption readings (kWh per half-hour slot) – Octopus/OVO API */
    gasConsumptionHalfHourly?: number[];
    /** Timestamped internal temperature readings from Hive thermostat */
    internalTemperatureTelemetry?: { t: string; v: number }[];
    /** Annual gas consumption from a manual bill entry (kWh) */
    annualGasKwh?: number;
  };
  gridConstraints: {
    smartTariff: SmartTariff;
    hasSolarPV: boolean;
    /** Enables "Hot Water Battery" logic for Mixergy Solar X integration */
    mixergySolarX: boolean;
    /** Tank volume (litres) for Solar X; 300L+ unlocks 40% grid-import reduction vs 35% standard */
    mixergySolarXTankLitres?: number;
  };
}

// ─── ConnectedInsightModule Outputs ───────────────────────────────────────────

export interface ThermalDecayResult {
  /** Thermal Time Constant τ (hours) – derived from Hive temperature history */
  thermalTimeConstantHours: number;
  /** Temperature drop rate when heating is off (°C/hr) */
  coolingRateCPerHour: number;
  /** External temperature used as baseline for the calculation (°C) */
  referenceExternalTempC: number;
  notes: string[];
}

export interface BaseloadIsolationResult {
  /** Estimated annual DHW (domestic hot water) demand (kWh) */
  estimatedDhwKwh: number;
  /** Estimated annual space heating demand (kWh) */
  estimatedSpaceHeatingKwh: number;
  /** Number of detected combi ignition spikes (>19 kW peaks) */
  highIntensitySpikeCount: number;
  notes: string[];
}

export interface HalfHourSlot {
  /** Half-hour index (0–47, where 0 = 00:00–00:30) */
  slotIndex: number;
  /** Pence per kWh for this slot */
  pricePerKwhPence: number;
}

export interface DsrSavingsResult {
  /** Estimated annual grid-import saving by shifting DHW to cheapest slots (kWh) */
  annualLoadShiftSavingKwh: number;
  /** Estimated annual saving in GBP from load shifting */
  annualLoadShiftSavingGbp: number;
  /** Additional saving from Mixergy Solar X battery effect (kWh), if enabled */
  mixergySolarXSavingKwh: number;
  /** Optimal daily half-hour slot index for DHW scheduling (0–47) */
  optimalSlotIndex: number;
  notes: string[];
}

export interface MagicLinkResult {
  /** Secure one-time URL for read-only property data sharing */
  url: string;
  /** ISO 8601 expiration timestamp (24 hours from generation) */
  expiresAt: string;
  /** Unique token embedded in the URL */
  token: string;
}

export interface ComparisonTrace {
  /** Theoretical heat loss derived from building physics (kWh/year) */
  theoreticalHeatLossKwh: number;
  /** Measured consumption from provider data (kWh/year) */
  measuredConsumptionKwh: number;
  /** Gap between measured and theoretical (positive = worse than modelled) */
  gapKwh: number;
  /** Ratio of measured to theoretical (>1 means building underperforms model) */
  ratio: number;
}

export interface ConnectedInsightResult {
  /** 0.0–1.0 confidence score: 1.0 = half-hourly, 0.4 = manual bill */
  dataConfidence: number;
  thermalDecay?: ThermalDecayResult;
  baseloadIsolation?: BaseloadIsolationResult;
  dsrSavings?: DsrSavingsResult;
  comparisonTrace: ComparisonTrace;
  notes: string[];
}

// ─── Sludge vs Scale ─────────────────────────────────────────────────────────

export type InstallationPolicy = 'full_job' | 'high_temp_retrofit';

export interface SludgeVsScaleInput {
  /** Piping topology of the primary circuit */
  pipingTopology: PipingTopology;
  /** True if an inline magnetic filter is fitted on the primary return */
  hasMagneticFilter: boolean;
  /** Water hardness category from the geochemical normalizer */
  waterHardnessCategory: NormalizerOutput['waterHardnessCategory'];
  /** Age of the system in years */
  systemAgeYears: number;
  /** Annual gas spend (GBP) – used to convert efficiency penalties into £/year */
  annualGasSpendGbp?: number;
}

export interface SludgeVsScaleResult {
  /** Primary circuit: magnetite sludge tax (% efficiency loss, 0 when not applicable) */
  primarySludgeTaxPct: number;
  /** DHW circuit: CaCO3/silicate scale penalty (% fuel increase for DHW only) */
  dhwScalePenaltyPct: number;
  /** Estimated scale thickness on DHW heat exchanger (mm) */
  estimatedScaleThicknessMm: number;
  /** Modelled DHW recovery latency increase due to scale (seconds per draw) */
  dhwRecoveryLatencyIncreaseSec: number;
  /** Annual cost attributed to primary sludge degradation (GBP, 0 if no gas spend) */
  primarySludgeCostGbp: number;
  /** Annual cost attributed to DHW scale degradation (GBP, 0 if no gas spend) */
  dhwScaleCostGbp: number;
  notes: string[];
}

// ─── System Optimization ──────────────────────────────────────────────────────

export interface SystemOptimizationInput {
  /** Installation policy – drives flow temperature and radiator sizing */
  installationPolicy: InstallationPolicy;
  /** Design heat loss of the property (W) */
  heatLossWatts: number;
  /** Number of radiators in the system */
  radiatorCount: number;
}

export interface SystemOptimizationResult {
  installationPolicy: InstallationPolicy;
  /** Modelled design flow temperature (°C) */
  designFlowTempC: number;
  /** Seasonal Performance Factor range [min, max] */
  spfRange: [number, number];
  /** Midpoint SPF for single-figure display */
  spfMidpoint: number;
  /** Radiator type recommended/assumed for this policy */
  radiatorType: string;
  /** True when the policy unlocks condensing mode (return < 55 °C) */
  condensingModeAvailable: boolean;
  notes: string[];
}

// ─── Metallurgy Edge ─────────────────────────────────────────────────────────

export type HeatExchangerMetallurgy = 'al_si' | 'stainless_steel';

export interface MetallurgyEdgeInput {
  /** True if a salt-based water softener is fitted on the domestic side */
  hasSoftener: boolean;
  /** Water hardness category (for scale risk context) */
  waterHardnessCategory: NormalizerOutput['waterHardnessCategory'];
  /** Preferred metallurgy or 'auto' for engine recommendation */
  preferredMetallurgy?: HeatExchangerMetallurgy | 'auto';
}

export interface MetallurgyEdgeResult {
  /** Recommended heat exchanger metallurgy for this property */
  recommendedMetallurgy: HeatExchangerMetallurgy;
  /** True when WB 8000+ is boosted due to softener compatibility */
  wbSoftenerEdgeActive: boolean;
  /** Primary reason for the recommendation */
  recommendationReason: string;
  /** Human-readable flag for the installer – populated when softener edge is active */
  softenerCompatibilityFlag?: string;
  notes: string[];
}

// ─── Mixergy Legacy ───────────────────────────────────────────────────────────

export type InstallerNetwork = 'british_gas' | 'independent';

export interface MixergyLegacyInput {
  /** Whether the property already has an IoT-capable thermostat / hub */
  hasIotIntegration: boolean;
  /** Installer network – drives BG-exclusivity logic */
  installerNetwork: InstallerNetwork;
  /** DHW storage volume (litres) */
  dhwStorageLitres: number;
}

export interface MixergyLegacyResult {
  /** True when BG exclusive-install terms apply */
  bgExclusivityActive: boolean;
  /** IoT capability tier unlocked for this configuration */
  iotTier: 'none' | 'basic' | 'full';
  /** Estimated annual DHW saving versus a conventional cylinder (kWh) */
  estimatedAnnualSavingKwh: number;
  notes: string[];
}

// ─── Portfolio Analysis ───────────────────────────────────────────────────────

export interface PortfolioProperty {
  /** Unique asset reference (e.g. address or HA asset ID) */
  assetId: string;
  address: string;
  maintenanceInput: PredictiveMaintenanceInput;
  /** Year of last MCS design review (undefined = never) */
  lastMcsReviewYear?: number;
  /** Year of last Legionella risk assessment (undefined = never) */
  lastLegionellaAssessmentYear?: number;
  /** Dynamic system pressure at last inspection (bar) */
  lastDynamicPressureBar?: number;
  /** Date string of most recent annual service (ISO 8601) */
  lastServiceDate?: string;
}

export interface PortfolioPropertyResult {
  assetId: string;
  address: string;
  kettlingRiskScore: number;    // 0–10
  magnetiteRiskScore: number;   // 0–10
  overallHealthScore: number;   // 0–100
  complianceAlerts: string[];
  recommendedActions: string[];
}

export interface PortfolioResult {
  properties: PortfolioPropertyResult[];
  /** Assets ordered from highest risk to lowest */
  rankedByRisk: PortfolioPropertyResult[];
  fleetAverageHealthScore: number;
  criticalAssetCount: number;
  complianceFailureCount: number;
}

// ─── Spec Edge Module ─────────────────────────────────────────────────────────

export type DhwTankType = 'standard' | 'mixergy';

export interface SpecEdgeInput {
  /** Installation policy – drives flow temperature and SPF curves */
  installationPolicy: InstallationPolicy;
  /** Building design heat loss (W) */
  heatLossWatts: number;
  /** Unit modulation floor (kW) – used for "Motorway Cruise" longevity bonus */
  unitModulationFloorKw: number;
  /** Water hardness category – drives DHW scaling tax */
  waterHardnessCategory: NormalizerOutput['waterHardnessCategory'];
  /** True if a salt-based water softener is fitted */
  hasSoftener: boolean;
  /** True if an inline magnetic filter is fitted on the primary return */
  hasMagneticFilter: boolean;
  /** DHW tank type – enables Mixergy stratification saving when 'mixergy' */
  dhwTankType?: DhwTankType;
  /** Annual gas spend (GBP) – used to monetise efficiency penalties */
  annualGasSpendGbp?: number;
  /** Preferred heat exchanger metallurgy or 'auto' for engine recommendation */
  preferredMetallurgy?: HeatExchangerMetallurgy | 'auto';
}

export interface SpecEdgeResult {
  // ── Installation strategy ───────────────────────────────────────────────
  /** Modelled design flow temperature (°C) */
  designFlowTempC: number;
  /** Seasonal Performance Factor range [min, max] */
  spfRange: [number, number];
  /** Midpoint SPF for single-figure display */
  spfMidpoint: number;

  // ── Metallurgy & longevity ──────────────────────────────────────────────
  /** Recommended heat exchanger metallurgy */
  recommendedMetallurgy: HeatExchangerMetallurgy;
  /** True when unit modulation floor closely matches building heat loss (Motorway Cruise rule) */
  longevityBonusActive: boolean;

  // ── Softener compatibility ──────────────────────────────────────────────
  /** True when WB 8000+ is boosted due to softener compatibility */
  wbSoftenerEdgeActive: boolean;
  /** Human-readable installer briefing flag – populated when softener edge is active */
  softenerCompatibilityFlag?: string;

  // ── Maintenance ROI ─────────────────────────────────────────────────────
  /** Magnetite sludge tax: estimated energy bill increase (%) when no magnetic filter */
  magnetiteSludgeTaxPct: number;
  /** Radiator heat output reduction (%) due to magnetite when no magnetic filter */
  radiatorHeatOutputReductionPct: number;
  /** DHW scaling tax: fuel increase (%) for hot water in hard-water postcodes */
  dhwScalingTaxPct: number;
  /** Annualised Cost of Inaction (GBP/year) – sludge + scaling penalties combined */
  annualCostOfInactionGbp: number;
  /** Years for a professional flush to pay back through restored efficiency (null if no gas spend provided) */
  flushPaybackYears: number | null;

  // ── Mixergy saving ──────────────────────────────────────────────────────
  /** Gas saving (%) from Mixergy stratification – set when dhwTankType is 'mixergy' */
  mixergyGasSavingPct?: number;
  /** Footprint reduction (%) from Mixergy versus a conventional cylinder */
  mixergyFootprintReductionPct?: number;

  notes: string[];
}

// ─── Regional Hardness Module ─────────────────────────────────────────────────

export interface RegionalHardnessResult {
  /** Extracted postcode prefix (e.g. 'DT' for 'DT9 3AQ') */
  postcodePrefix: string;
  /** Modelled CaCO₃ level (mg/L / ppm) for this postcode zone */
  ppmLevel: number;
  /** Water hardness classification */
  hardnessCategory: NormalizerOutput['waterHardnessCategory'];
  /**
   * True when the postcode overlies high-silica geology (London Basin / Thames
   * Estuary, or Dorset Chalk / Jurassic limestone).  Silicates form a porous
   * ceramic scaffold ~10× harder to remove than CaCO₃ alone, adding a
   * compounding thermal resistance penalty.
   */
  silicateTaxActive: boolean;
  /** Human-readable description of the local water chemistry and commercial implication */
  description: string;
  notes: string[];
}

// ─── Softener Warranty Module ─────────────────────────────────────────────────

export type BoilerCompatibility = 'wb_8000plus' | 'vaillant' | 'other';

export interface SoftenerWarrantyInput {
  /** True if a salt-based water softener is fitted on the domestic side */
  hasSoftener: boolean;
  /** Water hardness category – determines scale-penalty baseline */
  waterHardnessCategory: NormalizerOutput['waterHardnessCategory'];
  /** Boiler model in use – determines softener compatibility */
  boilerCompatibility?: BoilerCompatibility;
}

export interface SoftenerWarrantyResult {
  /**
   * DHW scaling tax percentage cleared by the softener (11% efficiency gain
   * retained when softener is present and water is hard/very_hard).
   * 0 when no softener is fitted or water is soft/moderate.
   */
  dhwScalingTaxClearedPct: number;
  /**
   * True when the heating (primary) circuit must still be filled with hard
   * water + Sentinel X100 inhibitor to satisfy WB warranty conditions.
   * Always true when wbEdgeActive is true.
   */
  primaryBypassRequired: boolean;
  /** Human-readable primary bypass rule for the installer brief */
  primaryBypassRule: string;
  /** True when WB 8000+ (Al-Si) softener edge is unlocked */
  wbEdgeActive: boolean;
  notes: string[];
}

// ─── Full Job SPF Module ──────────────────────────────────────────────────────

export type InstallationVariant = 'full_job' | 'fast_fit';

export interface FullJobSPFInput {
  /** Installation variant – drives design flow temperature and SPF curve */
  installationVariant: InstallationVariant;
  /** Building design heat loss (W) */
  heatLossWatts: number;
  /** Annual gas spend (GBP) – used to monetise running-cost difference (optional) */
  annualGasSpendGbp?: number;
}

export interface FullJobSPFResult {
  /** The installation variant that was evaluated */
  installationVariant: InstallationVariant;
  /** Modelled design flow temperature (°C) */
  designFlowTempC: number;
  /** Seasonal Performance Factor range [min, max] */
  spfRange: [number, number];
  /** Midpoint SPF for single-figure display */
  spfMidpoint: number;
  /**
   * SPF improvement if the alternative (Full Job) were chosen instead.
   * Positive means Full Job is better; 0 when Full Job is already selected.
   */
  spfDeltaVsAlternative: number;
  /**
   * Estimated annual gas saving (GBP/year) achievable by upgrading to the
   * Full Job variant.  Null when annualGasSpendGbp is not provided or Full
   * Job is already selected.
   */
  annualSavingGbp: number | null;
  notes: string[];
}

// ─── Grid Flexibility & Solar X Module ───────────────────────────────────────

export interface GridFlexInput {
  /** Annual DHW energy demand to be shifted (kWh) */
  dhwAnnualKwh: number;
  /** Usable thermal storage capacity of the cylinder (kWh) */
  cylinderCapacityKwh: number;
  /** 48 half-hour Agile price slots for a representative day (p/kWh) */
  agileSlots: HalfHourSlot[];
  /** True if Mixergy Solar X diverter integration is enabled */
  mixergySolarX: boolean;
  /** Tank volume (litres) – 300L+ triggers enhanced 40% Solar X saving */
  tankVolumeLitres?: number;
  /** Estimated annual solar surplus available for DHW diversion (kWh) */
  annualSolarSurplusKwh?: number;
  /**
   * DHW heat source type.
   *  - 'combi':   Combi boiler – must fire on demand; shifting potential = 0%.
   *  - 'mixergy': Mixergy stored cylinder – 100% shiftable as a hot-water battery.
   */
  tankType?: 'combi' | 'mixergy';
  /**
   * Energy provider identifier.
   * Used to apply provider-specific commercial rebates (e.g. British Gas £40/yr).
   */
  provider?: 'british_gas' | 'octopus' | string;
}

export interface GridFlexResult {
  /** Optimal half-hour slot index (0–47) for scheduling the daily DHW reheat */
  optimalSlotIndex: number;
  /** Price at the optimal slot (p/kWh) */
  optimalSlotPricePence: number;
  /** Daily average Agile price (p/kWh) across all 48 slots */
  dailyAvgPricePence: number;
  /** Estimated annual saving from shifting DHW load to the cheapest slot (GBP) */
  annualLoadShiftSavingGbp: number;
  /** Additional annual grid-import reduction from Mixergy Solar X (kWh) */
  mixergySolarXSavingKwh: number;
  /** Financial value of the Solar X grid-import reduction (GBP) at baseline tariff */
  mixergySolarXSavingGbp: number;
  /** Combined annual saving: load shift + Solar X (GBP) */
  totalAnnualSavingGbp: number;
  /** Cylinder charge fraction achievable from solar surplus alone (0–1) */
  solarSelfConsumptionFraction: number;
  /**
   * Fraction of daily DHW energy that can be shifted to off-peak slots.
   *  - 0.0 for combi boilers (must fire on demand).
   *  - 1.0 for Mixergy stored cylinders (full hot-water battery shifting).
   */
  shiftingPotentialFraction: number;
  /**
   * British Gas "Mixergy Extra" annual rebate (GBP).
   * Applied when tankType is 'mixergy' AND provider is 'british_gas'.
   * Zero for all other combinations.
   */
  bgRebateGbp: number;
  notes: string[];
}

// ─── Multi-Tenant Theming ─────────────────────────────────────────────────────

export type TenantId = 'bg' | 'octopus' | 'default';

/**
 * White-label tenant configuration for the Professional Portal.
 *
 *  - 'bg':      British Gas / Hive – prioritises Home Health Check,
 *               WB 8000+ recommendations, and Maintenance ROI visualizer.
 *  - 'octopus': Octopus Energy – prioritises Heat Pump SPF (Full Job vs.
 *               Fast Fit) and the Hot Water Battery Agile savings chart.
 *  - 'default': Neutral Atlas branding with no priority overrides.
 */
export interface TenantConfig {
  tenantId: TenantId;
  /** Display name shown in the portal header */
  brandName: string;
  /** Primary accent colour (CSS hex value) */
  accentColor: string;
  /**
   * Ordered list of module IDs to surface as primary recommendations.
   * Modules not listed are still available but de-prioritised.
   */
  priorityModules: string[];
}


// ─── Thermal Inertia Module ───────────────────────────────────────────────────

/**
 * Building fabric type classification for thermal inertia simulation.
 *  - 'solid_brick_1930s':  Pre-war solid brick construction.
 *                          High thermal mass; Tau (τ) ≈ 55 hours.
 *  - '1970s_cavity_wall':  Post-war cavity wall with partial fill insulation.
 *                          Medium thermal mass; Tau (τ) ≈ 35 hours.
 *  - 'lightweight_new':    Post-1990s lightweight frame / new build.
 *                          Low thermal mass; Tau (τ) ≈ 15 hours.
 *  - 'passivhaus_standard': Super-insulated Passivhaus certified fabric.
 *                           Very high thermal mass; Tau (τ) ≈ 190.5 hours.
 */
export type BuildingFabricType =
  | 'solid_brick_1930s'
  | '1970s_cavity_wall'
  | 'lightweight_new'
  | 'passivhaus_standard';

/**
 * Occupancy profile for the thermal decay simulation.
 *  - 'professional': Occupants away all day (08:00–18:00). Exposes maximum decay.
 *  - 'home_all_day': Continuous occupancy; heat source cycling every 1–2 hours.
 */
export type OccupancyProfile = 'professional' | 'home_all_day';

export interface ThermalInertiaInput {
  /** Building fabric type – determines the thermal time constant (τ). */
  fabricType: BuildingFabricType;
  /** Occupancy profile – determines simulation window length. */
  occupancyProfile: OccupancyProfile;
  /** Indoor temperature at the start of the unheated period (°C). */
  initialTempC: number;
  /** Outdoor / ambient temperature during the unheated period (°C). */
  outdoorTempC: number;
  /**
   * Duration of the unheated period to simulate (hours).
   * Defaults to 10 hours (08:00–18:00) when occupancyProfile is 'professional'.
   */
  unheatedHours?: number;
}

export interface ThermalInertiaDataPoint {
  /** Hours elapsed since the start of the unheated period. */
  hourOffset: number;
  /** Simulated indoor temperature at this time step (°C, 1 d.p.). */
  tempC: number;
}

export interface ThermalInertiaResult {
  /** Thermal time constant used (τ, hours). */
  tauHours: number;
  /** Indoor temperature at the end of the unheated period (°C). */
  finalTempC: number;
  /** Total temperature drop over the unheated period (°C). */
  totalDropC: number;
  /**
   * Hour-by-hour temperature trace for charting.
   * Each entry covers one hour of the unheated window.
   */
  trace: ThermalInertiaDataPoint[];
  /** Human-readable narrative for the demo / sales meeting. */
  narrative: string;
  notes: string[];
}

// ─── Survey Summary Generator ─────────────────────────────────────────────────

/** A single surface element in a room used for the BS EN 12831 heat loss calculation. */
export interface SurveySurface {
  /** Area of the surface (m²) */
  area: number;
  /** U-value of the surface (W/m²K) */
  uValue: number;
}

/** Room-level input for the MCS 003 room-by-room heat loss schedule. */
export interface SurveySummaryRoom {
  /** Room name (e.g. 'Living Room') */
  name: string;
  /** Design target temperature for this room (°C) */
  targetTemp: number;
  /** Surface elements for fabric heat loss calculation */
  surfaces: SurveySurface[];
  /** Air change rate (n, air changes per hour) – used for ventilation heat loss */
  airChangesPerHour: number;
  /** Room volume (m³) – used for ventilation heat loss calculation */
  volume: number;
  /** Installed emitter output at design conditions (W) – used for compliance check */
  emitterOutputWatts: number;
}

/** A single line item in the Technical Bill of Materials. */
export interface SurveyBomEntry {
  component: string;
  detail: string;
}

/** A single room entry in the MCS 003 heat loss schedule. */
export interface HeatLossScheduleEntry {
  roomName: string;
  /** Design internal temperature (°C) */
  designTemp: number;
  /** Total calculated heat loss at design conditions (W) */
  totalWatts: number;
  /** True when installed emitter output ≥ calculated heat loss */
  isCompliant: boolean;
}

/**
 * A commercial insight for the design pack.
 *  - 'pass':  Green checkmark – requirement is met.
 *  - 'warn':  Amber/red flag – action required.
 *  - 'info':  Blue information – supporting evidence.
 */
export interface CommercialInsight {
  title: string;
  detail: string;
  status: 'pass' | 'warn' | 'info';
}

/** Input for the SurveySummaryGenerator. */
export interface SurveySummaryInput {
  /** Customer / site postcode – document reference and regional calibration key */
  postcode: string;
  /** Design heat loss of the property (W) */
  heatLossWatts: number;
  /** External design temperature (°C, e.g. −3 for southern England) */
  outsideDesignTemp: number;
  /** True if a salt-based water softener is fitted on the domestic side */
  hasSoftener: boolean;
  /** Room-by-room inputs for the BS EN 12831 heat loss schedule */
  rooms: SurveySummaryRoom[];
  /**
   * True when the system volume is below the 6 L/kW ASHP threshold and a
   * buffer vessel is required per MCS MIS 3005.
   */
  requiresBufferVessel: boolean;
  /** SpecEdge result – supplies SPF, flush payback, and metallurgy flags */
  specEdge: SpecEdgeResult;
  /** Sludge vs Scale result – supplies annual cost-of-inaction figures */
  sludgeVsScale: SludgeVsScaleResult;
}

/** The structured data object ready for PDF injection. */
export interface SummaryDataPack {
  /** Customer reference (derived from postcode) */
  customerRef: string;
  /** Total design heat load (kW, 1 d.p. string) */
  totalHeatLoadKw: string;
  /** MCS 003 room-by-room heat loss schedule */
  heatLossSchedule: HeatLossScheduleEntry[];
  /** Three commercial 'closing' insights for the design pack */
  commercialInsights: CommercialInsight[];
  /** Technical Bill of Materials */
  bom: SurveyBomEntry[];
  /** Maintenance ROI summary */
  maintenanceROI: {
    /** Years for a professional flush to pay back through restored efficiency */
    paybackYears: string;
    copy: string;
  };
}
