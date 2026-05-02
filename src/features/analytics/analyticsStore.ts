/**
 * src/features/analytics/analyticsStore.ts
 *
 * Privacy-first analytics event store for Atlas.
 *
 * Storage strategy
 * ────────────────
 * Events are persisted to localStorage under the key `atlas:analytics:v1`
 * as an append-only array wrapped in a versioned JSON envelope.  No survey
 * data, PII, or file contents are ever stored here — only IDs and metadata
 * as defined in AnalyticsEventV1.
 *
 * Wire format
 * ───────────
 *   {
 *     schemaVersion: 1,
 *     events: AnalyticsEventV1[]
 *   }
 *
 * Design rules
 * ────────────
 * - No React dependencies — pure storage functions usable anywhere.
 * - Best-effort: storage errors are silently swallowed so analytics never
 *   breaks the product journey.
 * - aggregateByTenant groups events only by tenantId (no visit-level detail
 *   is exposed in aggregates).
 */

import type { AnalyticsEventV1 } from './analyticsEvents';

// ─── Constants ────────────────────────────────────────────────────────────────

export const ANALYTICS_STORAGE_KEY = 'atlas:analytics:v1';
const SCHEMA_VERSION = 1 as const;

// ─── Per-tenant aggregate ─────────────────────────────────────────────────────

export interface TenantAnalyticsAggregate {
  tenantId: string | undefined;
  visitsCreated: number;
  visitsCompleted: number;
  completionRate: number;
  avgDurationSeconds: number | null;
  recommendationViews: number;
  recommendationSelections: number;
  topSelectedScenarioIds: Array<{ scenarioId: string; count: number }>;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage may throw in restricted environments.
  }
  return null;
}

function readEvents(): AnalyticsEventV1[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(ANALYTICS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      parsed['schemaVersion'] !== SCHEMA_VERSION
    ) {
      // Schema version mismatch — discard stale data rather than corrupt the store.
      // When a future schema migration is introduced this block should be replaced
      // with an upgrade path that transforms the old envelope into the new shape.
      return [];
    }
    const events = parsed['events'];
    if (!Array.isArray(events)) return [];
    return events as AnalyticsEventV1[];
  } catch {
    return [];
  }
}

