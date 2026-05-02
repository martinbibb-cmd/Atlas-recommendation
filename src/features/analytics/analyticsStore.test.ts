/**
 * src/features/analytics/analyticsStore.test.ts
 *
 * Tests for the analytics local store.
 *
 * Covers:
 *   - trackEvent appends events
 *   - listEvents returns stored events
 *   - clearEvents empties the store
 *   - aggregateByTenant groups by tenantId
 *   - aggregation computes completion rate correctly
 *   - aggregation computes average duration correctly
 *   - aggregation counts recommendation views and selections
 *   - no survey data is stored (only IDs)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackEvent,
  listEvents,
  clearEvents,
  aggregateByTenant,
  ANALYTICS_STORAGE_KEY,
} from './analyticsStore';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearEvents();
  // Verify clean state
  expect(listEvents()).toHaveLength(0);
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeVisitCreated(visitId: string, tenantId?: string) {
  return {
    eventId: `evt_created_${visitId}`,
    eventType: 'visit_created' as const,
    visitId,
    tenantId,
    createdAt: '2026-01-01T10:00:00.000Z',
  };
}

function makeVisitCompleted(visitId: string, durationSeconds: number, tenantId?: string) {
  return {
    eventId: `evt_completed_${visitId}`,
    eventType: 'visit_completed' as const,
    visitId,
    tenantId,
    createdAt: '2026-01-01T10:30:00.000Z',
    durationSeconds,
  };
}

function makeRecommendationViewed(visitId: string, scenarioIds: string[], tenantId?: string) {
  return {
    eventId: `evt_viewed_${visitId}`,
    eventType: 'recommendation_viewed' as const,
    visitId,
    tenantId,
    scenarioIds,
    createdAt: '2026-01-01T10:15:00.000Z',
  };
}

function makeRecommendationSelected(visitId: string, selectedScenarioId: string, tenantId?: string) {
  return {
    eventId: `evt_selected_${visitId}`,
    eventType: 'recommendation_selected' as const,
    visitId,
    tenantId,
    selectedScenarioId,
    createdAt: '2026-01-01T10:20:00.000Z',
  };
}

// ─── trackEvent / listEvents ──────────────────────────────────────────────────

describe('trackEvent + listEvents', () => {
  it('stores and retrieves a single event', () => {
    const ev = makeVisitCreated('visit_001');
    trackEvent(ev);
    const stored = listEvents();
    expect(stored).toHaveLength(1);
    expect(stored[0].eventType).toBe('visit_created');
    expect(stored[0].visitId).toBe('visit_001');
  });

  it('appends multiple events in order', () => {
    trackEvent(makeVisitCreated('visit_001'));
    trackEvent(makeVisitCreated('visit_002'));
    trackEvent(makeVisitCreated('visit_003'));
    const stored = listEvents();
    expect(stored).toHaveLength(3);
    expect(stored.map((e) => e.visitId)).toEqual(['visit_001', 'visit_002', 'visit_003']);
  });

  it('stores only IDs and metadata — never payload objects', () => {
    const ev = makeVisitCreated('visit_001', 'tenant_x');
    trackEvent(ev);
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY)!;
    // The stored JSON must not contain survey-like keys
    expect(raw).not.toContain('surveyData');
    expect(raw).not.toContain('address');
    expect(raw).not.toContain('name');
    expect(raw).not.toContain('heatLoss');
    expect(raw).not.toContain('floorPlan');
    // Must contain the safe identifiers
    expect(raw).toContain('visit_001');
    expect(raw).toContain('visit_created');
  });
});

// ─── clearEvents ─────────────────────────────────────────────────────────────

describe('clearEvents', () => {
  it('removes all stored events', () => {
    trackEvent(makeVisitCreated('visit_001'));
    trackEvent(makeVisitCreated('visit_002'));
    clearEvents();
    expect(listEvents()).toHaveLength(0);
  });

  it('is safe to call when store is empty', () => {
    expect(() => clearEvents()).not.toThrow();
  });
});

// ─── aggregateByTenant — grouping ─────────────────────────────────────────────

describe('aggregateByTenant — tenant grouping', () => {
  it('returns one aggregate per distinct tenantId', () => {
    trackEvent(makeVisitCreated('v1', 'tenant_a'));
    trackEvent(makeVisitCreated('v2', 'tenant_b'));
    trackEvent(makeVisitCreated('v3', 'tenant_a'));

    const aggs = aggregateByTenant();
    const tenantIds = aggs.map((a) => a.tenantId).sort();
    expect(tenantIds).toEqual(['tenant_a', 'tenant_b']);
  });

  it('groups events without tenantId under undefined', () => {
    trackEvent(makeVisitCreated('v1')); // no tenantId
    const aggs = aggregateByTenant();
    expect(aggs).toHaveLength(1);
    expect(aggs[0].tenantId).toBeUndefined();
  });

  it('returns empty array when no events stored', () => {
    expect(aggregateByTenant()).toHaveLength(0);
  });
});

// ─── aggregateByTenant — completion rate ──────────────────────────────────────

describe('aggregateByTenant — completion rate', () => {
  it('computes 100% when all visits complete', () => {
    trackEvent(makeVisitCreated('v1', 'tenant_a'));
    trackEvent(makeVisitCompleted('v1', 300, 'tenant_a'));
    trackEvent(makeVisitCreated('v2', 'tenant_a'));
    trackEvent(makeVisitCompleted('v2', 400, 'tenant_a'));

    const [agg] = aggregateByTenant();
    expect(agg.visitsCreated).toBe(2);
    expect(agg.visitsCompleted).toBe(2);
    expect(agg.completionRate).toBe(1);
  });

  it('computes 50% when half of visits complete', () => {
    trackEvent(makeVisitCreated('v1', 'tenant_a'));
    trackEvent(makeVisitCreated('v2', 'tenant_a'));
    trackEvent(makeVisitCompleted('v1', 300, 'tenant_a'));

    const [agg] = aggregateByTenant();
    expect(agg.visitsCreated).toBe(2);
    expect(agg.visitsCompleted).toBe(1);
    expect(agg.completionRate).toBe(0.5);
  });

  it('completion rate is 0 when no visits created', () => {
    // Store a completion with no corresponding creation (edge case)
    trackEvent(makeVisitCompleted('v_orphan', 100, 'tenant_x'));
    const agg = aggregateByTenant().find((a) => a.tenantId === 'tenant_x');
    expect(agg?.visitsCreated).toBe(0);
    expect(agg?.completionRate).toBe(0);
  });
});

// ─── aggregateByTenant — average duration ─────────────────────────────────────

describe('aggregateByTenant — average duration', () => {
  it('computes average duration across completed visits', () => {
    trackEvent(makeVisitCompleted('v1', 200, 'tenant_a'));
    trackEvent(makeVisitCompleted('v2', 400, 'tenant_a'));

    const [agg] = aggregateByTenant();
    expect(agg.avgDurationSeconds).toBe(300);
  });

  it('returns null avgDuration when no completed visits', () => {
    trackEvent(makeVisitCreated('v1', 'tenant_a'));
    const [agg] = aggregateByTenant();
    expect(agg.avgDurationSeconds).toBeNull();
  });

  it('ignores visits completed without durationSeconds', () => {
    trackEvent({
      eventId: 'evt_no_dur',
      eventType: 'visit_completed',
      visitId: 'v_nodur',
      tenantId: 'tenant_a',
      createdAt: '2026-01-01T00:00:00.000Z',
      // no durationSeconds
    });
    trackEvent(makeVisitCompleted('v2', 600, 'tenant_a'));

    const [agg] = aggregateByTenant();
    // Only the event with durationSeconds is counted
    expect(agg.avgDurationSeconds).toBe(600);
  });
});

// ─── aggregateByTenant — recommendation tracking ──────────────────────────────

describe('aggregateByTenant — recommendation tracking', () => {
  it('counts recommendation views', () => {
    trackEvent(makeRecommendationViewed('v1', ['combi', 'heat_pump'], 'tenant_a'));
    trackEvent(makeRecommendationViewed('v2', ['combi'], 'tenant_a'));

    const [agg] = aggregateByTenant();
    expect(agg.recommendationViews).toBe(2);
  });

  it('counts recommendation selections', () => {
    trackEvent(makeRecommendationSelected('v1', 'combi', 'tenant_a'));
    trackEvent(makeRecommendationSelected('v2', 'combi', 'tenant_a'));
    trackEvent(makeRecommendationSelected('v3', 'heat_pump', 'tenant_a'));

    const [agg] = aggregateByTenant();
    expect(agg.recommendationSelections).toBe(3);
  });

  it('computes topSelectedScenarioIds sorted by count descending', () => {
    trackEvent(makeRecommendationSelected('v1', 'combi', 'tenant_a'));
    trackEvent(makeRecommendationSelected('v2', 'combi', 'tenant_a'));
    trackEvent(makeRecommendationSelected('v3', 'heat_pump', 'tenant_a'));

    const [agg] = aggregateByTenant();
    expect(agg.topSelectedScenarioIds[0]).toEqual({ scenarioId: 'combi', count: 2 });
    expect(agg.topSelectedScenarioIds[1]).toEqual({ scenarioId: 'heat_pump', count: 1 });
  });

  it('returns empty topSelectedScenarioIds when no selections', () => {
    trackEvent(makeVisitCreated('v1', 'tenant_a'));
    const [agg] = aggregateByTenant();
    expect(agg.topSelectedScenarioIds).toHaveLength(0);
  });
});

// ─── No payload leakage ───────────────────────────────────────────────────────

describe('No payload leakage', () => {
  it('aggregates contain only counts and IDs — no survey fields', () => {
    trackEvent(makeVisitCreated('v1', 'tenant_a'));
    trackEvent(makeVisitCompleted('v1', 300, 'tenant_a'));
    trackEvent(makeRecommendationSelected('v1', 'combi', 'tenant_a'));

    const [agg] = aggregateByTenant();
    const keys = Object.keys(agg);

    // Allowed keys
    expect(keys).toContain('tenantId');
    expect(keys).toContain('visitsCreated');
    expect(keys).toContain('visitsCompleted');
    expect(keys).toContain('completionRate');
    expect(keys).toContain('avgDurationSeconds');
    expect(keys).toContain('recommendationViews');
    expect(keys).toContain('recommendationSelections');
    expect(keys).toContain('topSelectedScenarioIds');
    expect(keys).toContain('wonJobs');
    expect(keys).toContain('lostJobs');
    expect(keys).toContain('followUpCount');
    expect(keys).toContain('closeRate');

    // Never present
    expect(keys).not.toContain('surveyData');
    expect(keys).not.toContain('address');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('heatLoss');
    expect(keys).not.toContain('visitDetails');
  });
});

// ─── Conversion / close-rate tracking ─────────────────────────────────────────

function makeQuoteMarkedWon(visitId: string, tenantId?: string) {
  return {
    eventId: `evt_won_${visitId}`,
    eventType: 'quote_marked_won' as const,
    visitId,
    tenantId,
    createdAt: '2026-01-01T11:00:00.000Z',
  };
}

function makeQuoteMarkedLost(visitId: string, tenantId?: string) {
  return {
    eventId: `evt_lost_${visitId}`,
    eventType: 'quote_marked_lost' as const,
    visitId,
    tenantId,
    createdAt: '2026-01-01T11:00:00.000Z',
  };
}

function makeQuoteFollowUpRequired(visitId: string, tenantId?: string) {
  return {
    eventId: `evt_followup_${visitId}`,
    eventType: 'quote_follow_up_required' as const,
    visitId,
    tenantId,
    createdAt: '2026-01-01T11:00:00.000Z',
  };
}

describe('aggregateByTenant — conversion tracking', () => {
  it('counts wonJobs correctly', () => {
    trackEvent(makeQuoteMarkedWon('v1', 'tenant_a'));
    trackEvent(makeQuoteMarkedWon('v2', 'tenant_a'));
    const [agg] = aggregateByTenant();
    expect(agg.wonJobs).toBe(2);
  });

  it('counts lostJobs correctly', () => {
    trackEvent(makeQuoteMarkedLost('v1', 'tenant_a'));
    const [agg] = aggregateByTenant();
    expect(agg.lostJobs).toBe(1);
  });

  it('counts followUpCount correctly', () => {
    trackEvent(makeQuoteFollowUpRequired('v1', 'tenant_a'));
    trackEvent(makeQuoteFollowUpRequired('v2', 'tenant_a'));
    trackEvent(makeQuoteFollowUpRequired('v3', 'tenant_a'));
    const [agg] = aggregateByTenant();
    expect(agg.followUpCount).toBe(3);
  });

  it('computes closeRate as won / (won + lost)', () => {
    trackEvent(makeQuoteMarkedWon('v1', 'tenant_a'));
    trackEvent(makeQuoteMarkedWon('v2', 'tenant_a'));
    trackEvent(makeQuoteMarkedWon('v3', 'tenant_a'));
    trackEvent(makeQuoteMarkedLost('v4', 'tenant_a'));
    const [agg] = aggregateByTenant();
    expect(agg.wonJobs).toBe(3);
    expect(agg.lostJobs).toBe(1);
    expect(agg.closeRate).toBe(0.75);
  });

  it('closeRate is 0 when no won or lost events', () => {
    trackEvent(makeVisitCreated('v1', 'tenant_a'));
    const [agg] = aggregateByTenant();
    expect(agg.closeRate).toBe(0);
  });

  it('closeRate is 0 when only lost events (no wins)', () => {
    trackEvent(makeQuoteMarkedLost('v1', 'tenant_a'));
    trackEvent(makeQuoteMarkedLost('v2', 'tenant_a'));
    const [agg] = aggregateByTenant();
    expect(agg.closeRate).toBe(0);
  });

  it('closeRate is 1 when only won events (no losses)', () => {
    trackEvent(makeQuoteMarkedWon('v1', 'tenant_a'));
    const [agg] = aggregateByTenant();
    expect(agg.closeRate).toBe(1);
  });

  it('scopes conversion events per tenant', () => {
    trackEvent(makeQuoteMarkedWon('v1', 'tenant_a'));
    trackEvent(makeQuoteMarkedWon('v2', 'tenant_a'));
    trackEvent(makeQuoteMarkedLost('v3', 'tenant_b'));

    const aggs = aggregateByTenant();
    const a = aggs.find((x) => x.tenantId === 'tenant_a')!;
    const b = aggs.find((x) => x.tenantId === 'tenant_b')!;

    expect(a.wonJobs).toBe(2);
    expect(a.lostJobs).toBe(0);
    expect(b.wonJobs).toBe(0);
    expect(b.lostJobs).toBe(1);
  });

  it('stored events contain no customer data', () => {
    trackEvent(makeQuoteMarkedWon('v1', 'tenant_a'));
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY)!;
    expect(raw).not.toContain('address');
    expect(raw).not.toContain('name');
    expect(raw).not.toContain('jobDetails');
    expect(raw).toContain('quote_marked_won');
    expect(raw).toContain('v1');
  });
});
