/**
 * captureReviewModel.test.ts
 *
 * Tests for buildCaptureReviewModel and buildHandoffFromV2Capture.
 *
 * Covers:
 *   - photo-only capture imports successfully
 *   - LiDAR-inferred pins are marked as needing review, not confirmed
 *   - CaptureReviewModel has full evidence arrays (not just counts)
 *   - Customer proof excludes object-scope photos, QA flags, LiDAR pins
 *   - Engineer handoff includes all evidence with correct confidence signals
 */

import { describe, it, expect } from 'vitest';
import { buildCaptureReviewModel } from '../importer/captureReviewModel';
import {
  buildEngineerHandoffFromV2,
  buildCustomerProofFromV2,
} from '../importer/buildHandoffFromV2Capture';
import { importSessionCaptureV2 } from '../importer/sessionCaptureV2Importer';
import type { SessionCaptureV2 } from '../importer/sessionCaptureV2Importer';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function minimalCapture(overrides: Partial<SessionCaptureV2> = {}): SessionCaptureV2 {
  return {
    version: '2.0',
    sessionId: 'sc-test-001',
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
  };
}

// ─── buildCaptureReviewModel ──────────────────────────────────────────────────

describe('buildCaptureReviewModel', () => {
  it('returns all required top-level fields', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({ visitReference: 'JOB-001' }),
    );
    expect(model.sessionId).toBe('sc-test-001');
    expect(model.visitReference).toBe('JOB-001');
    expect(model.capturedAt).toBe('2026-04-15T09:00:00Z');
    expect(model.exportedAt).toBe('2026-04-15T11:00:00Z');
    expect(model.deviceModel).toBe('iPhone 15 Pro');
  });

  it('normalises rooms as full objects, not just a count', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        roomScans: [
          { roomId: 'r1', label: 'Kitchen', status: 'complete', floorIndex: 0, areaM2: 14.5 },
        ],
      }),
    );
    expect(model.rooms).toHaveLength(1);
    expect(model.rooms[0].roomId).toBe('r1');
    expect(model.rooms[0].label).toBe('Kitchen');
    expect(model.rooms[0].areaM2).toBe(14.5);
  });

  it('normalises photos with customerSafe signal', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        photos: [
          { photoId: 'ph-session', uri: 'file://s.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
          { photoId: 'ph-room', uri: 'file://r.jpg', capturedAt: '2026-04-15T09:01:00Z', scope: 'room', roomId: 'r1' },
          { photoId: 'ph-object', uri: 'file://o.jpg', capturedAt: '2026-04-15T09:02:00Z', scope: 'object', objectPinId: 'pin-01' },
        ],
        objectPins: [{ pinId: 'pin-01', objectType: 'boiler', photoIds: ['ph-object'] }],
      }),
    );
    expect(model.photos).toHaveLength(3);
    expect(model.photos.find((p) => p.photoId === 'ph-session')?.customerSafe).toBe(true);
    expect(model.photos.find((p) => p.photoId === 'ph-room')?.customerSafe).toBe(true);
    expect(model.photos.find((p) => p.photoId === 'ph-object')?.customerSafe).toBe(false);
  });

  it('customerSafePhotoIds contains only session and room photos', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        photos: [
          { photoId: 'ph-s', uri: 'file://s.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
          { photoId: 'ph-o', uri: 'file://o.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'object', objectPinId: 'pin-01' },
        ],
        objectPins: [{ pinId: 'pin-01', objectType: 'boiler', photoIds: ['ph-o'] }],
      }),
    );
    expect(model.customerSafePhotoIds).toContain('ph-s');
    expect(model.customerSafePhotoIds).not.toContain('ph-o');
  });

  it('normalises voice notes with transcript text', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        voiceNotes: [
          { voiceNoteId: 'vn-01', createdAt: '2026-04-15T09:05:00Z', transcript: 'Boiler note.' },
        ],
      }),
    );
    expect(model.voiceNotes).toHaveLength(1);
    expect(model.voiceNotes[0].transcript).toBe('Boiler note.');
    expect(model.hasTranscript).toBe(true);
  });

  it('hasTranscript is false when no transcripts are present', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        voiceNotes: [{ voiceNoteId: 'vn-01', createdAt: '2026-04-15T09:05:00Z' }],
      }),
    );
    expect(model.hasTranscript).toBe(false);
  });

  it('normalises floorPlanSnapshots', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        floorPlanSnapshots: [
          { snapshotId: 'fps-01', uri: 'file://fp.jpg', capturedAt: '2026-04-15T11:00:00Z', floorIndex: 0 },
        ],
      }),
    );
    expect(model.floorPlanSnapshots).toHaveLength(1);
    expect(model.floorPlanSnapshots[0].snapshotId).toBe('fps-01');
    expect(model.customerSafeFloorPlanIds).toContain('fps-01');
  });

  it('normalises qaFlags', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        qaFlags: [
          { code: 'FLUE_CLEARANCE_BORDERLINE', severity: 'warn', message: 'Borderline flue clearance' },
        ],
      }),
    );
    expect(model.qaFlags).toHaveLength(1);
    expect(model.qaFlags[0].code).toBe('FLUE_CLEARANCE_BORDERLINE');
    expect(model.qaFlags[0].severity).toBe('warn');
  });

  it('formats address from property fields', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({ property: { address: '22 Birchwood Avenue, Guildford', postcode: 'GU2 4RX' } }),
    );
    expect(model.address).toContain('Birchwood Avenue');
    expect(model.address).toContain('GU2 4RX');
  });

  it('address is undefined when property is absent', () => {
    const model = buildCaptureReviewModel(minimalCapture());
    expect(model.address).toBeUndefined();
  });

  it('evidenceWarnings includes warning when visitReference is absent', () => {
    const model = buildCaptureReviewModel(minimalCapture());
    expect(model.evidenceWarnings.some((w) => w.includes('Visit reference'))).toBe(true);
  });

  it('evidenceWarnings is empty for a complete, fully-linked capture', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        visitReference: 'JOB-001',
        property: { address: '1 Test St' },
        roomScans: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        objectPins: [
          { pinId: 'pin-01', objectType: 'boiler', roomId: 'r1', photoIds: ['ph-01'] },
        ],
        photos: [
          { photoId: 'ph-01', uri: 'file://ph.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'object', objectPinId: 'pin-01' },
        ],
      }),
    );
    expect(model.evidenceWarnings).toHaveLength(0);
  });
});

