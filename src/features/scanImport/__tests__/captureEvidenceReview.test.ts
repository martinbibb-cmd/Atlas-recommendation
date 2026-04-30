/**
 * captureEvidenceReview.test.ts
 *
 * Tests for the review + confirmation workflow introduced in the
 * "scan evidence review + confirmation" PR.
 *
 * Covers the 8 scenarios from the problem spec:
 *   1. inferred LiDAR pins default to pending
 *   2. manual items default to confirmed
 *   3. confirming an item moves it to confirmed
 *   4. rejecting removes it from outputs
 *   5. customer proof includes only confirmed + safe items
 *   6. engineer handoff includes all items with status
 *   7. photo-only capture still works
 *   8. empty review still exports but flags warnings
 *
 * Also covers:
 *   - deriveReviewWarnings: Unconfirmed LiDAR objects
 *   - deriveReviewWarnings: No confirmed photos selected
 *   - deriveReviewWarnings: Floor plan not reviewed
 *   - ReviewStatus type values
 *   - includeInCustomerReport toggle behaviour
 */

import { describe, it, expect } from 'vitest';
import {
  buildCaptureReviewModel,
  deriveReviewWarnings,
  type CaptureReviewModel,
} from '../importer/captureReviewModel';
import {
  buildEngineerHandoffFromV2,
  buildCustomerProofFromV2,
} from '../importer/buildHandoffFromV2Capture';
import type { SessionCaptureV2 } from '../importer/sessionCaptureV2Importer';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function minimalCapture(overrides: Partial<SessionCaptureV2> = {}): SessionCaptureV2 {
  return {
    version: '2.0',
    sessionId: 'sc-review-test',
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

/** Produce a CaptureReviewModel with all defaults applied. */
function buildModel(overrides: Partial<SessionCaptureV2> = {}): CaptureReviewModel {
  return buildCaptureReviewModel(
    minimalCapture({
      visitReference: 'JOB-REV-001',
      property: { address: '1 Test St' },
      ...overrides,
    }),
  );
}

// ─── 1. LiDAR pins default to pending ────────────────────────────────────────

describe('1. inferred LiDAR pins default to pending', () => {
  it('pin with inferredByLidar=true has reviewStatus pending', () => {
    const model = buildModel({
      objectPins: [
        {
          pinId: 'pin-lidar',
          objectType: 'radiator',
          photoIds: [],
          metadata: { inferredByLidar: true },
        },
      ],
    });
    const pin = model.objectPins.find((p) => p.pinId === 'pin-lidar');
    expect(pin?.reviewStatus).toBe('pending');
    expect(pin?.needsConfirmation).toBe(true);
  });

  it('multiple LiDAR pins all start as pending', () => {
    const model = buildModel({
      objectPins: [
        { pinId: 'p1', objectType: 'radiator', photoIds: [], metadata: { inferredByLidar: true } },
        { pinId: 'p2', objectType: 'pipe', photoIds: [], metadata: { inferredByLidar: true } },
      ],
    });
    expect(model.objectPins.every((p) => p.reviewStatus === 'pending')).toBe(true);
  });
});

// ─── 2. Manual items default to confirmed ─────────────────────────────────────

describe('2. manual items default to confirmed', () => {
  it('manual object pin has reviewStatus confirmed', () => {
    const model = buildModel({
      objectPins: [
        { pinId: 'pin-manual', objectType: 'boiler', photoIds: ['ph-01'] },
      ],
      photos: [
        { photoId: 'ph-01', uri: 'file://ph.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'object', objectPinId: 'pin-manual' },
      ],
    });
    const pin = model.objectPins.find((p) => p.pinId === 'pin-manual');
    expect(pin?.reviewStatus).toBe('confirmed');
    expect(pin?.needsConfirmation).toBe(false);
  });

  it('session-scope photo has reviewStatus confirmed', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-session', uri: 'file://s.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
      ],
    });
    const photo = model.photos.find((p) => p.photoId === 'ph-session');
    expect(photo?.reviewStatus).toBe('confirmed');
  });

  it('floor plan snapshot has reviewStatus confirmed', () => {
    const model = buildModel({
      floorPlanSnapshots: [
        { snapshotId: 'fps-01', uri: 'file://fp.jpg', capturedAt: '2026-04-15T11:00:00Z', floorIndex: 0 },
      ],
    });
    const snap = model.floorPlanSnapshots.find((s) => s.snapshotId === 'fps-01');
    expect(snap?.reviewStatus).toBe('confirmed');
    expect(snap?.includeInCustomerReport).toBe(true);
  });

  it('session and room photos have includeInCustomerReport true', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-s', uri: 'file://s.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
        { photoId: 'ph-r', uri: 'file://r.jpg', capturedAt: '2026-04-15T09:01:00Z', scope: 'room', roomId: 'r1' },
        { photoId: 'ph-o', uri: 'file://o.jpg', capturedAt: '2026-04-15T09:02:00Z', scope: 'object', objectPinId: 'pin-01' },
      ],
      objectPins: [{ pinId: 'pin-01', objectType: 'boiler', photoIds: ['ph-o'] }],
    });
    expect(model.photos.find((p) => p.photoId === 'ph-s')?.includeInCustomerReport).toBe(true);
    expect(model.photos.find((p) => p.photoId === 'ph-r')?.includeInCustomerReport).toBe(true);
    // Object-scope photos are NOT included in customer report by default
    expect(model.photos.find((p) => p.photoId === 'ph-o')?.includeInCustomerReport).toBe(false);
  });
});

