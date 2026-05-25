/**
 * googleDrive.ts
 *
 * Server-side Google Drive service layer for Atlas.
 *
 * Responsibilities
 * ────────────────
 * 1. OAuth 2.0 helpers: build the authorization URL, exchange an
 *    authorization code for tokens, and refresh an expired access token.
 * 2. Drive folder management: ensure the "Atlas Surveys" root folder exists
 *    and create per-survey sub-folders.
 * 3. File upload helpers: upload the canonical visit JSON data file and an
 *    optional customer PDF to Google Drive via multipart upload.
 *
 * This module contains no I/O other than calls to Google's REST APIs — it
 * does not read from or write to D1 directly.  The caller (finalize.ts) is
 * responsible for persisting tokens and ledger rows in D1.
 *
 * Required Cloudflare secrets
 * ───────────────────────────
 *   GOOGLE_CLIENT_ID      — OAuth 2.0 client ID from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET  — OAuth 2.0 client secret (never exposed to the browser)
 *
 * Google OAuth scopes used
 * ────────────────────────
 *   https://www.googleapis.com/auth/drive.file
 *   (application-only access — Atlas can only see files it creates)
 */

// ─── API endpoints ─────────────────────────────────────────────────────────────

export const GOOGLE_AUTH_ENDPOINT  = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const DRIVE_FILES_API       = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_UPLOAD_API      = 'https://www.googleapis.com/upload/drive/v3/files';

/** The Drive scope that limits access to files created by this application. */
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Name of the root folder created in the user's Google Drive. */
export const ATLAS_SURVEYS_FOLDER_NAME = 'Atlas Surveys';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleTokenResponse {
  access_token:   string;
  /** Only present on the initial code exchange, not on token refresh. */
  refresh_token?: string;
  /** Lifetime in seconds (typically 3600). */
  expires_in:     number;
  token_type:     string;
  scope:          string;
}

/** Minimal Drive file/folder reference returned after create/upload. */
export interface DriveFileRef {
  /** Google Drive file ID. */
  id:          string;
  /** Browser-friendly URL to view the file or folder in Drive. */
  webViewLink: string;
}

// ─── OAuth helpers ─────────────────────────────────────────────────────────────

/**
 * Build the Google OAuth 2.0 authorization URL that the user is redirected to.
 *
 * @param clientId    - GOOGLE_CLIENT_ID environment variable
 * @param redirectUri - Must exactly match a URI registered in Google Cloud Console
 * @param state       - Random token stored in KV for CSRF prevention
 */
export function buildAuthUrl(
  clientId:    string,
  redirectUri: string,
  state:       string,
): string {
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         DRIVE_FILE_SCOPE,
    access_type:   'offline',
    prompt:        'consent',  // force refresh_token to be returned every time
    state,
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchange an authorization code for Google access and refresh tokens.
 *
 * Called once per user after they complete the OAuth consent screen.
 * Store the returned tokens in D1 (`user_oauth_tokens`).
 */
export async function exchangeCodeForTokens(
  code:         string,
  clientId:     string,
  clientSecret: string,
  redirectUri:  string,
): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

/**
 * Use a stored refresh token to obtain a fresh access token.
 *
 * Returns the new access token and its absolute expiry as an ISO-8601 string.
 * Call this when `expires_at` in D1 is in the past.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId:     string,
  clientSecret: string,
): Promise<{ accessToken: string; expiresAt: string }> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token refresh failed (${response.status}): ${text}`);
  }

  const data = await response.json() as GoogleTokenResponse;
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  return { accessToken: data.access_token, expiresAt };
}

// ─── Drive folder helpers ──────────────────────────────────────────────────────

/**
 * Find a Drive file or folder by name (and optional parent folder ID).
 * Returns the Drive file ID or null if not found.
 */
async function findFileId(
  token:     string,
  name:      string,
  parentId?: string,
  mimeType?: string,
): Promise<string | null> {
  // Escape single-quotes in the name to prevent query injection.
  const safeName = name.replace(/\\/g, '\\\\' ).replace(/'/g, "\\\'");
  let q = `name = '${safeName}' and trashed = false`;
  if (parentId) q += ` and '${parentId}' in parents`;
  if (mimeType) q += ` and mimeType = '${mimeType}'`;

  const params   = new URLSearchParams({ q, fields: 'files(id)', spaces: 'drive' });
  const response = await fetch(`${DRIVE_FILES_API}?${params.toString()}`, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!response.ok) throw new Error(`Drive search failed (${response.status})`);

  const data = await response.json() as { files: { id: string }[] };
  return data.files[0]?.id ?? null;
}

/**
 * Ensure the top-level "Atlas Surveys" folder exists in the user's Google Drive.
 *
 * Returns the folder ID.  Creates the folder if it does not already exist.
 * Subsequent calls reuse the existing folder (Drive deduplication is handled
 * server-side by searching before creating).
 */
export async function ensureAtlasSurveysFolder(token: string): Promise<string> {
  const MIME_FOLDER = 'application/vnd.google-apps.folder';

  const existing = await findFileId(token, ATLAS_SURVEYS_FOLDER_NAME, undefined, MIME_FOLDER);
  if (existing) return existing;

  const response = await fetch(DRIVE_FILES_API, {
    method:  'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ATLAS_SURVEYS_FOLDER_NAME, mimeType: MIME_FOLDER }),
  });
  if (!response.ok) throw new Error(`Drive root folder create failed (${response.status})`);

  const data = await response.json() as { id: string };
  return data.id;
}

/**
 * Create a survey-specific sub-folder inside the "Atlas Surveys" root folder.
 *
 * The folder is named after the survey (e.g. "Smith - EH1 1AB - 2025-05-25").
 * Returns the new folder's Drive ID and a browser-viewable link.
 */
export async function createSurveySubFolder(
  token:          string,
  folderName:     string,
  parentFolderId: string,
): Promise<DriveFileRef> {
  const MIME_FOLDER = 'application/vnd.google-apps.folder';

  const response = await fetch(`${DRIVE_FILES_API}?fields=id,webViewLink`, {
    method:  'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:     folderName,
      mimeType: MIME_FOLDER,
      parents:  [parentFolderId],
    }),
  });
  if (!response.ok) throw new Error(`Drive survey folder create failed (${response.status})`);

  const data = await response.json() as { id: string; webViewLink?: string };
  return {
    id:          data.id,
    webViewLink: data.webViewLink ?? `https://drive.google.com/drive/folders/${data.id}`,
  };
}

