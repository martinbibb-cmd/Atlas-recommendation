import { buildAuthUrl } from '../services/googleDrive';

/**
 * GET /api/auth/google
 *
 * Initiates the Google OAuth 2.0 authorization flow for Google Drive access.
 *
 * Query parameters:
 *   user_id   string  — Required. The Atlas user ID (Firebase UID) to associate
 *                       the resulting tokens with.
 *   return_to string  — Optional. Path to redirect to after auth completes
 *                       (defaults to "/").
 *
 * Behavior:
 *   1. Validates that GOOGLE_CLIENT_ID is configured.
 *   2. Generates a cryptographically random `state` token.
 *   3. Stores `state → { userId, returnTo }` in ATLAS_CACHE_KV with a
 *      10-minute TTL to prevent CSRF and replay attacks.
 *   4. Redirects the user to the Google OAuth consent screen.
 *
 * Response:
 *   302 redirect to Google OAuth URL on success.
 *   400 if `user_id` is missing.
 *   503 if required environment variables are not configured.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const url      = new URL(request.url);
  const userId   = url.searchParams.get('user_id');
  const returnTo = url.searchParams.get('return_to') ?? '/';

  if (!userId || userId.trim().length === 0) {
    return Response.json(
      { ok: false, error: 'Missing required query parameter: user_id' },
      { status: 400 },
    );
  }

  if (!env.GOOGLE_CLIENT_ID) {
    console.error('[Atlas] Google OAuth not configured: GOOGLE_CLIENT_ID is missing');
    return Response.json(
      { ok: false, error: 'Google Drive integration is not configured on this server.' },
      { status: 503 },
    );
  }

  // Build the redirect URI — must match exactly what is registered in Google Cloud Console.
  const redirectUri = `${url.origin}/api/auth/google/callback`;

  // Generate a cryptographically random state token for CSRF prevention.
  const stateBytes = new Uint8Array(24);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Store the state → { userId, returnTo } mapping in KV with a 10-minute TTL.
  try {
    await env.ATLAS_CACHE_KV.put(
      `oauth:state:${state}`,
      JSON.stringify({ userId: userId.trim(), returnTo }),
      { expirationTtl: 600 },
    );
  } catch (err) {
    console.error('[Atlas] Failed to write OAuth state to KV:', String(err));
    return Response.json(
      { ok: false, error: 'Failed to initialise OAuth session. Please try again.' },
      { status: 500 },
    );
  }

  const authUrl = buildAuthUrl(env.GOOGLE_CLIENT_ID, redirectUri, state);

  console.log(`[Atlas] OAuth flow started for user=${userId.trim()}`);
  return Response.redirect(authUrl, 302);
};
