/**
 * scanFabricHazardIngestion.test.ts
 *
 * Ingestion compatibility tests for the new optional SessionCaptureV2 fields:
 *   - floorPlanFabric
 *   - hazardObservations
 *
 * Verifies:
 *   1. Payload with floorPlanFabric ingests successfully.
 *   2. Payload with hazardObservations ingests successfully.
 *   3. Old payload without either field still ingests (backwards compat).
 *   4. Single-object (non-array) floorPlanFabric ingests.
 *   5. Single-object (non-array) hazardObservations ingests.
 *   6. Malformed floorPlanFabric produces a validation error.
 *   7. Malformed hazardObservations produces a validation error.
 */

import { describe, it, expect } from 'vitest';
import { validateSessionCaptureV2 } from '../../scanImport/contracts/sessionCaptureV2';
import type { SessionCaptureV2 } from '../../scanImport/contracts/sessionCaptureV2';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function baseCapture(): Record<string, unknown> {
  return {
    version: '2.0',
    sessionId: 'sc-fabric-test-001',
    capturedAt: '2026-05-01T09:00:00Z',
    exportedAt: '2026-05-01T11:00:00Z',
    deviceModel: 'iPhone 15 Pro',
    roomScans: [],
    photos: [],
    voiceNotes: [],
    objectPins: [],
    floorPlanSnapshots: [],
    qaFlags: [],
  };
}

function withFabric(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...baseCapture(),
    floorPlanFabric: [
      {
        roomId: 'r1',
        roomName: 'Living Room',
        floorAreaM2: 18.5,
        ceilingHeightM: 2.4,
        perimeterM: 17.2,
        boundaries: [
          {
            boundaryId: 'b1',
            type: 'external',
            lengthM: 5.0,
            heightM: 2.4,
            material: 'solid brick',
            reviewStatus: 'confirmed',
          },
          {
            boundaryId: 'b2',
            type: 'internal',
            lengthM: 3.6,
            heightM: 2.4,
            reviewStatus: 'pending',
          },
        ],
        openings: [
          {
            openingId: 'o1',
            type: 'window',
            widthM: 1.2,
            heightM: 1.1,
            material: 'uPVC double glazed',
            linkedBoundaryId: 'b1',
            reviewStatus: 'confirmed',
          },
        ],
        ...overrides,
      },
    ],
  };
}

function withHazards(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...baseCapture(),
    hazardObservations: [
      {
        hazardId: 'hz1',
        category: 'asbestos_suspected',
        severity: 'high',
        title: 'Suspected asbestos ceiling tiles',
        description: 'Textured ceiling tiles in utility room may contain asbestos.',
        linkedPhotoIds: ['p1', 'p2'],
        linkedObjectPinIds: ['op1'],
        actionRequired: 'Do not disturb. Refer to licensed contractor before any work.',
        reviewStatus: 'confirmed',
        ...overrides,
      },
    ],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Criterion 1 — payload with floorPlanFabric ingests', () => {
  it('validates successfully when floorPlanFabric is an array', () => {
    const result = validateSessionCaptureV2(withFabric());
    expect(result.ok).toBe(true);
  });

  it('floorPlanFabric is present on the returned session', () => {
    const result = validateSessionCaptureV2(withFabric());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const session = result.session as SessionCaptureV2;
    expect(session.floorPlanFabric).toBeDefined();
    expect(Array.isArray(session.floorPlanFabric)).toBe(true);
  });

  it('validates when floorPlanFabric is a single object (not array)', () => {
    const payload = {
      ...baseCapture(),
      floorPlanFabric: {
        roomId: 'r1',
        boundaries: [{ boundaryId: 'b1', type: 'external' }],
        openings: [],
      },
    };
    const result = validateSessionCaptureV2(payload);
    expect(result.ok).toBe(true);
  });

  it('returns an error when a boundary has an invalid type', () => {
    const payload = {
      ...baseCapture(),
      floorPlanFabric: [
        {
          roomId: 'r1',
          boundaries: [{ boundaryId: 'b1', type: 'INVALID_TYPE' }],
        },
      ],
    };
    const result = validateSessionCaptureV2(payload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('type'))).toBe(true);
  });
});

describe('Criterion 2 — payload with hazardObservations ingests', () => {
  it('validates successfully when hazardObservations is an array', () => {
    const result = validateSessionCaptureV2(withHazards());
    expect(result.ok).toBe(true);
  });

  it('hazardObservations is present on the returned session', () => {
    const result = validateSessionCaptureV2(withHazards());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const session = result.session as SessionCaptureV2;
    expect(session.hazardObservations).toBeDefined();
    expect(Array.isArray(session.hazardObservations)).toBe(true);
  });

  it('validates when hazardObservations is a single object (not array)', () => {
    const payload = {
      ...baseCapture(),
      hazardObservations: {
        hazardId: 'hz1',
        category: 'electrical',
        severity: 'medium',
        title: 'Exposed wiring near water heater',
      },
    };
    const result = validateSessionCaptureV2(payload);
    expect(result.ok).toBe(true);
  });

  it('returns an error when a hazard has an invalid category', () => {
    const payload = withHazards({ category: 'INVALID_CAT' });
    const result = validateSessionCaptureV2(payload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('category'))).toBe(true);
  });

  it('returns an error when a hazard has an invalid severity', () => {
    const payload = withHazards({ severity: 'LETHAL' });
    const result = validateSessionCaptureV2(payload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('severity'))).toBe(true);
  });

  it('returns an error when a hazard is missing title', () => {
    const payload = withHazards({ title: 42 });
    const result = validateSessionCaptureV2(payload);
    expect(result.ok).toBe(false);
  });
});

describe('Criterion 3 — old payload without new fields still ingests', () => {
  it('validates a v2.0 capture without floorPlanFabric or hazardObservations', () => {
    const result = validateSessionCaptureV2(baseCapture());
    expect(result.ok).toBe(true);
  });

  it('floorPlanFabric is undefined when absent', () => {
    const result = validateSessionCaptureV2(baseCapture());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.session as SessionCaptureV2).floorPlanFabric).toBeUndefined();
  });

  it('hazardObservations is undefined when absent', () => {
    const result = validateSessionCaptureV2(baseCapture());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.session as SessionCaptureV2).hazardObservations).toBeUndefined();
  });
});