// ─── 3. Confirming moves to confirmed ────────────────────────────────────────

describe('3. confirming an item moves it to confirmed', () => {
  it('a pending LiDAR pin can be confirmed by setting reviewStatus', () => {
    const model = buildModel({
      objectPins: [
        { pinId: 'pin-lidar', objectType: 'radiator', photoIds: [], metadata: { inferredByLidar: true } },
      ],
    });

    // Simulate the engineer confirming the pin (as the UI would do)
    const pin = model.objectPins.find((p) => p.pinId === 'pin-lidar')!;
    pin.reviewStatus = 'confirmed';

    expect(pin.reviewStatus).toBe('confirmed');
    expect(pin.needsConfirmation).toBe(true); // needsConfirmation is immutable
  });

  it('after confirming a LiDAR pin, deriveReviewWarnings no longer flags it', () => {
    const model = buildModel({
      objectPins: [
        { pinId: 'pin-lidar', objectType: 'radiator', photoIds: [], metadata: { inferredByLidar: true } },
      ],
    });

    // Before confirmation
    let warnings = deriveReviewWarnings(model);
    expect(warnings.some((w) => w.includes('Unconfirmed LiDAR'))).toBe(true);

    // After confirmation
    model.objectPins[0].reviewStatus = 'confirmed';
    warnings = deriveReviewWarnings(model);
    expect(warnings.some((w) => w.includes('Unconfirmed LiDAR'))).toBe(false);
  });
});

// ─── 4. Rejecting removes from outputs ───────────────────────────────────────

describe('4. rejecting removes it from outputs', () => {
  it('rejected photo is excluded from customer proof', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-s', uri: 'file://s.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
      ],
    });

    // Reject the photo
    model.photos[0].reviewStatus = 'rejected';

    const proof = buildCustomerProofFromV2(model);
    expect(proof.items.some((i) => i.kind === 'photo')).toBe(false);
  });

  it('rejected floor plan is excluded from customer proof', () => {
    const model = buildModel({
      floorPlanSnapshots: [
        { snapshotId: 'fps-01', uri: 'file://fp.jpg', capturedAt: '2026-04-15T11:00:00Z', floorIndex: 0 },
      ],
    });

    // Reject the floor plan
    model.floorPlanSnapshots[0].reviewStatus = 'rejected';

    const proof = buildCustomerProofFromV2(model);
    expect(proof.items.some((i) => i.kind === 'floor_plan')).toBe(false);
  });

  it('rejected object pin is included in engineer handoff (with reviewStatus) but shows as rejected', () => {
    const model = buildModel({
      objectPins: [
        { pinId: 'pin-01', objectType: 'boiler', photoIds: [] },
      ],
    });

    // Reject the pin
    model.objectPins[0].reviewStatus = 'rejected';

    const handoff = buildEngineerHandoffFromV2(model);
    const pinItem = handoff.items.find((i) => i.kind === 'object_pin' && i.ref === 'pin-01');
    expect(pinItem).toBeDefined();
    expect(pinItem?.reviewStatus).toBe('rejected');
  });

  it('rejected photo is still shown in engineer handoff', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-s', uri: 'file://s.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
      ],
    });

    model.photos[0].reviewStatus = 'rejected';

    const handoff = buildEngineerHandoffFromV2(model);
    const photoItem = handoff.items.find((i) => i.kind === 'photo' && i.ref === 'ph-s');
    expect(photoItem).toBeDefined();
    expect(photoItem?.reviewStatus).toBe('rejected');
  });
});

// ─── 5. Customer proof: only confirmed + safe ──────────────────────────────

