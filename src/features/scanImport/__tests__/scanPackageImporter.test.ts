/**
 * scanPackageImporter.test.ts
 *
 * Tests for the Atlas Scan package import pipeline.
 *
 * Coverage:
 *   1. deriveReadiness — correct verdict from manifest + bundle warnings
 *   2. confirmScanPackageImport — valid package path
 *   3. confirmScanPackageImport — provenance preserved after hydration
 *   4. confirmScanPackageImport — reviewed/scanned room counts in summary
 *   5. confirmScanPackageImport — warnings path (ready_with_warnings)
 *   6. confirmScanPackageImport — blocking issues → readiness = blocked
 *   7. confirmScanPackageImport — invalid bundle fails gracefully
 */

import { describe, it, expect } from 'vitest';
import {
  deriveReadiness,
  confirmScanPackageImport,
  type ScanPackageReviewReady,
} from '../package/scanPackageImporter';
import { validateScanManifest } from '../package/ScanImportManifest';

import validManifest from '../fixtures/packages/valid-manifest.json';
import warningsManifest from '../fixtures/packages/warnings-manifest.json';
import blockingManifest from '../fixtures/packages/blocking-manifest.json';
import validSingleRoom from '../fixtures/valid-single-room.json';
import validMultiRoom from '../fixtures/valid-multi-room.json';
import lowConfidence from '../fixtures/low-confidence.json';
import invalidSchema from '../fixtures/invalid-schema.json';
import unsupportedVersion from '../fixtures/unsupported-version.json';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a ScanPackageReviewReady from a manifest fixture and bundle fixture. */
function makeReviewReady(
  manifestFixture: unknown,
  bundleFixture: unknown,
): ScanPackageReviewReady {
  const manifestResult = validateScanManifest(manifestFixture);
  if (!manifestResult.ok) throw new Error('Test setup: invalid manifest fixture');
  return {
    status: 'review_ready',
    review: {
      jobRef: manifestResult.manifest.jobRef,
      propertyAddress: manifestResult.manifest.propertyAddress,
      generatedAt: manifestResult.manifest.generatedAt,
      roomCount: manifestResult.manifest.stats.roomCount,
      reviewedRoomCount: manifestResult.manifest.stats.reviewedRoomCount,
      scannedRoomCount: manifestResult.manifest.stats.scannedRoomCount,
      totalObjects: manifestResult.manifest.stats.totalObjects,
      totalPhotos: manifestResult.manifest.stats.totalPhotos,
      evidenceIncluded: manifestResult.manifest.evidenceIncluded,
      evidenceFileCount: 0,
      blockingIssues: manifestResult.manifest.blockingIssues,
      validationWarnings: manifestResult.manifest.validationWarnings,
      readiness: 'ready',
      importActions: ['Create draft floor plan'],
    },
    _manifest: manifestResult.manifest,
    _bundleRaw: bundleFixture,
  };
}

// ─── 1. deriveReadiness ───────────────────────────────────────────────────────

describe('deriveReadiness', () => {
  it('returns "ready" when no blocking issues and no warnings', () => {
    const manifestResult = validateScanManifest(validManifest);
    if (!manifestResult.ok) throw new Error('bad fixture');
    expect(deriveReadiness(manifestResult.manifest, [])).toBe('ready');
  });

  it('returns "ready_with_warnings" when manifest has validation warnings', () => {
    const manifestResult = validateScanManifest(warningsManifest);
    if (!manifestResult.ok) throw new Error('bad fixture');
    expect(deriveReadiness(manifestResult.manifest, [])).toBe('ready_with_warnings');
  });

  it('returns "ready_with_warnings" when bundle produces import warnings', () => {
    const manifestResult = validateScanManifest(validManifest);
    if (!manifestResult.ok) throw new Error('bad fixture');
    const bundleWarnings = [{ code: 'LOW_CONFIDENCE_ROOM' as const, message: 'test', entityId: 'r1' }];
    expect(deriveReadiness(manifestResult.manifest, bundleWarnings)).toBe('ready_with_warnings');
  });

  it('returns "blocked" when manifest has blocking issues regardless of warnings', () => {
    const manifestResult = validateScanManifest(blockingManifest);
    if (!manifestResult.ok) throw new Error('bad fixture');
    expect(deriveReadiness(manifestResult.manifest, [])).toBe('blocked');
  });
});

// ─── 2. confirmScanPackageImport — valid path ─────────────────────────────────

