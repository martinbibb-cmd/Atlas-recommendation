/**
 * src/lib/privacy/__tests__/safeLog.test.ts
 *
 * Unit tests for the privacy-safe logging helpers.
 *
 * Coverage:
 *   - redactSensitiveFields: blocked keys are replaced with '[redacted]'
 *   - redactSensitiveFields: non-blocked keys pass through unchanged
 *   - redactSensitiveFields: nested objects are redacted recursively
 *   - redactSensitiveFields: arrays are mapped element-by-element
 *   - redactSensitiveFields: primitives (null, string, number) are returned as-is
 *   - safeStringify: produces valid JSON with blocked keys redacted
 *   - redactString: replaces http/https URIs in strings with '[redacted]'
 *   - redactString: non-URI strings are returned unchanged
 */

import { describe, it, expect } from 'vitest';
import { redactSensitiveFields, safeStringify, redactString } from '../safeLog';

// ─── redactSensitiveFields ────────────────────────────────────────────────────

describe('redactSensitiveFields', () => {
  it('replaces uri with [redacted]', () => {
    const result = redactSensitiveFields({ uri: 'https://drive.google.com/file/abc' });
    expect((result as Record<string, unknown>)['uri']).toBe('[redacted]');
  });

  it('replaces externalId with [redacted]', () => {
    const result = redactSensitiveFields({ externalId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms' });
    expect((result as Record<string, unknown>)['externalId']).toBe('[redacted]');
  });

  it('replaces files array with [redacted]', () => {
    const result = redactSensitiveFields({ files: [{ referenceId: 'ref_1', uri: 'https://example.com' }] });
    expect((result as Record<string, unknown>)['files']).toBe('[redacted]');
  });

  it('leaves non-blocked keys unchanged', () => {
    const result = redactSensitiveFields({ visitId: 'v_1', tenantId: 't_1', totalFiles: 3 });
    expect(result).toEqual({ visitId: 'v_1', tenantId: 't_1', totalFiles: 3 });
  });

  it('redacts blocked keys recursively in nested objects', () => {
    const input = {
      visitId: 'v_1',
      ref: { uri: 'https://example.com/file', externalId: 'abc123', provider: 'google_drive' },
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;
    const ref = result['ref'] as Record<string, unknown>;
    expect(ref['uri']).toBe('[redacted]');
    expect(ref['externalId']).toBe('[redacted]');
    expect(ref['provider']).toBe('google_drive');
  });

  it('maps array elements recursively', () => {
    const input = [
      { uri: 'https://example.com/a', kind: 'photo' },
      { uri: 'https://example.com/b', kind: 'scan' },
    ];
    const result = redactSensitiveFields(input) as Array<Record<string, unknown>>;
    expect(result[0]['uri']).toBe('[redacted]');
    expect(result[0]['kind']).toBe('photo');
    expect(result[1]['uri']).toBe('[redacted]');
  });

  it('returns null unchanged', () => {
    expect(redactSensitiveFields(null)).toBeNull();
  });

  it('returns strings unchanged', () => {
    expect(redactSensitiveFields('hello')).toBe('hello');
  });

  it('returns numbers unchanged', () => {
    expect(redactSensitiveFields(42)).toBe(42);
  });
});

// ─── safeStringify ────────────────────────────────────────────────────────────

describe('safeStringify', () => {
  it('produces valid JSON', () => {
    const result = safeStringify({ visitId: 'v_1', count: 3 });
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('redacts uri in serialised output', () => {
    const result = safeStringify({ uri: 'https://drive.google.com/file/abc', visitId: 'v_1' });
    expect(result).not.toContain('drive.google.com');
    expect(result).toContain('[redacted]');
    expect(result).toContain('v_1');
  });

  it('redacts externalId in serialised output', () => {
    const result = safeStringify({ externalId: 'secret-file-id', visitId: 'v_2' });
    expect(result).not.toContain('secret-file-id');
    expect(result).toContain('[redacted]');
  });

  it('handles arrays at the top level', () => {
    const result = safeStringify([{ uri: 'https://example.com', count: 1 }]);
    expect(result).not.toContain('example.com');
    expect(result).toContain('[redacted]');
    expect(result).toContain('"count": 1');
  });
});

// ─── redactString ─────────────────────────────────────────────────────────────

describe('redactString', () => {
  it('replaces an http URI with [redacted]', () => {
    const result = redactString('Error fetching http://example.com/file.pdf');
    expect(result).toBe('Error fetching [redacted]');
  });

  it('replaces an https URI with [redacted]', () => {
    const result = redactString('Could not open https://drive.google.com/file/d/abc123/view');
    expect(result).toBe('Could not open [redacted]');
  });

  it('replaces multiple URIs in one string', () => {
    const result = redactString('a=https://a.com/x b=https://b.com/y');
    expect(result).toBe('a=[redacted] b=[redacted]');
  });

  it('returns strings without URIs unchanged', () => {
    expect(redactString('Something went wrong')).toBe('Something went wrong');
  });

  it('handles an empty string', () => {
    expect(redactString('')).toBe('');
  });
});
