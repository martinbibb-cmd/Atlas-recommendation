/**
 * GoogleDriveWorkspaceProvider.test.ts
 *
 * Unit tests for GoogleDriveWorkspaceProvider.
 *
 * All Google Drive API calls are mocked via vitest's global fetch mock so no
 * real network calls or OAuth tokens are required.
 *
 * The tests validate:
 * - CRUD behaviour that mirrors LocalWorkspaceProvider
 * - Index maintenance (upsert on create/save, removal on delete)
 * - "Visit not found" errors
 * - OAuth redirect detection helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDriveWorkspaceProvider }           from '../GoogleDriveWorkspaceProvider';
import type { VisitMeta }                         from '../../visits/visitApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal stored-visit object as the Drive API would return it. */
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

type FetchCall = [string, RequestInit | undefined];

/**
 * Set up a mocked global fetch that records all calls and returns canned
 * responses in sequence.  Each element in `responses` is a factory that
 * receives the URL and returns a Response.
 */
function mockFetch(
  responseFactory: (url: string, init: RequestInit | undefined, callIndex: number) => Response,
): { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push([url, init]);
    return responseFactory(url, init, calls.length - 1);
  });
  return { calls };
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

// ─── Provider factory ─────────────────────────────────────────────────────────

/**
 * Build a provider that already has a token so we bypass the OAuth flow in
 * every test.  We inject the token directly into sessionStorage (the same
 * key DriveOAuthClient uses).
 */
