/**
 * GoogleDriveWorkspaceProvider.ts
 *
 * WorkspaceProvider implementation backed by the user's Google Drive.
 *
 * Storage layout
 * ──────────────
 * All visits are stored in an application-specific folder on the user's
 * Google Drive.  The folder is created on first use if it does not exist.
 *
 *   Drive root
 *   └── Atlas Mind Workspace/
 *       ├── visits/
 *       │   ├── <uuid>.json   ← one file per visit
 *       │   └── …
 *       └── index.json        ← lightweight index (list of VisitMeta objects)
 *
 * The index file is kept in sync on every create / save / delete so that
 * listVisits() can return instantly without fetching all individual files.
 *
 * Authentication
 * ──────────────
 * Uses Authorization Code + PKCE (RFC 7636) via DriveOAuthClient.
 * No client secret is included in the application bundle.
 *
 * Required Google OAuth scopes:
 *   https://www.googleapis.com/auth/drive.file
 *
 * Architecture rules
 * ──────────────────
 * - No dependency on IndexedDB or any local storage backend.
 * - Implements the same WorkspaceProvider interface as LocalWorkspaceProvider,
 *   so callers need no changes.
 * - All visit operations mirror the LocalWorkspaceProvider behaviour exactly:
 *   same error messages, same field defaults.
 */

import type { WorkspaceProvider, CreateVisitOpts, VisitPatch } from './WorkspaceProvider';
import type { VisitMeta, VisitDetail }                          from '../visits/visitApi';
import { DriveOAuthClient }                                     from './DriveOAuthClient';
import type { OAuthConfig }                                     from './DriveOAuthClient';

// ─── Google Drive REST constants ──────────────────────────────────────────────

const DRIVE_FILES_API  = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const MIME_JSON        = 'application/json';
const MIME_FOLDER      = 'application/vnd.google-apps.folder';

/** Name of the Atlas-specific root folder on Google Drive. */
const ROOT_FOLDER_NAME   = 'Atlas Mind Workspace';
/** Name of the sub-folder that holds per-visit JSON files. */
const VISITS_FOLDER_NAME = 'visits';
/** Name of the lightweight list-of-visits index file. */
const INDEX_FILE_NAME    = 'index.json';

// ─── Stored shape ─────────────────────────────────────────────────────────────

/** The shape written into each per-visit JSON file on Drive. */
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
 * Default OAuth configuration for Google Drive access.
 *
 * Replace `clientId` and `redirectUri` with the values from your
 * Google Cloud OAuth 2.0 client registration.
 *
 * The `redirectUri` must be an exact match for the URI registered in the
 * Google Cloud Console for your OAuth 2.0 client.
 */
