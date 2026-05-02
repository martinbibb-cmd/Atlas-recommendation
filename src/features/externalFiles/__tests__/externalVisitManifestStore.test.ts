/**
 * src/features/externalFiles/__tests__/externalVisitManifestStore.test.ts
 *
 * Unit tests for externalVisitManifestStore.
 *
 * Covers:
 *   - loadManifestForVisit returns null when no manifest exists
 *   - saveManifest persists a manifest and rebuilds the summary
 *   - deleteManifestForVisit removes the manifest
 *   - upsertFileReference creates a manifest when none exists
 *   - upsertFileReference adds a reference to an existing manifest
 *   - upsertFileReference replaces a reference with the same referenceId
 *   - removeFileReference removes a reference by referenceId
 *   - removeFileReference silently no-ops when manifest does not exist
 *   - summary is always consistent with files array
 *   - manifest store is separate from analytics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageAdapter } from '../../../lib/storage/localStorageAdapter';
import {
  loadManifestForVisit,
  saveManifest,
  deleteManifestForVisit,
  upsertFileReference,
  removeFileReference,
} from '../externalVisitManifestStore';
import type { ClientFileReferenceV1 } from '../../../contracts/ClientFileReferenceV1';
import type { ExternalVisitManifestV1 } from '../../../contracts/ExternalVisitManifestV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFileRef(overrides?: Partial<ClientFileReferenceV1>): ClientFileReferenceV1 {
  return {
    version: '1',
    referenceId: `ref_${Math.random().toString(36).slice(2)}`,
    provider: 'google_drive',
    fileKind: 'photo',
    uri: 'https://drive.google.com/file/d/example',
    accessMode: 'owner_controlled',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeManifest(
  visitId: string,
  files: ClientFileReferenceV1[] = [],
): ExternalVisitManifestV1 {
  return {
    version: '1',
    visitId,
    tenantId: 'tenant-test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    files,
    summary: {
      totalFiles: files.length,
      fileKindsPresent: [],
      countByKind: {},
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

// Use a fresh adapter instance to avoid cross-test pollution.
let _adapter: LocalStorageAdapter;

beforeEach(() => {
  _adapter = new LocalStorageAdapter();
  _adapter.clearSync('visitManifests');
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('loadManifestForVisit', () => {
  it('returns null when no manifest exists', () => {
    const result = loadManifestForVisit('visit_nonexistent');
    expect(result).toBeNull();
  });
});

describe('saveManifest', () => {
  it('persists the manifest', () => {
    const manifest = makeManifest('visit_abc');
    saveManifest(manifest);
    const loaded = loadManifestForVisit('visit_abc');
    expect(loaded).not.toBeNull();
    expect(loaded?.visitId).toBe('visit_abc');
  });

  it('rebuilds summary from files on save', () => {
    const files = [
      makeFileRef({ fileKind: 'photo' }),
      makeFileRef({ fileKind: 'photo' }),
      makeFileRef({ fileKind: 'report' }),
    ];
    const manifest = makeManifest('visit_sum', files);
    saveManifest(manifest);
    const loaded = loadManifestForVisit('visit_sum');
    expect(loaded?.summary.totalFiles).toBe(3);
    expect(loaded?.summary.fileKindsPresent).toContain('photo');
    expect(loaded?.summary.fileKindsPresent).toContain('report');
    expect(loaded?.summary.countByKind.photo).toBe(2);
    expect(loaded?.summary.countByKind.report).toBe(1);
  });
});

describe('deleteManifestForVisit', () => {
  it('removes the manifest', () => {
    saveManifest(makeManifest('visit_del'));
    expect(loadManifestForVisit('visit_del')).not.toBeNull();
    deleteManifestForVisit('visit_del');
    expect(loadManifestForVisit('visit_del')).toBeNull();
  });

  it('silently no-ops when manifest does not exist', () => {
    expect(() => deleteManifestForVisit('visit_missing')).not.toThrow();
  });
});

describe('upsertFileReference', () => {
  it('creates a manifest when none exists', () => {
    const ref = makeFileRef({ referenceId: 'ref_001' });
    upsertFileReference('visit_new', 'tenant-123', ref);
    const manifest = loadManifestForVisit('visit_new');
    expect(manifest).not.toBeNull();
    expect(manifest?.visitId).toBe('visit_new');
    expect(manifest?.tenantId).toBe('tenant-123');
    expect(manifest?.files).toHaveLength(1);
    expect(manifest?.files[0].referenceId).toBe('ref_001');
  });

  it('adds a reference to an existing manifest', () => {
    const ref1 = makeFileRef({ referenceId: 'ref_a' });
    const ref2 = makeFileRef({ referenceId: 'ref_b', fileKind: 'report' });
    upsertFileReference('visit_add', 'tenant-abc', ref1);
    upsertFileReference('visit_add', 'tenant-abc', ref2);
    const manifest = loadManifestForVisit('visit_add');
    expect(manifest?.files).toHaveLength(2);
  });

  it('replaces a reference with the same referenceId', () => {
    const ref = makeFileRef({ referenceId: 'ref_replace', fileKind: 'photo' });
    upsertFileReference('visit_replace', 'tenant-x', ref);
    const updated = { ...ref, fileKind: 'report' as const };
    upsertFileReference('visit_replace', 'tenant-x', updated);
    const manifest = loadManifestForVisit('visit_replace');
    expect(manifest?.files).toHaveLength(1);
    expect(manifest?.files[0].fileKind).toBe('report');
  });

  it('updates the summary after adding a reference', () => {
    const ref = makeFileRef({ fileKind: 'scan' });
    upsertFileReference('visit_summary', 'tenant-s', ref);
    const manifest = loadManifestForVisit('visit_summary');
    expect(manifest?.summary.totalFiles).toBe(1);
    expect(manifest?.summary.fileKindsPresent).toContain('scan');
    expect(manifest?.summary.countByKind.scan).toBe(1);
  });
});

describe('removeFileReference', () => {
  it('removes a reference by referenceId', () => {
    const ref1 = makeFileRef({ referenceId: 'ref_keep' });
    const ref2 = makeFileRef({ referenceId: 'ref_remove' });
    upsertFileReference('visit_rm', 'tenant-r', ref1);
    upsertFileReference('visit_rm', 'tenant-r', ref2);
    removeFileReference('visit_rm', 'ref_remove');
    const manifest = loadManifestForVisit('visit_rm');
    expect(manifest?.files).toHaveLength(1);
    expect(manifest?.files[0].referenceId).toBe('ref_keep');
  });

  it('silently no-ops when manifest does not exist', () => {
    expect(() => removeFileReference('visit_noexist', 'ref_x')).not.toThrow();
  });

  it('silently no-ops when referenceId is not in the manifest', () => {
    const ref = makeFileRef({ referenceId: 'ref_only' });
    upsertFileReference('visit_noop', 'tenant-n', ref);
    expect(() => removeFileReference('visit_noop', 'ref_missing')).not.toThrow();
    expect(loadManifestForVisit('visit_noop')?.files).toHaveLength(1);
  });

  it('updates the summary after removing a reference', () => {
    const ref1 = makeFileRef({ referenceId: 'ref_s1', fileKind: 'photo' });
    const ref2 = makeFileRef({ referenceId: 'ref_s2', fileKind: 'photo' });
    upsertFileReference('visit_sum_rm', 'tenant-t', ref1);
    upsertFileReference('visit_sum_rm', 'tenant-t', ref2);
    removeFileReference('visit_sum_rm', 'ref_s1');
    const manifest = loadManifestForVisit('visit_sum_rm');
    expect(manifest?.summary.totalFiles).toBe(1);
    expect(manifest?.summary.countByKind.photo).toBe(1);
  });
});

describe('manifest store analytics isolation', () => {
  it('is stored in visitManifests, not in any analytics key', () => {
    const ref = makeFileRef({ referenceId: 'ref_privacy' });
    upsertFileReference('visit_iso', 'tenant-iso', ref);
    // Analytics key must not contain manifest data
    const analyticsRaw = localStorage.getItem('atlas:analytics:v1');
    if (analyticsRaw) {
      expect(analyticsRaw).not.toContain('ref_privacy');
      expect(analyticsRaw).not.toContain('drive.google.com');
    }
    // Manifest must be stored under its own key
    const manifestRaw = localStorage.getItem('atlas:visit-manifests:v1');
    expect(manifestRaw).not.toBeNull();
    expect(manifestRaw).toContain('ref_privacy');
  });
});
