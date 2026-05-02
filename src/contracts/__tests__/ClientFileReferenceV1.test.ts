/**
 * ClientFileReferenceV1.test.ts
 *
 * Tests for the client-owned file reference contract.
 *
 * Covers:
 *   - validateClientFileReferenceV1Fields: valid reference returns no errors
 *   - validateClientFileReferenceV1Fields: required field violations
 *   - validateClientFileReferenceV1Fields: enum value violations
 *   - validateClientFileReferenceV1Fields: optional field type violations
 *   - isClientFileReferenceV1: type guard behaviour
 *   - Privacy invariant: uri and externalId are blocked by assertNoCustomerPayload
 */

import { describe, it, expect } from 'vitest';
import {
  validateClientFileReferenceV1Fields,
  isClientFileReferenceV1,
  type ClientFileReferenceV1,
} from '../ClientFileReferenceV1';
import { assertNoCustomerPayload } from '../../features/analytics/privacyGuard';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeValidRaw(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    version: '1',
    referenceId: 'ref_abc123',
    provider: 'google_drive',
    fileKind: 'report',
    uri: 'https://drive.google.com/file/d/abc123/view',
    accessMode: 'owner_controlled',
    createdAt: '2026-05-02T10:00:00Z',
    ...overrides,
  };
}

function makeValidReference(
  overrides: Partial<ClientFileReferenceV1> = {},
): ClientFileReferenceV1 {
  return makeValidRaw(overrides) as unknown as ClientFileReferenceV1;
}

// ─── validateClientFileReferenceV1Fields ──────────────────────────────────────

