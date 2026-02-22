import type { RegionalHardnessResult } from '../schema/EngineInputV2_3';

// ─── Postcode → ppm lookup ────────────────────────────────────────────────────

/**
 * Per-prefix CaCO₃ levels (mg/L) based on Drinking Water Inspectorate (DWI)
 * zone reports and Water UK hardness mapping.
 *
 * Ordering: higher-precision matches first so that the lookup can short-circuit
 * on the first hit.  Where a district-level prefix is absent the area prefix
 * is used as fallback.
 */
const PPM_LOOKUP: Record<string, number> = {
  // ── Dorset: Jurassic limestone / Upper Chalk aquifer ──────────────────────
  // Sherborne (DT9) sits on the North Dorset Chalk and reaches 364 ppm.
  // Weymouth / Dorchester (DT1–DT4) slightly lower but still Very Hard.
  DT: 314,   // representative zone median (range 250–364 ppm)

  // ── Kent: Cretaceous Chalk ────────────────────────────────────────────────
  ME: 310,
  CT: 305,
  TN: 308,
  DA: 315,

  // ── East Anglia: Chalk / Cretaceous limestone ─────────────────────────────
  NR: 320,
  IP: 305,
  CB: 310,

  // ── Hertfordshire / Home Counties ─────────────────────────────────────────
  AL: 310,
  LU: 300,
  HP: 305,
  MK: 300,
  OX: 300,
  RG: 305,
  SL: 300,
  GU: 305,
  KT: 310,
  TW: 310,

  // ── Greater London (Thames Basin) ─────────────────────────────────────────
  // London Basin geology dissolves significant silica as well as CaCO₃.
  E: 245,
  EC: 250,
  N: 240,
  NW: 235,
  SE: 240,
  SW: 245,
  W: 245,
  WC: 250,
  BR: 250,
  CR: 245,
  HA: 240,
  IG: 235,
  RM: 240,
  SM: 245,
  UB: 238,
  WD: 235,
  EN: 240,

  // ── Essex (Thames Estuary / river plain) ─────────────────────────────────
  SS: 255,
  CM: 250,
  CO: 248,

  // ── Yorkshire (Magnesian Limestone belt) ──────────────────────────────────
  LS: 200,
  BD: 195,
  HG: 205,
  WF: 190,
  HD: 185,
  HX: 185,
  HU: 175,
  YO: 180,
  S: 185,

  // ── Lincolnshire ──────────────────────────────────────────────────────────
  LN: 195,
  DN: 190,
  PE: 250,

  // ── East Midlands / Northamptonshire ─────────────────────────────────────
  NN: 255,
  CV: 200,
  B: 200,
  WV: 195,
  DY: 195,
  DE: 170,

  // ── South East / Sussex ───────────────────────────────────────────────────
  RH: 235,
  BN: 215,

  // ── Thames Valley / Berkshire ─────────────────────────────────────────────
  SG: 255,
  SP: 200,
  SO: 200,

  // ── North West (soft/moderate) ────────────────────────────────────────────
  M: 55,
  SK: 70,
  OL: 50,
  BL: 50,
  WN: 50,
  PR: 45,
  BB: 40,
  LA: 35,
  FY: 45,

  // ── Scotland (soft) ───────────────────────────────────────────────────────
  G: 30,
  EH: 50,
  KA: 25,
  PA: 20,
  AB: 20,
  DD: 35,
  PH: 25,
  IV: 15,
  HS: 10,
  ZE: 10,

  // ── Wales (soft) ──────────────────────────────────────────────────────────
  CF: 45,
  SA: 30,
  LD: 25,
  SY: 80,
  LL: 30,
  NP: 50,
  HR: 90,

  // ── Northern England (soft / moderate) ───────────────────────────────────
  NE: 40,
  SR: 40,
  DH: 50,
  TS: 60,
  DL: 65,
};

// ─── High-silica prefixes (London Basin / Thames Estuary) ────────────────────

