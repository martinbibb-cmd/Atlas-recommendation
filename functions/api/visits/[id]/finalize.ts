import {
  refreshAccessToken,
  ensureAtlasSurveysFolder,
  createSurveySubFolder,
  uploadJsonFile,
  uploadPdfFile,
} from '../../services/googleDrive';
import { isMissingTableError, isMissingColumnError, SCHEMA_DRIFT_RESPONSE } from '../../_utils/errors';

/**
 * POST /api/visits/:id/finalize
 *
 * Finalizes a visit by pushing its data to the user's Google Drive and
 * recording the resulting Drive URLs in the D1 survey ledger.
 *
 * This is the "final handshake" step in the hybrid D1 + Google Drive
 * architecture:
 *   1. The active draft lives in D1 while the surveyor is working.
 *   2. When the user clicks "Finalize & Generate PDF", this endpoint:
 *        a. Loads the visit's working payload from D1.
 *        b. Retrieves and (if needed) refreshes the user's Google OAuth token.
 *        c. Creates an "Atlas Surveys/<Survey Name>" folder in the user's Drive.
 *        d. Uploads the canonical JSON data contract to that folder.
 *        e. Optionally uploads a customer PDF if `pdf_base64` is provided.
 *        f. Inserts a lightweight ledger row into D1 with the Drive file URLs.
 *        g. Marks the visit status as "finalized" in D1.
 *
 * Request body (JSON):
 *   {
 *     user_id:     string   — Required. The Atlas user ID (Firebase UID).
 *     pdf_base64?: string   — Optional. Base64-encoded PDF for customer copy.
 *   }
 *
 * Response (200):
 *   {
 *     ok: true,
 *     ledger: {
 *       id:                  string
 *       drive_folder_url:    string
 *       drive_data_file_url: string
 *       drive_pdf_file_url:  string | null
 *     }
 *   }
 *
 * Response (400) when `user_id` is missing.
 * Response (404) when the visit does not exist.
 * Response (409) when the user has not connected Google Drive.
 * Response (503) on schema drift or database unavailability.
 */

interface VisitRow {
  id:                   string;
  customer_name:        string | null;
  address_line_1:       string | null;
  postcode:             string | null;
  status:               string;
  completed_at:         string | null;
  visit_reference:      string | null;
  working_payload_json: string;
}

interface TokenRow {
  access_token:  string;
  refresh_token: string | null;
  expires_at:    string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const visitId = params['id'] as string;