describe('validateClientFileReferenceV1Fields', () => {
  it('returns no errors for a minimal valid reference', () => {
    expect(validateClientFileReferenceV1Fields(makeValidRaw())).toHaveLength(0);
  });

  it('returns no errors for a fully-populated valid reference', () => {
    const raw = makeValidRaw({
      externalId: 'gdrive-file-id-xyz',
      displayName: 'Gas Safety Report 2026.pdf',
      mimeType: 'application/pdf',
      expiresAt: '2027-05-02T10:00:00Z',
    });
    expect(validateClientFileReferenceV1Fields(raw)).toHaveLength(0);
  });

  // Required field violations

  it('flags a wrong version', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ version: '2' }));
    expect(errors.some(e => e.includes('version'))).toBe(true);
  });

  it('flags a missing version', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ version: undefined }));
    expect(errors.some(e => e.includes('version'))).toBe(true);
  });

  it('flags an empty referenceId', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ referenceId: '' }));
    expect(errors.some(e => e.includes('referenceId'))).toBe(true);
  });

  it('flags a non-string referenceId', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ referenceId: 42 }));
    expect(errors.some(e => e.includes('referenceId'))).toBe(true);
  });

  it('flags an empty uri', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ uri: '' }));
    expect(errors.some(e => e.includes('uri'))).toBe(true);
  });

  it('flags a non-string uri', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ uri: null }));
    expect(errors.some(e => e.includes('uri'))).toBe(true);
  });

  it('flags an empty createdAt', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ createdAt: '' }));
    expect(errors.some(e => e.includes('createdAt'))).toBe(true);
  });

  // Enum violations

  it('flags an invalid provider', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ provider: 'dropbox' }));
    expect(errors.some(e => e.includes('provider'))).toBe(true);
  });

  it('flags an invalid fileKind', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ fileKind: 'video' }));
    expect(errors.some(e => e.includes('fileKind'))).toBe(true);
  });

  it('flags an invalid accessMode', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ accessMode: 'public' }));
    expect(errors.some(e => e.includes('accessMode'))).toBe(true);
  });

  // All valid enum variants

  it.each(['google_drive', 'onedrive', 'icloud', 'local_device', 'other'])(
    'accepts provider "%s"',
    (provider) => {
      expect(validateClientFileReferenceV1Fields(makeValidRaw({ provider }))).toHaveLength(0);
    },
  );

  it.each(['scan', 'photo', 'report', 'floor_plan', 'transcript', 'handoff', 'other'])(
    'accepts fileKind "%s"',
    (fileKind) => {
      expect(validateClientFileReferenceV1Fields(makeValidRaw({ fileKind }))).toHaveLength(0);
    },
  );

  it.each(['owner_controlled', 'signed_link', 'local_only'])(
    'accepts accessMode "%s"',
    (accessMode) => {
      expect(validateClientFileReferenceV1Fields(makeValidRaw({ accessMode }))).toHaveLength(0);
    },
  );

  // Optional field type violations

  it('flags a non-string externalId', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ externalId: 123 }));
    expect(errors.some(e => e.includes('externalId'))).toBe(true);
  });

  it('accepts an absent externalId', () => {
    expect(validateClientFileReferenceV1Fields(makeValidRaw({ externalId: undefined }))).toHaveLength(0);
  });

  it('flags a non-string displayName', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ displayName: true }));
    expect(errors.some(e => e.includes('displayName'))).toBe(true);
  });

  it('flags a non-string mimeType', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ mimeType: 99 }));
    expect(errors.some(e => e.includes('mimeType'))).toBe(true);
  });

  it('flags a non-string expiresAt', () => {
    const errors = validateClientFileReferenceV1Fields(makeValidRaw({ expiresAt: false }));
    expect(errors.some(e => e.includes('expiresAt'))).toBe(true);
  });

  it('accumulates multiple violations independently', () => {
    const raw = makeValidRaw({ provider: 'dropbox', fileKind: 'video', uri: '' });
    const errors = validateClientFileReferenceV1Fields(raw);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── isClientFileReferenceV1 ──────────────────────────────────────────────────

describe('isClientFileReferenceV1', () => {
  it('returns true for a valid reference', () => {
    expect(isClientFileReferenceV1(makeValidRaw())).toBe(true);
  });

  it('returns false for null', () => {
    expect(isClientFileReferenceV1(null)).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isClientFileReferenceV1([])).toBe(false);
  });

  it('returns false for a primitive', () => {
    expect(isClientFileReferenceV1('string')).toBe(false);
  });

  it('returns false when required fields are missing', () => {
    expect(isClientFileReferenceV1({})).toBe(false);
  });

  it('returns false when provider is invalid', () => {
    expect(isClientFileReferenceV1(makeValidRaw({ provider: 'dropbox' }))).toBe(false);
  });
});

// ─── Privacy guard — uri and externalId are blocked ───────────────────────────

describe('privacy guard — ClientFileReferenceV1 fields', () => {
  it('throws in dev when uri is present in an analytics payload', () => {
    // Simulate dev environment by checking if the function throws or warns.
    // In test env import.meta.env.DEV may be false; we verify the function
    // throws or warns by catching the error or just calling it and checking
    // it recognises the key.
    const payload = { eventId: 'e1', eventType: 'visit_created', uri: 'https://example.com/file' };
    // We expect assertNoCustomerPayload to throw (dev) or warn (prod).
    // Since test environment may not set DEV=true, we just verify no silent pass.
    expect(() => {
      try {
        assertNoCustomerPayload(payload);
      } catch (err) {
        throw err;
      }
    }).toThrow();
  });

  it('throws in dev when externalId is present in an analytics payload', () => {
    const payload = { eventId: 'e1', eventType: 'visit_created', externalId: 'gdrive-xyz' };
    expect(() => assertNoCustomerPayload(payload)).toThrow();
  });

  it('throws in dev when fileUri is present in an analytics payload', () => {
    const payload = { eventId: 'e1', fileUri: 'https://example.com/file' };
    expect(() => assertNoCustomerPayload(payload)).toThrow();
  });

  it('throws in dev when fileBlob is present in an analytics payload', () => {
    const payload = { eventId: 'e1', fileBlob: new Uint8Array() };
    expect(() => assertNoCustomerPayload(payload)).toThrow();
  });

  it('throws in dev when fileContent is present in an analytics payload', () => {
    const payload = { eventId: 'e1', fileContent: 'base64encodeddata' };
    expect(() => assertNoCustomerPayload(payload)).toThrow();
  });

  it('throws in dev when fileData is present in an analytics payload', () => {
    const payload = { eventId: 'e1', fileData: 'raw bytes' };
    expect(() => assertNoCustomerPayload(payload)).toThrow();
  });

  it('does not throw for a clean analytics-only payload', () => {
    const payload = {
      eventId: 'e1',
      eventType: 'visit_created',
      tenantId: 'tenant_001',
      visitId: 'visit_001',
      createdAt: '2026-05-02T10:00:00Z',
    };
    expect(() => assertNoCustomerPayload(payload)).not.toThrow();
  });

  it('does not throw for undefined input', () => {
    expect(() => assertNoCustomerPayload(undefined)).not.toThrow();
  });

  it('does not throw for null input', () => {
    expect(() => assertNoCustomerPayload(null)).not.toThrow();
  });
});

// ─── Type-level: makeValidReference produces ClientFileReferenceV1 ────────────

describe('makeValidReference helper', () => {
  it('produces a value accepted by isClientFileReferenceV1', () => {
    const ref = makeValidReference();
    expect(isClientFileReferenceV1(ref)).toBe(true);
  });
});
