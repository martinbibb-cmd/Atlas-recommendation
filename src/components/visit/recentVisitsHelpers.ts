/**
 * recentVisitsHelpers
 *
 * Pure helper functions for the RecentVisitsList component.
 *
 * Extracted into their own module so they can be unit-tested without rendering
 * the full component, and so the component file only exports the default
 * component (keeping react-refresh/only-export-components satisfied).
 */

import type { VisitMeta } from '../../lib/visits/visitApi';

/** Default maximum rows shown before the "Show all" button appears. */
export const DEFAULT_LIST_LIMIT = 20;

/**
 * Returns true when the query matches visit_reference, address, postcode, or
 * customer name (case-insensitive).
 */
export function matchesSearch(v: VisitMeta, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (v.visit_reference?.toLowerCase().includes(q) ?? false) ||
    (v.address_line_1?.toLowerCase().includes(q) ?? false) ||
    (v.postcode?.toLowerCase().includes(q) ?? false) ||
    (v.customer_name?.toLowerCase().includes(q) ?? false)
  );
}

/**
 * Returns true when the visit's updated_at date matches the given ISO date
 * string (YYYY-MM-DD format, local time comparison).
 */
export function matchesDateFilter(v: VisitMeta, dateStr: string): boolean {
  if (!dateStr) return true;
  try {
    // updated_at is an ISO timestamp; extract YYYY-MM-DD in local time using en-CA locale.
    const visitDate = new Date(v.updated_at).toLocaleDateString('en-CA');
    return visitDate === dateStr;
  } catch {
    return false;
  }
}