export const GOOGLE_DRIVE_OAUTH_DEFAULTS: OAuthConfig = {
  clientId:      '',   // Set at integration time
  authEndpoint:  'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  redirectUri:   typeof window !== 'undefined' ? window.location.origin + '/oauth/google' : '',
  scopes:        'https://www.googleapis.com/auth/drive.file',
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

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * GoogleDriveWorkspaceProvider
 *
 * Persists visits as JSON files in the user's Google Drive.
 * Implements the full WorkspaceProvider interface; no call-site changes needed.
 *
 * @example
 * const provider = new GoogleDriveWorkspaceProvider({
 *   clientId:   'YOUR_CLIENT_ID.apps.googleusercontent.com',
 *   redirectUri: 'https://your-app.example.com/oauth/google',
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
export class GoogleDriveWorkspaceProvider implements WorkspaceProvider {
  private readonly oauth: DriveOAuthClient;

  /** Cached Drive folder IDs to avoid repeated API lookups. */
  private _rootFolderId:   string | null = null;
  private _visitsFolderId: string | null = null;
  private _indexFileId:    string | null = null;

  constructor(config?: Partial<OAuthConfig>) {
    const merged = { ...GOOGLE_DRIVE_OAUTH_DEFAULTS, ...config };
    if (!merged.clientId) {
      throw new Error(
        'GoogleDriveWorkspaceProvider: clientId is required. ' +
        'Provide your Google Cloud OAuth 2.0 client ID when constructing the provider.',
      );
    }
    this.oauth = new DriveOAuthClient(merged);
  }

  // ── Authentication shortcuts ─────────────────────────────────────────────

  /** Redirect the user to Google's OAuth consent screen. */
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
    this._rootFolderId   = null;
    this._visitsFolderId = null;
    this._indexFileId    = null;
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
    const token      = await this.oauth.getAccessToken();
    const folderId   = await this._ensureVisitsFolder();
    const fileId     = await this._findFileId(`${id}.json`, folderId);
    if (!fileId) throw new Error('Visit not found');

    const response = await fetch(
      `${DRIVE_FILES_API}/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (response.status === 404) throw new Error('Visit not found');
    if (!response.ok) throw new Error(`Google Drive read failed (${response.status})`);

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
    const token      = await this.oauth.getAccessToken();
    const folderId   = await this._ensureVisitsFolder();
    const fileId     = await this._findFileId(`${id}.json`, folderId);
    if (!fileId) throw new Error('Visit not found');

    const response = await fetch(`${DRIVE_FILES_API}/${fileId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) throw new Error('Visit not found');
    if (!response.ok && response.status !== 204) {
      throw new Error(`Google Drive delete failed (${response.status})`);
    }

    await this._removeFromIndex(id);
  }

  // ── Drive folder/file helpers ────────────────────────────────────────────

  private async _ensureRootFolder(): Promise<string> {
    if (this._rootFolderId) return this._rootFolderId;
    const token = await this.oauth.getAccessToken();

    // Look for an existing Atlas Mind Workspace folder.
    const existing = await this._findFileId(ROOT_FOLDER_NAME, null, MIME_FOLDER);
    if (existing) {
      this._rootFolderId = existing;
      return existing;
    }

    // Create it.
    const response = await fetch(DRIVE_FILES_API, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': MIME_JSON,
      },
      body: JSON.stringify({ name: ROOT_FOLDER_NAME, mimeType: MIME_FOLDER }),
    });
    if (!response.ok) throw new Error(`Google Drive folder create failed (${response.status})`);
    const data = await response.json() as { id: string };
    this._rootFolderId = data.id;
    return data.id;
  }

  private async _ensureVisitsFolder(): Promise<string> {
    if (this._visitsFolderId) return this._visitsFolderId;
    const rootId = await this._ensureRootFolder();
    const token  = await this.oauth.getAccessToken();

    const existing = await this._findFileId(VISITS_FOLDER_NAME, rootId, MIME_FOLDER);
    if (existing) {
      this._visitsFolderId = existing;
      return existing;
    }

    const response = await fetch(DRIVE_FILES_API, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': MIME_JSON,
      },
      body: JSON.stringify({
        name:     VISITS_FOLDER_NAME,
        mimeType: MIME_FOLDER,
        parents:  [rootId],
      }),
    });
    if (!response.ok) throw new Error(`Google Drive visits folder create failed (${response.status})`);
    const data = await response.json() as { id: string };
    this._visitsFolderId = data.id;
    return data.id;
  }

  /**
   * Find a Drive file or folder by name and optional parent folder ID.
   * Returns the Drive file ID or null if not found.
   */
  private async _findFileId(
    name: string,
    parentId: string | null,
    mimeType?: string,
  ): Promise<string | null> {
    const token = await this.oauth.getAccessToken();

    let q = `name = '${name}' and trashed = false`;
    if (parentId) q += ` and '${parentId}' in parents`;
    if (mimeType) q += ` and mimeType = '${mimeType}'`;

    const params = new URLSearchParams({ q, fields: 'files(id)', spaces: 'drive' });
    const response = await fetch(`${DRIVE_FILES_API}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Google Drive search failed (${response.status})`);

    const data = await response.json() as { files: { id: string }[] };
    return data.files[0]?.id ?? null;
  }

  /** Write (create or update) a single visit file. */
  private async _writeVisitFile(stored: StoredVisit): Promise<void> {
    const token      = await this.oauth.getAccessToken();
    const folderId   = await this._ensureVisitsFolder();
    const fileName   = `${stored.id}.json`;
    const body       = JSON.stringify(stored);
    const existingId = await this._findFileId(fileName, folderId);

    if (existingId) {
      // Patch-upload to update content.
      const response = await fetch(`${DRIVE_UPLOAD_API}/${existingId}?uploadType=media`, {
        method:  'PATCH',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': MIME_JSON,
        },
        body,
      });
      if (!response.ok) throw new Error(`Google Drive write failed (${response.status})`);
    } else {
      // Multipart upload to set metadata + content in one request.
      const metadata  = JSON.stringify({ name: fileName, parents: [folderId] });
      const boundary  = 'atlas_boundary';
      const multipart =
        `--${boundary}\r\nContent-Type: ${MIME_JSON}\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: ${MIME_JSON}\r\n\r\n${body}\r\n` +
        `--${boundary}--`;

      const response = await fetch(`${DRIVE_UPLOAD_API}?uploadType=multipart`, {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
      });
      if (!response.ok) throw new Error(`Google Drive upload failed (${response.status})`);
    }
  }

  // ── Index helpers ────────────────────────────────────────────────────────

  private async _readIndex(): Promise<VisitMeta[]> {
    const token    = await this.oauth.getAccessToken();
    const rootId   = await this._ensureRootFolder();
    const fileId   = await this._findFileId(INDEX_FILE_NAME, rootId);
    if (!fileId) return [];

    this._indexFileId = fileId;
    const response = await fetch(`${DRIVE_FILES_API}/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
    const rootId = await this._ensureRootFolder();
    const body   = JSON.stringify(index);

    if (this._indexFileId) {
      const response = await fetch(
        `${DRIVE_UPLOAD_API}/${this._indexFileId}?uploadType=media`,
        {
          method:  'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': MIME_JSON },
          body,
        },
      );
      if (!response.ok) throw new Error(`Google Drive index write failed (${response.status})`);
    } else {
      const metadata  = JSON.stringify({ name: INDEX_FILE_NAME, parents: [rootId] });
      const boundary  = 'atlas_boundary';
      const multipart =
        `--${boundary}\r\nContent-Type: ${MIME_JSON}\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: ${MIME_JSON}\r\n\r\n${body}\r\n` +
        `--${boundary}--`;

      const response = await fetch(`${DRIVE_UPLOAD_API}?uploadType=multipart`, {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
      });
      if (!response.ok) throw new Error(`Google Drive index create failed (${response.status})`);
      const data = await response.json() as { id: string };
      this._indexFileId = data.id;
    }
  }
}
