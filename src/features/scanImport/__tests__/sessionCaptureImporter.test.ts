import { describe, it, expect } from 'vitest';
import {
  importSessionCapture,
  isSessionCaptureJson,
} from '../importer/sessionCaptureImporter';
import type { SessionCaptureV1 } from '@atlas/contracts';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function minimalCapture(overrides: Partial<SessionCaptureV1> = {}): unknown {
  return {
    version: '1.0',
    sessionId: 'test-sc-001',
    startedAt: '2026-04-01T09:00:00Z',
    updatedAt: '2026-04-01T10:00:00Z',
    status: 'ready',
    rooms: [],
    objects: [],
    photos: [],
    audio: { mode: 'continuous', segments: [] },
    notes: [],
    events: [],
    ...overrides,
  } as unknown;
}

// ─── importSessionCapture ─────────────────────────────────────────────────────

describe('importSessionCapture', () => {
  it('rejects null input', () => {
    const result = importSessionCapture(null);
    expect(result.status).toBe('rejected_invalid');
  });

  it('rejects undefined input', () => {
    const result = importSessionCapture(undefined);
    expect(result.status).toBe('rejected_invalid');
  });

  it('rejects missing sessionId', () => {
    const result = importSessionCapture({ version: '1.0', rooms: [] });
    expect(result.status).toBe('rejected_invalid');
  });

  it('returns success for a minimal valid capture', () => {
    const result = importSessionCapture(minimalCapture());
    // Minimal capture has no rooms → success_with_warnings
    expect(result.status).toBe('success_with_warnings');
    if (result.status === 'success_with_warnings') {
      expect(result.capture.sessionId).toBe('test-sc-001');
    }
  });

  it('returns success_with_warnings when rooms is empty', () => {
    const result = importSessionCapture(minimalCapture({ rooms: [] }));
    expect(result.status).toBe('success_with_warnings');
    if (result.status === 'success_with_warnings') {
      expect(result.warnings).toContain('No rooms captured');
    }
  });

  it('returns success_with_warnings when completedAt is missing', () => {
    const result = importSessionCapture(
      minimalCapture({
        rooms: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
      }),
    );
    expect(result.status).toBe('success_with_warnings');
    if (result.status === 'success_with_warnings') {
      expect(result.warnings).toContain('Session not yet marked as complete');
    }
  });

  it('returns success for a fully complete capture with rooms', () => {
    const result = importSessionCapture(
      minimalCapture({
        completedAt: '2026-04-01T10:00:00Z',
        property: { address: '14 Maple Close', postcode: 'GU1 1AA' },
        rooms: [
          { roomId: 'r1', label: 'Kitchen', status: 'complete' },
          { roomId: 'r2', label: 'Lounge', status: 'complete' },
        ],
      }),
    );
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.review.roomCount).toBe(2);
      expect(result.review.address).toBe('14 Maple Close, GU1 1AA');
    }
  });

  it('populates review.roomCount from rooms array', () => {
    const result = importSessionCapture(
      minimalCapture({
        completedAt: '2026-04-01T10:00:00Z',
        property: { address: '1 Test St' },
        rooms: [
          { roomId: 'r1', label: 'Room 1', status: 'complete' },
          { roomId: 'r2', label: 'Room 2', status: 'complete' },
          { roomId: 'r3', label: 'Room 3', status: 'complete' },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.review.roomCount).toBe(3);
    }
  });

  it('populates review.photoCount from photos array', () => {
    const result = importSessionCapture(
      minimalCapture({
        completedAt: '2026-04-01T10:00:00Z',
        property: { address: '1 Test St' },
        rooms: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        photos: [
          { photoId: 'p1', uri: 'file://p1.jpg', createdAt: '2026-04-01T09:30:00Z', scope: 'session' },
          { photoId: 'p2', uri: 'file://p2.jpg', createdAt: '2026-04-01T09:31:00Z', scope: 'room', roomId: 'r1' },
        ],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.review.photoCount).toBe(2);
    }
  });

  it('marks session-scope and room-scope photos as customerSafe', () => {
    const result = importSessionCapture(
      minimalCapture({
        completedAt: '2026-04-01T10:00:00Z',
        property: { address: '1 Test St' },
        rooms: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        photos: [
          { photoId: 'p-session', uri: 'file://p1.jpg', createdAt: '2026-04-01T09:30:00Z', scope: 'session' },
          { photoId: 'p-room', uri: 'file://p2.jpg', createdAt: '2026-04-01T09:31:00Z', scope: 'room', roomId: 'r1' },
          { photoId: 'p-object', uri: 'file://p3.jpg', createdAt: '2026-04-01T09:32:00Z', scope: 'object', objectId: 'obj1' },
        ],
        objects: [{ objectId: 'obj1', type: 'boiler', status: 'confirmed', photoIds: ['p-object'], noteMarkerIds: [] }],
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      const safe = result.review.customerSafeEvidence;
      const safePhotoRefs = safe.filter((e) => e.kind === 'photo').map((e) => e.ref);
      expect(safePhotoRefs).toContain('p-session');
      expect(safePhotoRefs).toContain('p-room');
      expect(safePhotoRefs).not.toContain('p-object');
    }
  });

  it('surfaces transcript in engineerEvidence when transcript text exists', () => {
    const result = importSessionCapture(
      minimalCapture({
        completedAt: '2026-04-01T10:00:00Z',
        property: { address: '1 Test St' },
        rooms: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        audio: {
          mode: 'continuous',
          segments: [],
          transcription: { status: 'complete', text: 'Boiler is 14 years old.' },
        },
      }),
    );
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.review.hasTranscript).toBe(true);
      const transcriptItem = result.review.engineerEvidence.find(
        (e) => e.kind === 'transcript',
      );
      expect(transcriptItem).toBeDefined();
      // Transcript is not customer-safe
      const customerTranscript = result.review.customerSafeEvidence.find(
        (e) => e.kind === 'transcript',
      );
      expect(customerTranscript).toBeUndefined();
    }
  });

  it('warns about objects without photos', () => {
    const result = importSessionCapture(
      minimalCapture({
        completedAt: '2026-04-01T10:00:00Z',
        property: { address: '1 Test St' },
        rooms: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        objects: [
          { objectId: 'obj1', type: 'boiler', status: 'confirmed', photoIds: [], noteMarkerIds: [] },
        ],
      }),
    );
    if (result.status === 'success_with_warnings') {
      expect(result.warnings.some((w) => w.includes('no photos'))).toBe(true);
    }
  });

  it('warns about orphan photos referencing unknown objects', () => {
    const result = importSessionCapture(
      minimalCapture({
        completedAt: '2026-04-01T10:00:00Z',
        property: { address: '1 Test St' },
        rooms: [{ roomId: 'r1', label: 'Kitchen', status: 'complete' }],
        objects: [],
        photos: [
          {
            photoId: 'p-orphan',
            uri: 'file://p.jpg',
            createdAt: '2026-04-01T09:30:00Z',
            scope: 'object',
            objectId: 'nonexistent-obj',
          },
        ],
      }),
    );
    if (result.status === 'success_with_warnings') {
      expect(result.warnings.some((w) => w.includes('reference objects not in this capture'))).toBe(true);
    }
  });

  it('warns when incomplete rooms exist', () => {
    const result = importSessionCapture(
      minimalCapture({
        completedAt: '2026-04-01T10:00:00Z',
        property: { address: '1 Test St' },
        rooms: [
          { roomId: 'r1', label: 'Kitchen', status: 'active' },
        ],
      }),
    );
    if (result.status === 'success_with_warnings') {
      expect(result.review.verificationRequired.length).toBeGreaterThan(0);
    }
  });

  it('imports the full session-capture-full.json fixture successfully', async () => {
    const { default: fixture } = await import('../fixtures/session-capture-full.json');
    const result = importSessionCapture(fixture);
    expect(result.status === 'success' || result.status === 'success_with_warnings').toBe(true);
    if (result.status === 'success' || result.status === 'success_with_warnings') {
      expect(result.capture.sessionId).toBe('sc-fixture-001-full');
      expect(result.review.roomCount).toBe(5);
      expect(result.review.photoCount).toBe(6);
      expect(result.review.hasTranscript).toBe(true);
      expect(result.review.address).toContain('Maple Close');
    }
  });
});

// ─── isSessionCaptureJson ─────────────────────────────────────────────────────

describe('isSessionCaptureJson', () => {
  it('returns true for a SessionCaptureV1 shape', () => {
    expect(isSessionCaptureJson(minimalCapture())).toBe(true);
  });

  it('returns false for a ScanBundleV1 shape (has bundleId, not sessionId)', () => {
    expect(
      isSessionCaptureJson({
        version: '1.0',
        bundleId: 'bundle-1',
        rooms: [],
        meta: {},
      }),
    ).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSessionCaptureJson(null)).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isSessionCaptureJson([])).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isSessionCaptureJson('session')).toBe(false);
  });

  it('returns false when sessionId is empty string', () => {
    expect(isSessionCaptureJson({ version: '1.0', sessionId: '', rooms: [], photos: [] })).toBe(false);
  });
});
