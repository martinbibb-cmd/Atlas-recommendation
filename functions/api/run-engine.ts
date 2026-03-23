/**
 * POST /api/run-engine
 *
 * Authenticated Atlas engine endpoint. Accepts a normalised survey payload
 * (EngineInputV2_3) and returns the full engine result as JSON.
 *
 * Authentication:
 *   Authorization: Bearer <ATLAS_AGENT_TOKEN>
 *
 * Response (200):
 *   Full FullEngineResult JSON object.
 *
 * Response (400) — body is not valid JSON:
 *   { error: "invalid_json" }
 *
 * Response (401) — missing or wrong token:
 *   { error: "unauthorized" }
 *
 * Response (500) — engine threw an exception:
 *   { error: "engine_failed", message: string }
 */

import { runEngine } from '../../src/engine/Engine';
import type { EngineInputV2_3 } from '../../src/engine/schema/EngineInputV2_3';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${env.ATLAS_AGENT_TOKEN}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: EngineInputV2_3;
  try {
    body = await request.json<EngineInputV2_3>();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const result = runEngine(body);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'engine_failed',
        message: error instanceof Error ? error.message : 'unknown error',
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    );
  }
};
