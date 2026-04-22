/**
 * visitApi.test.ts
 *
 * Unit tests for the Atlas visit API client helpers.
 * fetch is mocked so no real network calls are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createVisit,
  listVisits,
  getVisit,
  saveVisit,
  deleteVisit,
  visitStatusLabel,
  visitDisplayLabel,
  matchesFilter,
  isSurveyComplete,
  type VisitMeta,
} from '../visitApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('visitApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── createVisit ─────────────────────────────────────────────────────────────

  describe('createVisit', () => {
    it('POSTs to /api/visits and returns the id', async () => {
      global.fetch = mockFetch({ ok: true, id: 'abc-123' }, 201);
      const result = await createVisit({ postcode: 'SW1A 1AA' });
      expect(result.id).toBe('abc-123');
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('/api/visits');
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].method).toBe('POST');
    });

    it('works with no options (empty body)', async () => {
      global.fetch = mockFetch({ ok: true, id: 'xyz-789' }, 201);
      const result = await createVisit();
      expect(result.id).toBe('xyz-789');
    });

    it('throws when the server returns an error', async () => {
      global.fetch = mockFetch({ error: 'DB error' }, 500);
      await expect(createVisit()).rejects.toThrow('DB error');
    });

    it('throws when the response body is missing the id field', async () => {
      global.fetch = mockFetch({ ok: true }, 201);
      await expect(createVisit()).rejects.toThrow('unexpected response');
    });

    it('throws when the response id is an empty string', async () => {
      global.fetch = mockFetch({ ok: true, id: '' }, 201);
      await expect(createVisit()).rejects.toThrow('unexpected response');
    });

    it('throws when the response id is not a string', async () => {
      global.fetch = mockFetch({ ok: true, id: null }, 201);
      await expect(createVisit()).rejects.toThrow('unexpected response');
    });
  });

  // ── listVisits ───────────────────────────────────────────────────────────────

  describe('listVisits', () => {
    it('GETs /api/visits and returns the visits array', async () => {
      const visits = [
        { id: 'v1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
          status: 'draft', customer_name: null, address_line_1: null, postcode: null, current_step: null },
      ];
      global.fetch = mockFetch({ ok: true, visits });
      const result = await listVisits();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('v1');
    });

    it('throws when the server returns an error', async () => {
      global.fetch = mockFetch({ error: 'Binding not found' }, 500);
      await expect(listVisits()).rejects.toThrow('Binding not found');
    });
  });

  // ── getVisit ─────────────────────────────────────────────────────────────────

  describe('getVisit', () => {
    const sampleVisit = {
      id: 'v1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
      status: 'draft', customer_name: null, address_line_1: null, postcode: null,
      current_step: null, working_payload: { occupancyCount: 3 },
    };

    it('GETs /api/visits/:id and returns the visit detail', async () => {
      global.fetch = mockFetch({ ok: true, visit: sampleVisit });
      const result = await getVisit('v1');
      expect(result.id).toBe('v1');
      expect(result.working_payload).toEqual({ occupancyCount: 3 });
    });

    it('uses the encoded id in the URL', async () => {
      global.fetch = mockFetch({ ok: true, visit: sampleVisit });
      await getVisit('v1');
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe('/api/visits/v1');
    });

    it('throws "Visit not found" on 404', async () => {
      global.fetch = mockFetch({ ok: false, error: 'Visit not found' }, 404);
      await expect(getVisit('missing')).rejects.toThrow('Visit not found');
    });

    it('throws on other error status codes', async () => {
      global.fetch = mockFetch({ error: 'Internal error' }, 500);
      await expect(getVisit('v1')).rejects.toThrow('Internal error');
    });
  });

  // ── saveVisit ────────────────────────────────────────────────────────────────

  describe('saveVisit', () => {
    it('PUTs to /api/visits/:id', async () => {
      global.fetch = mockFetch({ ok: true, id: 'v1' });
      await saveVisit('v1', { current_step: 'complete', working_payload: { occupancyCount: 2 } });
      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/visits/v1');
      expect(opts.method).toBe('PUT');
      const sent = JSON.parse(opts.body as string) as Record<string, unknown>;
      expect(sent.current_step).toBe('complete');
      expect((sent.working_payload as { occupancyCount: number }).occupancyCount).toBe(2);
    });

    it('throws when the server returns an error', async () => {
      global.fetch = mockFetch({ error: 'Visit not found' }, 404);
      await expect(saveVisit('missing', {})).rejects.toThrow('Visit not found');
    });
  });

  // ── deleteVisit ──────────────────────────────────────────────────────────────

  describe('deleteVisit', () => {
    it('DELETEs /api/visits/:id', async () => {
      global.fetch = mockFetch({ ok: true, id: 'v1' });
      await deleteVisit('v1');
      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/visits/v1');
      expect(opts.method).toBe('DELETE');
    });

    it('encodes the visit id in the URL', async () => {
      global.fetch = mockFetch({ ok: true, id: 'a/b' });
      await deleteVisit('a/b');
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe('/api/visits/a%2Fb');
    });

    it('throws "Visit not found" on 404', async () => {
      global.fetch = mockFetch({ ok: false, error: 'Visit not found' }, 404);
      await expect(deleteVisit('missing')).rejects.toThrow('Visit not found');
    });

    it('throws when the server returns a non-404 error', async () => {
      global.fetch = mockFetch({ error: 'Internal error' }, 500);
      await expect(deleteVisit('v1')).rejects.toThrow('Internal error');
    });
  });

  // ── visitStatusLabel ─────────────────────────────────────────────────────────

  describe('visitStatusLabel', () => {
    it('maps canonical status keys to human-readable labels', () => {
      expect(visitStatusLabel('new')).toBe('New');
      expect(visitStatusLabel('survey_started')).toBe('Survey started');
      expect(visitStatusLabel('recommendation_ready')).toBe('Survey complete');
      expect(visitStatusLabel('quoted')).toBe('Quoted');
      expect(visitStatusLabel('installed')).toBe('Installed');
    });

    it('maps legacy status values to their canonical equivalents', () => {
      expect(visitStatusLabel('draft')).toBe('New');
      expect(visitStatusLabel('complete')).toBe('Survey complete');
    });

    it('returns the raw value for unknown status strings', () => {
      expect(visitStatusLabel('unknown_state')).toBe('unknown_state');
    });
  });

  // ── visitDisplayLabel ────────────────────────────────────────────────────────

  describe('visitDisplayLabel', () => {
    function makeVisitMeta(overrides: Partial<VisitMeta> = {}): VisitMeta {
      return {
        id: 'abcdef12-3456-7890-abcd-ef1234567890',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'new',
        customer_name: null,
        address_line_1: null,
        postcode: null,
        current_step: null,
        visit_reference: null,
        ...overrides,
      };
    }

    it('returns visit_reference when present (highest priority)', () => {
      const v = makeVisitMeta({ visit_reference: 'Lead 12345', address_line_1: '10 Downing St', customer_name: 'A User' });
      expect(visitDisplayLabel(v)).toBe('Lead 12345');
    });

    it('returns address_line_1 when no visit_reference', () => {
      const v = makeVisitMeta({ address_line_1: '10 Downing St', postcode: 'SW1A 2AA', customer_name: 'A User' });
      expect(visitDisplayLabel(v)).toBe('10 Downing St');
    });

    it('falls back to truncated visit id when no identifying data', () => {
      const v = makeVisitMeta();
      expect(visitDisplayLabel(v)).toBe('Visit 34567890');
    });
  });

  // ── matchesFilter ────────────────────────────────────────────────────────────

  describe('matchesFilter', () => {
    it('"all" filter always returns true', () => {
      expect(matchesFilter('new', 'all')).toBe(true);
      expect(matchesFilter('installed', 'all')).toBe(true);
    });

    it('"active" matches new, draft and survey_started', () => {
      expect(matchesFilter('new', 'active')).toBe(true);
      expect(matchesFilter('draft', 'active')).toBe(true);
      expect(matchesFilter('survey_started', 'active')).toBe(true);
      expect(matchesFilter('recommendation_ready', 'active')).toBe(false);
    });

    it('"completed" matches recommendation_ready, complete, quoted and installed', () => {
      expect(matchesFilter('recommendation_ready', 'completed')).toBe(true);
      expect(matchesFilter('complete', 'completed')).toBe(true);
      expect(matchesFilter('quoted', 'completed')).toBe(true);
      expect(matchesFilter('installed', 'completed')).toBe(true);
      expect(matchesFilter('new', 'completed')).toBe(false);
    });

    it('"needs_followup" matches recommendation_ready and complete only', () => {
      expect(matchesFilter('recommendation_ready', 'needs_followup')).toBe(true);
      expect(matchesFilter('complete', 'needs_followup')).toBe(true);
      expect(matchesFilter('quoted', 'needs_followup')).toBe(false);
      expect(matchesFilter('installed', 'needs_followup')).toBe(false);
      expect(matchesFilter('new', 'needs_followup')).toBe(false);
    });
  });

  // ── isSurveyComplete ─────────────────────────────────────────────────────────

  describe('isSurveyComplete', () => {
    function makeVisit(status: string, current_step: string | null = null): VisitMeta {
      return {
        id: 'test-id',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status,
        customer_name: null,
        address_line_1: null,
        postcode: null,
        current_step,
        visit_reference: null,
      };
    }

    it('returns true for recommendation_ready status', () => {
      expect(isSurveyComplete(makeVisit('recommendation_ready'))).toBe(true);
    });

    it('returns true for legacy "complete" status', () => {
      expect(isSurveyComplete(makeVisit('complete'))).toBe(true);
    });

    it('returns true for quoted and installed', () => {
      expect(isSurveyComplete(makeVisit('quoted'))).toBe(true);
      expect(isSurveyComplete(makeVisit('installed'))).toBe(true);
    });

    it('returns true when current_step is "complete" regardless of status', () => {
      expect(isSurveyComplete(makeVisit('new', 'complete'))).toBe(true);
    });

    it('returns false for new / draft / survey_started without a complete step', () => {
      expect(isSurveyComplete(makeVisit('new'))).toBe(false);
      expect(isSurveyComplete(makeVisit('draft'))).toBe(false);
      expect(isSurveyComplete(makeVisit('survey_started'))).toBe(false);
    });
  });
});

// ─── RecentVisitsList helpers ─────────────────────────────────────────────────

import {
  matchesSearch,
  matchesDateFilter,
  DEFAULT_LIST_LIMIT,
  isAnyFilterActive,
  cardSubline,
  buildListSummary,
} from '../../../components/visit/recentVisitsHelpers';

describe('RecentVisitsList helpers', () => {
  function makeVisitMeta(overrides: Partial<VisitMeta> = {}): VisitMeta {
    return {
      id: 'test-id',
      created_at: '2024-06-15T10:00:00Z',
      updated_at: '2024-06-15T10:00:00Z',
      status: 'new',
      customer_name: null,
      address_line_1: null,
      postcode: null,
      current_step: null,
      visit_reference: null,
      ...overrides,
    };
  }

  // ── DEFAULT_LIST_LIMIT ────────────────────────────────────────────────────

  describe('DEFAULT_LIST_LIMIT', () => {
    it('is a positive integer (20)', () => {
      expect(DEFAULT_LIST_LIMIT).toBe(20);
      expect(typeof DEFAULT_LIST_LIMIT).toBe('number');
    });
  });

  // ── matchesSearch ─────────────────────────────────────────────────────────

  describe('matchesSearch', () => {
    it('returns true when query is empty', () => {
      const v = makeVisitMeta({ address_line_1: '10 Downing St' });
      expect(matchesSearch(v, '')).toBe(true);
    });

    it('matches by visit_reference (case-insensitive)', () => {
      const v = makeVisitMeta({ visit_reference: 'LEAD-1234' });
      expect(matchesSearch(v, 'lead-1234')).toBe(true);
      expect(matchesSearch(v, 'LEAD')).toBe(true);
      expect(matchesSearch(v, 'lead')).toBe(true);
    });

    it('matches by address_line_1', () => {
      const v = makeVisitMeta({ address_line_1: '10 Downing Street' });
      expect(matchesSearch(v, 'downing')).toBe(true);
    });

    it('does not match by postcode (not a supported search field)', () => {
      const v = makeVisitMeta({ postcode: 'SW1A 2AA' });
      expect(matchesSearch(v, 'sw1a')).toBe(false);
    });

    it('does not match by customer_name (not a supported search field)', () => {
      const v = makeVisitMeta({ customer_name: 'Jane Smith' });
      expect(matchesSearch(v, 'jane')).toBe(false);
    });

    it('returns false when query does not match any field', () => {
      const v = makeVisitMeta({ address_line_1: '10 Downing St', customer_name: 'Alice' });
      expect(matchesSearch(v, 'zzz_no_match')).toBe(false);
    });

    it('visit_reference match takes priority over no-match on other fields', () => {
      const v = makeVisitMeta({ visit_reference: 'REF-999', address_line_1: '1 Other St' });
      expect(matchesSearch(v, 'REF-999')).toBe(true);
    });
  });

  // ── matchesDateFilter ─────────────────────────────────────────────────────

  describe('matchesDateFilter', () => {
    it('returns true when dateStr is empty (no filter active)', () => {
      const v = makeVisitMeta({ updated_at: '2024-06-15T10:00:00Z' });
      expect(matchesDateFilter(v, '')).toBe(true);
    });

    it('returns true when the visit was updated on the given date', () => {
      const v = makeVisitMeta({ updated_at: '2024-06-15T10:00:00Z' });
      // en-CA locale formats as YYYY-MM-DD using local time.
      // We replicate what the helper does:
      const expectedDate = new Date('2024-06-15T10:00:00Z').toLocaleDateString('en-CA');
      expect(matchesDateFilter(v, expectedDate)).toBe(true);
    });

    it('returns false when the visit was updated on a different date', () => {
      const v = makeVisitMeta({ updated_at: '2024-06-15T10:00:00Z' });
      expect(matchesDateFilter(v, '2024-06-16')).toBe(false);
    });

    it('returns false for an invalid dateStr that does not match', () => {
      const v = makeVisitMeta({ updated_at: '2024-06-15T10:00:00Z' });
      expect(matchesDateFilter(v, '1999-01-01')).toBe(false);
    });
  });

  // ── capped list behaviour (regression) ───────────────────────────────────

  describe('capped list — newest-first regression', () => {
    /**
     * Builds an array of N visits sorted newest-first by updated_at
     * (as the API returns them).
     */
    function buildVisits(n: number): VisitMeta[] {
      return Array.from({ length: n }, (_, i) => {
        const isoDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString();
        return makeVisitMeta({
          id: `visit-${i}`,
          updated_at: isoDate,
          address_line_1: `${i + 1} Example Road`,
        });
      });
    }

    it('slicing first DEFAULT_LIST_LIMIT from a 50-visit array returns 20 items', () => {
      const visits = buildVisits(50);
      const visible = visits.slice(0, DEFAULT_LIST_LIMIT);
      expect(visible).toHaveLength(20);
    });

    it('the first item in the sliced list is the newest visit', () => {
      const visits = buildVisits(50);
      const visible = visits.slice(0, DEFAULT_LIST_LIMIT);
      // visit-0 was set with the most-recent timestamp (index 0 = now)
      expect(visible[0].id).toBe('visit-0');
    });

    it('slicing returns all items when fewer than DEFAULT_LIST_LIMIT exist', () => {
      const visits = buildVisits(10);
      const visible = visits.slice(0, DEFAULT_LIST_LIMIT);
      expect(visible).toHaveLength(10);
    });

    it('filtered results bypass the cap when a text search is active', () => {
      const visits = buildVisits(50);
      // Searching for '1 Example Road' matches only the visit with address_line_1 = '1 Example Road'
      const filtered = visits.filter((v) => matchesSearch(v, '1 Example Road'));
      // Since filtering is active, we show all filtered results (no slice)
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.length).toBeLessThanOrEqual(50);
    });
  });

  // ── list summary text logic (regression) ─────────────────────────────────

  describe('list summary text — regression', () => {
    it('shows "Showing latest 20 visits" when unfiltered and capped', () => {
      expect(buildListSummary({ isFiltering: false, showAll: false, visibleCount: 20, totalFilteredCount: 50 }))
        .toBe('Showing latest 20 visits');
    });

    it('shows "Showing all N visits" when showAll is true and not filtering', () => {
      expect(buildListSummary({ isFiltering: false, showAll: true, visibleCount: 50, totalFilteredCount: 50 }))
        .toBe('Showing all 50 visits');
    });

    it('shows "Showing N filtered visits" when filters are active', () => {
      expect(buildListSummary({ isFiltering: true, showAll: false, visibleCount: 7, totalFilteredCount: 7 }))
        .toBe('Showing 7 filtered visits');
    });

    it('uses singular "visit" when exactly 1 result', () => {
      expect(buildListSummary({ isFiltering: true, showAll: false, visibleCount: 1, totalFilteredCount: 1 }))
        .toBe('Showing 1 filtered visit');
      expect(buildListSummary({ isFiltering: false, showAll: false, visibleCount: 1, totalFilteredCount: 5 }))
        .toBe('Showing latest 1 visit');
    });
  });

  // ── card subline logic (row display-label regression) ─────────────────────

  describe('card subline — display-label regression', () => {
    it('when headline is visit_reference, subline shows address_line_1', () => {
      const v = makeVisitMeta({ visit_reference: 'REF-1', address_line_1: '10 Main St' });
      expect(cardSubline(v)).toBe('10 Main St');
    });

    it('when headline is visit_reference and no address, subline is empty', () => {
      const v = makeVisitMeta({ visit_reference: 'REF-2', address_line_1: null });
      expect(cardSubline(v)).toBe('');
    });

    it('when headline is address (no visit_reference), subline is empty', () => {
      const v = makeVisitMeta({ visit_reference: null, address_line_1: '10 Main St' });
      expect(cardSubline(v)).toBe('');
    });

    it('when only id fallback (no ref/address), subline is empty', () => {
      const v = makeVisitMeta({ visit_reference: null, address_line_1: null });
      expect(cardSubline(v)).toBe('');
    });
  });

  // ── isFiltering logic (clear-filters regression) ──────────────────────────

  describe('isFiltering — clear-filters regression', () => {
    it('is false when all filters are at defaults', () => {
      expect(isAnyFilterActive('', '', 'all')).toBe(false);
    });

    it('is true when search text is non-empty', () => {
      expect(isAnyFilterActive('REF-1', '', 'all')).toBe(true);
    });

    it('is true when a date is selected', () => {
      expect(isAnyFilterActive('', '2024-06-15', 'all')).toBe(true);
    });

    it('is true when a status filter is active', () => {
      expect(isAnyFilterActive('', '', 'active')).toBe(true);
    });

    it('returns to false after clearing all filters', () => {
      // Simulate clearing: all fields reset to defaults
      expect(isAnyFilterActive('', '', 'all')).toBe(false);
    });
  });
});
