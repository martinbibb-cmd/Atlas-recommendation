/**
 * receiveScanHandoff.test.ts
 *
 * Unit tests for receiveScanHandoff and the scanHandoffStore.
 *
 * Covers:
 *   1. Valid ScanToMindHandoffV1 payload is accepted, stored, and returned.
 *   2. Invalid / malformed payload returns errors without storing.
 *   3. Payload with capture QA warnings surfaces warnings in the result.
 *   4. scanHandoffStore round-trips: store, retrieve, remove, list, clear.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { receiveScanHandoff } from '../receiveScanHandoff';
import {
  storeScanCapture,
  getScanCapture,
  removeScanCapture,
  listScanCaptures,
  clearScanHandoffStore,
  SCAN_HANDOFF_STORAGE_KEY,
} from '../scanHandoffStore';
import type { SessionCaptureV2 } from '../../scanImport/contracts/sessionCaptureV2';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function minimalCapture(overrides: Partial<SessionCaptureV2> = {}): SessionCaptureV2 {
  return {
    version: '2.0',
    sessionId: 'test-sc-001',
    capturedAt: '2026-04-01T09:00:00Z',
    exportedAt: '2026-04-01T11:00:00Z',
    deviceModel: 'iPhone 15 Pro',
    roomScans: [],
    photos: [],
    voiceNotes: [],
    objectPins: [],
    floorPlanSnapshots: [],
    qaFlags: [],
    ...overrides,
  };
}

function minimalHandoff(captureOverrides: Partial<SessionCaptureV2> = {}): unknown {
  return {
    schemaVersion: 1,
    kind: 'scan-to-mind-handoff',
    visit: {
      version: '1',
      visitId: 'visit_test_001',
      createdAt: '2026-04-01T08:00:00Z',
    },
    capture: minimalCapture(captureOverrides),
  };
}

// ─── Clear store before each test ────────────────────────────────────────────

beforeEach(() => {
  clearScanHandoffStore();
});

// ─── Criterion 1: Valid payload is accepted and stored ────────────────────────

describe('Criterion 1 — valid payload is accepted and stored', () => {
  it('returns ok:true for a well-formed ScanToMindHandoffV1', () => {
    const result = receiveScanHandoff(minimalHandoff());
    expect(result.ok).toBe(true);
  });

  it('returns the visit reference on success', () => {
    const result = receiveScanHandoff(minimalHandoff());
    expect(result.ok).toBe(true);
    expect(result.visit?.visitId).toBe('visit_test_001');
  });

  it('returns the capture on success', () => {
    const result = receiveScanHandoff(minimalHandoff());
    expect(result.ok).toBe(true);
    expect(result.capture?.sessionId).toBe('test-sc-001');
  });

  it('stores the capture in the handoff store on success', () => {
    receiveScanHandoff(minimalHandoff());
    const stored = getScanCapture('visit_test_001');
    expect(stored).not.toBeNull();
    expect(stored?.sessionId).toBe('test-sc-001');
  });

  it('returns an empty errors array on success', () => {
    const result = receiveScanHandoff(minimalHandoff());
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Criterion 2: Invalid payload returns errors without storing ──────────────

describe('Criterion 2 — invalid payload returns errors without storing', () => {
  it('returns ok:false for a null payload', () => {
    const result = receiveScanHandoff(null);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns ok:false for a plain string', () => {
    const result = receiveScanHandoff('not-json');
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when schemaVersion is wrong', () => {
    const bad = { ...minimalHandoff() as Record<string, unknown>, schemaVersion: 2 };
    const result = receiveScanHandoff(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('schemaVersion'))).toBe(true);
  });

  it('returns ok:false when kind is wrong', () => {
    const bad = { ...minimalHandoff() as Record<string, unknown>, kind: 'wrong-kind' };
    const result = receiveScanHandoff(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('kind'))).toBe(true);
  });

  it('returns ok:false when visit is missing', () => {
    const bad = { schemaVersion: 1, kind: 'scan-to-mind-handoff', capture: minimalCapture() };
    const result = receiveScanHandoff(bad);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when visitId is empty', () => {
    const bad = {
      schemaVersion: 1,
      kind: 'scan-to-mind-handoff',
      visit: { version: '1', visitId: '', createdAt: '2026-01-01T00:00:00Z' },
      capture: minimalCapture(),
    };
    const result = receiveScanHandoff(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('visitId'))).toBe(true);
  });

  it('does not store anything on a failed validation', () => {
    receiveScanHandoff(null);
    expect(Object.keys(listScanCaptures())).toHaveLength(0);
  });
});

// ─── Criterion 3: QA warnings are surfaced ────────────────────────────────────

describe('Criterion 3 — QA warnings are surfaced', () => {
  it('surfaces warn-severity QA flags as warnings', () => {
    const result = receiveScanHandoff(
      minimalHandoff({
        qaFlags: [{ code: 'LOW_PHOTO_COUNT', severity: 'warn', message: 'Few photos' }],
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.some(w => w.includes('LOW_PHOTO_COUNT'))).toBe(true);
  });

  it('surfaces error-severity QA flags as warnings (does not fail the handoff)', () => {
    const result = receiveScanHandoff(
      minimalHandoff({
        qaFlags: [{ code: 'MISSING_BOILER', severity: 'error' }],
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.some(w => w.includes('MISSING_BOILER'))).toBe(true);
  });

  it('info-severity QA flags produce no warnings', () => {
    const result = receiveScanHandoff(
      minimalHandoff({
        qaFlags: [{ code: 'INFO_NOTE', severity: 'info' }],
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});

// ─── Criterion 4: scanHandoffStore round-trips ────────────────────────────────

describe('Criterion 4 — scanHandoffStore round-trips', () => {
  const capture = minimalCapture({ sessionId: 'sc-store-001' });

  it('stores and retrieves a capture by visitId', () => {
    storeScanCapture('visit_store_001', capture);
    const retrieved = getScanCapture('visit_store_001');
    expect(retrieved?.sessionId).toBe('sc-store-001');
  });

  it('returns null for an unknown visitId', () => {
    expect(getScanCapture('unknown_visit')).toBeNull();
  });

  it('overwrites an existing entry for the same visitId', () => {
    const v1 = minimalCapture({ sessionId: 'sc-v1' });
    const v2 = minimalCapture({ sessionId: 'sc-v2' });
    storeScanCapture('visit_overwrite', v1);
    storeScanCapture('visit_overwrite', v2);
    expect(getScanCapture('visit_overwrite')?.sessionId).toBe('sc-v2');
  });

  it('removeScanCapture deletes the entry', () => {
    storeScanCapture('visit_to_remove', capture);
    removeScanCapture('visit_to_remove');
    expect(getScanCapture('visit_to_remove')).toBeNull();
  });

  it('listScanCaptures returns all stored entries', () => {
    storeScanCapture('v1', minimalCapture({ sessionId: 'sc-1' }));
    storeScanCapture('v2', minimalCapture({ sessionId: 'sc-2' }));
    const all = listScanCaptures();
    expect(Object.keys(all)).toHaveLength(2);
    expect(all['v1']?.sessionId).toBe('sc-1');
    expect(all['v2']?.sessionId).toBe('sc-2');
  });

  it('clearScanHandoffStore removes all entries', () => {
    storeScanCapture('v1', capture);
    storeScanCapture('v2', capture);
    clearScanHandoffStore();
    expect(Object.keys(listScanCaptures())).toHaveLength(0);
  });

  it('uses the correct storage key', () => {
    expect(SCAN_HANDOFF_STORAGE_KEY).toBe('atlas:scan-handoffs:v1');
  });
});

// ─── Criterion 5: Canonical handoff with externalAreaScans ────────────────────

describe('Criterion 5 — canonical handoff with externalAreaScans is accepted', () => {
  it('accepts a handoff with an externalAreaScans array', () => {
    const result = receiveScanHandoff(
      minimalHandoff({
        externalAreaScans: [
          {
            scanId: 'ext-001',
            label: 'Rear elevation',
            capturedAt: '2026-04-01T10:00:00Z',
            reviewStatus: 'pending',
            photoIds: ['p-ext-001', 'p-ext-002'],
            objectPins: [
              { pinId: 'ep-001', objectType: 'flue_terminal', label: 'Rear flue exit' },
              { pinId: 'ep-002', objectType: 'obstruction', label: 'Neighbour fence' },
            ],
            measurementLines: [
              { lineId: 'ml-001', label: 'Flue to boundary', lengthM: 1.2 },
            ],
            pointCloudAssetId: 'pc-rear-001',
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a handoff without externalAreaScans (optional field)', () => {
    const result = receiveScanHandoff(minimalHandoff());
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns the externalAreaScans on the capture when present', () => {
    const result = receiveScanHandoff(
      minimalHandoff({
        externalAreaScans: [
          {
            scanId: 'ext-002',
            capturedAt: '2026-04-01T10:00:00Z',
            objectPins: [{ pinId: 'ep-100', objectType: 'flue_terminal' }],
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    const scans = Array.isArray(result.capture?.externalAreaScans)
      ? result.capture?.externalAreaScans
      : result.capture?.externalAreaScans
        ? [result.capture.externalAreaScans]
        : [];
    expect(scans).toHaveLength(1);
    expect(scans[0]?.scanId).toBe('ext-002');
  });

  it('returns ok:false for an externalAreaScans entry missing scanId', () => {
    const badScan = {
      capturedAt: '2026-04-01T10:00:00Z',
    };
    const result = receiveScanHandoff(
      minimalHandoff({ externalAreaScans: [badScan] as unknown as typeof badScan[] }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('scanId'))).toBe(true);
  });

  it('returns ok:false for an externalAreaScans entry with invalid objectType', () => {
    const result = receiveScanHandoff(
      minimalHandoff({
        externalAreaScans: [
          {
            scanId: 'ext-bad',
            capturedAt: '2026-04-01T10:00:00Z',
            objectPins: [{ pinId: 'ep-bad', objectType: 'invalid_type' }],
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('objectType'))).toBe(true);
  });
});