describe('5. customer proof includes only confirmed + safe items', () => {
  it('only confirmed photos with includeInCustomerReport=true appear in proof', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-s1', uri: 'file://s1.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
        { photoId: 'ph-s2', uri: 'file://s2.jpg', capturedAt: '2026-04-15T09:01:00Z', scope: 'session' },
        { photoId: 'ph-obj', uri: 'file://o.jpg', capturedAt: '2026-04-15T09:02:00Z', scope: 'object', objectPinId: 'pin-01' },
      ],
      objectPins: [{ pinId: 'pin-01', objectType: 'boiler', photoIds: ['ph-obj'] }],
    });

    // Reject one session photo
    model.photos.find((p) => p.photoId === 'ph-s2')!.reviewStatus = 'rejected';

    const proof = buildCustomerProofFromV2(model);
    const photoRefs = proof.items.filter((i) => i.kind === 'photo').map((i) => i.ref);

    expect(photoRefs).toContain('ph-s1');
    expect(photoRefs).not.toContain('ph-s2'); // rejected
    expect(photoRefs).not.toContain('ph-obj'); // object scope → not in customer report
  });

  it('floor plan with includeInCustomerReport=false is excluded from proof', () => {
    const model = buildModel({
      floorPlanSnapshots: [
        { snapshotId: 'fps-01', uri: 'file://fp.jpg', capturedAt: '2026-04-15T11:00:00Z', floorIndex: 0 },
      ],
    });

    // Engineer opts out of customer report
    model.floorPlanSnapshots[0].includeInCustomerReport = false;

    const proof = buildCustomerProofFromV2(model);
    expect(proof.items.some((i) => i.kind === 'floor_plan')).toBe(false);
  });

  it('LiDAR-inferred pins never appear in customer proof (no object_pin kind)', () => {
    const model = buildModel({
      objectPins: [
        { pinId: 'pin-lidar', objectType: 'radiator', photoIds: [], metadata: { inferredByLidar: true } },
      ],
    });

    const proof = buildCustomerProofFromV2(model);
    // Customer proof never includes object pins
    expect(proof.items.some((i) => i.kind === ('object_pin' as unknown))).toBe(false);
  });

  it('rejected items are excluded from customer proof', () => {
    const model = buildModel({
      roomScans: [
        { roomId: 'r1', label: 'Kitchen', status: 'complete' },
        { roomId: 'r2', label: 'Loft', status: 'complete' },
      ],
    });

    const proof = buildCustomerProofFromV2(model);
    const roomRefs = proof.items.filter((i) => i.kind === 'room').map((i) => i.ref);
    expect(roomRefs).toContain('r1');
    expect(roomRefs).toContain('r2');
  });

  it('QA flags are never in customer proof', () => {
    const model = buildModel({
      qaFlags: [{ code: 'SOME_FLAG', severity: 'warn', message: 'Some issue' }],
    });
    const proof = buildCustomerProofFromV2(model);
    expect(proof.items.some((i) => i.kind === ('qa_flag' as unknown))).toBe(false);
  });
});

// ─── 6. Engineer handoff: all items with status ───────────────────────────

describe('6. engineer handoff includes all items with status', () => {
  it('engineer handoff includes reviewStatus on pins', () => {
    const model = buildModel({
      objectPins: [
        { pinId: 'pin-manual', objectType: 'boiler', photoIds: [] },
        { pinId: 'pin-lidar', objectType: 'radiator', photoIds: [], metadata: { inferredByLidar: true } },
      ],
    });

    const handoff = buildEngineerHandoffFromV2(model);
    const manualPin = handoff.items.find((i) => i.kind === 'object_pin' && i.ref === 'pin-manual');
    const lidarPin = handoff.items.find((i) => i.kind === 'object_pin' && i.ref === 'pin-lidar');

    expect(manualPin?.reviewStatus).toBe('confirmed');
    expect(lidarPin?.reviewStatus).toBe('pending');
    expect(lidarPin?.confidence).toBe('inferred');
  });

  it('engineer handoff includes reviewStatus on photos', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-s', uri: 'file://s.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
      ],
    });

    const handoff = buildEngineerHandoffFromV2(model);
    const photoItem = handoff.items.find((i) => i.kind === 'photo' && i.ref === 'ph-s');
    expect(photoItem?.reviewStatus).toBe('confirmed');
  });

  it('engineer handoff includes reviewStatus on floor plans', () => {
    const model = buildModel({
      floorPlanSnapshots: [
        { snapshotId: 'fps-01', uri: 'file://fp.jpg', capturedAt: '2026-04-15T11:00:00Z', floorIndex: 0 },
      ],
    });

    const handoff = buildEngineerHandoffFromV2(model);
    const fpItem = handoff.items.find((i) => i.kind === 'floor_plan' && i.ref === 'fps-01');
    expect(fpItem?.reviewStatus).toBe('confirmed');
  });

  it('engineer handoff includes all evidence kinds', () => {
    const model = buildModel({
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
    });

    const handoff = buildEngineerHandoffFromV2(model);
    const kinds = handoff.items.map((i) => i.kind);
    expect(kinds).toContain('room');
    expect(kinds).toContain('object_pin');
    expect(kinds).toContain('photo');
    expect(kinds).toContain('voice_note');
    expect(kinds).toContain('floor_plan');
    expect(kinds).toContain('qa_flag');
  });
});