  // ── Parse request body ───────────────────────────────────────────────────────

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json(
      { ok: false, error: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
  if (!userId) {
    return Response.json(
      { ok: false, error: 'Missing required field: user_id' },
      { status: 400 },
    );
  }

  const pdfBase64 = typeof body.pdf_base64 === 'string' ? body.pdf_base64 : null;

  // ── 1. Load the visit from D1 ────────────────────────────────────────────────

  let visit: VisitRow | null;
  try {
    visit = await env.ATLAS_REPORTS_D1.prepare(
      `SELECT id, customer_name, address_line_1, postcode, status, completed_at,
              visit_reference, working_payload_json
       FROM visits WHERE id = ?`,
    )
      .bind(visitId)
      .first<VisitRow>();
  } catch (err) {
    console.error(`[Atlas] Finalize: visit load failed id=${visitId}:`, String(err));
    if (isMissingTableError(err) || isMissingColumnError(err)) {
      return Response.json(SCHEMA_DRIFT_RESPONSE, { status: 503 });
    }
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }

  if (visit == null) {
    return Response.json({ ok: false, error: 'Visit not found' }, { status: 404 });
  }

  // ── 2. Retrieve the user's OAuth tokens from D1 ──────────────────────────────

  let tokenRow: TokenRow | null;
  try {
    tokenRow = await env.ATLAS_REPORTS_D1.prepare(
      'SELECT access_token, refresh_token, expires_at FROM user_oauth_tokens WHERE user_id = ?',
    )
      .bind(userId)
      .first<TokenRow>();
  } catch (err) {
    console.error(`[Atlas] Finalize: token lookup failed user=${userId}:`, String(err));
    if (isMissingTableError(err)) {
      return Response.json(SCHEMA_DRIFT_RESPONSE, { status: 503 });
    }
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }

  if (tokenRow == null) {
    return Response.json(
      {
        ok:    false,
        error: 'Google Drive is not connected for this user. Connect via /api/auth/google first.',
        code:  'DRIVE_NOT_CONNECTED',
      },
      { status: 409 },
    );
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    console.error('[Atlas] Finalize: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured');
    return Response.json(
      { ok: false, error: 'Google Drive integration is not configured on this server.' },
      { status: 503 },
    );
  }

  // ── 3. Refresh the access token if it has expired ────────────────────────────

  let accessToken = tokenRow.access_token;
  const tokenExpiry = new Date(tokenRow.expires_at);

  if (Date.now() >= tokenExpiry.getTime() - 60_000) {
    // Token expires within 60 seconds — refresh proactively.
    if (!tokenRow.refresh_token) {
      return Response.json(
        {
          ok:    false,
          error: 'Google Drive access token has expired and no refresh token is available. Please reconnect.',
          code:  'DRIVE_TOKEN_EXPIRED',
        },
        { status: 409 },
      );
    }

    try {
      const refreshed = await refreshAccessToken(
        tokenRow.refresh_token,
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
      );
      accessToken = refreshed.accessToken;

      // Persist the refreshed token back to D1.
      await env.ATLAS_REPORTS_D1.prepare(
        `UPDATE user_oauth_tokens
         SET access_token = ?, expires_at = ?, updated_at = ?
         WHERE user_id = ?`,
      )
        .bind(refreshed.accessToken, refreshed.expiresAt, new Date().toISOString(), userId)
        .run();
    } catch (err) {
      console.error(`[Atlas] Finalize: token refresh failed user=${userId}:`, String(err));
      return Response.json(
        {
          ok:    false,
          error: 'Failed to refresh Google Drive access token. Please reconnect.',
          code:  'DRIVE_TOKEN_REFRESH_FAILED',
        },
        { status: 502 },
      );
    }
  }

  // ── 4. Build folder name and ensure Drive folders exist ──────────────────────

  const datePart    = new Date().toISOString().slice(0, 10);
  const namePart    = visit.customer_name ?? 'Unknown';
  const postcodePart = visit.postcode ?? 'Unknown';
  const folderName  = `${namePart} - ${postcodePart} - ${datePart}`;

  let rootFolderId:   string;
  let surveyFolder:   Awaited<ReturnType<typeof createSurveySubFolder>>;

  try {
    rootFolderId = await ensureAtlasSurveysFolder(accessToken);
    surveyFolder = await createSurveySubFolder(accessToken, folderName, rootFolderId);
  } catch (err) {
    console.error(`[Atlas] Finalize: Drive folder setup failed visit=${visitId}:`, String(err));
    return Response.json(
      { ok: false, error: `Google Drive folder setup failed: ${String(err)}` },
      { status: 502 },
    );
  }

  // ── 5. Upload the canonical JSON data contract ───────────────────────────────

  let dataFile: Awaited<ReturnType<typeof uploadJsonFile>>;
  const dataFileName = `${visitId}_data.json`;

  try {
    const payload = {
      visit_id:       visit.id,
      customer_name:  visit.customer_name,
      address_line_1: visit.address_line_1,
      postcode:       visit.postcode,
      visit_reference: visit.visit_reference,
      finalized_at:   new Date().toISOString(),
      working_payload: JSON.parse(visit.working_payload_json),
    };
    dataFile = await uploadJsonFile(accessToken, dataFileName, JSON.stringify(payload, null, 2), surveyFolder.id);
  } catch (err) {
    console.error(`[Atlas] Finalize: JSON upload failed visit=${visitId}:`, String(err));
    return Response.json(
      { ok: false, error: `Failed to upload data file to Google Drive: ${String(err)}` },
      { status: 502 },
    );
  }

  // ── 6. Optionally upload the customer PDF ────────────────────────────────────

  let pdfFile: Awaited<ReturnType<typeof uploadPdfFile>> | null = null;

  if (pdfBase64) {
    const pdfFileName = `${visitId}_customer_report.pdf`;
    try {
      pdfFile = await uploadPdfFile(accessToken, pdfFileName, pdfBase64, surveyFolder.id);
    } catch (err) {
      // PDF upload failure is non-fatal — the data file is the canonical record.
      console.warn(`[Atlas] Finalize: PDF upload failed visit=${visitId} (non-fatal):`, String(err));
    }
  }

  // ── 7. Write the survey ledger row to D1 ────────────────────────────────────

  const ledgerId    = crypto.randomUUID();
  const finalizedAt = new Date().toISOString();

  try {
    await env.ATLAS_REPORTS_D1.prepare(
      `INSERT INTO survey_ledger
         (id, visit_id, user_id, customer_name, postcode, finalized_at,
          drive_folder_id, drive_folder_url,
          drive_data_file_id, drive_data_file_url,
          drive_pdf_file_id,  drive_pdf_file_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        ledgerId,
        visitId,
        userId,
        visit.customer_name ?? null,
        visit.postcode      ?? null,
        finalizedAt,
        surveyFolder.id,
        surveyFolder.webViewLink,
        dataFile.id,
        dataFile.webViewLink,
        pdfFile?.id          ?? null,
        pdfFile?.webViewLink ?? null,
      )
      .run();
  } catch (err) {
    console.error(`[Atlas] Finalize: ledger insert failed visit=${visitId}:`, String(err));
    if (isMissingTableError(err) || isMissingColumnError(err)) {
      return Response.json(SCHEMA_DRIFT_RESPONSE, { status: 503 });
    }
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }

  // ── 8. Mark the visit as finalized in D1 ────────────────────────────────────

  try {
    await env.ATLAS_REPORTS_D1.prepare(
      `UPDATE visits
       SET status = 'finalized', completed_at = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(finalizedAt, finalizedAt, visitId)
      .run();
  } catch (err) {
    // Non-fatal: the ledger row is the source of truth for finalization.
    console.warn(`[Atlas] Finalize: status update failed visit=${visitId} (non-fatal):`, String(err));
  }

  console.log(`[Atlas] Visit finalized: id=${visitId} user=${userId} ledger=${ledgerId}`);

  return Response.json({
    ok: true,
    ledger: {
      id:                  ledgerId,
      drive_folder_url:    surveyFolder.webViewLink,
      drive_data_file_url: dataFile.webViewLink,
      drive_pdf_file_url:  pdfFile?.webViewLink ?? null,
    },
  });
};
