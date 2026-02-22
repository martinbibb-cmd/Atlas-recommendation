import type { EngineInputV2_3, NormalizerOutput } from '../schema/EngineInputV2_3';

// Hard water postcode prefixes (simplified for UK)
const HARD_WATER_PREFIXES = [
  'AL', 'CB', 'CM', 'CO', 'EN', 'HP', 'IP', 'LU', 'MK', 'NN',
  'NR', 'OX', 'PE', 'RG', 'SG', 'SL', 'SO', 'SP', 'SS', 'TN',
  'GU', 'KT', 'RH', 'TW', 'BR', 'CR', 'DA', 'SE', 'SW', 'EC',
  'WC', 'N', 'NW', 'E', 'W', 'HA', 'UB',
  // Kent
  'ME', 'CT',
  // Yorkshire (upgraded from moderate)
  'LS', 'BD', 'HG',
  // Lincolnshire
  'LN',
  // Midlands
  'B', 'WV', 'CV', 'DY',
];

const VERY_HARD_PREFIXES = [
  'HP', 'MK', 'OX', 'RG', 'SL', 'TW', 'GU', 'KT',
  // Kent (300+ ppm chalk geology)
  'ME', 'CT', 'TN', 'DA',
  // Hertfordshire (300+ ppm)
  'AL', 'LU',
  // East Anglia (300+ ppm)
  'NR', 'IP', 'CB',
];

/**
 * Silicate scaling scaffold coefficient for high-silica London/Essex areas.
 * Silicates form a porous ceramic scaffold that is ~10× harder to remove than
 * CaCO₃ alone and far more thermally resistive.  Applied to the scaleRf
 * formula for postcodes in HIGH_SILICA_PREFIXES.
 */
const HIGH_SILICA_SCAFFOLD_COEFFICIENT = 10.0;

/**
 * Volume proxy when radiator count is unavailable (litres per kW of boiler
 * output).  Based on industry rule-of-thumb: ~6 L/kW for a typical UK system.
 */
const VOLUME_PROXY_L_PER_KW = 6;

/**
 * Efficiency drop per 1 mm of scale accumulation on the DHW heat exchanger.
 * Source: SEDBUK / CIBSE research – cited in problem specification.
 */
const SCALE_EFFICIENCY_LOSS_PCT_PER_MM = 8;

/**
 * Postcodes overlying the London Basin / Thames Estuary geology.
 * The Cretaceous chalk and Eocene silts here dissolve significant silica
 * (SiO₂) into the aquifer, producing a porous silicate scale that is ~10×
 * harder to remove than CaCO₃ alone.  All Greater London postcodes plus
 * the Essex river-plain boroughs (IG, RM, SS) qualify.
 */
const HIGH_SILICA_PREFIXES = [
  // Greater London inner & outer
  'E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC',
  'BR', 'CR', 'DA', 'EN', 'HA', 'IG', 'KT', 'RM', 'SM', 'TW', 'UB', 'WD',
  // Essex Thames plain
  'SS', 'CM', 'CO',
];

function getPostcodePrefix(postcode: string): string {
  return postcode.trim().toUpperCase().replace(/[0-9\s].*$/, '');
}

export function normalizeInput(input: EngineInputV2_3): NormalizerOutput {
  const prefix = getPostcodePrefix(input.postcode);
  const isVeryHard = VERY_HARD_PREFIXES.includes(prefix);
  const isHard = HARD_WATER_PREFIXES.some(p => prefix.startsWith(p));
  const isHighSilica = HIGH_SILICA_PREFIXES.some(p => prefix.startsWith(p));

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

  /**
   * Scaling scaffold coefficient.
   * London/Essex postcodes overlie the London Basin where dissolved silica
   * forms a porous ceramic scaffold on heat-exchanger surfaces that is ~10×
   * more thermally resistive than CaCO₃ alone and far harder to remove by
   * descaling.  Set to HIGH_SILICA_SCAFFOLD_COEFFICIENT for these areas, 1.0 elsewhere.
   */
  const scalingScaffoldCoefficient = isHighSilica ? HIGH_SILICA_SCAFFOLD_COEFFICIENT : 1.0;

  // System volume: ~10 L per radiator (standard UK estimate).
  // Fallback: VOLUME_PROXY_L_PER_KW per kW of boiler output when radiator count is unavailable.
  const systemVolumeL =
    input.radiatorCount > 0
      ? input.radiatorCount * 10
      : (input.heatLossWatts / 1000) * VOLUME_PROXY_L_PER_KW;

  // Vented systems need loft space and gravity head
  const canUseVentedSystem = !input.hasLoftConversion;

  // Silicate thermal resistance (Rf): silicates are ~10x more resistant than CaCO3
  // Base Rf for CaCO3: ~0.0001 m²K/W per 0.1mm
  // Silicate scaffold coefficient amplifies silica contribution for high-silica areas
  const scaleRf =
    (cacO3Level / 1000) * 0.001 +
    (silicaLevel / 1000) * 0.001 * scalingScaffoldCoefficient;

  // 10-year decay: use research figure of 8% efficiency drop per 1mm of scale accumulation.
  // Scale growth rate ~0.1mm/year in hard water
  const scaleGrowthMmPerYear = isVeryHard ? 0.16 : isHard ? 0.10 : 0.04;
  const scaleAt10Years = scaleGrowthMmPerYear * 10;
  const tenYearEfficiencyDecayPct = Math.min(scaleAt10Years * SCALE_EFFICIENCY_LOSS_PCT_PER_MM, 15); // up to 15% max

  // ── Two-Water Physics ────────────────────────────────────────────────────────

  // Sludge Potential (Primary circuit): 0–1 factor.
  // Linked to system age and piping topology (Baxi research: 47% rad reduction / 7% bill increase).
  // Scales linearly over 20 years; legacy (one_pipe/microbore) topologies reach full potential sooner.
  const systemAge = input.systemAgeYears ?? 0;
  const isLegacyTopology =
    input.pipingTopology === 'one_pipe' || input.pipingTopology === 'microbore';
  const sludgePotential = parseFloat(
    Math.min(1, (systemAge / 20) * (isLegacyTopology ? 1.0 : 0.7)).toFixed(3)
  );

  // Scaling Potential (Secondary/DHW circuit): 0–1 factor.
  // Linked to postcode CaCO₃ hardness (300 ppm = 1.0 base) and silicate scaffold presence.
  // High-silica areas amplified by 1.5× because silicates are ~10× harder to remove,
  // based on research showing 8% efficiency drop for every 1 mm of scale accumulation.
  const scalingPotential = parseFloat(
    Math.min(1, (cacO3Level / 300) * (isHighSilica ? 1.5 : 1.0)).toFixed(3)
  );

  return {
    cacO3Level,
    silicaLevel,
    waterHardnessCategory,
    systemVolumeL,
    canUseVentedSystem,
    scaleRf,
    tenYearEfficiencyDecayPct,
    scalingScaffoldCoefficient,
    sludgePotential,
    scalingPotential,
  };
}
