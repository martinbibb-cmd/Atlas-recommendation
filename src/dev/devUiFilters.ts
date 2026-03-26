/**
 * devUiFilters.ts
 *
 * Pure filter helpers for the UI Inventory.
 * Operates on DevUiRegistryItem arrays so that DevMenuPage stays declarative.
 */

import type { DevUiRegistryItem, DevUiCategory, DevUiStatus, DevUiAccess, DevUiRouteKind } from './devUiRegistry';

// ─── Filter shape ─────────────────────────────────────────────────────────────

export interface DevUiFilterState {
  search: string;
  categoryFilter: DevUiCategory | null;
  statusFilter: DevUiStatus | null;
  accessFilter: DevUiAccess | null;
  routeKindFilter: DevUiRouteKind | null;
  /** Show only items included in the copy box. */
  copyBoxOnly: boolean;
  /** View mode: full metadata / routes only / hierarchy / flagged only. */
  viewMode: DevUiViewMode;
}

export type DevUiViewMode = 'full' | 'routes' | 'hierarchy' | 'flagged';

export const INITIAL_FILTER_STATE: DevUiFilterState = {
  search: '',
  categoryFilter: null,
  statusFilter: null,
  accessFilter: null,
  routeKindFilter: null,
  copyBoxOnly: false,
  viewMode: 'full',
};

// ─── Copy-box eligibility ─────────────────────────────────────────────────────

/** Returns true if an item should appear in the copy box by default. */
export function isEligibleForCopyBox(item: DevUiRegistryItem): boolean {
  return (
    item.includeInCopyBox === true ||
    item.status === 'canonical' ||
    item.access === 'production'
  );
}

// ─── Main filter ──────────────────────────────────────────────────────────────

/**
 * Applies all active filters from DevUiFilterState to the registry array.
 * Returns a new array; never mutates the original.
 */
export function applyFilters(
  items: DevUiRegistryItem[],
  state: DevUiFilterState,
): DevUiRegistryItem[] {
  return items.filter(item => {
    if (state.categoryFilter != null && item.category !== state.categoryFilter) return false;
    if (state.statusFilter != null && item.status !== state.statusFilter) return false;
    if (state.accessFilter != null && item.access !== state.accessFilter) return false;
    if (state.routeKindFilter != null && item.routeKind !== state.routeKindFilter) return false;
    if (state.copyBoxOnly && !isEligibleForCopyBox(item)) return false;

    // 'flagged' view mode is an alias for copyBoxOnly — filters down to
    // items included in the copy box without requiring a separate toggle.
    if (state.viewMode === 'flagged' && !isEligibleForCopyBox(item)) return false;

    if (state.search.trim() !== '') {
      const q = state.search.toLowerCase();
      const searchTargets = [
        item.commonName,
        item.codeName,
        item.fileName,
        item.filePath,
        item.routePath ?? '',
        item.fullRouteExample ?? '',
        item.access ?? '',
        item.notes ?? '',
        ...(item.queryFlags ?? []),
        ...(item.sourceFiles ?? []),
      ];
      return searchTargets.some(t => t.toLowerCase().includes(q));
    }

    return true;
  });
}
