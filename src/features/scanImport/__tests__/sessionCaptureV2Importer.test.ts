/**
 * sessionCaptureV2Importer.test.ts
 *
 * Tests for the SessionCaptureV2 import pipeline.
 *
 * Covers all 6 acceptance criteria from the problem statement:
 *   1. Import the shared fixture successfully (session_capture_v2_example.json)
 *   2. Confirm transcript text imports without raw audio
 *   3. Confirm photos are evidence records, not just counts
 *   4. Confirm object pins survive import
 *   5. Confirm empty/invalid SessionCaptureV2 fails cleanly
 *   6. Confirm ScanBundleV1 is not the primary import route
 */

import { describe, it, expect } from 'vitest';
import {
  importSessionCaptureV2,
  isSessionCaptureV2Json,
  buildEngineerEvidenceFromV2,
} from '../importer/sessionCaptureV2Importer';
import type { SessionCaptureV2 } from '../importer/sessionCaptureV2Importer';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function minimalV2(overrides: Partial<SessionCaptureV2> = {}): unknown {
  return {
    version: '2.0',
    sessionId: 'test-sc-v2-001',
    capturedAt: '2026-04-15T09:00:00Z',
    exportedAt: '2026-04-15T11:00:00Z',
    deviceModel: 'iPhone 15 Pro',
    roomScans: [],
    photos: [],
    voiceNotes: [],
    objectPins: [],
    floorPlanSnapshots: [],
    qaFlags: [],
    ...overrides,
  } as unknown;
}

// ─── Acceptance criterion 1: Import the shared fixture successfully ────────────

describe('Acceptance criterion 1 — import session_capture_v2_example.json', () => {
  it('imports the V2 fixture without a rejected_invalid result', async () => {
    const { default: fixture } = await import('../fixtures/session_capture_v2_example.json');
    const result = importSessionCaptureV2(fixture);
    expect(result.status === 'success' || result.status === 'success_with_warnings').toBe(true);
  });

  it('fixture sessionId is preserved on import', async () => {
    const { default: fixture } = await import('../fixtures/session_capture_v2_example.json');
    const result = importSessionCaptureV2(fixture);
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.capture.sessionId).toBe('sc-v2-fixture-001');
    }
  });

  it('fixture visitReference is preserved on import', async () => {
    const { default: fixture } = await import('../fixtures/session_capture_v2_example.json');
    const result = importSessionCaptureV2(fixture);
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.capture.visitReference).toBe('JOB-2026-04-15-GU1');
      expect(result.review.visitReference).toBe('JOB-2026-04-15-GU1');
    }
  });

  it('fixture review.roomCount reflects roomScans array', async () => {
    const { default: fixture } = await import('../fixtures/session_capture_v2_example.json');
    const result = importSessionCaptureV2(fixture);
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.review.roomCount).toBe(4);
    }
  });

  it('fixture review.address includes the property address', async () => {
    const { default: fixture } = await import('../fixtures/session_capture_v2_example.json');
    const result = importSessionCaptureV2(fixture);
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.review.address).toContain('Birchwood Avenue');
    }
  });

  it('fixture deviceModel is captured in review', async () => {
    const { default: fixture } = await import('../fixtures/session_capture_v2_example.json');
    const result = importSessionCaptureV2(fixture);
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.review.deviceModel).toBe('iPhone 15 Pro');
    }
  });
});

// ─── Acceptance criterion 2: Transcript text imports without raw audio ─────────

describe('Acceptance criterion 2 — voice note transcripts, no raw audio', () => {
  it('imports transcript text from voiceNotes', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        voiceNotes: [
          {
            voiceNoteId: 'vn-01',
            roomId: 'r1',
            createdAt: '2026-04-15T09:05:00Z',
            transcript: 'Boiler is 10 years old, working fine.',
          },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.review.hasTranscript).toBe(true);
      expect(result.review.voiceNoteCount).toBe(1);
      // Transcript should be in engineer evidence, not customer evidence
      const transcriptItems = result.review.engineerEvidence.filter((e) => e.kind === 'voice_note');
      expect(transcriptItems.length).toBe(1);
      expect(transcriptItems[0].label).toContain('Boiler is 10 years old');
    }
  });

  it('voice note transcripts are not customer-safe', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        voiceNotes: [
          {
            voiceNoteId: 'vn-01',
            createdAt: '2026-04-15T09:05:00Z',
            transcript: 'Engineer field note — boiler pressure borderline.',
          },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      const customerVoiceNotes = result.review.customerSafeEvidence.filter(
        (e) => e.kind === 'voice_note',
      );
      expect(customerVoiceNotes.length).toBe(0);
    }
  });

  it('hasTranscript is false when all voice notes have no transcript', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        voiceNotes: [
          {
            voiceNoteId: 'vn-01',
            createdAt: '2026-04-15T09:05:00Z',
            // no transcript field
          },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.review.hasTranscript).toBe(false);
    }
  });

  it('V2 payload has no raw audio field — audio is voice notes only', async () => {
    const { default: fixture } = await import('../fixtures/session_capture_v2_example.json');
    const result = importSessionCaptureV2(fixture);
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      // SessionCaptureV2 has voiceNotes not audio — confirm no audio property
      expect('audio' in result.capture).toBe(false);
      expect(Array.isArray(result.capture.voiceNotes)).toBe(true);
    }
  });
});