// ─── File upload helpers ───────────────────────────────────────────────────────

/**
 * Upload a JSON string as a file to Google Drive using multipart upload.
 *
 * Returns the Drive file ID and a browser-viewable link.
 */
export async function uploadJsonFile(
  token:    string,
  fileName: string,
  content:  string,
  parentId: string,
): Promise<DriveFileRef> {
  const MIME_JSON = 'application/json';
  const boundary  = 'atlas_json_boundary';
  const metadata  = JSON.stringify({ name: fileName, parents: [parentId] });
  const body      =
    `--${boundary}\r\nContent-Type: ${MIME_JSON}\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${MIME_JSON}\r\n\r\n${content}\r\n` +
    `--${boundary}--`;

  const response = await fetch(
    `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,webViewLink`,
    {
      method:  'POST',
      headers: {
        Authorization:  'Bearer ' + token,
        'Content-Type': 'multipart/related; boundary=' + boundary,
      },
      body,
    },
  );
  if (!response.ok) throw new Error(`Drive JSON upload failed (${response.status})`);

  const data = await response.json() as { id: string; webViewLink?: string };
  return {
    id:          data.id,
    webViewLink: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view`,
  };
}

/**
 * Upload a PDF (binary) to Google Drive using multipart upload.
 *
 * The PDF bytes are provided as a base64-encoded string (as received from the
 * client request body) and decoded server-side before upload.
 *
 * Returns the Drive file ID and a browser-viewable link.
 */
export async function uploadPdfFile(
  token:     string,
  fileName:  string,
  pdfBase64: string,
  parentId:  string,
): Promise<DriveFileRef> {
  const MIME_JSON = 'application/json';
  const MIME_PDF  = 'application/pdf';
  const boundary  = 'atlas_pdf_boundary';

  // Decode the base64 PDF into a Uint8Array.
  const binaryString = atob(pdfBase64);
  const pdfBytes     = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pdfBytes[i] = binaryString.charCodeAt(i);
  }

  const metadata   = JSON.stringify({ name: fileName, parents: [parentId] });
  const encoder    = new TextEncoder();
  const headerPart = encoder.encode(
    `--${boundary}\r\nContent-Type: ${MIME_JSON}\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${MIME_PDF}\r\n\r\n`,
  );
  const footerPart = encoder.encode(`\r\n--${boundary}--`);

  const combined = new Uint8Array(headerPart.length + pdfBytes.length + footerPart.length);
  combined.set(headerPart);
  combined.set(pdfBytes,   headerPart.length);
  combined.set(footerPart, headerPart.length + pdfBytes.length);

  const response = await fetch(
    `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,webViewLink`,
    {
      method:  'POST',
      headers: {
        Authorization:  'Bearer ' + token,
        'Content-Type': 'multipart/related; boundary=' + boundary,
      },
      body: combined,
    },
  );
  if (!response.ok) throw new Error(`Drive PDF upload failed (${response.status})`);

  const data = await response.json() as { id: string; webViewLink?: string };
  return {
    id:          data.id,
    webViewLink: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view`,
  };
}