function writeEvents(events: AnalyticsEventV1[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      ANALYTICS_STORAGE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, events }),
    );
  } catch {
    // Best effort — quota exceeded or unavailable.
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Appends an analytics event to the local store.
 * Silently no-ops when storage is unavailable.
 */
export function trackEvent(event: AnalyticsEventV1): void {
  try {
    const events = readEvents();
    events.push(event);
    writeEvents(events);
  } catch {
    // Best effort.
  }
}

/**
 * Returns all stored analytics events.
 * Returns an empty array when the store is empty or unavailable.
 */
export function listEvents(): AnalyticsEventV1[] {
  return readEvents();
}

/**
 * Removes all stored analytics events.
 * Used by developer tools and test teardown.
 */
export function clearEvents(): void {
  try {
    const storage = getStorage();
    storage?.removeItem(ANALYTICS_STORAGE_KEY);
  } catch {
    // Best effort.
  }
}

// ─── Date-range filter ────────────────────────────────────────────────────────

export type AnalyticsDateFilter =
  | { type: 'all_time' }
  | { type: 'last_7_days' }
  | { type: 'last_30_days' }
  | { type: 'custom'; from: string; to: string };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function filterEventsByDate(
  events: AnalyticsEventV1[],
  filter: AnalyticsDateFilter,
): AnalyticsEventV1[] {
  if (filter.type === 'all_time') return events;

  const now = Date.now();
  let from: number;
  let to: number;

  if (filter.type === 'last_7_days') {
    from = now - 7 * MS_PER_DAY;
    to = now;
  } else if (filter.type === 'last_30_days') {
    from = now - 30 * MS_PER_DAY;
    to = now;
  } else {
    from = Date.parse(filter.from);
    to = Date.parse(filter.to) + MS_PER_DAY - 1; // inclusive end-of-day
  }

  return events.filter((e) => {
    const t = Date.parse(e.createdAt);
    return Number.isFinite(t) && t >= from && t <= to;
  });
}

// ─── CSV / JSON export helpers ────────────────────────────────────────────────

/**
 * Serialises a single tenant aggregate as a flat CSV row.
 * Returns a header line + one data row for use in full-export joins.
 */
export function aggregatesToCsv(aggregates: TenantAnalyticsAggregate[]): string {
  const header = [
    'tenantId',
    'visitsCreated',
    'visitsCompleted',
    'completionRate',
    'avgDurationSeconds',
    'recommendationViews',
    'recommendationSelections',
    'topScenarioId',
    'topScenarioCount',
  ].join(',');

  const rows = aggregates.map((a) => {
    const top = a.topSelectedScenarioIds[0];
    return [
      a.tenantId ?? '',
      a.visitsCreated,
      a.visitsCompleted,
      a.completionRate.toFixed(4),
      a.avgDurationSeconds !== null ? a.avgDurationSeconds.toFixed(1) : '',
      a.recommendationViews,
      a.recommendationSelections,
      top ? top.scenarioId : '',
      top ? top.count : '',
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Groups stored events by tenantId and computes aggregate statistics.
 *
 * Returns one aggregate per distinct tenantId value (including undefined for
 * events without a tenantId).  No individual visit details are exposed.
 */
export function aggregateByTenant(): TenantAnalyticsAggregate[] {
  const events = readEvents();

  // Collect distinct tenantId keys (undefined is a valid group key).
  const tenantKeys = new Set<string | undefined>(events.map((e) => e.tenantId));

  return Array.from(tenantKeys).map((tenantId) => {
    const tenantEvents = events.filter((e) => e.tenantId === tenantId);

    const created = tenantEvents.filter((e) => e.eventType === 'visit_created').length;
    const completed = tenantEvents.filter((e) => e.eventType === 'visit_completed');
    const completedCount = completed.length;

    const durations = completed
      .map((e) => (e.eventType === 'visit_completed' ? e.durationSeconds : undefined))
      .filter((d): d is number => typeof d === 'number' && d >= 0);

    const avgDurationSeconds =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : null;

    const views = tenantEvents.filter(
      (e) => e.eventType === 'recommendation_viewed',
    ).length;

    const selections = tenantEvents.filter(
      (e) => e.eventType === 'recommendation_selected',
    );
    const selectionCount = selections.length;

    // Count per selected scenario ID.
    const scenarioCounts: Record<string, number> = {};
    for (const ev of selections) {
      if (ev.eventType === 'recommendation_selected') {
        const id = ev.selectedScenarioId;
        scenarioCounts[id] = (scenarioCounts[id] ?? 0) + 1;
      }
    }
    const topSelectedScenarioIds = Object.entries(scenarioCounts)
      .map(([scenarioId, count]) => ({ scenarioId, count }))
      .sort((a, b) => b.count - a.count);

    return {
      tenantId,
      visitsCreated: created,
      visitsCompleted: completedCount,
      completionRate: created > 0 ? completedCount / created : 0,
      avgDurationSeconds,
      recommendationViews: views,
      recommendationSelections: selectionCount,
      topSelectedScenarioIds,
    };
  });
}

/**
 * Same as `aggregateByTenant` but restricted to events within the given date
 * range.  Accepts an `AnalyticsDateFilter` to support the dashboard UI filters.
 *
 * Returns aggregates only for tenants that have at least one event in range.
 */
export function aggregateByTenantFiltered(
  filter: AnalyticsDateFilter,
): TenantAnalyticsAggregate[] {
  const allEvents = readEvents();
  const events = filterEventsByDate(allEvents, filter);

  const tenantKeys = new Set<string | undefined>(events.map((e) => e.tenantId));

  return Array.from(tenantKeys).map((tenantId) => {
    const tenantEvents = events.filter((e) => e.tenantId === tenantId);

    const created = tenantEvents.filter((e) => e.eventType === 'visit_created').length;
    const completed = tenantEvents.filter((e) => e.eventType === 'visit_completed');
    const completedCount = completed.length;

    const durations = completed
      .map((e) => (e.eventType === 'visit_completed' ? e.durationSeconds : undefined))
      .filter((d): d is number => typeof d === 'number' && d >= 0);

    const avgDurationSeconds =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : null;

    const views = tenantEvents.filter(
      (e) => e.eventType === 'recommendation_viewed',
    ).length;

    const selections = tenantEvents.filter(
      (e) => e.eventType === 'recommendation_selected',
    );
    const selectionCount = selections.length;

    const scenarioCounts: Record<string, number> = {};
    for (const ev of selections) {
      if (ev.eventType === 'recommendation_selected') {
        const id = ev.selectedScenarioId;
        scenarioCounts[id] = (scenarioCounts[id] ?? 0) + 1;
      }
    }
    const topSelectedScenarioIds = Object.entries(scenarioCounts)
      .map(([scenarioId, count]) => ({ scenarioId, count }))
      .sort((a, b) => b.count - a.count);

    return {
      tenantId,
      visitsCreated: created,
      visitsCompleted: completedCount,
      completionRate: created > 0 ? completedCount / created : 0,
      avgDurationSeconds,
      recommendationViews: views,
      recommendationSelections: selectionCount,
      topSelectedScenarioIds,
    };
  });
}