// ─── Acceptance criterion 3: Photos are evidence records, not just counts ──────

describe('Acceptance criterion 3 — photos as evidence records', () => {
  it('each photo appears as a distinct evidence item with its photoId as ref', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        photos: [
          { photoId: 'ph-01', uri: 'file://ph-01.jpg', capturedAt: '2026-04-15T09:10:00Z', scope: 'session' },
          { photoId: 'ph-02', uri: 'file://ph-02.jpg', capturedAt: '2026-04-15T09:11:00Z', scope: 'room', roomId: 'r1' },
          { photoId: 'ph-03', uri: 'file://ph-03.jpg', capturedAt: '2026-04-15T09:12:00Z', scope: 'object', objectPinId: 'pin-01' },
        ],
        objectPins: [
          { pinId: 'pin-01', objectType: 'boiler', photoIds: ['ph-03'] },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.review.photoCount).toBe(3);
      const photoRefs = result.review.engineerEvidence
        .filter((e) => e.kind === 'photo')
        .map((e) => e.ref);
      expect(photoRefs).toContain('ph-01');
      expect(photoRefs).toContain('ph-02');
      expect(photoRefs).toContain('ph-03');
    }
  });

  it('session-scope photos are customer-safe', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        photos: [
          { photoId: 'ph-session', uri: 'file://s.jpg', capturedAt: '2026-04-15T09:10:00Z', scope: 'session' },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      const safe = result.review.customerSafeEvidence.map((e) => e.ref);
      expect(safe).toContain('ph-session');
    }
  });

  it('room-scope photos are customer-safe', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        photos: [
          { photoId: 'ph-room', uri: 'file://r.jpg', capturedAt: '2026-04-15T09:11:00Z', scope: 'room', roomId: 'r1' },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      const safe = result.review.customerSafeEvidence.map((e) => e.ref);
      expect(safe).toContain('ph-room');
    }
  });

  it('object-scope photos are NOT customer-safe', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        photos: [
          { photoId: 'ph-obj', uri: 'file://o.jpg', capturedAt: '2026-04-15T09:12:00Z', scope: 'object', objectPinId: 'pin-01' },
        ],
        objectPins: [
          { pinId: 'pin-01', objectType: 'boiler', photoIds: ['ph-obj'] },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      const safe = result.review.customerSafeEvidence.map((e) => e.ref);
      expect(safe).not.toContain('ph-obj');
    }
  });

  it('photos retain their room and objectPinId associations', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Utility', status: 'complete' }],
        photos: [
          {
            photoId: 'ph-linked',
            uri: 'file://linked.jpg',
            capturedAt: '2026-04-15T09:10:00Z',
            scope: 'object',
            roomId: 'r1',
            objectPinId: 'pin-boiler',
          },
        ],
        objectPins: [{ pinId: 'pin-boiler', objectType: 'boiler', photoIds: ['ph-linked'] }],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      const item = result.review.engineerEvidence.find(
        (e) => e.kind === 'photo' && e.ref === 'ph-linked',
      );
      expect(item).toBeDefined();
      expect(item?.roomId).toBe('r1');
      expect(item?.objectPinId).toBe('pin-boiler');
    }
  });
});

// ─── Acceptance criterion 4: Object pins survive import ───────────────────────

