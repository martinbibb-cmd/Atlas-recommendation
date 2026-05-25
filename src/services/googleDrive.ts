/**
 * googleDrive.ts  (client-side)
 *
 * Thin client-side service that communicates with the Atlas Cloudflare Worker
 * endpoints for Google Drive integration.
 *
 * This module does NOT call Google's APIs directly.  All OAuth flow and Drive
 * API calls are handled server-side by the Cloudflare Worker to keep the
 * client secret and access tokens out of the browser.
 *
 * Usage
 * ─────
 *   // 1. Connect Google Drive (redirects to Google OAuth consent screen):
 *   connectGoogleDrive(userId);
 *
 *   // 2. After the OAuth redirect returns, check the URL for the result:
 *   const status = getGoogleDriveAuthStatus();  // 'connected' | 'denied' | 'error' | null
 *
 *   // 3. Finalize a visit (push data + optional PDF to Drive):
 *   const result = await finalizeVisit({ visitId, userId, pdfBase64 });
 *   if (result.ok) {
 *     window.open(result.ledger.drive_folder_url);
 *   }
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FinalizeSurveyOptions {
  /** The Atlas visit ID (UUID). */
  visitId:    string;
  /** The Firebase UID of the current user. */
  userId:     string;
  /** Optional base64-encoded PDF to upload alongside the JSON data file. */
  pdfBase64?: string;
}

export interface FinalizeSuccessResult {
  ok:     true;
  ledger: {
    /** D1 ledger row ID. */
    id:                  string;
    /** Browser link to the survey sub-folder in Google Drive. */
    drive_folder_url:    string;
    /** Browser link to the canonical JSON data file. */
    drive_data_file_url: string;
    /** Browser link to the customer PDF, or null if not uploaded. */
    drive_pdf_file_url:  string | null;
  };
}

export interface FinalizeErrorResult {
  ok:     false;
  error:  string;
  /** Machine-readable code for specific error conditions. */
  code?:  string;
}

export type FinalizeResult = FinalizeSuccessResult | FinalizeErrorResult;

// ─── Google Drive OAuth status ─────────────────────────────────────────────────

/**
 * Read the Google Drive OAuth result from the current page URL.
 *
 * The OAuth callback endpoint appends `?google_drive=<status>` to the
 * redirect URL after the flow completes.
 *
 * Returns:
 *   'connected' — Drive was connected successfully.
 *   'denied'    — The user declined the OAuth consent screen.
 *   'error'     — The server encountered an error during the flow.
 *   null        — No OAuth result is present in the URL.
 */
export function getGoogleDriveAuthStatus(): 'connected' | 'denied' | 'error' | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('google_drive');
  if (value === 'connected' || value === 'denied' || value === 'error') return value;
  return null;
}

// ─── Connect Google Drive ──────────────────────────────────────────────────────

/**
 * Initiate the Google Drive OAuth flow by redirecting the user to the Atlas
 * OAuth initiation endpoint (`/api/auth/google`).
 *
 * The server will generate a CSRF-safe state token and redirect the user to
 * Google's consent screen.  After approval, Google redirects back to
 * `/api/auth/google/callback` which stores the tokens in D1 and redirects
 * the user to the `returnTo` path with `?google_drive=connected`.
 *
 * @param userId   - Firebase UID of the current user.
 * @param returnTo - Optional path to return to after auth (default: current path).
 */
export function connectGoogleDrive(userId: string, returnTo?: string): void {
  const params = new URLSearchParams({ user_id: userId });
  if (returnTo) params.set('return_to', returnTo);
  window.location.href = `/api/auth/google?${params.toString()}`;
}

// ─── Finalize survey ───────────────────────────────────────────────────────────

/**
 * Finalize a visit by pushing its data to the user's Google Drive.
 *
 * Calls `POST /api/visits/:id/finalize` on the Atlas Cloudflare Worker, which:
 *   1. Compiles the canonical JSON data contract from the D1 working payload.
 *   2. Creates an "Atlas Surveys/<Survey Name>" folder in the user's Drive.
 *   3. Uploads the JSON data file (and optional PDF) to that folder.
 *   4. Records the resulting Drive URLs in the D1 survey ledger.
 *   5. Marks the visit as "finalized" in D1.
 *
 * Returns `{ ok: true, ledger }` on success or `{ ok: false, error, code }` on failure.
 *
 * Common error codes:
 *   DRIVE_NOT_CONNECTED   — The user has not connected Google Drive yet.
 *                           Call `connectGoogleDrive(userId)` to initiate the flow.
 *   DRIVE_TOKEN_EXPIRED   — The token has expired and has no refresh token.
 *                           Re-connect with `connectGoogleDrive(userId)`.
 */
export async function finalizeVisit(options: FinalizeSurveyOptions): Promise<FinalizeResult> {
  const { visitId, userId, pdfBase64 } = options;

  const body: Record<string, unknown> = { user_id: userId };
  if (pdfBase64) body.pdf_base64 = pdfBase64;

  let response: Response;
  try {
    response = await fetch(`/api/visits/${encodeURIComponent(visitId)}/finalize`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, error: `Network error: ${String(err)}` };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: `Unexpected response from server (${response.status})` };
  }

  if (!response.ok) {
    const errBody = json as Record<string, unknown>;
    return {
      ok:    false,
      error: typeof errBody.error === 'string' ? errBody.error : `Server error (${response.status})`,
      code:  typeof errBody.code  === 'string' ? errBody.code  : undefined,
    };
  }

  return json as FinalizeSuccessResult;
}
