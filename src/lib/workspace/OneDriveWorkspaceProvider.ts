/**
 * OneDriveWorkspaceProvider.ts
 *
 * WorkspaceProvider implementation backed by the user's Microsoft OneDrive
 * (via the Microsoft Graph API).
 *
 * Storage layout
 * ──────────────
 * Mirrors LocalWorkspaceProvider — one JSON file per visit, plus a lightweight
 * index file for fast listing.
 *
 *   OneDrive root
 *   └── Atlas Mind Workspace/
 *       ├── visits/
 *       │   ├── <uuid>.json   ← one file per visit
 *       │   └── …
 *       └── index.json        ← lightweight index (list of VisitMeta objects)
 *
 * Authentication
 * ──────────────
 * Uses Authorization Code + PKCE (RFC 7636) via DriveOAuthClient.
 * Supports both personal Microsoft accounts and Azure AD (work/school) accounts.
 * Use 'common' as the tenant to support both.
 *
 * Required Microsoft Graph permission:
 *   Files.ReadWrite
 *
 * Architecture rules
 * ──────────────────
 * - No dependency on IndexedDB or any local storage backend.
 * - Implements the same WorkspaceProvider interface as LocalWorkspaceProvider.
 * - All error messages match LocalWorkspaceProvider for transparent swapping.
 */

import type { WorkspaceProvider, CreateVisitOpts, VisitPatch } from './WorkspaceProvider';
import type { VisitMeta, VisitDetail }                          from '../visits/visitApi';
import { DriveOAuthClient }                                     from './DriveOAuthClient';
import type { OAuthConfig }                                     from './DriveOAuthClient';

// ─── Microsoft Graph constants ────────────────────────────────────────────────

const GRAPH_BASE   = 'https://graph.microsoft.com/v1.0/me/drive';
const GRAPH_ITEMS  = `${GRAPH_BASE}/root`;

/** Name of the Atlas-specific root folder on OneDrive. */
const ROOT_FOLDER_NAME   = 'Atlas Mind Workspace';
/** Name of the sub-folder that holds per-visit JSON files. */
const VISITS_FOLDER_NAME = 'visits';
/** Name of the lightweight list-of-visits index file. */
const INDEX_FILE_NAME    = 'index.json';

// ─── Stored shape ─────────────────────────────────────────────────────────────

interface StoredVisit {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  customer_name: string | null;
  address_line_1: string | null;
  postcode: string | null;
  current_step: string | null;
  visit_reference: string | null;
  completed_at: string | null;
  completion_method: string | null;
  working_payload: Record<string, unknown>;
}

// ─── Default OAuth config ─────────────────────────────────────────────────────

/**
 * Default OAuth configuration for Microsoft OneDrive access.
 *
 * Replace `clientId` with the Application (client) ID from your Azure app
 * registration.  `redirectUri` must exactly match the redirect URI you
 * registered in the Azure portal.
 *
 * The tenant is set to 'common' to accept both personal and work/school
 * Microsoft accounts.  Restrict to your tenant ID if needed.
 */
export const ONEDRIVE_OAUTH_DEFAULTS: OAuthConfig = {
  clientId:      '',   // Set at integration time
  authEndpoint:  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  redirectUri:   typeof window !== 'undefined' ? window.location.origin + '/oauth/microsoft' : '',
  scopes:        'Files.ReadWrite offline_access',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return crypto.randomUUID();
}

function toVisitMeta(stored: StoredVisit): VisitMeta {
  return {
    id:                stored.id,
    created_at:        stored.created_at,
    updated_at:        stored.updated_at,
    status:            stored.status,
    customer_name:     stored.customer_name,
    address_line_1:    stored.address_line_1,
    postcode:          stored.postcode,
    current_step:      stored.current_step,
    visit_reference:   stored.visit_reference,
    completed_at:      stored.completed_at,
    completion_method: stored.completion_method,
  };
}

