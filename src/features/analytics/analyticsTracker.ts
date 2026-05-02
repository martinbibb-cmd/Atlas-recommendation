/**
 * src/features/analytics/analyticsTracker.ts
 *
 * Privacy-first analytics tracker helpers for Atlas.
 *
 * These functions are the sole entry points for recording analytics events.
 * They accept only IDs and metadata — never full payloads, survey data, or PII.
 *
 * Design rules
 * ────────────
 * - Only the minimum required identifiers are accepted.
 * - Full visit payloads, survey answers, names, or addresses must never be
 *   passed to these functions.
 * - All functions delegate to trackEvent() in analyticsStore; they never write
 *   to storage directly.
 * - A crypto.randomUUID()-based eventId is generated here so callers don't
 *   need to manage IDs.
 */

import { trackEvent } from './analyticsStore';
import type { AtlasVisit } from '../visits/createAtlasVisit';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function generateEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (e.g. old jsdom).
  return `evt_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Records a visit_created event.
 *
 * Call this immediately after a new visit is successfully created.
 *
 * @param visit - The newly created AtlasVisit (visitId + brandId; no survey data).
 * @param tenantId - Optional tenant identifier for aggregation.
 */
export function trackVisitCreated(visit: AtlasVisit, tenantId?: string): void {
  trackEvent({
    eventId: generateEventId(),
    eventType: 'visit_created',
    visitId: visit.visitId,
    tenantId,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Records a visit_completed event.
 *
 * Call this when the engineer finishes the survey for a visit.
 * Duration is computed from visit.createdAt to now.
 *
 * @param visit - The active AtlasVisit (visitId only; no survey data).
 * @param tenantId - Optional tenant identifier for aggregation.
 */
export function trackVisitCompleted(visit: AtlasVisit, tenantId?: string): void {
  const createdMs = Date.parse(visit.createdAt);
  const durationSeconds = Number.isFinite(createdMs)
    ? Math.round((Date.now() - createdMs) / 1000)
    : undefined;

  trackEvent({
    eventId: generateEventId(),
    eventType: 'visit_completed',
    visitId: visit.visitId,
    tenantId,
    createdAt: new Date().toISOString(),
    durationSeconds,
  });
}

/**
 * Records a recommendation_viewed event.
 *
 * Call this when the recommendation results page is first displayed.
 *
 * @param visitId  - The active visit ID.
 * @param scenarioIds - Ordered list of scenario/family IDs visible in the result.
 * @param tenantId - Optional tenant identifier for aggregation.
 */
export function trackRecommendationViewed(
  visitId: string,
  scenarioIds: string[],
  tenantId?: string,
): void {
  trackEvent({
    eventId: generateEventId(),
    eventType: 'recommendation_viewed',
    visitId,
    tenantId,
    createdAt: new Date().toISOString(),
    scenarioIds: [...scenarioIds],
  });
}

/**
 * Records a recommendation_selected event.
 *
 * Call this when the engineer confirms or acts on a specific recommendation.
 *
 * @param visitId - The active visit ID.
 * @param selectedScenarioId - The scenario/family ID the engineer confirmed.
 * @param tenantId - Optional tenant identifier for aggregation.
 */
export function trackRecommendationSelected(
  visitId: string,
  selectedScenarioId: string,
  tenantId?: string,
): void {
  trackEvent({
    eventId: generateEventId(),
    eventType: 'recommendation_selected',
    visitId,
    tenantId,
    createdAt: new Date().toISOString(),
    selectedScenarioId,
  });
}
