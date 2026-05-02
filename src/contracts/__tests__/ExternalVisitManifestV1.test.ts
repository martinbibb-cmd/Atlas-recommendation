/**
 * ExternalVisitManifestV1.test.ts
 *
 * Tests for the external visit save manifest contract.
 *
 * Covers:
 *   - buildManifestSummary: empty files, single kind, multiple kinds
 *   - validateExternalVisitManifestV1Fields: valid manifest returns no errors
 *   - validateExternalVisitManifestV1Fields: required field violations
 *   - validateExternalVisitManifestV1Fields: files array validation
 *   - validateExternalVisitManifestV1Fields: summary validation
 *   - isExternalVisitManifestV1: type guard behaviour
 *   - Privacy invariant: 'files' key is blocked by assertNoCustomerPayload
 */

import { describe, it, expect } from 'vitest';
import {
  buildManifestSummary,
  validateExternalVisitManifestV1Fields,
  isExternalVisitManifestV1,
  type ExternalVisitManifestV1,
} from '../ExternalVisitManifestV1';
import type { ClientFileReferenceV1 } from '../ClientFileReferenceV1';
import { assertNoCustomerPayload } from '../../features/analytics/privacyGuard';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFileRef(overrides: Partial<ClientFileReferenceV1> = {}): ClientFileReferenceV1 {
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

function makeValidRaw(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  const files: ClientFileReferenceV1[] = [makeFileRef()];
  return {
    version: '1',
    visitId: 'visit_001',
    tenantId: 'tenant_001',
    createdAt: '2026-05-02T10:00:00Z',
    updatedAt: '2026-05-02T10:00:00Z',
    files,
    summary: {
      totalFiles: 1,
      fileKindsPresent: ['report'],
      countByKind: { report: 1 },
    },
    ...overrides,
  };
}

function makeValidManifest(
  overrides: Partial<ExternalVisitManifestV1> = {},
): ExternalVisitManifestV1 {
  return makeValidRaw(overrides) as unknown as ExternalVisitManifestV1;
}

// ─── buildManifestSummary ─────────────────────────────────────────────────────

describe('buildManifestSummary', () => {
  it('returns zero counts for an empty files array', () => {
    const summary = buildManifestSummary([]);
    expect(summary.totalFiles).toBe(0);
    expect(summary.fileKindsPresent).toHaveLength(0);
    expect(summary.countByKind).toEqual({});
  });

  it('returns correct counts for a single file', () => {
    const summary = buildManifestSummary([makeFileRef({ fileKind: 'scan' })]);
    expect(summary.totalFiles).toBe(1);
    expect(summary.fileKindsPresent).toEqual(['scan']);
    expect(summary.countByKind).toEqual({ scan: 1 });
  });

  it('accumulates counts for multiple files of the same kind', () => {
    const files = [
      makeFileRef({ referenceId: 'r1', fileKind: 'photo' }),
      makeFileRef({ referenceId: 'r2', fileKind: 'photo' }),
      makeFileRef({ referenceId: 'r3', fileKind: 'photo' }),
    ];
    const summary = buildManifestSummary(files);
    expect(summary.totalFiles).toBe(3);
    expect(summary.fileKindsPresent).toEqual(['photo']);
    expect(summary.countByKind).toEqual({ photo: 3 });
  });

  it('counts multiple distinct file kinds', () => {
    const files = [
      makeFileRef({ referenceId: 'r1', fileKind: 'scan' }),
      makeFileRef({ referenceId: 'r2', fileKind: 'report' }),
      makeFileRef({ referenceId: 'r3', fileKind: 'report' }),
      makeFileRef({ referenceId: 'r4', fileKind: 'floor_plan' }),
    ];
    const summary = buildManifestSummary(files);
    expect(summary.totalFiles).toBe(4);
    expect(summary.fileKindsPresent).toEqual(['floor_plan', 'report', 'scan']);
    expect(summary.countByKind).toEqual({ floor_plan: 1, report: 2, scan: 1 });
  });

  it('returns fileKindsPresent in alphabetical order', () => {
    const files = [
      makeFileRef({ referenceId: 'r1', fileKind: 'transcript' }),
      makeFileRef({ referenceId: 'r2', fileKind: 'handoff' }),
      makeFileRef({ referenceId: 'r3', fileKind: 'other' }),
    ];
    const summary = buildManifestSummary(files);
    expect(summary.fileKindsPresent).toEqual(['handoff', 'other', 'transcript']);
  });

  it('does not carry URIs or names in the summary', () => {
    const files = [
      makeFileRef({
        referenceId: 'r1',
        fileKind: 'photo',
        uri: 'https://drive.google.com/secret',
        displayName: 'Secret Photo.jpg',
      }),
    ];
    const summary = buildManifestSummary(files);
    const serialised = JSON.stringify(summary);
    expect(serialised).not.toContain('uri');
    expect(serialised).not.toContain('secret');
    expect(serialised).not.toContain('displayName');
    expect(serialised).not.toContain('Secret Photo');
  });
});

// ─── validateExternalVisitManifestV1Fields ────────────────────────────────────

describe('validateExternalVisitManifestV1Fields', () => {
  it('returns no errors for a minimal valid manifest', () => {
    expect(validateExternalVisitManifestV1Fields(makeValidRaw())).toHaveLength(0);
  });

  it('returns no errors for a manifest with multiple files of different kinds', () => {
    const files: ClientFileReferenceV1[] = [
      makeFileRef({ referenceId: 'r1', fileKind: 'scan' }),
      makeFileRef({ referenceId: 'r2', fileKind: 'floor_plan' }),
    ];
    const raw = makeValidRaw({
      files,
      summary: buildManifestSummary(files),
    });
    expect(validateExternalVisitManifestV1Fields(raw)).toHaveLength(0);
  });

  it('returns no errors for an empty files array', () => {
    const raw = makeValidRaw({
      files: [],
      summary: buildManifestSummary([]),
    });
    expect(validateExternalVisitManifestV1Fields(raw)).toHaveLength(0);
  });

  // Required field violations

  it('flags a wrong version', () => {
    const errors = validateExternalVisitManifestV1Fields(makeValidRaw({ version: '2' }));
    expect(errors.some(e => e.includes('version'))).toBe(true);
  });

  it('flags a missing version', () => {
    const errors = validateExternalVisitManifestV1Fields(makeValidRaw({ version: undefined }));
    expect(errors.some(e => e.includes('version'))).toBe(true);
  });

  it('flags an empty visitId', () => {
    const errors = validateExternalVisitManifestV1Fields(makeValidRaw({ visitId: '' }));
    expect(errors.some(e => e.includes('visitId'))).toBe(true);
  });

  it('flags a non-string visitId', () => {
    const errors = validateExternalVisitManifestV1Fields(makeValidRaw({ visitId: 42 }));
    expect(errors.some(e => e.includes('visitId'))).toBe(true);
  });

  it('flags an empty tenantId', () => {
    const errors = validateExternalVisitManifestV1Fields(makeValidRaw({ tenantId: '' }));
    expect(errors.some(e => e.includes('tenantId'))).toBe(true);
  });

  it('flags an empty createdAt', () => {
    const errors = validateExternalVisitManifestV1Fields(makeValidRaw({ createdAt: '' }));
    expect(errors.some(e => e.includes('createdAt'))).toBe(true);
  });

  it('flags an empty updatedAt', () => {
    const errors = validateExternalVisitManifestV1Fields(makeValidRaw({ updatedAt: '' }));
    expect(errors.some(e => e.includes('updatedAt'))).toBe(true);
  });

  // files array violations

  it('flags a non-array files field', () => {
    const errors = validateExternalVisitManifestV1Fields(makeValidRaw({ files: 'not-an-array' }));
    expect(errors.some(e => e.includes('files'))).toBe(true);
  });

  it('flags a null files field', () => {
    const errors = validateExternalVisitManifestV1Fields(makeValidRaw({ files: null }));
    expect(errors.some(e => e.includes('files'))).toBe(true);
  });

  it('flags an invalid file reference inside the files array', () => {
    const raw = makeValidRaw({
      files: [{ ...makeFileRef(), provider: 'dropbox' }],
    });
    const errors = validateExternalVisitManifestV1Fields(raw);
    expect(errors.some(e => e.includes('files[0]'))).toBe(true);
  });

  it('flags a non-object item inside the files array', () => {
    const raw = makeValidRaw({ files: ['not-an-object'] });
    const errors = validateExternalVisitManifestV1Fields(raw);
    expect(errors.some(e => e.includes('files[0]'))).toBe(true);
  });

  // summary violations

  it('flags a non-object summary', () => {
    const errors = validateExternalVisitManifestV1Fields(makeValidRaw({ summary: 'bad' }));
    expect(errors.some(e => e.includes('summary'))).toBe(true);
  });

  it('flags a negative totalFiles in summary', () => {
    const raw = makeValidRaw({
      summary: { totalFiles: -1, fileKindsPresent: [], countByKind: {} },
    });
    const errors = validateExternalVisitManifestV1Fields(raw);
    expect(errors.some(e => e.includes('summary.totalFiles'))).toBe(true);
  });

  it('flags a non-integer totalFiles in summary', () => {
    const raw = makeValidRaw({
      summary: { totalFiles: 1.5, fileKindsPresent: [], countByKind: {} },
    });
    const errors = validateExternalVisitManifestV1Fields(raw);
    expect(errors.some(e => e.includes('summary.totalFiles'))).toBe(true);
  });

  it('flags a non-array fileKindsPresent in summary', () => {
    const raw = makeValidRaw({
      summary: { totalFiles: 0, fileKindsPresent: 'not-array', countByKind: {} },
    });
    const errors = validateExternalVisitManifestV1Fields(raw);
    expect(errors.some(e => e.includes('summary.fileKindsPresent'))).toBe(true);
  });

  it('flags a non-object countByKind in summary', () => {
    const raw = makeValidRaw({
      summary: { totalFiles: 0, fileKindsPresent: [], countByKind: null },
    });
    const errors = validateExternalVisitManifestV1Fields(raw);
    expect(errors.some(e => e.includes('summary.countByKind'))).toBe(true);
  });

  it('accumulates multiple violations independently', () => {
    const raw = makeValidRaw({ visitId: '', tenantId: '', files: null });
    const errors = validateExternalVisitManifestV1Fields(raw);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── isExternalVisitManifestV1 ────────────────────────────────────────────────

describe('isExternalVisitManifestV1', () => {
  it('returns true for a valid manifest', () => {
    expect(isExternalVisitManifestV1(makeValidRaw())).toBe(true);
  });

  it('returns false for null', () => {
    expect(isExternalVisitManifestV1(null)).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isExternalVisitManifestV1([])).toBe(false);
  });

  it('returns false for a primitive', () => {
    expect(isExternalVisitManifestV1('string')).toBe(false);
  });

  it('returns false when required fields are missing', () => {
    expect(isExternalVisitManifestV1({})).toBe(false);
  });

  it('returns false when version is wrong', () => {
    expect(isExternalVisitManifestV1(makeValidRaw({ version: '2' }))).toBe(false);
  });

  it('returns false when files contains an invalid reference', () => {
    const raw = makeValidRaw({
      files: [{ ...makeFileRef(), provider: 'dropbox' }],
    });
    expect(isExternalVisitManifestV1(raw)).toBe(false);
  });
});

// ─── Privacy guard — 'files' key is blocked ───────────────────────────────────

describe('privacy guard — ExternalVisitManifestV1 files field', () => {
  it('throws when a payload contains a top-level files key', () => {
    const payload = {
      eventId: 'e1',
      eventType: 'visit_created',
      files: [makeFileRef()],
    };
    expect(() => assertNoCustomerPayload(payload)).toThrow();
  });

  it('does not throw for a clean analytics payload without files', () => {
    const payload = {
      eventId: 'e1',
      eventType: 'visit_created',
      tenantId: 'tenant_001',
      visitId: 'visit_001',
      createdAt: '2026-05-02T10:00:00Z',
    };
    expect(() => assertNoCustomerPayload(payload)).not.toThrow();
  });

  it('confirms visitId and tenantId are safe for analytics (no throw)', () => {
    const payload = { visitId: 'visit_001', tenantId: 'tenant_001' };
    expect(() => assertNoCustomerPayload(payload)).not.toThrow();
  });
});

// ─── Type-level: makeValidManifest produces ExternalVisitManifestV1 ───────────

describe('makeValidManifest helper', () => {
  it('produces a value accepted by isExternalVisitManifestV1', () => {
    const manifest = makeValidManifest();
    expect(isExternalVisitManifestV1(manifest)).toBe(true);
  });

  it('round-trips through JSON serialisation', () => {
    const manifest = makeValidManifest();
    const parsed = JSON.parse(JSON.stringify(manifest));
    expect(isExternalVisitManifestV1(parsed)).toBe(true);
  });
});
