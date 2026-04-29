import { createD1CircuitBreaker } from "../../_utils/circuitBreaker";

/**
 * POST /api/scan-sessions/:id/transcripts
 *
 * Saves a voice-note transcript or AI-generated summary for a scan session.
 *
 * Request body (JSON):
 *   {
 *     room_id?:  string   — optional: scopes transcript to a specific room
 *     source:    'voice_note' | 'ai_summary'
 *     text:      string   — transcript content (required)
 *   }
 *
 * Response (201):
 *   { ok: true, id: string }
 */

const ALLOWED_SOURCES = ["voice_note", "ai_summary"] as const;
type TranscriptSource = (typeof ALLOWED_SOURCES)[number];

function isSource(v: unknown): v is TranscriptSource {
  return typeof v === "string" && (ALLOWED_SOURCES as readonly string[]).includes(v);
}

export const onRequestPost: PagesFunction<Env, "id"> = async (context) => {
  const { env, request, params } = context;
  const sessionId = params.id as string;

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  if (!isSource(body.source)) {
    return Response.json(
      { ok: false, error: `source must be one of: ${ALLOWED_SOURCES.join(", ")}` },
      { status: 400 },
    );
  }
  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return Response.json({ ok: false, error: "text is required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const roomId = typeof body.room_id === "string" && body.room_id.length > 0
    ? body.room_id
    : null;
  const now = new Date().toISOString();

  const breaker = createD1CircuitBreaker();
  const result = await breaker.run(() =>
    env.ATLAS_REPORTS_D1.prepare(
      `INSERT INTO transcripts (id, session_id, room_id, source, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, sessionId, roomId, body.source, body.text, now)
      .run(),
  );

  if (!result.ok) {
    console.error(`[Atlas] Transcript insert failed: sessionId=${sessionId}`);
    return result.response;
  }

  console.log(`[Atlas] Transcript created: id=${id} sessionId=${sessionId}`);
  return Response.json({ ok: true, id }, { status: 201 });
};