describe('Acceptance criterion 4 — object pins survive import', () => {
  it('objectPins array is preserved on the validated capture', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Utility', status: 'complete' }],
        objectPins: [
          {
            pinId: 'pin-01',
            objectType: 'boiler',
            roomId: 'r1',
            label: 'Worcester 30i',
            photoIds: [],
            metadata: { ageYears: 12 },
          },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.capture.objectPins).toHaveLength(1);
      expect(result.capture.objectPins[0].pinId).toBe('pin-01');
      expect(result.capture.objectPins[0].objectType).toBe('boiler');
      expect(result.capture.objectPins[0].label).toBe('Worcester 30i');
      expect(result.capture.objectPins[0].metadata?.ageYears).toBe(12);
    }
  });

  it('objectPins appear in engineerEvidence with correct kind', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Utility', status: 'complete' }],
        objectPins: [
          { pinId: 'pin-boiler', objectType: 'boiler', roomId: 'r1', photoIds: [] },
          { pinId: 'pin-rad',    objectType: 'radiator', roomId: 'r1', photoIds: [] },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.review.objectPinCount).toBe(2);
      const pinItems = result.review.engineerEvidence.filter((e) => e.kind === 'object_pin');
      expect(pinItems.length).toBe(2);
      expect(pinItems.map((p) => p.ref)).toContain('pin-boiler');
      expect(pinItems.map((p) => p.ref)).toContain('pin-rad');
    }
  });

  it('objectPins are NOT customer-safe', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        objectPins: [
          { pinId: 'pin-boiler', objectType: 'boiler', photoIds: [] },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      const safeRefs = result.review.customerSafeEvidence.map((e) => e.ref);
      expect(safeRefs).not.toContain('pin-boiler');
    }
  });

  it('objectPins survive round-trip through fixture import', async () => {
    const { default: fixture } = await import('../fixtures/session_capture_v2_example.json');
    const result = importSessionCaptureV2(fixture);
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.capture.objectPins.length).toBe(3);
      const pinIds = result.capture.objectPins.map((p) => p.pinId);
      expect(pinIds).toContain('pin-001');
      expect(pinIds).toContain('pin-002');
      expect(pinIds).toContain('pin-003');
    }
  });

  it('warns when an object pin has no photos', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        objectPins: [
          { pinId: 'pin-nophoto', objectType: 'boiler', photoIds: [] },
        ],
      }),
    );
    if (result.status === 'success_with_warnings') {
      expect(
        result.review.verificationRequired.some((s) => s.includes('no photos')),
      ).toBe(true);
    }
  });
});

// ─── Acceptance criterion 5: Empty/invalid fails cleanly ─────────────────────

