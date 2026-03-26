/**
 * waterQualityLookup.ts
 *
 * Postcode-driven water quality lookup for the Services step.
 *
 * Uses the existing RegionalHardness engine module (which embeds DWI zone data)
 * to derive hardness, limescale risk, and silicate scaffold risk from a
 * UK postcode outward code.
 *
 * Fallback behaviour
 * ──────────────────
 * If the postcode is blank or unrecognised the function returns a state with
 * source='assumed' and hardnessBand='unknown' so the caller can offer a manual
 * override without blocking survey progress.
 */

import { runRegionalHardness } from '../../../engine/modules/RegionalHardness';
import type { WaterQualityState, HardnessBand, ScaleRiskLevel } from './waterQualityTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a RegionalHardness hardness category to the WaterQualityState HardnessBand.
 * The category values are identical — this wrapper keeps the dependency explicit.
 */
function mapHardnessCategory(
  category: 'soft' | 'moderate' | 'hard' | 'very_hard',
): HardnessBand {
  return category;
}

/**
 * Derive limescale risk from hardness ppm and silicate status.
 *
 * Silicate scaffold compounds the effective thermal resistance ~10× beyond
 * the CaCO₃ reading, so we upgrade risk when silicateTaxActive is true.
 */
function deriveLimescaleRisk(ppm: number, silicateTaxActive: boolean): ScaleRiskLevel {
  if (ppm >= 300 || (ppm >= 180 && silicateTaxActive)) return 'high';
  if (ppm >= 180 || (ppm >= 100 && silicateTaxActive)) return 'medium';
  if (ppm >= 50) return 'low';
  return 'low';
}

/**
 * Derive silicate risk from the silicateTaxActive flag and ppm level.
 */
function deriveSilicateRisk(ppm: number, silicateTaxActive: boolean): ScaleRiskLevel {
  if (!silicateTaxActive) return 'low';
  if (ppm >= 240) return 'high';
  return 'medium';
}

// ─── Main lookup ──────────────────────────────────────────────────────────────

/**
 * lookupWaterQuality
 *
 * Derives a WaterQualityState from a UK postcode outward code by calling
 * the RegionalHardness engine module.
 *
 * Returns source='lookup' on success.
 * Returns source='assumed' with hardnessBand='unknown' if postcode is empty.
 *
 * Does not throw — callers should always receive a usable state object.
 */
export function lookupWaterQuality(postcode: string): WaterQualityState {
  const trimmed = postcode.trim();

  if (!trimmed) {
    return {
      source: 'assumed',
      postcode: null,
      hardnessBand: 'unknown',
      hardnessPpm: null,
      limescaleRisk: 'unknown',
      silicateRisk: 'unknown',
      confidenceNote: 'No postcode provided — hardness could not be looked up.',
    };
  }

  try {
    const result = runRegionalHardness(trimmed);
    const hardnessBand = mapHardnessCategory(result.hardnessCategory);
    const limescaleRisk = deriveLimescaleRisk(result.ppmLevel, result.silicateTaxActive);
    const silicateRisk = deriveSilicateRisk(result.ppmLevel, result.silicateTaxActive);

    const silicateNote = result.silicateTaxActive
      ? ' Silicate scaffold geology active — effective scale hardness is compounded.'
      : '';
    const confidenceNote = `Looked up from postcode prefix ${result.postcodePrefix}: ${result.ppmLevel} ppm CaCO₃.${silicateNote}`;

    return {
      source: 'lookup',
      postcode: trimmed,
      hardnessBand,
      hardnessPpm: result.ppmLevel,
      limescaleRisk,
      silicateRisk,
      confidenceNote,
    };
  } catch {
    return {
      source: 'assumed',
      postcode: trimmed,
      hardnessBand: 'unknown',
      hardnessPpm: null,
      limescaleRisk: 'unknown',
      silicateRisk: 'unknown',
      confidenceNote: `Lookup failed for postcode "${trimmed}" — please select hardness manually.`,
    };
  }
}
