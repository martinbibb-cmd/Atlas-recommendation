/**
 * scanImporter.test.ts
 *
 * Tests for the scan import pipeline.
 *
 * Coverage:
 *   1. Valid single-room import → status: 'success'
 *   2. Valid multi-room import → floors created per floorIndex
 *   3. Low-confidence room → status: 'success_with_warnings' + LOW_CONFIDENCE_ROOM code
 *   4. Partial missing openings → success_with_warnings + MISSING_OPENINGS code
 *   5. Invalid schema → rejected_invalid with error messages
 *   6. Unsupported version → rejected_unsupported_version
 *   7. Provenance is attached to every imported entity
 *   8. Importer does not write recommendation output
 *   9. Draft floors / rooms map correctly from fixture data
 *  10. Null / non-object input is rejected
 *  11. Bundle QA error flags surface as warnings
 */

import { describe, it, expect } from 'vitest';
import { importScanBundle } from '../importer/scanImporter';

// ─── Fixtures (imported directly as JSON) ────────────────────────────────────

import validSingleRoom from '../fixtures/valid-single-room.json';
import validMultiRoom from '../fixtures/valid-multi-room.json';
import lowConfidence from '../fixtures/low-confidence.json';
import partialMissingOpenings from '../fixtures/partial-missing-openings.json';
import invalidSchema from '../fixtures/invalid-schema.json';
import unsupportedVersion from '../fixtures/unsupported-version.json';

// ─── 1. Valid single-room import ──────────────────────────────────────────────

describe('importScanBundle — valid single-room fixture', () => {
  it('returns status: success', () => {
    const result = importScanBundle(validSingleRoom);
    expect(result.status).toBe('success');
  });

  it('produces a draft with one floor', () => {
    const result = importScanBundle(validSingleRoom);
    if (result.status !== 'success') throw new Error('Expected success');
    expect(result.draft.floors).toHaveLength(1);
  });

  it('maps the single room into the floor', () => {
    const result = importScanBundle(validSingleRoom);
    if (result.status !== 'success') throw new Error('Expected success');
    expect(result.draft.floors[0].rooms).toHaveLength(1);
    expect(result.draft.floors[0].rooms[0].roomType).toBe('living');
  });

  it('sets importedRoomIds to contain the mapped room ID', () => {
    const result = importScanBundle(validSingleRoom);
    if (result.status !== 'success') throw new Error('Expected success');
    expect(result.draft.importedRoomIds).toHaveLength(1);
    expect(result.draft.floors[0].rooms[0].id).toBe(result.draft.importedRoomIds[0]);
  });

  it('returns an empty warnings array', () => {
    const result = importScanBundle(validSingleRoom);
    if (result.status !== 'success') throw new Error('Expected success');
    expect(result.warnings).toHaveLength(0);
  });

  it('includes a provenance summary', () => {
    const result = importScanBundle(validSingleRoom);
    if (result.status !== 'success') throw new Error('Expected success');
    expect(result.provenanceSummary.bundleId).toBe('fixture-single-room-001');
    expect(result.provenanceSummary.totalRooms).toBe(1);
  });
});

// ─── 2. Valid multi-room import ───────────────────────────────────────────────

describe('importScanBundle — valid multi-room fixture', () => {
  it('returns status: success', () => {
    const result = importScanBundle(validMultiRoom);
    expect(result.status).toBe('success');
  });

  it('creates two floors (ground + first)', () => {
    const result = importScanBundle(validMultiRoom);
    if (result.status !== 'success') throw new Error('Expected success');
    expect(result.draft.floors).toHaveLength(2);
  });

  it('puts ground-floor rooms on floor index 0', () => {
    const result = importScanBundle(validMultiRoom);
    if (result.status !== 'success') throw new Error('Expected success');
    const groundFloor = result.draft.floors.find(f => f.levelIndex === 0);
    expect(groundFloor).toBeDefined();
    expect(groundFloor!.rooms).toHaveLength(2);
  });

  it('puts first-floor bedroom on floor index 1', () => {
    const result = importScanBundle(validMultiRoom);
    if (result.status !== 'success') throw new Error('Expected success');
    const firstFloor = result.draft.floors.find(f => f.levelIndex === 1);
    expect(firstFloor).toBeDefined();
    expect(firstFloor!.rooms[0].roomType).toBe('bedroom');
  });
});