/** Build a Graph API path segment for a file inside the workspace. */
function graphPath(...segments: string[]): string {
  // Encodes each path segment individually, then joins with ':/' notation.
  const encoded = segments.map(encodeURIComponent).join('/');
  return `${GRAPH_ITEMS}:/${encoded}:`;
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * OneDriveWorkspaceProvider
 *
 * Persists visits as JSON files in the user's Microsoft OneDrive.
 * Implements the full WorkspaceProvider interface; no call-site changes needed.
 *
 * @example
 * const provider = new OneDriveWorkspaceProvider({
 *   clientId:    'YOUR_AZURE_APP_CLIENT_ID',
 *   redirectUri: 'https://your-app.example.com/oauth/microsoft',
 * });
 *
 * // Trigger login (redirects the page):
 * await provider.signIn();
 *
 * // On the redirect-back page:
 * if (provider.isRedirectBack(window.location.href)) {
 *   await provider.handleOAuthRedirect(window.location.href);
 * }
 *
 * // Now use normally:
 * const visits = await provider.listVisits();
 */
export class OneDriveWorkspaceProvider implements WorkspaceProvider {
  private readonly oauth: DriveOAuthClient;

  constructor(config?: Partial<OAuthConfig>) {
    this.oauth = new DriveOAuthClient({
      ...ONEDRIVE_OAUTH_DEFAULTS,
      ...config,
    });
  }

  // ── Authentication shortcuts ─────────────────────────────────────────────

  /** Redirect the user to Microsoft's OAuth consent screen. */
  async signIn(): Promise<void> {
    await this.oauth.beginLogin();
  }

  /** True when an access token is available. */
  get isAuthenticated(): boolean {
    return this.oauth.isAuthenticated;
  }

  /**
   * Call this on the OAuth redirect-back page to exchange the code for a token.
   * Returns true when the redirect was handled successfully.
   */
  async handleOAuthRedirect(url: string): Promise<boolean> {
    if (!this.oauth.isRedirectBack(url)) return false;
    await this.oauth.handleRedirect(url);
    return true;
  }

  /** Remove the stored token (log out). */
  signOut(): void {
    this.oauth.signOut();
  }

  // ── WorkspaceProvider interface ──────────────────────────────────────────

  async listVisits(): Promise<VisitMeta[]> {
    const index = await this._readIndex();
    return index
      .slice()
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 50);
  }

  async getVisit(id: string): Promise<VisitDetail> {
    const token    = await this.oauth.getAccessToken();
    const url      = `${graphPath(ROOT_FOLDER_NAME, VISITS_FOLDER_NAME, `${id}.json`)}/content`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) throw new Error('Visit not found');
    if (!response.ok) throw new Error(`OneDrive read failed (${response.status})`);

    const stored = await response.json() as StoredVisit;
    return { ...toVisitMeta(stored), working_payload: stored.working_payload ?? {} };
  }

  async createVisit(opts: CreateVisitOpts = {}): Promise<{ ok: true; id: string }> {
    const id  = generateId();
    const now = nowIso();

    const stored: StoredVisit = {
      id,
      created_at:        now,
      updated_at:        now,
      status:            'new',
      customer_name:     opts.customer_name     ?? null,
      address_line_1:    opts.address_line_1    ?? null,
      postcode:          opts.postcode          ?? null,
      current_step:      null,
      visit_reference:   opts.visit_reference   ?? null,
      completed_at:      null,
      completion_method: null,
      working_payload:   {},
    };

    await this._writeVisitFile(stored);
    await this._upsertIndex(toVisitMeta(stored));

    return { ok: true, id };
  }

  async saveVisit(id: string, patch: VisitPatch): Promise<void> {
    const existing = await this.getVisit(id);

    const updated: StoredVisit = {
      id:                existing.id,
      created_at:        existing.created_at,
      updated_at:        nowIso(),
      status:            patch.status            !== undefined ? patch.status                     : existing.status,
      customer_name:     patch.customer_name     !== undefined ? (patch.customer_name     ?? null) : existing.customer_name,
      address_line_1:    patch.address_line_1    !== undefined ? (patch.address_line_1    ?? null) : existing.address_line_1,
      postcode:          patch.postcode          !== undefined ? (patch.postcode          ?? null) : existing.postcode,
      current_step:      patch.current_step      !== undefined ? (patch.current_step      ?? null) : existing.current_step,
      visit_reference:   patch.visit_reference   !== undefined ? (patch.visit_reference   ?? null) : existing.visit_reference,
      completed_at:      patch.completed_at      !== undefined ? (patch.completed_at      ?? null) : existing.completed_at,
      completion_method: patch.completion_method !== undefined ? (patch.completion_method ?? null) : existing.completion_method,
      working_payload:   patch.working_payload   !== undefined ? patch.working_payload            : existing.working_payload,
    };

    await this._writeVisitFile(updated);
    await this._upsertIndex(toVisitMeta(updated));
  }

  async deleteVisit(id: string): Promise<void> {
    const token    = await this.oauth.getAccessToken();
    const url      = `${graphPath(ROOT_FOLDER_NAME, VISITS_FOLDER_NAME, `${id}.json`)}`;

    const response = await fetch(url, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) throw new Error('Visit not found');
    if (!response.ok && response.status !== 204) {
      throw new Error(`OneDrive delete failed (${response.status})`);
    }

    await this._removeFromIndex(id);
  }

  // ── File helpers ─────────────────────────────────────────────────────────

  /** Write (create or update) a single visit JSON file. */
  private async _writeVisitFile(stored: StoredVisit): Promise<void> {
    const token    = await this.oauth.getAccessToken();
    const url      = `${graphPath(ROOT_FOLDER_NAME, VISITS_FOLDER_NAME, `${stored.id}.json`)}/content`;

    // PUT with @microsoft.graph.conflictBehavior=replace creates or overwrites.
    const response = await fetch(`${url}?@microsoft.graph.conflictBehavior=replace`, {
      method:  'PUT',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stored),
    });
    if (!response.ok) throw new Error(`OneDrive write failed (${response.status})`);
  }

  // ── Index helpers ────────────────────────────────────────────────────────

  private async _readIndex(): Promise<VisitMeta[]> {
    const token    = await this.oauth.getAccessToken();
    const url      = `${graphPath(ROOT_FOLDER_NAME, INDEX_FILE_NAME)}/content`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) return [];
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data as VisitMeta[] : [];
  }

  private async _upsertIndex(meta: VisitMeta): Promise<void> {
    const token   = await this.oauth.getAccessToken();
    const current = await this._readIndex();
    const next    = [meta, ...current.filter((v) => v.id !== meta.id)];
    await this._writeIndex(token, next);
  }

  private async _removeFromIndex(id: string): Promise<void> {
    const token   = await this.oauth.getAccessToken();
    const current = await this._readIndex();
    const next    = current.filter((v) => v.id !== id);
    await this._writeIndex(token, next);
  }

  private async _writeIndex(token: string, index: VisitMeta[]): Promise<void> {
    const url = `${graphPath(ROOT_FOLDER_NAME, INDEX_FILE_NAME)}/content`;

    const response = await fetch(`${url}?@microsoft.graph.conflictBehavior=replace`, {
      method:  'PUT',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(index),
    });
    if (!response.ok) throw new Error(`OneDrive index write failed (${response.status})`);
  }
}