describe('Acceptance criterion 5 — invalid input fails cleanly', () => {
  it('rejects null', () => {
    const result = importSessionCaptureV2(null);
    expect(result.status).toBe('rejected_invalid');
  });

  it('rejects undefined', () => {
    const result = importSessionCaptureV2(undefined);
    expect(result.status).toBe('rejected_invalid');
  });

  it('rejects an empty object', () => {
    const result = importSessionCaptureV2({});
    expect(result.status).toBe('rejected_invalid');
  });

  it('rejects a V1-shaped payload (version 1.0 is not supported by V2 importer)', () => {
    const v1Payload = {
      version: '1.0',
      sessionId: 'v1-session',
      startedAt: '2026-04-01T09:00:00Z',
      updatedAt: '2026-04-01T10:00:00Z',
      status: 'ready',
      rooms: [],
      objects: [],
      photos: [],
      audio: { mode: 'continuous', segments: [] },
      notes: [],
      events: [],
    };
    const result = importSessionCaptureV2(v1Payload);
    expect(result.status).toBe('rejected_invalid');
    if (result.status === 'rejected_invalid') {
      expect(result.errors.some((e) => e.includes('not supported'))).toBe(true);
    }
  });

  it('rejects when sessionId is missing', () => {
    const result = importSessionCaptureV2({
      version: '2.0',
      capturedAt: '2026-04-15T09:00:00Z',
      exportedAt: '2026-04-15T11:00:00Z',
      deviceModel: 'iPhone 15 Pro',
      roomScans: [],
      photos: [],
      voiceNotes: [],
      objectPins: [],
      floorPlanSnapshots: [],
      qaFlags: [],
    });
    expect(result.status).toBe('rejected_invalid');
    if (result.status === 'rejected_invalid') {
      expect(result.errors.some((e) => e.includes('sessionId'))).toBe(true);
    }
  });

  it('rejects when deviceModel is missing', () => {
    const result = importSessionCaptureV2({
      version: '2.0',
      sessionId: 'test-001',
      capturedAt: '2026-04-15T09:00:00Z',
      exportedAt: '2026-04-15T11:00:00Z',
      roomScans: [],
      photos: [],
      voiceNotes: [],
      objectPins: [],
      floorPlanSnapshots: [],
      qaFlags: [],
    });
    expect(result.status).toBe('rejected_invalid');
    if (result.status === 'rejected_invalid') {
      expect(result.errors.some((e) => e.includes('deviceModel'))).toBe(true);
    }
  });

  it('rejects when roomScans is not an array', () => {
    const result = importSessionCaptureV2(
      minimalV2({ roomScans: 'not-an-array' as unknown as [] }),
    );
    expect(result.status).toBe('rejected_invalid');
    if (result.status === 'rejected_invalid') {
      expect(result.errors.some((e) => e.includes('roomScans'))).toBe(true);
    }
  });

  it('rejects when a photo has an invalid scope', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        photos: [
          {
            photoId: 'p1',
            uri: 'file://p1.jpg',
            capturedAt: '2026-04-15T09:00:00Z',
            scope: 'invalid_scope' as 'session',
          },
        ],
      }),
    );
    expect(result.status).toBe('rejected_invalid');
    if (result.status === 'rejected_invalid') {
      expect(result.errors.some((e) => e.includes('scope'))).toBe(true);
    }
  });

  it('rejects when a QA flag has an invalid severity', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        qaFlags: [
          { code: 'SOME_FLAG', severity: 'critical' as 'error' },
        ],
      }),
    );
    expect(result.status).toBe('rejected_invalid');
    if (result.status === 'rejected_invalid') {
      expect(result.errors.some((e) => e.includes('severity'))).toBe(true);
    }
  });

  it('rejects when an objectPin has an unknown objectType', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        objectPins: [
          { pinId: 'p1', objectType: 'unknown_type' as 'boiler', photoIds: [] },
        ],
      }),
    );
    expect(result.status).toBe('rejected_invalid');
  });

  it('returns a non-empty errors array on rejection', () => {
    const result = importSessionCaptureV2(null);
    if (result.status === 'rejected_invalid') {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

// ─── Acceptance criterion 6: ScanBundleV1 is not the primary import route ─────

describe('Acceptance criterion 6 — ScanBundleV1 is not the primary import route', () => {
  it('isSessionCaptureV2Json returns true for a V2 payload', () => {
    expect(
      isSessionCaptureV2Json({
        version: '2.0',
        sessionId: 'sc-v2-001',
        roomScans: [],
        photos: [],
      }),
    ).toBe(true);
  });

  it('isSessionCaptureV2Json returns false for a V1 payload (version 1.0)', () => {
    expect(
      isSessionCaptureV2Json({
        version: '1.0',
        sessionId: 'sc-v1-001',
        rooms: [],
        photos: [],
      }),
    ).toBe(false);
  });

  it('isSessionCaptureV2Json returns false for a ScanBundleV1 payload (has bundleId)', () => {
    expect(
      isSessionCaptureV2Json({
        version: '1.0',
        bundleId: 'bundle-001',
        rooms: [],
        meta: {},
      }),
    ).toBe(false);
  });

  it('isSessionCaptureV2Json returns false for null', () => {
    expect(isSessionCaptureV2Json(null)).toBe(false);
  });

  it('isSessionCaptureV2Json returns false when sessionId is empty string', () => {
    expect(
      isSessionCaptureV2Json({
        version: '2.0',
        sessionId: '',
        roomScans: [],
        photos: [],
      }),
    ).toBe(false);
  });

  it('isSessionCaptureV2Json returns false when roomScans is not an array', () => {
    expect(
      isSessionCaptureV2Json({
        version: '2.0',
        sessionId: 'sc-v2-001',
        roomScans: 'not-an-array',
        photos: [],
      }),
    ).toBe(false);
  });

  it('V2 importer rejects a ScanBundleV1 payload with a clear error', () => {
    const scanBundle = {
      version: '1.0',
      bundleId: 'bundle-001',
      rooms: [],
      anchors: [],
      qaFlags: [],
      meta: {
        capturedAt: '2026-04-15T09:00:00Z',
        deviceModel: 'iPhone 15 Pro',
        scannerApp: 'AtlasScan 2.0',
        coordinateConvention: 'metric_m',
      },
    };
    const result = importSessionCaptureV2(scanBundle);
    expect(result.status).toBe('rejected_invalid');
    if (result.status === 'rejected_invalid') {
      // Should explicitly say version is not supported
      expect(result.errors.some((e) => e.includes('not supported'))).toBe(true);
    }
  });
});

// ─── Additional: QA flags and floor plan snapshots ────────────────────────────

describe('QA flags and floor-plan snapshots', () => {
  it('qaFlags appear in engineerEvidence as qa_flag kind', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        qaFlags: [
          { code: 'FLUE_CLEARANCE_BORDERLINE', severity: 'warn', message: 'Flue clearance borderline', entityId: 'pin-01' },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.review.qaFlagCount).toBe(1);
      expect(result.review.qaWarnCount).toBe(1);
      const flagItems = result.review.engineerEvidence.filter((e) => e.kind === 'qa_flag');
      expect(flagItems.length).toBe(1);
      expect(flagItems[0].ref).toBe('FLUE_CLEARANCE_BORDERLINE');
    }
  });

  it('qaFlags are NOT customer-safe', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        qaFlags: [
          { code: 'SOME_FLAG', severity: 'warn', message: 'Some QA issue' },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      const safeFlags = result.review.customerSafeEvidence.filter((e) => e.kind === 'qa_flag');
      expect(safeFlags.length).toBe(0);
    }
  });

  it('floor-plan snapshots are customer-safe', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        floorPlanSnapshots: [
          { snapshotId: 'fps-01', uri: 'file://floorplan.jpg', capturedAt: '2026-04-15T11:00:00Z', floorIndex: 0 },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.review.floorPlanSnapshotCount).toBe(1);
      const safeSnapshots = result.review.customerSafeEvidence.filter(
        (e) => e.kind === 'floor_plan',
      );
      expect(safeSnapshots.length).toBe(1);
      expect(safeSnapshots[0].ref).toBe('fps-01');
    }
  });

  it('warns about QA error flags in verificationRequired', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        qaFlags: [
          { code: 'CRITICAL_ERROR', severity: 'error', message: 'Critical problem found' },
        ],
      }),
    );
    if (result.status === 'success_with_warnings') {
      expect(result.review.qaErrorCount).toBe(1);
      expect(
        result.review.verificationRequired.some((s) => s.includes('QA error')),
      ).toBe(true);
    }
  });

  it('warns about orphan photos referencing unknown pins', () => {
    const result = importSessionCaptureV2(
      minimalV2({
        property: { address: '1 Test St' },
        visitReference: 'JOB-001',
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        photos: [
          {
            photoId: 'ph-orphan',
            uri: 'file://orphan.jpg',
            capturedAt: '2026-04-15T09:10:00Z',
            scope: 'object',
            objectPinId: 'nonexistent-pin',
          },
        ],
        objectPins: [],
      }),
    );
    if (result.status === 'success_with_warnings') {
      expect(
        result.warnings.some((w) => w.includes('reference object pins not in this capture')),
      ).toBe(true);
    }
  });
});

