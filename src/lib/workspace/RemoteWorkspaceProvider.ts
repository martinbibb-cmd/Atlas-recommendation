/**
 * RemoteWorkspaceProvider.ts
 *
 * WorkspaceProvider implementation that delegates to the Cloudflare
 * /api/visits endpoints via the existing visitApi.ts client.
 *
 * Use this provider when Atlas Mind is operating in server-connected mode
 * (i.e. when a Cloudflare Workers backend with a D1 database is available).
 *
 * Architecture rules
 * ──────────────────
 * - This file is a thin adapter — all logic lives in visitApi.ts.
 * - No IndexedDB or localStorage access.
 * - The same error messages from visitApi.ts are propagated unchanged so
 *   callers cannot distinguish between local and remote implementations
 *   without inspecting the provider type.
 */

import type { WorkspaceProvider, CreateVisitOpts, VisitPatch } from './WorkspaceProvider';
import type { VisitMeta, VisitDetail } from '../visits/visitApi';
import {
  listVisits as apiListVisits,
  getVisit as apiGetVisit,
  createVisit as apiCreateVisit,
  saveVisit as apiSaveVisit,
  deleteVisit as apiDeleteVisit,
} from '../visits/visitApi';

/**
 * RemoteWorkspaceProvider
 *
 * Delegates all visit CRUD operations to the Cloudflare /api/visits backend.
 * Intended for use when the application is running with a full server stack.
 */
export class RemoteWorkspaceProvider implements WorkspaceProvider {
  async listVisits(): Promise<VisitMeta[]> {
    return apiListVisits();
  }

  async getVisit(id: string): Promise<VisitDetail> {
    return apiGetVisit(id);
  }

  async createVisit(opts: CreateVisitOpts = {}): Promise<{ ok: true; id: string }> {
    return apiCreateVisit(opts);
  }

  async saveVisit(id: string, patch: VisitPatch): Promise<void> {
    return apiSaveVisit(id, patch);
  }

  async deleteVisit(id: string): Promise<void> {
    return apiDeleteVisit(id);
  }
}
