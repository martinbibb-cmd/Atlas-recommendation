export type OccupancySignature = 'professional' | 'steady_home' | 'shift_worker';

export type BuildingMass = 'light' | 'medium' | 'heavy';

export type PipingTopology = 'two_pipe' | 'one_pipe' | 'microbore';

export interface EngineInputV2_3 {
  // Location & Water
  postcode: string;
  dynamicMainsPressure: number; // bar

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
  occupancySignature: OccupancySignature;
  highOccupancy: boolean;

  // Preferences
  preferCombi: boolean;
}

export interface HydraulicResult {
  flowRateLs: number;         // L/s
  velocityMs: number;         // m/s
  isBottleneck: boolean;
  isSafetyCutoffRisk: boolean;
  ashpRequires28mm: boolean;
  notes: string[];
}

export interface CombiStressResult {
  annualPurgeLossKwh: number;
  shortDrawEfficiencyPct: number;
  condensingEfficiencyPct: number;
  isCondensingCompromised: boolean;
  totalPenaltyKwh: number;
  notes: string[];
}

export interface MixergyResult {
  equivalentConventionalLitres: number;
  mixergyLitres: number;
  footprintSavingPct: number;
  heatPumpCopMultiplierPct: number;
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
  systemVolumeL: number; // estimated from radiator count
  canUseVentedSystem: boolean;
  scaleRf: number;       // thermal resistance factor
  tenYearEfficiencyDecayPct: number;
}

export interface RedFlagResult {
  rejectCombi: boolean;
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

// ─── Updated FullEngineResult ─────────────────────────────────────────────────

export interface FullEngineResult {
  hydraulic: HydraulicResult;
  combiStress: CombiStressResult;
  mixergy: MixergyResult;
  lifestyle: LifestyleResult;
  normalizer: NormalizerOutput;
  redFlags: RedFlagResult;
  bomItems: BomItem[];
  legacyInfrastructure: LegacyInfrastructureResult;
}

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