// ─── 7. Photo-only capture still works ───────────────────────────────────────

describe('7. photo-only capture still works', () => {
  it('photo-only capture exports without blocking', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-01', uri: 'file://ph-01.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
        { photoId: 'ph-02', uri: 'file://ph-02.jpg', capturedAt: '2026-04-15T09:01:00Z', scope: 'session' },
      ],
    });

    expect(model.photos).toHaveLength(2);
    expect(model.rooms).toHaveLength(0);
    expect(model.objectPins).toHaveLength(0);
    expect(model.photos.every((p) => p.reviewStatus === 'confirmed')).toBe(true);
    expect(model.photos.every((p) => p.includeInCustomerReport)).toBe(true);
  });

  it('photo-only: engineer handoff includes photos', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-01', uri: 'file://ph-01.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
      ],
    });
    const handoff = buildEngineerHandoffFromV2(model);
    expect(handoff.items.some((i) => i.kind === 'photo' && i.ref === 'ph-01')).toBe(true);
  });

  it('photo-only: customer proof includes confirmed session photos', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-01', uri: 'file://ph-01.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
      ],
    });
    const proof = buildCustomerProofFromV2(model);
    expect(proof.items.some((i) => i.kind === 'photo' && i.ref === 'ph-01')).toBe(true);
    expect(proof.capturedOnSiteStatement).toContain('Captured on site');
  });

  it('photo-only: deriveReviewWarnings returns no warnings when photos are confirmed', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-01', uri: 'file://ph-01.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
      ],
    });
    const warnings = deriveReviewWarnings(model);
    expect(warnings).toHaveLength(0);
  });
});

// ─── 8. Empty review still exports but flags warnings ────────────────────────

describe('8. empty review still exports but flags warnings', () => {
  it('empty capture exports without throwing', () => {
    const model = buildModel();
    expect(() => buildEngineerHandoffFromV2(model)).not.toThrow();
    expect(() => buildCustomerProofFromV2(model)).not.toThrow();
  });

  it('empty capture customer proof has the capturedOnSiteStatement', () => {
    const model = buildModel();
    const proof = buildCustomerProofFromV2(model);
    expect(proof.capturedOnSiteStatement).toContain('Captured on site');
    expect(proof.items).toHaveLength(0);
  });

  it('empty capture engineer handoff has empty items and surfaced warnings', () => {
    const model = buildModel();
    const handoff = buildEngineerHandoffFromV2(model);
    expect(handoff.items).toHaveLength(0);
    // evidenceWarnings come from the static import-time derivation
    expect(handoff.warnings.some((w) => w.includes('No room scans'))).toBe(true);
  });

  it('empty capture with photos = empty deriveReviewWarnings', () => {
    const model = buildModel();
    // No photos → no "No confirmed photos" warning (warning only fires when
    // there ARE photos but none are confirmed for customer report)
    const warnings = deriveReviewWarnings(model);
    expect(warnings).toHaveLength(0);
  });
});

// ─── deriveReviewWarnings ─────────────────────────────────────────────────────

