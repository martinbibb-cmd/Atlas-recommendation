/**
 * POST /api/gemini
 *
 * Server-side proxy for the Google Gemini API.
 * Reads the API key from the GRMINI_API_KEY Cloudflare secret so that
 * the key is never exposed to the client.
 *
 * Request body (JSON): standard Gemini generateContent request body.
 *
 * Response: proxied Gemini API response (JSON).
 *
 * Returns 503 when GRMINI_API_KEY is not configured, allowing the client
 * to degrade gracefully (render nothing).
 */

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const apiKey = env.GRMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { ok: false, error: 'Gemini API key not configured' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return Response.json(data, { status: upstream.status });
  } catch (err) {
    console.error('[Atlas] Gemini proxy error:', String(err));
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
};
