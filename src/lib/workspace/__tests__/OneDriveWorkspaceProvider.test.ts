/**
 * OneDriveWorkspaceProvider.test.ts
 *
 * Unit tests for OneDriveWorkspaceProvider.
 *
 * All Microsoft Graph API calls are mocked via vitest's global fetch mock so
 * no real network calls or OAuth tokens are required.
 *
 * The tests validate:
 * - CRUD behaviour that mirrors LocalWorkspaceProvider
 * - Index maintenance (upsert on create/save, removal on delete)
 * - "Visit not found" errors
 * - OAuth redirect detection helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OneDriveWorkspaceProvider }              from '../OneDriveWorkspaceProvider';
import type { VisitMeta }                         from '../../visits/visitApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function storedVisit(id: string, overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id,
    created_at:        '2025-01-01T00:00:00.000Z',
    updated_at:        '2025-01-01T00:00:00.000Z',
    status:            'new',
    customer_name:     null,
    address_line_1:    null,
    postcode:          null,
    current_step:      null,
    visit_reference:   null,
    completed_at:      null,
    completion_method: null,
    working_payload:   {},
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

function notFoundResponse(): Response {
  return new Response(JSON.stringify({ error: { code: 'itemNotFound' } }), {
    status:  404,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Provider factory ─────────────────────────────────────────────────────────

function makeProvider(): OneDriveWorkspaceProvider {
  const token = {
    accessToken: 'test-access-token',
    expiresAt:   Date.now() / 1000 + 3600,
  };
  sessionStorage.setItem('atlas_oauth_token', JSON.stringify(token));
  return new OneDriveWorkspaceProvider({ clientId: 'test-client-id' });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OneDriveWorkspaceProvider', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  // ── isAuthenticated ────────────────────────────────────────────────────────

  describe('isAuthenticated', () => {
    it('returns false when no token is stored', () => {
      sessionStorage.clear();
      const provider = new OneDriveWorkspaceProvider({ clientId: 'test' });
      expect(provider.isAuthenticated).toBe(false);
    });

    it('returns true when a token is stored in sessionStorage', () => {
      const provider = makeProvider();
      expect(provider.isAuthenticated).toBe(true);
    });
  });

  // ── handleOAuthRedirect ────────────────────────────────────────────────────

  describe('handleOAuthRedirect', () => {
    it('returns false for a non-redirect URL', async () => {
      const provider = makeProvider();
      const result   = await provider.handleOAuthRedirect('https://example.com/dashboard');
      expect(result).toBe(false);
    });
  });

  // ── listVisits ─────────────────────────────────────────────────────────────

  describe('listVisits', () => {
    it('returns an empty array when the index file does not exist', async () => {
      const provider = makeProvider();

      vi.stubGlobal('fetch', async () => notFoundResponse());

      const visits = await provider.listVisits();
      expect(visits).toEqual([]);
    });

    it('returns visits sorted by updated_at descending', async () => {
      const provider = makeProvider();
      const index: VisitMeta[] = [
        {
          id: 'a', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T10:00:00Z',
          status: 'new', customer_name: 'Alice', address_line_1: null, postcode: null,
          current_step: null, visit_reference: null, completed_at: null, completion_method: null,
        },
        {
          id: 'b', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-02T10:00:00Z',
          status: 'new', customer_name: 'Bob', address_line_1: null, postcode: null,
          current_step: null, visit_reference: null, completed_at: null, completion_method: null,
        },
      ];

      vi.stubGlobal('fetch', async () => jsonResponse(index));

      const visits = await provider.listVisits();
      expect(visits[0].id).toBe('b');
      expect(visits[1].id).toBe('a');
    });

    it('caps results at 50 visits', async () => {
      const provider = makeProvider();
      const index: VisitMeta[] = Array.from({ length: 80 }, (_, i) => ({
        id:                `visit-${i}`,
        created_at:        '2025-01-01T00:00:00Z',
        updated_at:        `2025-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        status:            'new',
        customer_name:     null,
        address_line_1:    null,
        postcode:          null,
        current_step:      null,
        visit_reference:   null,
        completed_at:      null,
        completion_method: null,
      }));

      vi.stubGlobal('fetch', async () => jsonResponse(index));

      const visits = await provider.listVisits();
      expect(visits).toHaveLength(50);
    });
  });

  // ── createVisit ────────────────────────────────────────────────────────────

  describe('createVisit', () => {
    it('returns ok:true and a non-empty id', async () => {
      const provider = makeProvider();

      let callCount = 0;
      vi.stubGlobal('fetch', async () => {
        callCount++;
        if (callCount === 1) return jsonResponse({ id: 'new-file-id', name: 'visit.json' }); // write visit file
        if (callCount === 2) return notFoundResponse(); // read index → empty
        if (callCount === 3) return jsonResponse({ id: 'index-id' }); // write index
        return jsonResponse({});
      });

      const result = await provider.createVisit({ customer_name: 'Dave' });
      expect(result.ok).toBe(true);
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    it('creates unique IDs for two separate visits', async () => {
      const provider = makeProvider();

      vi.stubGlobal('fetch', async () => jsonResponse({ id: 'file-id' }));

      const a = await provider.createVisit();
      const b = await provider.createVisit();
      expect(a.id).not.toBe(b.id);
    });

    it('sets initial status to "new"', async () => {
      const provider = makeProvider();

      const writtenBodies: string[] = [];
      vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
        if (init?.body) writtenBodies.push(init.body as string);
        return jsonResponse({ id: 'file-id' });
      });

      const { id } = await provider.createVisit();

      // The first written body should be the visit file.
      const visitBody = JSON.parse(writtenBodies[0]) as Record<string, unknown>;
      expect(visitBody['id']).toBe(id);
      expect(visitBody['status']).toBe('new');
    });
  });

  // ── getVisit ───────────────────────────────────────────────────────────────

  describe('getVisit', () => {
    it('throws "Visit not found" when the Graph API returns 404', async () => {
      const provider = makeProvider();
      vi.stubGlobal('fetch', async () => notFoundResponse());
      await expect(provider.getVisit('ghost-id')).rejects.toThrow('Visit not found');
    });

    it('returns the full visit detail including working_payload', async () => {
      const provider = makeProvider();
      const visit    = storedVisit('test-id', {
        customer_name: 'Eve',
        working_payload: { boiler_type: 'combi' },
      });

      vi.stubGlobal('fetch', async () => jsonResponse(visit));

      const detail = await provider.getVisit('test-id');
      expect(detail.customer_name).toBe('Eve');
      expect(detail.working_payload).toEqual({ boiler_type: 'combi' });
      expect(detail.id).toBe('test-id');
    });

    it('defaults working_payload to {} when absent in stored file', async () => {
      const provider = makeProvider();
      const visit    = storedVisit('test-id');
      delete (visit as Record<string, unknown>)['working_payload'];

      vi.stubGlobal('fetch', async () => jsonResponse(visit));

      const detail = await provider.getVisit('test-id');
      expect(detail.working_payload).toEqual({});
    });
  });

  // ── saveVisit ──────────────────────────────────────────────────────────────

  describe('saveVisit', () => {
    it('throws "Visit not found" when the visit does not exist', async () => {
      const provider = makeProvider();
      vi.stubGlobal('fetch', async () => notFoundResponse());
      await expect(provider.saveVisit('ghost-id', { status: 'quoted' })).rejects.toThrow('Visit not found');
    });

    it('updates specified scalar fields', async () => {
      const provider  = makeProvider();
      const original  = storedVisit('v1', { customer_name: 'Frank', status: 'new' });
      const written: string[] = [];

      let callCount = 0;
      vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
        callCount++;
        if (callCount === 1) return jsonResponse(original);  // getVisit read
        if (callCount === 2) {
          written.push(init?.body as string);
          return jsonResponse({ id: 'v1' }); // write visit file
        }
        if (callCount === 3) return notFoundResponse(); // read index
        if (callCount === 4) return jsonResponse({ id: 'index-id' }); // write index
        return jsonResponse({});
      });

      await provider.saveVisit('v1', { status: 'quoted', customer_name: 'Grace' });

      const saved = JSON.parse(written[0]) as Record<string, unknown>;
      expect(saved['status']).toBe('quoted');
      expect(saved['customer_name']).toBe('Grace');
    });

    it('does not alter unspecified fields', async () => {
      const provider = makeProvider();
      const original = storedVisit('v2', { postcode: 'SW1 1AA', customer_name: 'Harry' });
      const written: string[] = [];

      let callCount = 0;
      vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
        callCount++;
        if (callCount === 1) return jsonResponse(original);
        if (callCount === 2) {
          written.push(init?.body as string);
          return jsonResponse({ id: 'v2' });
        }
        return jsonResponse({ id: 'idx' });
      });

      await provider.saveVisit('v2', { status: 'survey_started' });

      const saved = JSON.parse(written[0]) as Record<string, unknown>;
      expect(saved['postcode']).toBe('SW1 1AA');
      expect(saved['customer_name']).toBe('Harry');
    });

    it('overwrites working_payload on each save', async () => {
      const provider = makeProvider();
      const original = storedVisit('v3', { working_payload: { old: true } });
      const written: string[] = [];

      let callCount = 0;
      vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
        callCount++;
        if (callCount === 1) return jsonResponse(original);
        if (callCount === 2) {
          written.push(init?.body as string);
          return jsonResponse({ id: 'v3' });
        }
        return jsonResponse({ id: 'idx' });
      });

      await provider.saveVisit('v3', { working_payload: { new: true } });

      const saved = JSON.parse(written[0]) as Record<string, unknown>;
      expect(saved['working_payload']).toEqual({ new: true });
    });
  });

  // ── deleteVisit ────────────────────────────────────────────────────────────

  describe('deleteVisit', () => {
    it('throws "Visit not found" when the file does not exist', async () => {
      const provider = makeProvider();
      vi.stubGlobal('fetch', async () => notFoundResponse());
      await expect(provider.deleteVisit('ghost-id')).rejects.toThrow('Visit not found');
    });

    it('sends a DELETE request to the correct Graph endpoint', async () => {
      const provider     = makeProvider();
      const deletedUrls: string[] = [];

      let callCount = 0;
      vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
        callCount++;
        if (callCount === 1) {
          deletedUrls.push(url);
          return emptyResponse(204); // DELETE succeeds
        }
        // Index update calls
        if (callCount === 2) return notFoundResponse(); // read index
        if (callCount === 3) return jsonResponse({ id: 'idx' }); // write index
        return jsonResponse({});
      });

      await provider.deleteVisit('del-id');

      expect(deletedUrls[0]).toContain('del-id');
      expect(deletedUrls[0]).toContain('Atlas%20Mind%20Workspace');
    });

    it('removes the visit from the index', async () => {
      const provider = makeProvider();
      const index: VisitMeta[] = [
        {
          id: 'del-id', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
          status: 'new', customer_name: null, address_line_1: null, postcode: null,
          current_step: null, visit_reference: null, completed_at: null, completion_method: null,
        },
        {
          id: 'keep-id', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
          status: 'new', customer_name: null, address_line_1: null, postcode: null,
          current_step: null, visit_reference: null, completed_at: null, completion_method: null,
        },
      ];

      const writtenIndexBodies: string[] = [];
      let callCount = 0;
      vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
        callCount++;
        if (callCount === 1) return emptyResponse(204); // DELETE
        if (callCount === 2) return jsonResponse(index); // read index
        if (callCount === 3) {
          writtenIndexBodies.push(init?.body as string);
          return jsonResponse({ id: 'idx' }); // write index
        }
        return jsonResponse({});
      });

      await provider.deleteVisit('del-id');

      const saved = JSON.parse(writtenIndexBodies[0]) as VisitMeta[];
      expect(saved.find((v) => v.id === 'del-id')).toBeUndefined();
      expect(saved.find((v) => v.id === 'keep-id')).toBeDefined();
    });
  });

  // ── signOut ────────────────────────────────────────────────────────────────

  describe('signOut', () => {
    it('clears isAuthenticated', () => {
      const provider = makeProvider();
      expect(provider.isAuthenticated).toBe(true);
      provider.signOut();
      expect(provider.isAuthenticated).toBe(false);
    });
  });
});