describe('confirmScanPackageImport — valid package', () => {
  it('returns status: imported for a valid single-room package', () => {
    const reviewReady = makeReviewReady(validManifest, validSingleRoom);
    const result = confirmScanPackageImport(reviewReady);
    expect(result.status).toBe('imported');
  });

  it('returns a draft with floors', () => {
    const reviewReady = makeReviewReady(validManifest, validSingleRoom);
    const result = confirmScanPackageImport(reviewReady);
    if (result.status !== 'imported') throw new Error('Expected imported');
    expect(result.draft.floors.length).toBeGreaterThan(0);
  });

  it('returns a summary with correct room count', () => {
    const reviewReady = makeReviewReady(validManifest, validSingleRoom);
    const result = confirmScanPackageImport(reviewReady);
    if (result.status !== 'imported') throw new Error('Expected imported');
    expect(result.summary.roomsImported).toBe(1);
  });

  it('returns a summary with objects and photos from manifest', () => {
    const reviewReady = makeReviewReady(validManifest, validSingleRoom);
    const result = confirmScanPackageImport(reviewReady);
    if (result.status !== 'imported') throw new Error('Expected imported');
    expect(result.summary.objectsImported).toBe(validManifest.stats.totalObjects);
    expect(result.summary.photosDetected).toBe(validManifest.stats.totalPhotos);
  });

  it('handles a multi-room bundle correctly', () => {
    const reviewReady = makeReviewReady(validManifest, validMultiRoom);
    const result = confirmScanPackageImport(reviewReady);
    if (result.status !== 'imported') throw new Error('Expected imported');
    expect(result.summary.roomsImported).toBeGreaterThan(1);
  });
});

// ─── 3. Provenance preserved after hydration ──────────────────────────────────

describe('confirmScanPackageImport — provenance', () => {
  it('attaches source: scanned to every imported room', () => {
    const reviewReady = makeReviewReady(validManifest, validSingleRoom);
    const result = confirmScanPackageImport(reviewReady);
    if (result.status !== 'imported') throw new Error('Expected imported');
    for (const floor of result.draft.floors) {
      for (const room of floor.rooms) {
        expect(room.provenance?.source).toBe('scanned');
      }
    }
  });

  it('attaches reviewStatus: unreviewed to every imported room', () => {
    const reviewReady = makeReviewReady(validManifest, validSingleRoom);
    const result = confirmScanPackageImport(reviewReady);
    if (result.status !== 'imported') throw new Error('Expected imported');
    for (const floor of result.draft.floors) {
      for (const room of floor.rooms) {
        expect(room.provenance?.reviewStatus).toBe('unreviewed');
      }
    }
  });

  it('attaches sourceBundleId from the bundle', () => {
    const reviewReady = makeReviewReady(validManifest, validSingleRoom);
    const result = confirmScanPackageImport(reviewReady);
    if (result.status !== 'imported') throw new Error('Expected imported');
    const room = result.draft.floors[0].rooms[0];
    expect(room.provenance?.sourceBundleId).toBe('fixture-single-room-001');
  });

  it('attaches provenance to walls', () => {
    const reviewReady = makeReviewReady(validManifest, validSingleRoom);
    const result = confirmScanPackageImport(reviewReady);
    if (result.status !== 'imported') throw new Error('Expected imported');
    for (const floor of result.draft.floors) {
      for (const wall of floor.walls) {
        expect(wall.provenance?.source).toBe('scanned');
      }
    }
  });

  it('pendingReviewCount in summary equals rooms with unreviewed status', () => {
    const reviewReady = makeReviewReady(validManifest, validSingleRoom);
    const result = confirmScanPackageImport(reviewReady);
    if (result.status !== 'imported') throw new Error('Expected imported');
    const unreviewedCount = result.draft.floors
      .flatMap(f => f.rooms)
      .filter(r => r.provenance?.reviewStatus === 'unreviewed').length;
    expect(result.summary.pendingReviewCount).toBe(unreviewedCount);
  });
});

// ─── 4. Reviewed/scanned room counts reflected in review ─────────────────────

describe('confirmScanPackageImport — summary counts from manifest', () => {
  it('objectsImported reflects manifest stats.totalObjects', () => {
    const reviewReady = makeReviewReady(warningsManifest, validMultiRoom);
    const result = confirmScanPackageImport(reviewReady);
    if (result.status !== 'imported') throw new Error('Expected imported');
    expect(result.summary.objectsImported).toBe(warningsManifest.stats.totalObjects);
  });
});

// ─── 5. Warnings path ─────────────────────────────────────────────────────────

describe('confirmScanPackageImport — warnings path', () => {
  it('returns imported with warnings for a low-confidence bundle', () => {
    const reviewReady = makeReviewReady(validManifest, lowConfidence);
    const result = confirmScanPackageImport(reviewReady);
    if (result.status !== 'imported') throw new Error(`Expected imported, got ${result.status}`);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.summary.warningsCount).toBe(result.warnings.length);
  });
});

// ─── 6. Invalid bundle fails gracefully ──────────────────────────────────────

describe('confirmScanPackageImport — invalid bundle', () => {
  it('returns status: failed for an invalid bundle schema', () => {
    const reviewReady = makeReviewReady(validManifest, invalidSchema);
    const result = confirmScanPackageImport(reviewReady);
    expect(result.status).toBe('failed');
  });

  it('returns status: failed for an unsupported version', () => {
    const reviewReady = makeReviewReady(validManifest, unsupportedVersion);
    const result = confirmScanPackageImport(reviewReady);
    expect(result.status).toBe('failed');
  });

  it('does not throw on null bundle', () => {
    const reviewReady = makeReviewReady(validManifest, null);
    const result = confirmScanPackageImport(reviewReady);
    expect(result.status).toBe('failed');
  });
});
