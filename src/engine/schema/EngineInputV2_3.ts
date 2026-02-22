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
  /**
   * Worcester Bosch longevity bonus (%).  Set to 15 when hasSoftener is true
   * and the heat exchanger is Al-Si, reflecting WB's unique softener-warranty
   * compatibility.  0 otherwise.
   */
  wbLongevityBoostPct: number;
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
  notes: string[];
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
  sludgeVsScale: SludgeVsScaleResult;
  systemOptimization: SystemOptimizationResult;
  metallurgyEdge: MetallurgyEdgeResult;
  mixergyLegacy: MixergyLegacyResult;
  specEdge: SpecEdgeResult;
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
   * Estuary).  Silicates form a porous ceramic scaffold ~10× harder to remove
   * than CaCO₃ alone, adding a compounding thermal resistance penalty.
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

