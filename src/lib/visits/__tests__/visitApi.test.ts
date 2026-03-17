/**
 * visitApi.test.ts
 *
 * Unit tests for the Atlas visit API client helpers.
 * fetch is mocked so no real network calls are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVisit, listVisits, getVisit, saveVisit } from '../visitApi';

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
});