// ─── 3. Low-confidence import ─────────────────────────────────────────────────

describe('importScanBundle — low-confidence fixture', () => {
  it('returns status: success_with_warnings', () => {
    const result = importScanBundle(lowConfidence);
    expect(result.status).toBe('success_with_warnings');
  });

  it('includes a LOW_CONFIDENCE_ROOM warning', () => {
    const result = importScanBundle(lowConfidence);
    if (result.status !== 'success_with_warnings') throw new Error('Expected success_with_warnings');
    const codes = result.warnings.map(w => w.code);
    expect(codes).toContain('LOW_CONFIDENCE_ROOM');
  });

  it('includes a BUNDLE_QA_WARNING for the partial-coverage flag', () => {
    const result = importScanBundle(lowConfidence);
    if (result.status !== 'success_with_warnings') throw new Error('Expected success_with_warnings');
    const codes = result.warnings.map(w => w.code);
    expect(codes).toContain('BUNDLE_QA_WARNING');
  });

  it('still produces a usable draft', () => {
    const result = importScanBundle(lowConfidence);
    if (result.status !== 'success_with_warnings') throw new Error('Expected success_with_warnings');
    expect(result.draft.floors).toHaveLength(1);
    expect(result.draft.importedRoomIds).toHaveLength(1);
  });
});

// ─── 4. Partial missing openings ─────────────────────────────────────────────

describe('importScanBundle — partial-missing-openings fixture', () => {
  it('returns status: success_with_warnings', () => {
    const result = importScanBundle(partialMissingOpenings);
    expect(result.status).toBe('success_with_warnings');
  });

  it('includes a MISSING_OPENINGS warning for the internal wall', () => {
    const result = importScanBundle(partialMissingOpenings);
    if (result.status !== 'success_with_warnings') throw new Error('Expected success_with_warnings');
    const codes = result.warnings.map(w => w.code);
    expect(codes).toContain('MISSING_OPENINGS');
  });

  it('still imports the room successfully', () => {
    const result = importScanBundle(partialMissingOpenings);
    if (result.status !== 'success_with_warnings') throw new Error('Expected success_with_warnings');
    expect(result.draft.importedRoomIds).toHaveLength(1);
  });
});

// ─── 5. Invalid schema rejection ─────────────────────────────────────────────

