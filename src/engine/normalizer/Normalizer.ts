import type { EngineInputV2_3, NormalizerOutput } from '../schema/EngineInputV2_3';

// Hard water postcode prefixes (simplified for UK)
const HARD_WATER_PREFIXES = [
  'AL', 'CB', 'CM', 'CO', 'EN', 'HP', 'IP', 'LU', 'MK', 'NN',
  'NR', 'OX', 'PE', 'RG', 'SG', 'SL', 'SO', 'SP', 'SS', 'TN',
  'GU', 'KT', 'RH', 'TW', 'BR', 'CR', 'DA', 'SE', 'SW', 'EC',
  'WC', 'N', 'NW', 'E', 'W', 'HA', 'UB',
];

const VERY_HARD_PREFIXES = ['HP', 'MK', 'OX', 'RG', 'SL', 'TW', 'GU', 'KT'];

function getPostcodePrefix(postcode: string): string {
  return postcode.trim().toUpperCase().replace(/[0-9\s].*$/, '');
}

export function normalizeInput(input: EngineInputV2_3): NormalizerOutput {
  const prefix = getPostcodePrefix(input.postcode);
  const isVeryHard = VERY_HARD_PREFIXES.includes(prefix);
  const isHard = HARD_WATER_PREFIXES.some(p => prefix.startsWith(p));

  let cacO3Level: number;
  let silicaLevel: number;
  let waterHardnessCategory: NormalizerOutput['waterHardnessCategory'];

  if (isVeryHard) {
    cacO3Level = 300;
    silicaLevel = 25;
    waterHardnessCategory = 'very_hard';
  } else if (isHard) {
    cacO3Level = 200;
    silicaLevel = 15;
    waterHardnessCategory = 'hard';
  } else if (prefix.match(/^(BD|DE|DN|HD|HG|HU|HX|LS|S|SE|WF|YO)/)) {
    cacO3Level = 120;
    silicaLevel = 8;
    waterHardnessCategory = 'moderate';
  } else {
    // Soft water (Scotland, Wales, North West)
    cacO3Level = 50;
    silicaLevel = 3;
    waterHardnessCategory = 'soft';
  }

  // System volume: ~10L per radiator (standard UK estimate)
  const systemVolumeL = input.radiatorCount * 10;

  // Vented systems need loft space and gravity head
  const canUseVentedSystem = !input.hasLoftConversion;

  // Silicate thermal resistance (Rf): silicates are ~10x more resistant than CaCO3
  // Base Rf for CaCO3: ~0.0001 m²K/W per 0.1mm
  // Silicate "scaffold" factor: 10x
  const scaleRf = (cacO3Level / 1000) * 0.001 + (silicaLevel / 1000) * 0.01;

  // 10-year decay: 1.6mm scale layer → ~11% efficiency collapse (spec)
  // Scale growth rate ~0.1mm/year in hard water
  const scaleGrowthMmPerYear = isVeryHard ? 0.16 : isHard ? 0.10 : 0.04;
  const scaleAt10Years = scaleGrowthMmPerYear * 10;
  const tenYearEfficiencyDecayPct = Math.min(scaleAt10Years * 7, 15); // up to 15% max

  return {
    cacO3Level,
    silicaLevel,
    waterHardnessCategory,
    systemVolumeL,
    canUseVentedSystem,
    scaleRf,
    tenYearEfficiencyDecayPct,
  };
}
