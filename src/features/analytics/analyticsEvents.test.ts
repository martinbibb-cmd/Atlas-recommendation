/**
 * src/features/analytics/analyticsEvents.test.ts
 *
 * Tests for the analytics event type model.
 *
 * Covers:
 *   - event type discriminants are valid string literals
 *   - base fields are present on all event types
 *   - optional fields are correctly typed
 *   - no survey data or PII fields exist on any event type
 */

import { describe, it, expect } from 'vitest';
import type {
  AnalyticsEventV1,
  AnalyticsEventBaseV1,
  VisitCreatedEvent,
  VisitCompletedEvent,
  VisitAbandonedEvent,
  RecommendationViewedEvent,
  RecommendationSelectedEvent,
  QuoteMarkedWonEvent,
  QuoteMarkedLostEvent,
  QuoteFollowUpRequiredEvent,
} from './analyticsEvents';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE: AnalyticsEventBaseV1 = {
  eventId: 'evt_001',
  eventType: 'visit_created',
  visitId: 'visit_abc',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// ─── Base fields ──────────────────────────────────────────────────────────────

describe('AnalyticsEventBaseV1', () => {
  it('has the required fields', () => {
    expect(BASE.eventId).toBe('evt_001');
    expect(BASE.visitId).toBe('visit_abc');
    expect(BASE.eventType).toBe('visit_created');
    expect(BASE.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('tenantId is optional', () => {
    expect(BASE.tenantId).toBeUndefined();
    const withTenant: AnalyticsEventBaseV1 = { ...BASE, tenantId: 'tenant_x' };
    expect(withTenant.tenantId).toBe('tenant_x');
  });
});

// ─── VisitCreatedEvent ────────────────────────────────────────────────────────

describe('VisitCreatedEvent', () => {
  const ev: VisitCreatedEvent = {
    ...BASE,
    eventType: 'visit_created',
  };

  it('has eventType = visit_created', () => {
    expect(ev.eventType).toBe('visit_created');
  });

  it('carries no survey data fields', () => {
    const keys = Object.keys(ev);
    expect(keys).not.toContain('surveyData');
    expect(keys).not.toContain('address');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('email');
  });

  it('is assignable to AnalyticsEventV1 union', () => {
    const union: AnalyticsEventV1 = ev;
    expect(union.eventType).toBe('visit_created');
  });
});

// ─── VisitCompletedEvent ──────────────────────────────────────────────────────

describe('VisitCompletedEvent', () => {
  it('has eventType = visit_completed and optional durationSeconds', () => {
    const ev: VisitCompletedEvent = {
      ...BASE,
      eventType: 'visit_completed',
      durationSeconds: 300,
    };
    expect(ev.eventType).toBe('visit_completed');
    expect(ev.durationSeconds).toBe(300);
  });

  it('durationSeconds is optional', () => {
    const ev: VisitCompletedEvent = {
      ...BASE,
      eventType: 'visit_completed',
    };
    expect(ev.durationSeconds).toBeUndefined();
  });
});

// ─── VisitAbandonedEvent ──────────────────────────────────────────────────────

describe('VisitAbandonedEvent', () => {
  it('has eventType = visit_abandoned', () => {
    const ev: VisitAbandonedEvent = {
      ...BASE,
      eventType: 'visit_abandoned',
    };
    expect(ev.eventType).toBe('visit_abandoned');
  });
});

// ─── RecommendationViewedEvent ────────────────────────────────────────────────

describe('RecommendationViewedEvent', () => {
  it('has eventType = recommendation_viewed and scenarioIds array', () => {
    const ev: RecommendationViewedEvent = {
      ...BASE,
      eventType: 'recommendation_viewed',
      scenarioIds: ['combi', 'heat_pump'],
    };
    expect(ev.eventType).toBe('recommendation_viewed');
    expect(ev.scenarioIds).toEqual(['combi', 'heat_pump']);
  });

  it('scenarioIds contains only IDs, not scenario payload data', () => {
    const ev: RecommendationViewedEvent = {
      ...BASE,
      eventType: 'recommendation_viewed',
      scenarioIds: ['combi'],
    };
    // Each entry must be a string (ID), not an object
    for (const id of ev.scenarioIds) {
      expect(typeof id).toBe('string');
    }
  });
});

// ─── RecommendationSelectedEvent ─────────────────────────────────────────────

describe('RecommendationSelectedEvent', () => {
  it('has eventType = recommendation_selected and selectedScenarioId string', () => {
    const ev: RecommendationSelectedEvent = {
      ...BASE,
      eventType: 'recommendation_selected',
      selectedScenarioId: 'combi',
    };
    expect(ev.eventType).toBe('recommendation_selected');
    expect(ev.selectedScenarioId).toBe('combi');
  });

  it('selectedScenarioId is a string ID, not an object', () => {
    const ev: RecommendationSelectedEvent = {
      ...BASE,
      eventType: 'recommendation_selected',
      selectedScenarioId: 'heat_pump',
    };
    expect(typeof ev.selectedScenarioId).toBe('string');
  });
});

// ─── Union narrowing ──────────────────────────────────────────────────────────

describe('AnalyticsEventV1 union', () => {
  it('can be narrowed by eventType', () => {
    const events: AnalyticsEventV1[] = [
      { ...BASE, eventType: 'visit_created' },
      { ...BASE, eventType: 'visit_completed', durationSeconds: 120 },
      { ...BASE, eventType: 'recommendation_viewed', scenarioIds: ['combi'] },
      { ...BASE, eventType: 'recommendation_selected', selectedScenarioId: 'combi' },
    ];

    for (const ev of events) {
      if (ev.eventType === 'visit_completed') {
        expect(ev.durationSeconds).toBe(120);
      }
      if (ev.eventType === 'recommendation_viewed') {
        expect(ev.scenarioIds).toEqual(['combi']);
      }
      if (ev.eventType === 'recommendation_selected') {
        expect(ev.selectedScenarioId).toBe('combi');
      }
    }
  });

  it('all event types carry visitId (no payload leakage check)', () => {
    const events: AnalyticsEventV1[] = [
      { ...BASE, eventType: 'visit_created' },
      { ...BASE, eventType: 'visit_completed' },
      { ...BASE, eventType: 'visit_abandoned' },
      { ...BASE, eventType: 'recommendation_viewed', scenarioIds: [] },
      { ...BASE, eventType: 'recommendation_selected', selectedScenarioId: 'x' },
      { ...BASE, eventType: 'quote_marked_won' },
      { ...BASE, eventType: 'quote_marked_lost' },
      { ...BASE, eventType: 'quote_follow_up_required' },
    ];
    for (const ev of events) {
      // visitId must be present on every event
      expect(typeof ev.visitId).toBe('string');
      // Must not carry raw survey or PII fields
      expect(Object.keys(ev)).not.toContain('surveyPayload');
      expect(Object.keys(ev)).not.toContain('address');
      expect(Object.keys(ev)).not.toContain('name');
    }
  });
});

// ─── QuoteMarkedWonEvent ──────────────────────────────────────────────────────

describe('QuoteMarkedWonEvent', () => {
  it('has eventType = quote_marked_won', () => {
    const ev: QuoteMarkedWonEvent = { ...BASE, eventType: 'quote_marked_won' };
    expect(ev.eventType).toBe('quote_marked_won');
  });

  it('carries no customer data fields', () => {
    const ev: QuoteMarkedWonEvent = { ...BASE, eventType: 'quote_marked_won' };
    const keys = Object.keys(ev);
    expect(keys).not.toContain('address');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('jobDetails');
  });

  it('is assignable to AnalyticsEventV1 union', () => {
    const union: AnalyticsEventV1 = { ...BASE, eventType: 'quote_marked_won' };
    expect(union.eventType).toBe('quote_marked_won');
  });
});

// ─── QuoteMarkedLostEvent ─────────────────────────────────────────────────────

describe('QuoteMarkedLostEvent', () => {
  it('has eventType = quote_marked_lost', () => {
    const ev: QuoteMarkedLostEvent = { ...BASE, eventType: 'quote_marked_lost' };
    expect(ev.eventType).toBe('quote_marked_lost');
  });

  it('is assignable to AnalyticsEventV1 union', () => {
    const union: AnalyticsEventV1 = { ...BASE, eventType: 'quote_marked_lost' };
    expect(union.eventType).toBe('quote_marked_lost');
  });
});

// ─── QuoteFollowUpRequiredEvent ───────────────────────────────────────────────

describe('QuoteFollowUpRequiredEvent', () => {
  it('has eventType = quote_follow_up_required', () => {
    const ev: QuoteFollowUpRequiredEvent = { ...BASE, eventType: 'quote_follow_up_required' };
    expect(ev.eventType).toBe('quote_follow_up_required');
  });

  it('is assignable to AnalyticsEventV1 union', () => {
    const union: AnalyticsEventV1 = { ...BASE, eventType: 'quote_follow_up_required' };
    expect(union.eventType).toBe('quote_follow_up_required');
  });
});
