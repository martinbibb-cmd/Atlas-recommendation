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

/** Monotonic counter for fallback ID generation — avoids collisions. */
let _fallbackCounter = 0;

function generateEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (e.g. old jsdom).
  // Uses timestamp + monotonic counter to guarantee uniqueness within the session.
  return `evt_${Date.now()}_${(_fallbackCounter++).toString(36)}`;
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
    ...(visit.createdByUserId !== undefined ? { createdByUserId: visit.createdByUserId } : {}),
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
    ...(visit.createdByUserId !== undefined ? { createdByUserId: visit.createdByUserId } : {}),
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

/**
 * Records a quote_marked_won event.
 *
 * Call this when the engineer marks a visit/quote as won.
 * Only visitId and tenantId are stored — no customer details.
 *
 * @param visitId  - The visit ID being marked.
 * @param tenantId - Optional tenant identifier for aggregation.
 */
export function trackQuoteMarkedWon(visitId: string, tenantId?: string): void {
  trackEvent({
    eventId: generateEventId(),
    eventType: 'quote_marked_won',
    visitId,
    tenantId,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Records a quote_marked_lost event.
 *
 * Call this when the engineer marks a visit/quote as lost.
 * Only visitId and tenantId are stored — no customer details.
 *
 * @param visitId  - The visit ID being marked.
 * @param tenantId - Optional tenant identifier for aggregation.
 */
export function trackQuoteMarkedLost(visitId: string, tenantId?: string): void {
  trackEvent({
    eventId: generateEventId(),
    eventType: 'quote_marked_lost',
    visitId,
    tenantId,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Records a quote_follow_up_required event.
 *
 * Call this when the engineer flags a visit/quote for follow-up.
 * Only visitId and tenantId are stored — no customer details.
 *
 * @param visitId  - The visit ID being flagged.
 * @param tenantId - Optional tenant identifier for aggregation.
 */
export function trackQuoteFollowUpRequired(visitId: string, tenantId?: string): void {
  trackEvent({
    eventId: generateEventId(),
    eventType: 'quote_follow_up_required',
    visitId,
    tenantId,
    createdAt: new Date().toISOString(),
  });
}
