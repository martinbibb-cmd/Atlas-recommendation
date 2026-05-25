import { exchangeCodeForTokens } from '../../services/googleDrive';
import { isMissingTableError, SCHEMA_DRIFT_RESPONSE } from '../../_utils/errors';

/**
 * GET /api/auth/google/callback
 *
 * Google OAuth 2.0 callback handler.
 *
 * Called by Google after the user grants (or denies) Drive access.
 * Exchanges the authorization code for access + refresh tokens and persists
 * them in D1 (`user_oauth_tokens`), then redirects the user back to the app.
 *
 * Query parameters (set by Google):
 *   code    string — Authorization code to exchange for tokens.
 *   state   string — CSRF token previously stored in KV by /api/auth/google.
 *   error   string — Present when the user denies access.
 *
 * Behavior:
 *   1. Validates `state` against ATLAS_CACHE_KV and retrieves the userId.
 *   2. Exchanges `code` for access + refresh tokens via Google's token endpoint.
 *   3. Upserts the token row in D1 `user_oauth_tokens`.
 *   4. Deletes the consumed state token from KV.
 *   5. Redirects to `returnTo` with `?google_drive=connected`.
 *
 * Response:
 *   302 redirect to app URL on success.
 *   302 redirect with `?google_drive=error` on failure.
 *   400 if `state` is missing or invalid.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);

  const error = url.searchParams.get('error');
  if (error) {
    console.warn(`[Atlas] OAuth denied by user: ${error}`);
    return Response.redirect(`${url.origin}/?google_drive=denied`, 302);
  }

  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return Response.json(
      { ok: false, error: 'Missing required parameters: code and state are required.' },
      { status: 400 },
    );
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    console.error('[Atlas] OAuth callback: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured');
    return Response.redirect(`${url.origin}/?google_drive=error`, 302);
  }

  // ── 1. Validate state and retrieve userId ────────────────────────────────────

  let storedState: { userId: string; returnTo: string } | null = null;

  try {
    const raw = await env.ATLAS_CACHE_KV.get(`oauth:state:${state}`);
    if (!raw) {
      console.warn('[Atlas] OAuth callback: state not found or expired');
      return Response.json(
        { ok: false, error: 'OAuth state is invalid or has expired. Please try connecting again.' },
        { status: 400 },
      );
    }
    storedState = JSON.parse(raw) as { userId: string; returnTo: string };
  } catch (err) {
    console.error('[Atlas] OAuth callback: failed to read state from KV:', String(err));
    return Response.redirect(`${url.origin}/?google_drive=error`, 302);
  }

  const { userId, returnTo } = storedState;
  const redirectUri = `${url.origin}/api/auth/google/callback`;

  // ── 2. Exchange the authorization code for tokens ────────────────────────────

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;

  try {
    tokens = await exchangeCodeForTokens(
      code,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    );
  } catch (err) {
    console.error(`[Atlas] OAuth callback: token exchange failed for user=${userId}:`, String(err));
    return Response.redirect(`${url.origin}/?google_drive=error`, 302);
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const now       = new Date().toISOString();

  // ── 3. Upsert the token row in D1 ────────────────────────────────────────────

  try {
    if (tokens.refresh_token) {
      // Full upsert: we have a fresh refresh token (first-time connect or re-consent).
      await env.ATLAS_REPORTS_D1.prepare(
        `INSERT INTO user_oauth_tokens
           (user_id, provider, access_token, refresh_token, expires_at, scope, created_at, updated_at)
         VALUES (?, 'google', ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET
           access_token  = excluded.access_token,
           refresh_token = excluded.refresh_token,
           expires_at    = excluded.expires_at,
           scope         = excluded.scope,
           updated_at    = excluded.updated_at`,
      )
        .bind(
          userId,
          tokens.access_token,
          tokens.refresh_token,
          expiresAt,
          tokens.scope ?? null,
          now,
          now,
        )
        .run();
    } else {
      // Partial update: refresh only updated the access token, keep existing refresh token.
      await env.ATLAS_REPORTS_D1.prepare(
        `INSERT INTO user_oauth_tokens
           (user_id, provider, access_token, expires_at, scope, created_at, updated_at)
         VALUES (?, 'google', ?, ?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET
           access_token = excluded.access_token,
           expires_at   = excluded.expires_at,
           scope        = excluded.scope,
           updated_at   = excluded.updated_at`,
      )
        .bind(userId, tokens.access_token, expiresAt, tokens.scope ?? null, now, now)
        .run();
    }
  } catch (err) {
    console.error(`[Atlas] OAuth callback: failed to store tokens for user=${userId}:`, String(err));
    if (isMissingTableError(err)) {
      return Response.json(SCHEMA_DRIFT_RESPONSE, { status: 503 });
    }
    return Response.redirect(`${url.origin}/?google_drive=error`, 302);
  }

  // ── 4. Consume the state token from KV ───────────────────────────────────────

  try {
    await env.ATLAS_CACHE_KV.delete(`oauth:state:${state}`);
  } catch {
    // Non-critical: if KV delete fails the token will just expire naturally.
    console.warn('[Atlas] OAuth callback: failed to delete consumed state from KV');
  }

  console.log(`[Atlas] Google Drive connected for user=${userId}`);

  // ── 5. Redirect back to the app ──────────────────────────────────────────────

  const destination = new URL(returnTo, url.origin);
  destination.searchParams.set('google_drive', 'connected');
  return Response.redirect(destination.toString(), 302);
};