describe('importScanBundle — invalid-schema fixture', () => {
  it('returns status: rejected_invalid', () => {
    const result = importScanBundle(invalidSchema);
    expect(result.status).toBe('rejected_invalid');
  });

  it('returns a non-empty errors array', () => {
    const result = importScanBundle(invalidSchema);
    if (result.status !== 'rejected_invalid') throw new Error('Expected rejected_invalid');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ─── 6. Unsupported version rejection ────────────────────────────────────────

describe('importScanBundle — unsupported-version fixture', () => {
  it('returns status: rejected_unsupported_version', () => {
    const result = importScanBundle(unsupportedVersion);
    expect(result.status).toBe('rejected_unsupported_version');
  });

  it('reports the unsupported version string', () => {
    const result = importScanBundle(unsupportedVersion);
    if (result.status !== 'rejected_unsupported_version') throw new Error('Expected rejected_unsupported_version');
    expect(result.version).toBe('99.0');
  });

  it('lists the supported versions', () => {
    const result = importScanBundle(unsupportedVersion);
    if (result.status !== 'rejected_unsupported_version') throw new Error('Expected rejected_unsupported_version');
    expect(result.supportedVersions).toContain('1.0');
  });
});

// ─── 7. Provenance preservation ───────────────────────────────────────────────

describe('importScanBundle — provenance on imported entities', () => {
  it('attaches provenance to every imported room', () => {
    const result = importScanBundle(validSingleRoom);
    if (result.status !== 'success') throw new Error('Expected success');
    for (const floor of result.draft.floors) {
      for (const room of floor.rooms) {
        expect(room.provenance).toBeDefined();
        expect(room.provenance!.source).toBe('scanned');
        expect(room.provenance!.reviewStatus).toBe('unreviewed');
        expect(room.provenance!.sourceBundleId).toBe('fixture-single-room-001');
      }
    }
  });

  it('attaches provenance to every imported wall', () => {
    const result = importScanBundle(validSingleRoom);
    if (result.status !== 'success') throw new Error('Expected success');
    for (const floor of result.draft.floors) {
      for (const wall of floor.walls) {
        expect(wall.provenance).toBeDefined();
        expect(wall.provenance!.source).toBe('scanned');
        expect(wall.provenance!.reviewStatus).toBe('unreviewed');
      }
    }
  });

  it('attaches provenance to every imported opening', () => {
    const result = importScanBundle(validSingleRoom);
    if (result.status !== 'success') throw new Error('Expected success');
    for (const floor of result.draft.floors) {
      for (const opening of floor.openings) {
        expect(opening.provenance).toBeDefined();
        expect(opening.provenance!.source).toBe('scanned');
        expect(opening.provenance!.reviewStatus).toBe('unreviewed');
      }
    }
  });

  it('records the bundle version on imported entities', () => {
    const result = importScanBundle(validSingleRoom);
    if (result.status !== 'success') throw new Error('Expected success');
    const room = result.draft.floors[0].rooms[0];
    expect(room.provenance!.sourceBundleVersion).toBe('1.0');
  });
});

// ─── 8. Importer does not write recommendation output ─────────────────────────

describe('importScanBundle — does not produce recommendation output', () => {
  it('result contains no recommendation or engine output fields', () => {
    const result = importScanBundle(validSingleRoom);
    // The result type must not have any recommendation/engine fields
    expect(result).not.toHaveProperty('recommendations');
    expect(result).not.toHaveProperty('engineOutput');
    expect(result).not.toHaveProperty('surveyState');
    expect(result).not.toHaveProperty('heatLossWatts');
  });
});

// ─── 9. Null / non-object input rejection ─────────────────────────────────────

describe('importScanBundle — null / non-object inputs', () => {
  it('rejects null', () => {
    const result = importScanBundle(null);
    expect(result.status).toBe('rejected_invalid');
  });

  it('rejects a string', () => {
    const result = importScanBundle('not-a-bundle');
    expect(result.status).toBe('rejected_invalid');
  });

  it('rejects an array', () => {
    const result = importScanBundle([]);
    expect(result.status).toBe('rejected_invalid');
  });

  it('rejects an empty object', () => {
    const result = importScanBundle({});
    expect(result.status).toBe('rejected_invalid');
  });
});

// ─── 10. Bundle QA error flag ─────────────────────────────────────────────────

describe('importScanBundle — QA error flags in bundle', () => {
  it('surfaces BUNDLE_QA_ERROR warnings for error-severity QA flags', () => {
    const bundleWithQaError = {
      ...validSingleRoom,
      bundleId: 'qa-error-test',
      qaFlags: [
        {
          code: 'RECONSTRUCTION_FAILED',
          message: 'Point cloud reconstruction failed for north wall.',
          severity: 'error',
          entityId: 'wall-north-01',
        },
      ],
    };
    const result = importScanBundle(bundleWithQaError);
    expect(result.status).toBe('success_with_warnings');
    if (result.status !== 'success_with_warnings') return;
    const codes = result.warnings.map(w => w.code);
    expect(codes).toContain('BUNDLE_QA_ERROR');
  });
});
