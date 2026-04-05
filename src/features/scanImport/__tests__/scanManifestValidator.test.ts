/**
 * scanManifestValidator.test.ts
 *
 * Tests for ScanImportManifest validation.
 */

import { describe, it, expect } from 'vitest';
import { validateScanManifest } from '../package/ScanImportManifest';

import validManifest from '../fixtures/packages/valid-manifest.json';
import warningsManifest from '../fixtures/packages/warnings-manifest.json';
import blockingManifest from '../fixtures/packages/blocking-manifest.json';
import evidenceManifest from '../fixtures/packages/evidence-manifest.json';

// ─── Valid manifest ───────────────────────────────────────────────────────────

describe('validateScanManifest — valid manifests', () => {
  it('accepts a valid clean manifest', () => {
    const result = validateScanManifest(validManifest);
    expect(result.ok).toBe(true);
  });

  it('returns the manifest typed on success', () => {
    const result = validateScanManifest(validManifest);
    if (!result.ok) throw new Error('Expected ok');
    expect(result.manifest.jobRef).toBe('ATLAS-JOB-001');
    expect(result.manifest.propertyAddress).toBe('12 Oakfield Road, Bristol, BS3 4NR');
  });

  it('accepts a manifest with validation warnings', () => {
    const result = validateScanManifest(warningsManifest);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok');
    expect(result.manifest.validationWarnings).toHaveLength(2);
  });

  it('accepts a manifest with blocking issues', () => {
    const result = validateScanManifest(blockingManifest);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok');
    expect(result.manifest.blockingIssues).toBe(true);
  });

  it('accepts a manifest with evidence files', () => {
    const result = validateScanManifest(evidenceManifest);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok');
    expect(result.manifest.evidenceIncluded).toBe(true);
    expect(result.manifest.evidenceFiles).toHaveLength(2);
  });

  it('stats are preserved correctly', () => {
    const result = validateScanManifest(validManifest);
    if (!result.ok) throw new Error('Expected ok');
    expect(result.manifest.stats.roomCount).toBe(1);
    expect(result.manifest.stats.reviewedRoomCount).toBe(1);
    expect(result.manifest.stats.scannedRoomCount).toBe(1);
    expect(result.manifest.stats.totalObjects).toBe(3);
    expect(result.manifest.stats.totalPhotos).toBe(4);
  });
});

// ─── Invalid manifest ─────────────────────────────────────────────────────────

describe('validateScanManifest — invalid inputs', () => {
  it('rejects null', () => {
    const result = validateScanManifest(null);
    expect(result.ok).toBe(false);
  });

  it('rejects a non-object', () => {
    const result = validateScanManifest('not-a-manifest');
    expect(result.ok).toBe(false);
  });

  it('rejects an empty object', () => {
    const result = validateScanManifest({});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a manifest with wrong version', () => {
    const result = validateScanManifest({ ...validManifest, version: '2.0' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.errors.some(e => e.includes('version'))).toBe(true);
  });

  it('rejects a manifest with missing jobRef', () => {
    const { jobRef: _omit, ...rest } = validManifest as Record<string, unknown>;
    const result = validateScanManifest(rest);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.errors.some(e => e.includes('jobRef'))).toBe(true);
  });

  it('rejects a manifest with missing propertyAddress', () => {
    const { propertyAddress: _omit, ...rest } = validManifest as Record<string, unknown>;
    const result = validateScanManifest(rest);
    expect(result.ok).toBe(false);
  });

  it('rejects a manifest with invalid stats (non-number roomCount)', () => {
    const result = validateScanManifest({
      ...validManifest,
      stats: { ...validManifest.stats, roomCount: 'five' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.errors.some(e => e.includes('roomCount'))).toBe(true);
  });

  it('rejects a manifest with non-boolean blockingIssues', () => {
    const result = validateScanManifest({ ...validManifest, blockingIssues: 'yes' });
    expect(result.ok).toBe(false);
  });

  it('rejects a manifest with non-array evidenceFiles', () => {
    const result = validateScanManifest({ ...validManifest, evidenceFiles: 'photo.jpg' });
    expect(result.ok).toBe(false);
  });

  it('rejects a manifest with non-array validationWarnings', () => {
    const result = validateScanManifest({ ...validManifest, validationWarnings: null });
    expect(result.ok).toBe(false);
  });
});
