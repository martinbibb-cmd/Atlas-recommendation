/**
 * src/features/analytics/analyticsTracker.test.ts
 *
 * Tests for the analytics tracker helper functions.
 *
 * Covers:
 *   - trackVisitCreated stores a visit_created event
 *   - trackVisitCompleted stores a visit_completed event with duration
 *   - trackRecommendationViewed stores a recommendation_viewed event
 *   - trackRecommendationSelected stores a recommendation_selected event
 *   - no PII or full payloads are stored
 *   - tenantId is correctly forwarded
 *   - durationSeconds is computed from visit.createdAt
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackVisitCreated,
  trackVisitCompleted,
  trackRecommendationViewed,
  trackRecommendationSelected,
  trackQuoteMarkedWon,
  trackQuoteMarkedLost,
  trackQuoteFollowUpRequired,
} from './analyticsTracker';
import { listEvents, clearEvents } from './analyticsStore';
import type { AtlasVisit } from '../visits/createAtlasVisit';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearEvents();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeVisit(overrides?: Partial<AtlasVisit>): AtlasVisit {
  return {
    visitId: 'visit_test_001',
    brandId: 'atlas-default',
    createdAt: new Date(Date.now() - 60_000).toISOString(), // 60s ago
    ...overrides,
  };
}

// ─── trackVisitCreated ────────────────────────────────────────────────────────

describe('trackVisitCreated', () => {
  it('stores a visit_created event with correct visitId', () => {
    const visit = makeVisit({ visitId: 'visit_abc' });
    trackVisitCreated(visit);
    const events = listEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('visit_created');
    expect(events[0].visitId).toBe('visit_abc');
  });

  it('forwards tenantId when provided', () => {
    const visit = makeVisit();
    trackVisitCreated(visit, 'tenant_x');
    const [ev] = listEvents();
    expect(ev.tenantId).toBe('tenant_x');
  });

  it('tenantId is undefined when not provided', () => {
    const visit = makeVisit();
    trackVisitCreated(visit);
    const [ev] = listEvents();
    expect(ev.tenantId).toBeUndefined();
  });

  it('generates a unique eventId', () => {
    const visit = makeVisit();
    trackVisitCreated(visit);
    trackVisitCreated(visit);
    const events = listEvents();
    expect(events[0].eventId).not.toBe(events[1].eventId);
  });

  it('does NOT store brandId (not an analytics field)', () => {
    const visit = makeVisit({ brandId: 'installer-demo' });
    trackVisitCreated(visit);
    const raw = JSON.stringify(listEvents());
    expect(raw).not.toContain('installer-demo');
  });

  it('does NOT store any survey data fields', () => {
    const visit = makeVisit();
    trackVisitCreated(visit);
    const [ev] = listEvents();
    const keys = Object.keys(ev);
    expect(keys).not.toContain('surveyData');
    expect(keys).not.toContain('address');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('heatLoss');
  });
});

// ─── trackVisitCompleted ──────────────────────────────────────────────────────

describe('trackVisitCompleted', () => {
  it('stores a visit_completed event with correct visitId', () => {
    const visit = makeVisit({ visitId: 'visit_def' });
    trackVisitCompleted(visit);
    const [ev] = listEvents();
    expect(ev.eventType).toBe('visit_completed');
    expect(ev.visitId).toBe('visit_def');
  });

  it('computes durationSeconds from createdAt to now', () => {
    // Visit created 60 seconds ago
    const createdAt = new Date(Date.now() - 60_000).toISOString();
    const visit = makeVisit({ createdAt });
    trackVisitCompleted(visit);
    const [ev] = listEvents();
    expect(ev.eventType).toBe('visit_completed');
    if (ev.eventType === 'visit_completed') {
      expect(typeof ev.durationSeconds).toBe('number');
      // Allow ±5s tolerance for test execution time
      expect(ev.durationSeconds).toBeGreaterThanOrEqual(55);
      expect(ev.durationSeconds).toBeLessThan(70);
    }
  });

  it('durationSeconds is undefined when createdAt is invalid', () => {
    const visit = makeVisit({ createdAt: 'not-a-date' });
    trackVisitCompleted(visit);
    const [ev] = listEvents();
    if (ev.eventType === 'visit_completed') {
      expect(ev.durationSeconds).toBeUndefined();
    }
  });

  it('forwards tenantId', () => {
    const visit = makeVisit();
    trackVisitCompleted(visit, 'tenant_y');
    const [ev] = listEvents();
    expect(ev.tenantId).toBe('tenant_y');
  });
});

// ─── trackRecommendationViewed ────────────────────────────────────────────────

describe('trackRecommendationViewed', () => {
  it('stores a recommendation_viewed event with scenarioIds', () => {
    trackRecommendationViewed('visit_001', ['combi', 'heat_pump']);
    const [ev] = listEvents();
    expect(ev.eventType).toBe('recommendation_viewed');
    expect(ev.visitId).toBe('visit_001');
    if (ev.eventType === 'recommendation_viewed') {
      expect(ev.scenarioIds).toEqual(['combi', 'heat_pump']);
    }
  });

  it('makes a defensive copy of scenarioIds', () => {
    const ids = ['combi', 'heat_pump'];
    trackRecommendationViewed('visit_001', ids);
    ids.push('system'); // mutate original — should not affect stored event
    const [ev] = listEvents();
    if (ev.eventType === 'recommendation_viewed') {
      expect(ev.scenarioIds).toHaveLength(2);
    }
  });

  it('forwards tenantId', () => {
    trackRecommendationViewed('visit_001', ['combi'], 'tenant_z');
    const [ev] = listEvents();
    expect(ev.tenantId).toBe('tenant_z');
  });

  it('stores only string IDs, never scenario payload objects', () => {
    trackRecommendationViewed('visit_001', ['combi']);
    const raw = JSON.stringify(listEvents());
    // Must not contain any scenario-data-like keys
    expect(raw).not.toContain('overallScore');
    expect(raw).not.toContain('evidenceTrace');
    expect(raw).not.toContain('caveats');
  });
});

// ─── trackRecommendationSelected ─────────────────────────────────────────────

describe('trackRecommendationSelected', () => {
  it('stores a recommendation_selected event with selectedScenarioId', () => {
    trackRecommendationSelected('visit_001', 'combi');
    const [ev] = listEvents();
    expect(ev.eventType).toBe('recommendation_selected');
    expect(ev.visitId).toBe('visit_001');
    if (ev.eventType === 'recommendation_selected') {
      expect(ev.selectedScenarioId).toBe('combi');
    }
  });

  it('forwards tenantId', () => {
    trackRecommendationSelected('visit_001', 'heat_pump', 'tenant_q');
    const [ev] = listEvents();
    expect(ev.tenantId).toBe('tenant_q');
  });

  it('stores only the scenario ID string, not the full scenario object', () => {
    trackRecommendationSelected('visit_001', 'combi');
    const raw = JSON.stringify(listEvents());
    expect(raw).not.toContain('overallScore');
    expect(raw).not.toContain('evidenceTrace');
    expect(raw).toContain('combi');
  });

  it('generates a unique eventId for each call', () => {
    trackRecommendationSelected('visit_001', 'combi');
    trackRecommendationSelected('visit_002', 'heat_pump');
    const events = listEvents();
    expect(events[0].eventId).not.toBe(events[1].eventId);
  });
});

// ─── Integration — full visit journey ─────────────────────────────────────────

describe('full visit journey integration', () => {
  it('records the complete journey in correct order', () => {
    const visit = makeVisit({ visitId: 'visit_journey', createdAt: new Date().toISOString() });

    trackVisitCreated(visit, 'tenant_abc');
    trackRecommendationViewed('visit_journey', ['combi', 'heat_pump'], 'tenant_abc');
    trackRecommendationSelected('visit_journey', 'combi', 'tenant_abc');
    trackVisitCompleted(visit, 'tenant_abc');

    const events = listEvents();
    expect(events).toHaveLength(4);
    expect(events[0].eventType).toBe('visit_created');
    expect(events[1].eventType).toBe('recommendation_viewed');
    expect(events[2].eventType).toBe('recommendation_selected');
    expect(events[3].eventType).toBe('visit_completed');

    // All events share the same visitId
    for (const ev of events) {
      expect(ev.visitId).toBe('visit_journey');
      expect(ev.tenantId).toBe('tenant_abc');
    }
  });
});

// ─── trackQuoteMarkedWon ──────────────────────────────────────────────────────

describe('trackQuoteMarkedWon', () => {
  it('stores a quote_marked_won event with correct visitId', () => {
    trackQuoteMarkedWon('visit_won_001');
    const [ev] = listEvents();
    expect(ev.eventType).toBe('quote_marked_won');
    expect(ev.visitId).toBe('visit_won_001');
  });

  it('forwards tenantId when provided', () => {
    trackQuoteMarkedWon('visit_won_002', 'tenant_x');
    const [ev] = listEvents();
    expect(ev.tenantId).toBe('tenant_x');
  });

  it('tenantId is undefined when not provided', () => {
    trackQuoteMarkedWon('visit_won_003');
    const [ev] = listEvents();
    expect(ev.tenantId).toBeUndefined();
  });

  it('generates a unique eventId', () => {
    trackQuoteMarkedWon('v1');
    trackQuoteMarkedWon('v2');
    const events = listEvents();
    expect(events[0].eventId).not.toBe(events[1].eventId);
  });

  it('stores no customer data fields', () => {
    trackQuoteMarkedWon('visit_won_004', 'tenant_x');
    const [ev] = listEvents();
    const keys = Object.keys(ev);
    expect(keys).not.toContain('address');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('jobDetails');
  });
});

// ─── trackQuoteMarkedLost ─────────────────────────────────────────────────────

describe('trackQuoteMarkedLost', () => {
  it('stores a quote_marked_lost event with correct visitId', () => {
    trackQuoteMarkedLost('visit_lost_001');
    const [ev] = listEvents();
    expect(ev.eventType).toBe('quote_marked_lost');
    expect(ev.visitId).toBe('visit_lost_001');
  });

  it('forwards tenantId', () => {
    trackQuoteMarkedLost('visit_lost_002', 'tenant_y');
    const [ev] = listEvents();
    expect(ev.tenantId).toBe('tenant_y');
  });

  it('stores no customer data fields', () => {
    trackQuoteMarkedLost('visit_lost_003');
    const [ev] = listEvents();
    expect(Object.keys(ev)).not.toContain('address');
    expect(Object.keys(ev)).not.toContain('name');
  });
});

// ─── trackQuoteFollowUpRequired ───────────────────────────────────────────────

describe('trackQuoteFollowUpRequired', () => {
  it('stores a quote_follow_up_required event with correct visitId', () => {
    trackQuoteFollowUpRequired('visit_fu_001');
    const [ev] = listEvents();
    expect(ev.eventType).toBe('quote_follow_up_required');
    expect(ev.visitId).toBe('visit_fu_001');
  });

  it('forwards tenantId', () => {
    trackQuoteFollowUpRequired('visit_fu_002', 'tenant_z');
    const [ev] = listEvents();
    expect(ev.tenantId).toBe('tenant_z');
  });

  it('stores no customer data fields', () => {
    trackQuoteFollowUpRequired('visit_fu_003');
    const [ev] = listEvents();
    expect(Object.keys(ev)).not.toContain('address');
    expect(Object.keys(ev)).not.toContain('name');
  });

  it('generates a unique eventId per call', () => {
    trackQuoteFollowUpRequired('v1');
    trackQuoteFollowUpRequired('v2');
    const events = listEvents();
    expect(events[0].eventId).not.toBe(events[1].eventId);
  });
});