// ─── Photo-only capture ───────────────────────────────────────────────────────

describe('photo-only capture imports successfully', () => {
  it('buildCaptureReviewModel succeeds with only photos (no rooms, no pins)', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        visitReference: 'JOB-001',
        property: { address: '1 Test St' },
        photos: [
          { photoId: 'ph-01', uri: 'file://ph-01.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
          { photoId: 'ph-02', uri: 'file://ph-02.jpg', capturedAt: '2026-04-15T09:01:00Z', scope: 'session' },
        ],
      }),
    );
    expect(model.photos).toHaveLength(2);
    expect(model.rooms).toHaveLength(0);
    expect(model.objectPins).toHaveLength(0);
    expect(model.customerSafePhotoIds).toHaveLength(2);
  });

  it('photo-only capture has no rooms warning but no rejection', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        visitReference: 'JOB-001',
        property: { address: '1 Test St' },
        photos: [
          { photoId: 'ph-01', uri: 'file://ph-01.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
        ],
      }),
    );
    // Photo-only is valid — no rejection, just a "no room scans" warning
    expect(model.rooms).toHaveLength(0);
    expect(model.photos).toHaveLength(1);
    expect(model.evidenceWarnings.some((w) => w.includes('No room scans'))).toBe(true);
  });

  it('engineer handoff can be built from photo-only capture', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        visitReference: 'JOB-001',
        property: { address: '1 Test St' },
        photos: [
          { photoId: 'ph-01', uri: 'file://ph-01.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
        ],
      }),
    );
    const handoff = buildEngineerHandoffFromV2(model);
    expect(handoff.items.some((i) => i.kind === 'photo' && i.ref === 'ph-01')).toBe(true);
  });

  it('customer proof can be built from photo-only capture', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        visitReference: 'JOB-001',
        property: { address: '1 Test St' },
        photos: [
          { photoId: 'ph-01', uri: 'file://ph-01.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
        ],
      }),
    );
    const proof = buildCustomerProofFromV2(model);
    expect(proof.items.some((i) => i.kind === 'photo')).toBe(true);
    expect(proof.capturedOnSiteStatement).toContain('Captured on site');
  });
});

