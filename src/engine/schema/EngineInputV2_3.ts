export type OccupancySignature = 'professional' | 'steady_home' | 'shift_worker';

export type BuildingMass = 'light' | 'medium' | 'heavy';

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
  reasons: string[];
}

export interface FullEngineResult {
  hydraulic: HydraulicResult;
  combiStress: CombiStressResult;
  mixergy: MixergyResult;
  lifestyle: LifestyleResult;
  normalizer: NormalizerOutput;
  redFlags: RedFlagResult;
  bomItems: BomItem[];
}

export interface BomItem {
  name: string;
  model: string;
  quantity: number;
  notes: string;
}
