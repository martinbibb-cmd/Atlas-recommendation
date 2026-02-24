/**
 * SedbukModule — boiler seasonal efficiency baseline via GC number lookup
 * or band fallback (condensing status + age).
 *
 * Data source: src/data/sedbuk-mini.json (embedded minimal table).
 * Extend the JSON for a richer dataset without touching this module.
 */

import sedbukData from '../../data/sedbuk-mini.json';

export interface SedbukResultV1 {
  /** How the efficiency was determined. */
  source: 'gc_lookup' | 'band_fallback' | 'unknown';
  /** Seasonal efficiency fraction (0–1), or null when entirely unknown. */
  seasonalEfficiency: number | null;
  /** Human-readable source label for UI / context bullets. */
  label: string;
  /** Additional explanatory notes. */
  notes: string[];
}

export interface SedbukLookupInput {
  gcNumber?: string;
  ageYears?: number;
  condensing?: 'yes' | 'no' | 'unknown';
}

/**
 * Age threshold (years) above which a condensing boiler is classified as "early
 * condensing" (pre-2005 era, c. 2025 install base).  Early condensing units had
 * lower SEDBUK ratings than modern condensing boilers.
 */
const EARLY_CONDENSING_AGE_THRESHOLD = 20;

/**
 * Determine which band key to use from the sedbuk-mini bandFallback table.
 */
function bandKey(input: SedbukLookupInput): string {
  const age = input.ageYears ?? 0;
  const condensing = input.condensing ?? 'unknown';

  if (condensing === 'no') {
    if (age >= 16) return 'non_condensing_old';
    if (age >= 6)  return 'non_condensing_mid';
    return 'non_condensing_recent';
  }

  if (condensing === 'yes') {
    // Distinguish early vs modern condensing: pre-2005 era ≈ age > 20 years (as of ~2025)
    const isEarly = age > EARLY_CONDENSING_AGE_THRESHOLD;
    if (isEarly) {
      if (age >= 16) return 'early_condensing_old';
      return 'early_condensing_mid';
    }
    if (age >= 16) return 'modern_condensing_old';
    if (age >= 6)  return 'modern_condensing_mid';
    return 'modern_condensing_recent';
  }

  // 'unknown' condensing status
  return 'unknown';
}

/**
 * Format a digits-only GC number into the familiar dashed display format.
 *
 * Pure display helper — not used for lookup.
 * Example: '4758301' → '47-583-01'
 * Returns the input unchanged if it does not match the 7-digit GC format.
 */
export function formatGcNumber(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 7) return digits;
  return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5, 7)}`;
}

/**
 * Look up SEDBUK seasonal efficiency for a boiler.
 *
 * Priority:
 *   1. GC number match → gc_lookup
 *   2. Band inference from condensing + ageYears → band_fallback
 *   3. Entirely unknown → unknown (null efficiency)
 */
export function lookupSedbukV1(input: SedbukLookupInput): SedbukResultV1 {
  const notes: string[] = [];

  // 1. GC lookup
  if (input.gcNumber) {
    const normalised = input.gcNumber.replace(/\D/g, '');
    if (normalised.length === 0) {
      notes.push('GC not provided / invalid format — using band fallback.');
    } else {
      const entry = (sedbukData.gcLookup as Record<string, { seasonalEfficiency: number; fuel: string; notes?: string }>)[normalised];
      if (entry) {
        notes.push(`SEDBUK GC lookup: ${entry.notes ?? input.gcNumber}.`);
        return {
          source: 'gc_lookup',
          seasonalEfficiency: entry.seasonalEfficiency,
          label: 'SEDBUK (GC lookup)',
          notes,
        };
      }
      notes.push(`GC number '${input.gcNumber}' not found in SEDBUK table — using band fallback.`);
    }
  }

  // 2. Band fallback
  const key = bandKey(input);
  const band = (sedbukData.bandFallback as Record<string, { description: string; seasonalEfficiency: number }>)[key];
  if (band) {
    notes.push(`SEDBUK band: ${band.description}.`);
    return {
      source: 'band_fallback',
      seasonalEfficiency: band.seasonalEfficiency,
      label: 'SEDBUK (band estimate)',
      notes,
    };
  }

  // 3. Unknown
  notes.push('Insufficient boiler data — SEDBUK efficiency unknown.');
  return {
    source: 'unknown',
    seasonalEfficiency: null,
    label: 'SEDBUK (unknown)',
    notes,
  };
}
