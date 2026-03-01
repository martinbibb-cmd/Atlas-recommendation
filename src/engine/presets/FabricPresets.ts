export type DwellingForm = 'detached' | 'semi' | 'terrace' | 'flat';
export type AgeBand = 'pre1930' | '1930_70' | '1970_90' | '1990_2010' | '2010plus';
export type SizeProxy = 'small' | 'medium' | 'large';
export type InsulationToggle = 'poor' | 'ok' | 'good';

export type WallType = 'solid_masonry' | 'cavity_insulated' | 'cavity_uninsulated' | 'timber_lightweight';
export type InsulationLevel = 'poor' | 'moderate' | 'good' | 'exceptional';
export type AirTightness = 'leaky' | 'average' | 'tight' | 'passive_level';
export type Glazing = 'single' | 'double' | 'triple';
export type RoofInsulation = 'poor' | 'moderate' | 'good';
export type ThermalMass = 'light' | 'medium' | 'heavy';

export interface FabricPreset {
  id: string;
  label: string;
  wall: WallType;
  insulation: InsulationLevel;
  air: AirTightness;
  glaz: Glazing;
  roof: RoofInsulation;
  mass: ThermalMass;
  heatLossWatts: number;
  tauHours: number;
}

const SIZE_MULTIPLIER: Record<SizeProxy, number> = { small: 0.8, medium: 1, large: 1.25 };
const INSULATION_SHIFT: Record<InsulationToggle, number> = { poor: -1, ok: 0, good: 1 };
const INSULATION_ORDER: InsulationLevel[] = ['poor', 'moderate', 'good', 'exceptional'];

const BASE_MAP: Record<DwellingForm, Record<AgeBand, Omit<FabricPreset, 'id' | 'label' | 'heatLossWatts' | 'tauHours'>>> = {
  detached: {
    pre1930: { wall: 'solid_masonry', insulation: 'poor', air: 'leaky', glaz: 'single', roof: 'poor', mass: 'heavy' },
    '1930_70': { wall: 'cavity_uninsulated', insulation: 'poor', air: 'average', glaz: 'single', roof: 'poor', mass: 'heavy' },
    '1970_90': { wall: 'cavity_insulated', insulation: 'moderate', air: 'average', glaz: 'double', roof: 'moderate', mass: 'medium' },
    '1990_2010': { wall: 'cavity_insulated', insulation: 'good', air: 'tight', glaz: 'double', roof: 'good', mass: 'medium' },
    '2010plus': { wall: 'timber_lightweight', insulation: 'good', air: 'tight', glaz: 'triple', roof: 'good', mass: 'light' },
  },
  semi: {
    pre1930: { wall: 'solid_masonry', insulation: 'poor', air: 'average', glaz: 'single', roof: 'poor', mass: 'heavy' },
    '1930_70': { wall: 'cavity_uninsulated', insulation: 'poor', air: 'average', glaz: 'double', roof: 'poor', mass: 'medium' },
    '1970_90': { wall: 'cavity_insulated', insulation: 'moderate', air: 'average', glaz: 'double', roof: 'moderate', mass: 'medium' },
    '1990_2010': { wall: 'cavity_insulated', insulation: 'good', air: 'tight', glaz: 'double', roof: 'good', mass: 'medium' },
    '2010plus': { wall: 'timber_lightweight', insulation: 'good', air: 'tight', glaz: 'triple', roof: 'good', mass: 'light' },
  },
  terrace: {
    pre1930: { wall: 'solid_masonry', insulation: 'poor', air: 'average', glaz: 'single', roof: 'poor', mass: 'heavy' },
    '1930_70': { wall: 'cavity_uninsulated', insulation: 'poor', air: 'average', glaz: 'double', roof: 'poor', mass: 'medium' },
    '1970_90': { wall: 'cavity_insulated', insulation: 'moderate', air: 'average', glaz: 'double', roof: 'moderate', mass: 'medium' },
    '1990_2010': { wall: 'cavity_insulated', insulation: 'good', air: 'tight', glaz: 'double', roof: 'good', mass: 'medium' },
    '2010plus': { wall: 'timber_lightweight', insulation: 'good', air: 'tight', glaz: 'triple', roof: 'good', mass: 'light' },
  },
  flat: {
    pre1930: { wall: 'solid_masonry', insulation: 'poor', air: 'average', glaz: 'single', roof: 'moderate', mass: 'heavy' },
    '1930_70': { wall: 'cavity_uninsulated', insulation: 'moderate', air: 'average', glaz: 'double', roof: 'moderate', mass: 'medium' },
    '1970_90': { wall: 'cavity_insulated', insulation: 'moderate', air: 'tight', glaz: 'double', roof: 'good', mass: 'medium' },
    '1990_2010': { wall: 'cavity_insulated', insulation: 'good', air: 'tight', glaz: 'double', roof: 'good', mass: 'medium' },
    '2010plus': { wall: 'timber_lightweight', insulation: 'exceptional', air: 'passive_level', glaz: 'triple', roof: 'good', mass: 'light' },
  },
};

const BASE_HEATLOSS: Record<DwellingForm, number> = { detached: 10000, semi: 8000, terrace: 7000, flat: 5000 };
const AGE_MULT: Record<AgeBand, number> = { pre1930: 1.35, '1930_70': 1.2, '1970_90': 1.05, '1990_2010': 0.85, '2010plus': 0.65 };
const INSUL_MULT: Record<InsulationToggle, number> = { poor: 1.2, ok: 1.0, good: 0.85 };
const TAU_BASE: Record<ThermalMass, number> = { light: 24, medium: 42, heavy: 68 };

function shiftInsulation(level: InsulationLevel, shift: number): InsulationLevel {
  const idx = INSULATION_ORDER.indexOf(level);
  return INSULATION_ORDER[Math.max(0, Math.min(INSULATION_ORDER.length - 1, idx + shift))];
}

export function getFabricPreset(form: DwellingForm, age: AgeBand, size: SizeProxy, insulationToggle: InsulationToggle): FabricPreset {
  const base = BASE_MAP[form][age];
  const insulation = shiftInsulation(base.insulation, INSULATION_SHIFT[insulationToggle]);
  const heatLossWatts = Math.round(BASE_HEATLOSS[form] * AGE_MULT[age] * SIZE_MULTIPLIER[size] * INSUL_MULT[insulationToggle]);
  const tauHours = Math.round(TAU_BASE[base.mass] * (insulationToggle === 'good' ? 1.2 : insulationToggle === 'poor' ? 0.9 : 1));
  return {
    id: `${form}_${age}_${size}_${insulationToggle}`,
    label: `${form} / ${age} / ${size}`,
    ...base,
    insulation,
    heatLossWatts,
    tauHours,
  };
}