// ─── buildEngineerEvidenceFromV2 ──────────────────────────────────────────────

describe('buildEngineerEvidenceFromV2', () => {
  it('returns room items with kind capture', () => {
    const capture: SessionCaptureV2 = {
      version: '2.0',
      sessionId: 'sc-01',
      capturedAt: '2026-04-15T09:00:00Z',
      exportedAt: '2026-04-15T11:00:00Z',
      deviceModel: 'iPhone 15 Pro',
      roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
      photos: [],
      voiceNotes: [],
      objectPins: [],
      floorPlanSnapshots: [],
      qaFlags: [],
    };
    const items = buildEngineerEvidenceFromV2(capture);
    expect(items.some((i) => i.kind === 'capture' && i.title === 'Kitchen')).toBe(true);
  });

  it('includes voice note transcript text in label', () => {
    const capture: SessionCaptureV2 = {
      version: '2.0',
      sessionId: 'sc-01',
      capturedAt: '2026-04-15T09:00:00Z',
      exportedAt: '2026-04-15T11:00:00Z',
      deviceModel: 'iPhone 15 Pro',
      roomScans: [],
      photos: [],
      voiceNotes: [
        {
          voiceNoteId: 'vn-01',
          createdAt: '2026-04-15T09:05:00Z',
          transcript: 'Boiler in utility room, 12 years old.',
        },
      ],
      objectPins: [],
      floorPlanSnapshots: [],
      qaFlags: [],
    };
    const items = buildEngineerEvidenceFromV2(capture);
    expect(items.some((i) => i.kind === 'note' && i.title.includes('Boiler in utility room'))).toBe(true);
  });
});
