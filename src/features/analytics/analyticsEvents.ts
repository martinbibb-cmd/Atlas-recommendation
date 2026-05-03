/**
 * src/features/analytics/analyticsEvents.ts
 *
 * Privacy-first analytics event model for Atlas.
 *
 * Principles
 * ──────────
 * - No raw survey data.
 * - No photos, transcripts, or floor plans.
 * - No addresses, names, or file contents.
 * - Tenant-level aggregation only.
 * - IDs and metadata only — never full payloads.
 */

// ─── Base event ───────────────────────────────────────────────────────────────

export interface AnalyticsEventBaseV1 {
  /** Stable UUID for this event — used for deduplication. */
  eventId: string;
  /** Discriminant for the union type. */
  eventType: string;
  /** Optional tenant that owns this visit — used for aggregation. */
  tenantId?: string;
  /** Server-issued visit ID (no survey data; just the identifier). */
  visitId: string;
  /** ISO-8601 timestamp when the event was recorded on-device. */
  createdAt: string;
}

// ─── Event variants ───────────────────────────────────────────────────────────

export interface VisitCreatedEvent extends AnalyticsEventBaseV1 {
  eventType: 'visit_created';
  /**
   * Optional userId of the engineer who created the visit.
   * Stored only when the active user profile is set at creation time.
   * Never contains email or displayName.
   */
  createdByUserId?: string;
}

export interface VisitCompletedEvent extends AnalyticsEventBaseV1 {
  eventType: 'visit_completed';
  /** Elapsed seconds from visit creation to survey completion. */
  durationSeconds?: number;
  /**
   * Optional userId of the engineer who created the visit.
   * Carried forward from the creation event for aggregation.
   * Never contains email or displayName.
   */
  createdByUserId?: string;
}

export interface VisitAbandonedEvent extends AnalyticsEventBaseV1 {
  eventType: 'visit_abandoned';
}

export interface RecommendationViewedEvent extends AnalyticsEventBaseV1 {
  eventType: 'recommendation_viewed';
  /** Ordered list of scenario IDs visible in this recommendation result. */
  scenarioIds: string[];
}

export interface RecommendationSelectedEvent extends AnalyticsEventBaseV1 {
  eventType: 'recommendation_selected';
  /** The scenario ID the engineer chose / confirmed. */
  selectedScenarioId: string;
}

export interface QuoteMarkedWonEvent extends AnalyticsEventBaseV1 {
  eventType: 'quote_marked_won';
}

export interface QuoteMarkedLostEvent extends AnalyticsEventBaseV1 {
  eventType: 'quote_marked_lost';
}

export interface QuoteFollowUpRequiredEvent extends AnalyticsEventBaseV1 {
  eventType: 'quote_follow_up_required';
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type AnalyticsEventV1 =
  | VisitCreatedEvent
  | VisitCompletedEvent
  | VisitAbandonedEvent
  | RecommendationViewedEvent
  | RecommendationSelectedEvent
  | QuoteMarkedWonEvent
  | QuoteMarkedLostEvent
  | QuoteFollowUpRequiredEvent;
