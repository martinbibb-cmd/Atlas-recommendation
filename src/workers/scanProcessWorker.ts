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
  // Track byte offsets for each property (float32 = 4 bytes assumed; this
  // covers the vast majority of LiDAR exports from apps like Atlas Scan).
  const propByteOffsets: number[] = [];
  let currentByteOffset = 0;
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
        currentByteOffset = 0;
        propByteOffsets.length = 0;
      }
    } else if (parts[0] === 'property' && inVertexElement) {
      propByteOffsets.push(currentByteOffset);
      if (parts[2] === 'x') xIdx = propIdx;
      else if (parts[2] === 'y') yIdx = propIdx;
      else if (parts[2] === 'z') zIdx = propIdx;
      // All common property types are 4 bytes (float, int, uint) except
      // uchar/char (1 byte) and short/ushort (2 bytes).
      const typeSize: Record<string, number> = {
        float: 4, float32: 4, double: 8, float64: 8,
        int: 4, int32: 4, uint: 4, uint32: 4,
        short: 2, int16: 2, ushort: 2, uint16: 2,
        char: 1, int8: 1, uchar: 1, uint8: 1,
      };
      currentByteOffset += typeSize[parts[1]] ?? 4;
      propIdx++;
    }
  }

  if (vertexCount <= 0) throw new Error('PLY file contains no vertex data');
  if (xIdx < 0 || yIdx < 0 || zIdx < 0) {
    throw new Error('PLY file is missing required x, y, or z vertex properties');
  }

  const stride = currentByteOffset; // total bytes per vertex
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

    // Use the header-derived per-property byte offsets and stride so files
    // with normals, colours, or other properties are read correctly.
    const dv = new DataView(buffer, dataOffset);
    const xOff = propByteOffsets[xIdx] ?? 0;
    const yOff = propByteOffsets[yIdx] ?? 4;
    const zOff = propByteOffsets[zIdx] ?? 8;
    for (let i = 0; i < vertexCount; i++) {
      const base = i * stride;
      positions[i * 3]     = dv.getFloat32(base + xOff, true);
      positions[i * 3 + 1] = dv.getFloat32(base + yOff, true);
      positions[i * 3 + 2] = dv.getFloat32(base + zOff, true);
    }
  } else {
    // ASCII PLY — x/y/z indices are validated above; no silent fallback.
    const fullText = new TextDecoder().decode(new Uint8Array(buffer));
    const bodyStart = fullText.indexOf('end_header\n') + 'end_header\n'.length;
    const bodyLines = fullText.slice(bodyStart).split(/\r?\n/);

    let written = 0;
    for (let i = 0; i < bodyLines.length && written < vertexCount; i++) {
      const line = bodyLines[i].trim();
      if (!line) continue;
      const cols = line.split(/\s+/);
      positions[written * 3]     = parseFloat(cols[xIdx] ?? '0');
      positions[written * 3 + 1] = parseFloat(cols[yIdx] ?? '0');
      positions[written * 3 + 2] = parseFloat(cols[zIdx] ?? '0');
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
