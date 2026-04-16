import { describe, it, expect } from 'vitest';
import { buildInitialSpatialTwinFromCapture } from '../import/buildInitialSpatialTwinFromCapture';
import type { SessionCaptureV1 } from '@atlas/contracts';

function makeMinimalSession(overrides: Partial<SessionCaptureV1> = {}): SessionCaptureV1 {
  return {
    version: '1.0',
    sessionId: 'test-session-123',
    startedAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T11:00:00Z',
    status: 'ready',
    rooms: [
      { roomId: 'room-1', label: 'Kitchen', status: 'complete' },
      { roomId: 'room-2', label: 'Lounge', status: 'complete' },
    ],
    objects: [],
    photos: [],
    audio: { durationSeconds: 0, localFilename: undefined, remoteAssetId: undefined },
    notes: [],
    events: [],
    ...overrides,
  };
}

describe('buildInitialSpatialTwinFromCapture', () => {
  it('imports a valid SessionCaptureV1 and returns success', () => {
    const session = makeMinimalSession();
    const result = buildInitialSpatialTwinFromCapture(session, 'prop-1');
    expect(result.status).toBe('success');
    expect(result.model).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('preserves sourceSessionId from session', () => {
    const session = makeMinimalSession({ sessionId: 'abc-456' });
    const result = buildInitialSpatialTwinFromCapture(session, 'prop-1');
    expect(result.model?.sourceSessionId).toBe('abc-456');
  });

  it('creates rooms from session.rooms', () => {
    const session = makeMinimalSession();
    const result = buildInitialSpatialTwinFromCapture(session, 'prop-1');
    expect(result.model?.spatial.rooms).toHaveLength(2);
    expect(result.model?.spatial.rooms[0]?.label).toBe('Kitchen');
  });

  it('creates evidence markers from photos', () => {
    const session = makeMinimalSession({
      photos: [
        {
          photoId: 'photo-1',
          uri: 'file://photo.jpg',
          createdAt: '2024-01-01T10:30:00Z',
          scope: 'room',
          roomId: 'room-1',
        },
        {
          photoId: 'photo-2',
          uri: 'file://photo2.jpg',
          createdAt: '2024-01-01T10:31:00Z',
          scope: 'session',
        },
      ],
    });
    const result = buildInitialSpatialTwinFromCapture(session, 'prop-1');
    expect(result.model?.evidenceMarkers.filter((e) => e.kind === 'photo')).toHaveLength(2);
  });

  it('creates evidence markers from notes', () => {
    const session = makeMinimalSession({
      notes: [
        {
          markerId: 'note-1',
          createdAt: '2024-01-01T10:32:00Z',
          text: 'Check the pipe run',
        },
      ],
    });
    const result = buildInitialSpatialTwinFromCapture(session, 'prop-1');
    expect(result.model?.evidenceMarkers.filter((e) => e.kind === 'note')).toHaveLength(1);
  });

  it('incomplete capture with no rooms returns success_with_warnings', () => {
    const session = makeMinimalSession({ rooms: [] });
    const result = buildInitialSpatialTwinFromCapture(session, 'prop-1');
    expect(result.status).toBe('success_with_warnings');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('null input returns failed', () => {
    // @ts-expect-error — testing invalid input
    const result = buildInitialSpatialTwinFromCapture(null, 'prop-1');
    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
  });

  it('undefined input returns failed', () => {
    // @ts-expect-error — testing invalid input
    const result = buildInitialSpatialTwinFromCapture(undefined, 'prop-1');
    expect(result.status).toBe('failed');
  });
});
