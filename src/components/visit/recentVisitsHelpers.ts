/**
 * recentVisitsHelpers
 *
 * Pure helper functions for the RecentVisitsList component.
 *
 * Extracted into their own module so they can be unit-tested without rendering
 * the full component, and so the component file only exports the default
 * component (keeping react-refresh/only-export-components satisfied).
 */

import type { VisitMeta, VisitFilterCategory } from '../../lib/visits/visitApi';

/** Default maximum rows shown before the "Show all" button appears. */
export const DEFAULT_LIST_LIMIT = 20;

/**
 * Returns true when the query matches visit_reference or address_line_1
 * (case-insensitive).
 */
export function matchesSearch(v: VisitMeta, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (v.visit_reference?.toLowerCase().includes(q) ?? false) ||
    (v.address_line_1?.toLowerCase().includes(q) ?? false)
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

/**
 * Returns true when any search text, date filter, or status filter is active.
 * When true the visit cap is bypassed so no matches are hidden.
 */
export function isAnyFilterActive(
  search: string,
  dateFilter: string,
  filter: VisitFilterCategory,
): boolean {
  return search.trim() !== '' || dateFilter !== '' || filter !== 'all';
}

/**
 * Returns the secondary identifier to pair with the headline in a visit card's
 * meta subline. Complements visitDisplayLabel so headline and subline never
 * repeat the same information.
 *
 * Priority order mirrors visitDisplayLabel:
 *   - headline = visit_reference → subline shows address_line_1
 *   - headline = address_line_1  → subline is empty (no reliable secondary field)
 *   - otherwise                  → empty string
 */
export function cardSubline(
  v: Pick<VisitMeta, 'visit_reference' | 'address_line_1'>,
): string {
  if (v.visit_reference) {
    return v.address_line_1 ?? '';
  }
  return '';
}

/**
 * Derives the human-readable list state summary shown above the visit list.
 *
 * Examples:
 *   "Showing latest 20 visits"   — unfiltered, capped
 *   "Showing all 83 visits"      — unfiltered, show-all mode
 *   "Showing 7 filtered visits"  — any filter active
 */
export function buildListSummary(opts: {
  isFiltering: boolean;
  showAll: boolean;
  visibleCount: number;
  totalFilteredCount: number;
}): string {
  const { isFiltering, showAll, visibleCount, totalFilteredCount } = opts;
  const plural = (n: number) => (n !== 1 ? 's' : '');
  if (isFiltering) {
    return `Showing ${visibleCount} filtered visit${plural(visibleCount)}`;
  }
  if (showAll) {
    return `Showing all ${totalFilteredCount} visit${plural(totalFilteredCount)}`;
  }
  return `Showing latest ${visibleCount} visit${plural(visibleCount)}`;
}
