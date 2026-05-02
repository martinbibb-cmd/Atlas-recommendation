/**
 * src/features/branding/activeBrand.ts
 *
 * Deterministic resolver for the active brandId in the Atlas Mind journey.
 *
 * Priority chain (first non-null, non-empty value wins):
 *   1. visitBrandId   — brand attached to the current active visit
 *   2. routeBrandId   — brand injected via URL / route parameter
 *   3. fallbackBrandId — caller-supplied default
 *   4. 'atlas-default' — hard-coded safety net
 *
 * This function is pure and has no side-effects.
 * It does not read from storage or context — callers supply all inputs.
 */

import { DEFAULT_BRAND_ID } from './brandProfiles';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolveActiveBrandIdInput {
  /** Brand from the active visit record (visit.brandId). Highest priority. */
  visitBrandId?: string | null;
  /** Brand from the current URL / route. Used when no visit brand is set. */
  routeBrandId?: string | null;
  /** Caller-supplied fallback before the global default. */
  fallbackBrandId?: string | null;
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolves the active brandId from a priority-ordered set of candidates.
 *
 * Rules:
 *  - visitBrandId wins when present (non-null, non-empty string).
 *  - routeBrandId is used when no visit brand is set.
 *  - fallbackBrandId is used when neither of the above is set.
 *  - 'atlas-default' is always the last resort.
 *
 * @param input - Priority-ordered brand candidates.
 * @returns     A non-empty brandId string.
 */
export function resolveActiveBrandId(input: ResolveActiveBrandIdInput): string {
  if (input.visitBrandId && input.visitBrandId.trim().length > 0) {
    return input.visitBrandId;
  }
  if (input.routeBrandId && input.routeBrandId.trim().length > 0) {
    return input.routeBrandId;
  }
  if (input.fallbackBrandId && input.fallbackBrandId.trim().length > 0) {
    return input.fallbackBrandId;
  }
  return DEFAULT_BRAND_ID;
}