// ─── LiDAR-inferred pins are not confirmed ────────────────────────────────────

describe('LiDAR-inferred pins are marked as needing review, not confirmed', () => {
  it('pin with inferredByLidar=true has needsConfirmation=true in review model', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        visitReference: 'JOB-001',
        property: { address: '1 Test St' },
        objectPins: [
          {
            pinId: 'pin-lidar',
            objectType: 'radiator',
            photoIds: [],
            metadata: { inferredByLidar: true },
          },
        ],
      }),
    );
    const pin = model.objectPins.find((p) => p.pinId === 'pin-lidar');
    expect(pin).toBeDefined();
    expect(pin?.needsConfirmation).toBe(true);
  });

  it('pin without inferredByLidar has needsConfirmation=false', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        visitReference: 'JOB-001',
        property: { address: '1 Test St' },
        objectPins: [
          { pinId: 'pin-manual', objectType: 'boiler', photoIds: ['ph-01'] },
        ],
        photos: [
          { photoId: 'ph-01', uri: 'file://ph.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'object', objectPinId: 'pin-manual' },
        ],
      }),
    );
    const pin = model.objectPins.find((p) => p.pinId === 'pin-manual');
    expect(pin?.needsConfirmation).toBe(false);
  });

  it('LiDAR-inferred pin produces an evidenceWarning', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        visitReference: 'JOB-001',
        property: { address: '1 Test St' },
        objectPins: [
          {
            pinId: 'pin-lidar',
            objectType: 'pipe',
            photoIds: [],
            metadata: { inferredByLidar: true },
          },
        ],
      }),
    );
    expect(
      model.evidenceWarnings.some((w) => w.includes('inferred by LiDAR')),
    ).toBe(true);
  });

  it('engineer handoff shows LiDAR-inferred pin with confidence inferred', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        visitReference: 'JOB-001',
        property: { address: '1 Test St' },
        objectPins: [
          {
            pinId: 'pin-lidar',
            objectType: 'radiator',
            label: 'LiDAR Radiator',
            photoIds: [],
            metadata: { inferredByLidar: true },
          },
        ],
      }),
    );
    const handoff = buildEngineerHandoffFromV2(model);
    const pinItem = handoff.items.find((i) => i.kind === 'object_pin' && i.ref === 'pin-lidar');
    expect(pinItem).toBeDefined();
    expect(pinItem?.confidence).toBe('inferred');
  });

  it('customer proof does NOT include LiDAR-inferred object pins', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        visitReference: 'JOB-001',
        property: { address: '1 Test St' },
        objectPins: [
          {
            pinId: 'pin-lidar',
            objectType: 'radiator',
            photoIds: [],
            metadata: { inferredByLidar: true },
          },
        ],
      }),
    );
    const proof = buildCustomerProofFromV2(model);
    expect(proof.items.some((i) => i.kind === 'object_pin' as unknown)).toBe(false);
  });

  it('sessionCaptureV2Importer verificationRequired includes LiDAR pin warning', () => {
    // The importer itself also flags LiDAR-inferred pins
    const result = importSessionCaptureV2({
      version: '2.0',
      sessionId: 'sc-lidar-test',
      capturedAt: '2026-04-15T09:00:00Z',
      exportedAt: '2026-04-15T11:00:00Z',
      deviceModel: 'iPhone 15 Pro',
      property: { address: '1 Test St' },
      visitReference: 'JOB-001',
      roomScans: [{ roomId: 'r1', label: 'Hall', status: 'complete' }],
      photos: [],
      voiceNotes: [],
      objectPins: [
        {
          pinId: 'pin-lidar',
          objectType: 'pipe',
          photoIds: [],
          metadata: { inferredByLidar: true },
        },
      ],
      floorPlanSnapshots: [],
      qaFlags: [],
    });
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(
        result.review.verificationRequired.some((s: string) =>
          s.includes('LiDAR') || s.includes('confirm'),
        ),
      ).toBe(true);
    }
  });
});