const HIGH_SILICA_PREFIXES = new Set([
  'E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC',
  'BR', 'CR', 'DA', 'EN', 'HA', 'IG', 'KT', 'RM', 'SM', 'TW', 'UB', 'WD',
  'SS', 'CM', 'CO',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPrefix(postcode: string): string {
  return postcode.trim().toUpperCase().replace(/[0-9\s].*$/, '');
}

function classifyPpm(ppm: number): RegionalHardnessResult['hardnessCategory'] {
  if (ppm >= 300) return 'very_hard';
  if (ppm >= 180) return 'hard';
  if (ppm >= 100) return 'moderate';
  return 'soft';
}

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * RegionalHardness
 *
 * Maps a UK postcode to its local CaCO₃ level (ppm), hardness category, and
 * Silicate Tax status.  Provides the commercial "Silicate Tax" narrative for
 * sales materials targeting British Gas (Hive) and Worcester Bosch installers.
 *
 * Key hotspots:
 *  - Dorset (DT):          250–364 ppm – Jurassic chalk / limestone aquifer.
 *  - Kent (ME, CT, TN, DA): 305–315 ppm – Cretaceous Chalk.
 *  - East Anglia (NR, IP):  305–320 ppm – Chalk / Cretaceous limestone.
 *  - London / Essex:        235–255 ppm – Thames Basin + high-silica geology.
 *  - Yorkshire (LS, BD):    190–205 ppm – Magnesian Limestone belt.
 */
export function runRegionalHardness(postcode: string): RegionalHardnessResult {
  const notes: string[] = [];
  const prefix = getPrefix(postcode);

  // Longest-match lookup: try two-char prefix first, then single-char.
  // Default to 50 ppm (soft water assumption) for unrecognised postcodes.
  const ppmLevel = PPM_LOOKUP[prefix] ?? PPM_LOOKUP[prefix.charAt(0)] ?? 50;
  const hardnessCategory = classifyPpm(ppmLevel);
  const silicateTaxActive = HIGH_SILICA_PREFIXES.has(prefix);

  // ── Build description ─────────────────────────────────────────────────────
  const hardnessLabel: Record<RegionalHardnessResult['hardnessCategory'], string> = {
    very_hard: 'Very Hard (300+ ppm)',
    hard: 'Hard (180–300 ppm)',
    moderate: 'Moderate (100–180 ppm)',
    soft: 'Soft (<100 ppm)',
  };

  const silicateClause = silicateTaxActive
    ? ' The postcode also overlies the London Basin / Thames Estuary, where dissolved ' +
      'silicates form a porous ceramic scaffold on heat-exchanger surfaces – ~10× ' +
      'harder to remove than CaCO₃ alone (Silicate Tax active).'
    : '';

  const description =
    `Postcode ${prefix}: ${ppmLevel} ppm CaCO₃ — ${hardnessLabel[hardnessCategory]}.` +
    silicateClause;

  // ── Commercial notes ──────────────────────────────────────────────────────
  if (hardnessCategory === 'very_hard') {
    notes.push(
      `🔴 Very Hard Water (${ppmLevel} ppm): At this hardness a 1.6 mm scale layer on ` +
      `the DHW heat exchanger will cause an 11% fuel increase for hot water production. ` +
      `WB 8000+ with domestic-side softener is the recommended specification – it removes ` +
      `the DHW scaling tax while retaining full warranty coverage.`
    );
  } else if (hardnessCategory === 'hard') {
    notes.push(
      `🟡 Hard Water (${ppmLevel} ppm): Scale accumulation rate ~0.10 mm/year. ` +
      `A scale inhibitor or softener is recommended to prevent DHW efficiency loss.`
    );
  } else if (hardnessCategory === 'moderate') {
    notes.push(
      `🟢 Moderate Water (${ppmLevel} ppm): Scale risk is low. Standard Sentinel X100 ` +
      `inhibitor treatment in the primary circuit is sufficient.`
    );
  } else {
    notes.push(
      `🟢 Soft Water (${ppmLevel} ppm): Negligible scale risk. ` +
      `Primary circuit inhibitor treatment still recommended to prevent corrosion.`
    );
  }

  if (silicateTaxActive) {
    notes.push(
      `⚠️ Silicate Tax Active: London Basin / Thames Estuary geology. Dissolved silicates ` +
      `form a porous ceramic scale scaffold ~10× harder to remove than CaCO₃ alone. ` +
      `Effective thermal resistance is compounded beyond the CaCO₃ ppm reading.`
    );
  }

  return {
    postcodePrefix: prefix,
    ppmLevel,
    hardnessCategory,
    silicateTaxActive,
    description,
    notes,
  };
}
