/**
 * scanProcessWorker.ts
 *
 * Web Worker for processing large scan files without blocking the UI thread.
 *
 * Supported operations (sent via postMessage):
 *
 *   { type: 'parse_ply', buffer: ArrayBuffer }
 *     Parses a binary or ASCII PLY file and extracts x/y/z vertex positions.
 *     Responds with: { type: 'ply_result', positions: Float32Array, vertexCount: number }
 *
 *   { type: 'parse_json', buffer: ArrayBuffer }
 *     UTF-8 decodes and JSON.parses an ArrayBuffer.
 *     Responds with: { type: 'json_result', value: unknown }
 *
 * On error the worker responds with: { type: 'error', message: string }
 *
 * Usage from the main thread:
 *   const worker = new Worker(new URL('./scanProcessWorker.ts', import.meta.url), { type: 'module' });
 *   worker.postMessage({ type: 'parse_ply', buffer }, [buffer]);
 *   worker.onmessage = (e) => { ... };
 */

// Narrow self to the DedicatedWorkerGlobalScope so postMessage(data, transfer)
// resolves to the correct overload without requiring "targetOrigin" as a string.
// We use a minimal interface rather than the full DedicatedWorkerGlobalScope type
// so the file compiles under the DOM lib (which does not include WebWorker types).
interface WorkerSelf {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
  postMessage(message: unknown): void;
}
const workerSelf = self as unknown as WorkerSelf;

// ─── PLY parser ───────────────────────────────────────────────────────────────

/**
 * Minimal PLY parser supporting:
 *   - ASCII PLY  (element vertex with x, y, z properties)
 *   - Binary little-endian PLY (element vertex with float x, y, z)
 *
 * Returns a Float32Array of interleaved [x, y, z, x, y, z, ...] values.
 */
function parsePly(buffer: ArrayBuffer): { positions: Float32Array; vertexCount: number } {
  const headerBytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4096));
  const headerText = new TextDecoder().decode(headerBytes);

  if (!headerText.startsWith('ply')) {
    throw new Error('Not a valid PLY file — missing "ply" magic header');
  }

  const headerEnd = headerText.indexOf('end_header');
  if (headerEnd === -1) throw new Error('PLY header not terminated with "end_header"');

  const header = headerText.slice(0, headerEnd + 'end_header'.length);
  const lines = header.split(/\r?\n/);

  let vertexCount = 0;
  let isBinaryLittle = false;
  let xIdx = -1;
  let yIdx = -1;
  let zIdx = -1;
  let propIdx = 0;
  let inVertexElement = false;

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'format') {
      isBinaryLittle = parts[1] === 'binary_little_endian';
    } else if (parts[0] === 'element') {
      inVertexElement = parts[1] === 'vertex';
      if (inVertexElement) {
        vertexCount = parseInt(parts[2], 10);
        propIdx = 0;
      }
    } else if (parts[0] === 'property' && inVertexElement) {
      if (parts[2] === 'x') xIdx = propIdx;
      else if (parts[2] === 'y') yIdx = propIdx;
      else if (parts[2] === 'z') zIdx = propIdx;
      propIdx++;
    }
  }

  if (vertexCount <= 0) throw new Error('PLY file contains no vertex data');

  const positions = new Float32Array(vertexCount * 3);

  if (isBinaryLittle) {
    // Binary little-endian: locate data start after end_header + newline
    const encoder = new TextEncoder();
    const endHeaderBytes = encoder.encode('end_header\n');
    const view = new Uint8Array(buffer);
    let dataOffset = 0;
    for (let i = 0; i <= view.byteLength - endHeaderBytes.length; i++) {
      let match = true;
      for (let j = 0; j < endHeaderBytes.length; j++) {
        if (view[i + j] !== endHeaderBytes[j]) { match = false; break; }
      }
      if (match) { dataOffset = i + endHeaderBytes.length; break; }
    }

    // Assume float32 x,y,z are the first three properties
    const dv = new DataView(buffer, dataOffset);
    const stride = 12; // 3 × 4 bytes — minimal assumption for float xyz
    for (let i = 0; i < vertexCount; i++) {
      const base = i * stride;
      positions[i * 3]     = dv.getFloat32(base,      true);
      positions[i * 3 + 1] = dv.getFloat32(base + 4,  true);
      positions[i * 3 + 2] = dv.getFloat32(base + 8,  true);
    }
  } else {
    // ASCII PLY
    const fullText = new TextDecoder().decode(new Uint8Array(buffer));
    const bodyStart = fullText.indexOf('end_header\n') + 'end_header\n'.length;
    const bodyLines = fullText.slice(bodyStart).split(/\r?\n/);

    const xi = xIdx >= 0 ? xIdx : 0;
    const yi = yIdx >= 0 ? yIdx : 1;
    const zi = zIdx >= 0 ? zIdx : 2;

    let written = 0;
    for (let i = 0; i < bodyLines.length && written < vertexCount; i++) {
      const line = bodyLines[i].trim();
      if (!line) continue;
      const cols = line.split(/\s+/);
      positions[written * 3]     = parseFloat(cols[xi] ?? '0');
      positions[written * 3 + 1] = parseFloat(cols[yi] ?? '0');
      positions[written * 3 + 2] = parseFloat(cols[zi] ?? '0');
      written++;
    }
  }

  return { positions, vertexCount };
}

// ─── Message handler ──────────────────────────────────────────────────────────

workerSelf.onmessage = (event: MessageEvent) => {
  const msg = event.data as { type: string; buffer?: ArrayBuffer };

  try {
    if (msg.type === 'parse_ply') {
      if (!msg.buffer) throw new Error('parse_ply requires a buffer');
      const { positions, vertexCount } = parsePly(msg.buffer);
      // Transfer ownership back — avoids a copy of potentially large Float32Array
      workerSelf.postMessage({ type: 'ply_result', positions, vertexCount }, [positions.buffer]);
      return;
    }

    if (msg.type === 'parse_json') {
      if (!msg.buffer) throw new Error('parse_json requires a buffer');
      const text = new TextDecoder().decode(new Uint8Array(msg.buffer));
      const value = JSON.parse(text) as unknown;
      workerSelf.postMessage({ type: 'json_result', value });
      return;
    }

    workerSelf.postMessage({ type: 'error', message: `Unknown message type: ${msg.type}` });
  } catch (err) {
    workerSelf.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