// ─── buildEngineerHandoffFromV2 ───────────────────────────────────────────────

describe('buildEngineerHandoffFromV2', () => {
  it('includes rooms, pins, photos, voice notes, floor plans, QA flags', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        visitReference: 'JOB-001',
        property: { address: '1 Test St' },
        roomScans: [{ roomId: 'r1', label: 'Utility', status: 'complete' }],
        objectPins: [{ pinId: 'pin-01', objectType: 'boiler', roomId: 'r1', photoIds: ['ph-01'] }],
        photos: [
          { photoId: 'ph-01', uri: 'file://ph.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'object', objectPinId: 'pin-01' },
        ],
        voiceNotes: [
          { voiceNoteId: 'vn-01', createdAt: '2026-04-15T09:05:00Z', transcript: 'Boiler note.' },
        ],
        floorPlanSnapshots: [
          { snapshotId: 'fps-01', uri: 'file://fp.jpg', capturedAt: '2026-04-15T11:00:00Z', floorIndex: 0 },
        ],
        qaFlags: [{ code: 'TEST_FLAG', severity: 'warn', message: 'Test warning' }],
      }),
    );
    const handoff = buildEngineerHandoffFromV2(model);
    const kinds = handoff.items.map((i) => i.kind);
    expect(kinds).toContain('room');
    expect(kinds).toContain('object_pin');
    expect(kinds).toContain('photo');
    expect(kinds).toContain('voice_note');
    expect(kinds).toContain('floor_plan');
    expect(kinds).toContain('qa_flag');
  });

  it('does not include qa_flag items with severity info', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        qaFlags: [{ code: 'INFO_FLAG', severity: 'info', message: 'Just info' }],
      }),
    );
    const handoff = buildEngineerHandoffFromV2(model);
    expect(handoff.items.some((i) => i.kind === 'qa_flag')).toBe(false);
  });

  it('incomplete room has confidence review', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        roomScans: [{ roomId: 'r1', label: 'Loft', status: 'active' }],
      }),
    );
    const handoff = buildEngineerHandoffFromV2(model);
    const room = handoff.items.find((i) => i.kind === 'room' && i.ref === 'r1');
    expect(room?.confidence).toBe('review');
  });
});

// ─── buildCustomerProofFromV2 ─────────────────────────────────────────────────