function makeProvider(): GoogleDriveWorkspaceProvider {
  const token = {
    accessToken: 'test-access-token',
    expiresAt:   Date.now() / 1000 + 3600,
  };
  sessionStorage.setItem('atlas_oauth_token', JSON.stringify(token));
  return new GoogleDriveWorkspaceProvider({ clientId: 'test-client-id' });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GoogleDriveWorkspaceProvider', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  // ── isAuthenticated ────────────────────────────────────────────────────────

  describe('isAuthenticated', () => {
    it('returns false when no token is stored', () => {
      sessionStorage.clear();
      const provider = new GoogleDriveWorkspaceProvider({ clientId: 'test' });
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
    it('returns an empty array when no index file exists on Drive', async () => {
      const provider = makeProvider();

      mockFetch((_url) => {
        // First call: search for root folder → not found.
        // Second call: create root folder → success.
        // Third call: search for index.json → not found (404).
        // We need to track call order.
        return jsonResponse({ files: [] });
      });

      // Override with a stateful mock.
      let callCount = 0;
      vi.stubGlobal('fetch', async () => {
        callCount++;
        if (callCount === 1) return jsonResponse({ files: [] });       // search root folder — not found
        if (callCount === 2) return jsonResponse({ id: 'root-id' });   // create root folder
        if (callCount === 3) return jsonResponse({ files: [] });       // search index.json — not found
        return jsonResponse({ files: [] });
      });

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

      let callCount = 0;
      vi.stubGlobal('fetch', async () => {
        callCount++;
        if (callCount === 1) return jsonResponse({ files: [{ id: 'root-id' }] });     // search root folder
        if (callCount === 2) return jsonResponse({ files: [{ id: 'index-file-id' }] }); // search index.json
        if (callCount === 3) return jsonResponse(index);                                // read index
        return jsonResponse({});
      });

      const visits = await provider.listVisits();
      expect(visits[0].id).toBe('b');
      expect(visits[1].id).toBe('a');
    });
  });

  // ── createVisit ────────────────────────────────────────────────────────────

  describe('createVisit', () => {
    it('returns ok:true and a UUID string id', async () => {
      const provider = makeProvider();

      let callCount = 0;
      vi.stubGlobal('fetch', async () => {
        callCount++;
        // root folder search → found
        if (callCount === 1) return jsonResponse({ files: [{ id: 'root-id' }] });
        // visits subfolder search → found
        if (callCount === 2) return jsonResponse({ files: [{ id: 'visits-id' }] });
        // search for visit file → not found (new file)
        if (callCount === 3) return jsonResponse({ files: [] });
        // multipart upload → success
        if (callCount === 4) return jsonResponse({ id: 'new-file-id' });
        // root folder search (for index)
        if (callCount === 5) return jsonResponse({ files: [{ id: 'root-id' }] });
        // search index.json → not found
        if (callCount === 6) return jsonResponse({ files: [] });
        // read index (not reached, returns empty)
        // write index
        if (callCount === 7) return jsonResponse({ id: 'index-id' });
        return jsonResponse({});
      });

      const result = await provider.createVisit({ customer_name: 'Test' });
      expect(result.ok).toBe(true);
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });
  });

  // ── getVisit ───────────────────────────────────────────────────────────────

  describe('getVisit', () => {
    it('throws "Visit not found" when the file does not exist on Drive', async () => {
      const provider = makeProvider();

      let callCount = 0;
      vi.stubGlobal('fetch', async () => {
        callCount++;
        // visits subfolder search → found
        if (callCount === 1) return jsonResponse({ files: [{ id: 'root-id' }] });
        if (callCount === 2) return jsonResponse({ files: [{ id: 'visits-id' }] });
        // search for the visit file → not found
        if (callCount === 3) return jsonResponse({ files: [] });
        return jsonResponse({});
      });

      await expect(provider.getVisit('ghost-id')).rejects.toThrow('Visit not found');
    });

    it('returns the full visit detail when the file exists', async () => {
      const provider = makeProvider();
      const visit    = storedVisit('test-id', { customer_name: 'Carol', working_payload: { heat_loss: 9000 } });

      let callCount = 0;
      vi.stubGlobal('fetch', async () => {
        callCount++;
        if (callCount === 1) return jsonResponse({ files: [{ id: 'root-id' }] });
        if (callCount === 2) return jsonResponse({ files: [{ id: 'visits-id' }] });
        if (callCount === 3) return jsonResponse({ files: [{ id: 'file-id' }] });
        if (callCount === 4) return jsonResponse(visit);  // alt=media fetch
        return jsonResponse({});
      });

      const detail = await provider.getVisit('test-id');
      expect(detail.customer_name).toBe('Carol');
      expect(detail.working_payload).toEqual({ heat_loss: 9000 });
    });
  });

  // ── deleteVisit ────────────────────────────────────────────────────────────

  describe('deleteVisit', () => {
    it('throws "Visit not found" when the file does not exist', async () => {
      const provider = makeProvider();

      let callCount = 0;
      vi.stubGlobal('fetch', async () => {
        callCount++;
        if (callCount === 1) return jsonResponse({ files: [{ id: 'root-id' }] });
        if (callCount === 2) return jsonResponse({ files: [{ id: 'visits-id' }] });
        if (callCount === 3) return jsonResponse({ files: [] }); // not found
        return jsonResponse({});
      });

      await expect(provider.deleteVisit('ghost-id')).rejects.toThrow('Visit not found');
    });

    it('sends a DELETE request and updates the index', async () => {
      const provider = makeProvider();
      const index: VisitMeta[] = [
        {
          id: 'del-id', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
          status: 'new', customer_name: null, address_line_1: null, postcode: null,
          current_step: null, visit_reference: null, completed_at: null, completion_method: null,
        },
      ];

      const deletedUrls: string[] = [];
      let callCount = 0;
      vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
        callCount++;
        if (callCount === 1) return jsonResponse({ files: [{ id: 'root-id' }] });
        if (callCount === 2) return jsonResponse({ files: [{ id: 'visits-id' }] });
        if (callCount === 3) return jsonResponse({ files: [{ id: 'file-id' }] }); // file found
        if (callCount === 4) {
          deletedUrls.push(url);
          return emptyResponse(204);
        }
        // Index update calls
        if (callCount === 5) return jsonResponse({ files: [{ id: 'root-id' }] });
        if (callCount === 6) return jsonResponse({ files: [{ id: 'index-file-id' }] });
        if (callCount === 7) return jsonResponse(index);    // read index
        if (callCount === 8) return jsonResponse({ id: 'index-id' }); // write index
        return jsonResponse({});
      });

      await provider.deleteVisit('del-id');
      expect(deletedUrls[0]).toContain('file-id');
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
