/**
 * reportApi.test.ts
 *
 * Unit tests for the Atlas report API client helpers.
 * fetch is mocked so no real network calls are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getReport, saveReport } from '../reportApi';

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

describe('reportApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── getReport ────────────────────────────────────────────────────────────────

  describe('getReport', () => {
    const sampleReport = {
      id: 'r1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      status: 'draft',
      title: null,
      customer_name: null,
      postcode: 'SW1A 1AA',
      payload: {
        surveyData: { occupancyCount: 3 },
        engineInput: {},
        engineOutput: { options: [] },
        decisionSynthesis: null,
      },
    };

    it('GETs /api/reports/:id and returns the report', async () => {
      global.fetch = mockFetch({ ok: true, report: sampleReport });
      const result = await getReport('r1');
      expect(result.id).toBe('r1');
      expect(result.postcode).toBe('SW1A 1AA');
    });

    it('uses the encoded id in the URL', async () => {
      global.fetch = mockFetch({ ok: true, report: sampleReport });
      await getReport('r1');
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe('/api/reports/r1');
    });

    it('throws "Report not found" on 404', async () => {
      global.fetch = mockFetch({ ok: false, error: 'Report not found' }, 404);
      await expect(getReport('missing')).rejects.toThrow('Report not found');
    });

    it('throws on other error status codes', async () => {
      global.fetch = mockFetch({ error: 'Internal error' }, 500);
      await expect(getReport('r1')).rejects.toThrow('Internal error');
    });
  });

  // ── saveReport ────────────────────────────────────────────────────────────────

  describe('saveReport', () => {
    const samplePayload = {
      surveyData: { occupancyCount: 2 } as unknown as import('../reportApi').ReportPayload['surveyData'],
      engineInput: {} as import('../reportApi').ReportPayload['engineInput'],
      engineOutput: { options: [] } as unknown as import('../reportApi').ReportPayload['engineOutput'],
      decisionSynthesis: null,
    };

    it('POSTs to /api/reports and returns the id', async () => {
      global.fetch = mockFetch({ ok: true, id: 'r-new' }, 201);
      const result = await saveReport({ postcode: 'SW1A 1AA', payload: samplePayload });
      expect(result.id).toBe('r-new');
      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/reports');
      expect(opts.method).toBe('POST');
    });

    it('throws when the server returns an error', async () => {
      global.fetch = mockFetch({ error: 'DB error' }, 500);
      await expect(saveReport({ payload: samplePayload })).rejects.toThrow('DB error');
    });
  });
});