describe('buildCustomerProofFromV2', () => {
  it('only includes complete rooms in customer proof', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        roomScans: [
          { roomId: 'r1', label: 'Kitchen', status: 'complete' },
          { roomId: 'r2', label: 'Loft', status: 'active' },
        ],
      }),
    );
    const proof = buildCustomerProofFromV2(model);
    const roomRefs = proof.items.filter((i) => i.kind === 'room').map((i) => i.ref);
    expect(roomRefs).toContain('r1');
    expect(roomRefs).not.toContain('r2');
  });

  it('does not include QA flags', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        qaFlags: [{ code: 'SOME_FLAG', severity: 'warn', message: 'Issue found' }],
      }),
    );
    const proof = buildCustomerProofFromV2(model);
    expect(proof.items.some((i) => i.kind === 'qa_flag' as unknown)).toBe(false);
  });

  it('does not include object-scope photos', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        photos: [
          { photoId: 'ph-obj', uri: 'file://o.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'object', objectPinId: 'pin-01' },
        ],
        objectPins: [{ pinId: 'pin-01', objectType: 'boiler', photoIds: ['ph-obj'] }],
      }),
    );
    const proof = buildCustomerProofFromV2(model);
    const photoRefs = proof.items.filter((i) => i.kind === 'photo').map((i) => i.ref);
    expect(photoRefs).not.toContain('ph-obj');
  });

  it('includes floor-plan snapshots in customer proof', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        floorPlanSnapshots: [
          { snapshotId: 'fps-01', uri: 'file://fp.jpg', capturedAt: '2026-04-15T11:00:00Z', floorIndex: 0 },
        ],
      }),
    );
    const proof = buildCustomerProofFromV2(model);
    expect(proof.items.some((i) => i.kind === 'floor_plan')).toBe(true);
  });

  it('capturedOnSiteStatement includes address when present', () => {
    const model = buildCaptureReviewModel(
      minimalCapture({
        property: { address: '22 Birchwood Avenue, Guildford', postcode: 'GU2 4RX' },
      }),
    );
    const proof = buildCustomerProofFromV2(model);
    expect(proof.capturedOnSiteStatement).toContain('Birchwood Avenue');
    expect(proof.capturedOnSiteStatement).toContain('Captured on site');
  });

  it('capturedOnSiteStatement is generic without address', () => {
    const model = buildCaptureReviewModel(minimalCapture());
    const proof = buildCustomerProofFromV2(model);
    expect(proof.capturedOnSiteStatement).toContain('Captured on site');
    expect(proof.capturedOnSiteStatement).not.toContain('undefined');
  });
});

// ─── V2 fixture round-trip ────────────────────────────────────────────────────

describe('V2 fixture round-trip through buildCaptureReviewModel', () => {
  it('builds a review model from the V2 fixture with all arrays populated', async () => {
    const { default: fixture } = await import('../fixtures/session_capture_v2_example.json');
    const model = buildCaptureReviewModel(fixture as unknown as SessionCaptureV2);
    expect(model.rooms).toHaveLength(4);
    expect(model.photos).toHaveLength(5);
    expect(model.voiceNotes).toHaveLength(2);
    expect(model.objectPins).toHaveLength(3);
    expect(model.floorPlanSnapshots).toHaveLength(1);
    expect(model.qaFlags).toHaveLength(2);
  });

  it('fixture address includes Birchwood Avenue', async () => {
    const { default: fixture } = await import('../fixtures/session_capture_v2_example.json');
    const model = buildCaptureReviewModel(fixture as unknown as SessionCaptureV2);
    expect(model.address).toContain('Birchwood Avenue');
  });

  it('fixture customer-safe photo IDs are room and session scope only', async () => {
    const { default: fixture } = await import('../fixtures/session_capture_v2_example.json');
    const model = buildCaptureReviewModel(fixture as unknown as SessionCaptureV2);
    // fixture has ph-v2-001 (object), ph-v2-002 (object), ph-v2-003 (room),
    // ph-v2-004 (room), ph-v2-005 (session)
    expect(model.customerSafePhotoIds).not.toContain('ph-v2-001');
    expect(model.customerSafePhotoIds).not.toContain('ph-v2-002');
    expect(model.customerSafePhotoIds).toContain('ph-v2-003');
    expect(model.customerSafePhotoIds).toContain('ph-v2-004');
    expect(model.customerSafePhotoIds).toContain('ph-v2-005');
  });
});
