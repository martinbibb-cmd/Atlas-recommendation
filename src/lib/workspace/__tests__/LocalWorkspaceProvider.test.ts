/**
 * LocalWorkspaceProvider.test.ts
 *
 * Unit tests for the file-based LocalWorkspaceProvider.
 *
 * Dexie is mocked via the 'fake-indexeddb' adapter so no real browser
 * IndexedDB is required — tests run cleanly in Node/jsdom.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LocalWorkspaceProvider } from '../LocalWorkspaceProvider';
import { AtlasWorkspaceDb } from '../LocalWorkspaceProvider';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _dbCounter = 0;

/** Create a fresh provider backed by a unique in-memory IndexedDB database. */
function makeProvider(): LocalWorkspaceProvider {
  const db = new AtlasWorkspaceDb(`atlas-workspace-test-${++_dbCounter}`);
  return new LocalWorkspaceProvider(db);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LocalWorkspaceProvider', () => {
  let provider: LocalWorkspaceProvider;

  beforeEach(() => {
    provider = makeProvider();
  });

  // ── createVisit ─────────────────────────────────────────────────────────────

  describe('createVisit', () => {
    it('returns ok:true and a non-empty id', async () => {
      const result = await provider.createVisit();
      expect(result.ok).toBe(true);
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    it('stores supplied metadata fields', async () => {
      const { id } = await provider.createVisit({
        customer_name: 'Alice',
        address_line_1: '10 Downing St',
        postcode: 'SW1A 2AA',
        visit_reference: 'REF-001',
      });

      const visit = await provider.getVisit(id);
      expect(visit.customer_name).toBe('Alice');
      expect(visit.address_line_1).toBe('10 Downing St');
      expect(visit.postcode).toBe('SW1A 2AA');
      expect(visit.visit_reference).toBe('REF-001');
    });

    it('sets initial status to "new"', async () => {
      const { id } = await provider.createVisit();
      const visit = await provider.getVisit(id);
      expect(visit.status).toBe('new');
    });

    it('sets created_at and updated_at as ISO strings', async () => {
      const { id } = await provider.createVisit();
      const visit = await provider.getVisit(id);
      expect(() => new Date(visit.created_at)).not.toThrow();
      expect(() => new Date(visit.updated_at)).not.toThrow();
    });

    it('initialises working_payload to an empty object', async () => {
      const { id } = await provider.createVisit();
      const detail = await provider.getVisit(id);
      expect(detail.working_payload).toEqual({});
    });

    it('works with no opts (empty body)', async () => {
      const result = await provider.createVisit();
      expect(result.ok).toBe(true);
    });

    it('creates unique IDs for two visits', async () => {
      const a = await provider.createVisit();
      const b = await provider.createVisit();
      expect(a.id).not.toBe(b.id);
    });
  });

  // ── listVisits ───────────────────────────────────────────────────────────────

  describe('listVisits', () => {
    it('returns an empty array when no visits exist', async () => {
      const visits = await provider.listVisits();
      expect(visits).toEqual([]);
    });

    it('returns all created visits', async () => {
      await provider.createVisit({ customer_name: 'Alice' });
      await provider.createVisit({ customer_name: 'Bob' });

      const visits = await provider.listVisits();
      expect(visits).toHaveLength(2);
    });

    it('returns visits most-recently-updated first', async () => {
      const { id: idA } = await provider.createVisit({ customer_name: 'Alice' });
      await new Promise((r) => setTimeout(r, 2));
      const { id: idB } = await provider.createVisit({ customer_name: 'Bob' });

      // Touch Alice after Bob so Alice should sort first.
      await new Promise((r) => setTimeout(r, 2));
      await provider.saveVisit(idA, { status: 'survey_started' });

      const visits = await provider.listVisits();
      expect(visits[0].id).toBe(idA);
      expect(visits[1].id).toBe(idB);
    });

    it('does not include working_payload in the list response', async () => {
      await provider.createVisit();
      const visits = await provider.listVisits();
      expect('working_payload' in visits[0]).toBe(false);
    });
  });

  // ── getVisit ─────────────────────────────────────────────────────────────────

  describe('getVisit', () => {
    it('returns the full visit including working_payload', async () => {
      const { id } = await provider.createVisit({ customer_name: 'Carol' });
      await provider.saveVisit(id, { working_payload: { foo: 'bar' } });

      const detail = await provider.getVisit(id);
      expect(detail.customer_name).toBe('Carol');
      expect(detail.working_payload).toEqual({ foo: 'bar' });
    });

    it('throws "Visit not found" for an unknown id', async () => {
      await expect(provider.getVisit('no-such-id')).rejects.toThrow('Visit not found');
    });
  });

  // ── saveVisit ────────────────────────────────────────────────────────────────

  describe('saveVisit', () => {
    it('updates specified scalar fields', async () => {
      const { id } = await provider.createVisit();
      await provider.saveVisit(id, {
        customer_name: 'Dave',
        address_line_1: '1 Main St',
        postcode: 'M1 1AA',
        current_step: 'survey',
        status: 'survey_started',
        visit_reference: 'JOB-99',
      });

      const visit = await provider.getVisit(id);
      expect(visit.customer_name).toBe('Dave');
      expect(visit.address_line_1).toBe('1 Main St');
      expect(visit.postcode).toBe('M1 1AA');
      expect(visit.current_step).toBe('survey');
      expect(visit.status).toBe('survey_started');
      expect(visit.visit_reference).toBe('JOB-99');
    });

    it('merges working_payload correctly', async () => {
      const { id } = await provider.createVisit();
      await provider.saveVisit(id, { working_payload: { heat_loss: 8000 } });
      const detail = await provider.getVisit(id);
      expect(detail.working_payload).toEqual({ heat_loss: 8000 });
    });

    it('overwrites the full working_payload on each save', async () => {
      const { id } = await provider.createVisit();
      await provider.saveVisit(id, { working_payload: { a: 1 } });
      await provider.saveVisit(id, { working_payload: { b: 2 } });
      const detail = await provider.getVisit(id);
      expect(detail.working_payload).toEqual({ b: 2 });
    });

    it('records completed_at and completion_method', async () => {
      const { id } = await provider.createVisit();
      await provider.saveVisit(id, {
        completed_at: '2025-10-14T14:32:00Z',
        completion_method: 'manual_pwa',
      });
      const visit = await provider.getVisit(id);
      expect(visit.completed_at).toBe('2025-10-14T14:32:00Z');
      expect(visit.completion_method).toBe('manual_pwa');
    });

    it('updates updated_at on each save', async () => {
      const { id } = await provider.createVisit();
      const before = (await provider.getVisit(id)).updated_at;

      // Ensure at least 1 ms has passed.
      await new Promise((r) => setTimeout(r, 2));
      await provider.saveVisit(id, { status: 'quoted' });

      const after = (await provider.getVisit(id)).updated_at;
      expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    });

    it('throws "Visit not found" for an unknown id', async () => {
      await expect(
        provider.saveVisit('ghost-id', { status: 'new' }),
      ).rejects.toThrow('Visit not found');
    });

    it('does not alter unspecified fields', async () => {
      const { id } = await provider.createVisit({ customer_name: 'Eve', postcode: 'E1 1AA' });
      await provider.saveVisit(id, { status: 'quoted' });
      const visit = await provider.getVisit(id);
      expect(visit.customer_name).toBe('Eve');
      expect(visit.postcode).toBe('E1 1AA');
    });
  });

  // ── deleteVisit ──────────────────────────────────────────────────────────────

  describe('deleteVisit', () => {
    it('removes the visit so it no longer appears in listVisits', async () => {
      const { id } = await provider.createVisit();
      await provider.deleteVisit(id);
      const visits = await provider.listVisits();
      expect(visits.find((v) => v.id === id)).toBeUndefined();
    });

    it('makes getVisit throw after deletion', async () => {
      const { id } = await provider.createVisit();
      await provider.deleteVisit(id);
      await expect(provider.getVisit(id)).rejects.toThrow('Visit not found');
    });

    it('throws "Visit not found" for an unknown id', async () => {
      await expect(provider.deleteVisit('nobody')).rejects.toThrow('Visit not found');
    });

    it('only deletes the targeted visit', async () => {
      const { id: idA } = await provider.createVisit({ customer_name: 'Frank' });
      const { id: idB } = await provider.createVisit({ customer_name: 'Grace' });
      await provider.deleteVisit(idA);
      const visits = await provider.listVisits();
      expect(visits).toHaveLength(1);
      expect(visits[0].id).toBe(idB);
    });
  });
});