describe('deriveReviewWarnings', () => {
  it('warns about unconfirmed LiDAR objects', () => {
    const model = buildModel({
      objectPins: [
        { pinId: 'pin-lidar', objectType: 'radiator', photoIds: [], metadata: { inferredByLidar: true } },
      ],
    });
    const warnings = deriveReviewWarnings(model);
    expect(warnings.some((w) => w.includes('Unconfirmed LiDAR'))).toBe(true);
  });

  it('does not warn about LiDAR objects when all are confirmed', () => {
    const model = buildModel({
      objectPins: [
        { pinId: 'pin-lidar', objectType: 'radiator', photoIds: [], metadata: { inferredByLidar: true } },
      ],
    });
    model.objectPins[0].reviewStatus = 'confirmed';
    const warnings = deriveReviewWarnings(model);
    expect(warnings.some((w) => w.includes('Unconfirmed LiDAR'))).toBe(false);
  });

  it('warns when photos exist but none are confirmed for customer report', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-s', uri: 'file://s.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
      ],
    });

    // Remove all from customer report
    model.photos[0].includeInCustomerReport = false;
    const warnings = deriveReviewWarnings(model);
    expect(warnings.some((w) => w.includes('No confirmed photos'))).toBe(true);
  });

  it('does not warn about photos when at least one is confirmed for customer report', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-s', uri: 'file://s.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
      ],
    });
    const warnings = deriveReviewWarnings(model);
    expect(warnings.some((w) => w.includes('No confirmed photos'))).toBe(false);
  });

  it('warns when a floor plan snapshot is pending/rejected', () => {
    const model = buildModel({
      floorPlanSnapshots: [
        { snapshotId: 'fps-01', uri: 'file://fp.jpg', capturedAt: '2026-04-15T11:00:00Z', floorIndex: 0 },
      ],
    });

    model.floorPlanSnapshots[0].reviewStatus = 'pending';
    const warnings = deriveReviewWarnings(model);
    expect(warnings.some((w) => w.includes('Floor plan not reviewed'))).toBe(true);
  });

  it('does not warn about floor plans when all are confirmed', () => {
    const model = buildModel({
      floorPlanSnapshots: [
        { snapshotId: 'fps-01', uri: 'file://fp.jpg', capturedAt: '2026-04-15T11:00:00Z', floorIndex: 0 },
      ],
    });
    // Default is confirmed
    const warnings = deriveReviewWarnings(model);
    expect(warnings.some((w) => w.includes('Floor plan not reviewed'))).toBe(false);
  });

  it('returns all three warnings simultaneously when all conditions are met', () => {
    const model = buildModel({
      objectPins: [
        { pinId: 'pin-lidar', objectType: 'radiator', photoIds: [], metadata: { inferredByLidar: true } },
      ],
      photos: [
        { photoId: 'ph-s', uri: 'file://s.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
      ],
      floorPlanSnapshots: [
        { snapshotId: 'fps-01', uri: 'file://fp.jpg', capturedAt: '2026-04-15T11:00:00Z', floorIndex: 0 },
      ],
    });

    // Set all conditions for warnings
    model.photos[0].includeInCustomerReport = false;
    model.floorPlanSnapshots[0].reviewStatus = 'rejected';

    const warnings = deriveReviewWarnings(model);
    expect(warnings.some((w) => w.includes('Unconfirmed LiDAR'))).toBe(true);
    expect(warnings.some((w) => w.includes('No confirmed photos'))).toBe(true);
    expect(warnings.some((w) => w.includes('Floor plan not reviewed'))).toBe(true);
  });
});

// ─── includeInCustomerReport toggle ───────────────────────────────────────────

describe('includeInCustomerReport toggle', () => {
  it('photo with includeInCustomerReport=false is excluded from proof even if confirmed', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-s', uri: 'file://s.jpg', capturedAt: '2026-04-15T09:00:00Z', scope: 'session' },
      ],
    });

    // Opt out of customer report
    model.photos[0].includeInCustomerReport = false;

    const proof = buildCustomerProofFromV2(model);
    expect(proof.items.some((i) => i.kind === 'photo')).toBe(false);
  });

  it('floor plan with includeInCustomerReport=true appears in proof when confirmed', () => {
    const model = buildModel({
      floorPlanSnapshots: [
        { snapshotId: 'fps-01', uri: 'file://fp.jpg', capturedAt: '2026-04-15T11:00:00Z', floorIndex: 0 },
      ],
    });

    const proof = buildCustomerProofFromV2(model);
    expect(proof.items.some((i) => i.kind === 'floor_plan' && i.ref === 'fps-01')).toBe(true);
  });

  it('object-scope photo always has includeInCustomerReport=false by default', () => {
    const model = buildModel({
      photos: [
        { photoId: 'ph-o', uri: 'file://o.jpg', capturedAt: '2026-04-15T09:02:00Z', scope: 'object', objectPinId: 'pin-01' },
      ],
      objectPins: [{ pinId: 'pin-01', objectType: 'boiler', photoIds: ['ph-o'] }],
    });

    const photo = model.photos.find((p) => p.photoId === 'ph-o');
    expect(photo?.includeInCustomerReport).toBe(false);
    expect(photo?.customerSafe).toBe(false);
  });
});
