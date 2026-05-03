/**
 * scanEvidenceSelectors.fabric.test.ts
 *
 * Unit tests for the new fabric and hazard selectors added to
 * scanEvidenceSelectors.ts:
 *
 *   - getFabricEvidenceSummary
 *   - getConfirmedFabricBoundaries
 *   - getCustomerSafeFabricEvidence
 *   - getHazardEvidenceSummary
 *   - hasBlockingHazard
 */

import { describe, it, expect } from 'vitest';
import type { SessionCaptureV2 } from '../../scanImport/contracts/sessionCaptureV2';
import type {
  FloorPlanFabricCaptureV1,
  HazardObservationCaptureV1,
} from '../../scanImport/contracts/sessionCaptureV2';
import {
  getFabricEvidenceSummary,
  getConfirmedFabricBoundaries,
  getCustomerSafeFabricEvidence,
  getHazardEvidenceSummary,
  hasBlockingHazard,
} from '../scanEvidenceSelectors';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function baseCapture(
  overrides: Partial<SessionCaptureV2> = {},
): SessionCaptureV2 {
  return {
    version: '2.0',
    sessionId: 'sc-sel-test',
    capturedAt: '2026-05-01T09:00:00Z',
    exportedAt: '2026-05-01T11:00:00Z',
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

const confirmedBoundary = {
  boundaryId: 'b-confirmed',
  type: 'external' as const,
  reviewStatus: 'confirmed' as const,
};

const pendingBoundary = {
  boundaryId: 'b-pending',
  type: 'internal' as const,
  reviewStatus: 'pending' as const,
};

const rejectedBoundary = {
  boundaryId: 'b-rejected',
  type: 'party' as const,
  reviewStatus: 'rejected' as const,
};

const fabricRoom: FloorPlanFabricCaptureV1 = {
  roomId: 'r1',
  roomName: 'Kitchen',
  floorAreaM2: 12,
  boundaries: [confirmedBoundary, pendingBoundary, rejectedBoundary],
  openings: [{ openingId: 'o1', type: 'window', reviewStatus: 'confirmed' }],
};

const highHazard: HazardObservationCaptureV1 = {
  hazardId: 'hz-high',
  category: 'asbestos_suspected',
  severity: 'high',
  title: 'Asbestos ceiling',
  reviewStatus: 'confirmed',
};

const criticalHazard: HazardObservationCaptureV1 = {
  hazardId: 'hz-crit',
  category: 'structural',
  severity: 'blocking',
  title: 'Structural crack',
  reviewStatus: 'pending',
};

const lowHazard: HazardObservationCaptureV1 = {
  hazardId: 'hz-low',
  category: 'other',
  severity: 'low',
  title: 'Minor staining',
  reviewStatus: 'confirmed',
};

const rejectedHighHazard: HazardObservationCaptureV1 = {
  hazardId: 'hz-rej',
  category: 'electrical',
  severity: 'high',
  title: 'Exposed wiring (rejected)',
  reviewStatus: 'rejected',
};

// ─── getFabricEvidenceSummary ─────────────────────────────────────────────────

describe('getFabricEvidenceSummary', () => {
  it('returns empty array when floorPlanFabric is absent', () => {
    const capture = baseCapture();
    expect(getFabricEvidenceSummary(capture)).toEqual([]);
  });

  it('returns array when floorPlanFabric is an array', () => {
    const capture = baseCapture({ floorPlanFabric: [fabricRoom] });
    const result = getFabricEvidenceSummary(capture);
    expect(result).toHaveLength(1);
    expect(result[0].roomId).toBe('r1');
  });

  it('wraps a single object in an array', () => {
    const capture = baseCapture({ floorPlanFabric: fabricRoom });
    const result = getFabricEvidenceSummary(capture);
    expect(result).toHaveLength(1);
    expect(result[0].roomId).toBe('r1');
  });
});

// ─── getConfirmedFabricBoundaries ─────────────────────────────────────────────

describe('getConfirmedFabricBoundaries', () => {
  it('returns empty array when no fabric', () => {
    expect(getConfirmedFabricBoundaries(baseCapture())).toEqual([]);
  });

  it('returns only boundaries with reviewStatus === confirmed', () => {
    const capture = baseCapture({ floorPlanFabric: [fabricRoom] });
    const confirmed = getConfirmedFabricBoundaries(capture);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].boundaryId).toBe('b-confirmed');
  });

  it('excludes pending boundaries', () => {
    const capture = baseCapture({ floorPlanFabric: [fabricRoom] });
    const confirmed = getConfirmedFabricBoundaries(capture);
    expect(confirmed.some((b) => b.boundaryId === 'b-pending')).toBe(false);
  });

  it('excludes rejected boundaries', () => {
    const capture = baseCapture({ floorPlanFabric: [fabricRoom] });
    const confirmed = getConfirmedFabricBoundaries(capture);
    expect(confirmed.some((b) => b.boundaryId === 'b-rejected')).toBe(false);
  });
});

// ─── getCustomerSafeFabricEvidence ────────────────────────────────────────────

describe('getCustomerSafeFabricEvidence', () => {
  it('returns empty array even when fabric is present', () => {
    const capture = baseCapture({ floorPlanFabric: [fabricRoom] });
    expect(getCustomerSafeFabricEvidence(capture)).toEqual([]);
  });

  it('returns empty array when fabric is absent', () => {
    expect(getCustomerSafeFabricEvidence(baseCapture())).toEqual([]);
  });
});

// ─── getHazardEvidenceSummary ─────────────────────────────────────────────────

describe('getHazardEvidenceSummary', () => {
  it('returns empty array when hazardObservations is absent', () => {
    expect(getHazardEvidenceSummary(baseCapture())).toEqual([]);
  });

  it('returns array when hazardObservations is an array', () => {
    const capture = baseCapture({ hazardObservations: [highHazard, lowHazard] });
    const result = getHazardEvidenceSummary(capture);
    expect(result).toHaveLength(2);
  });

  it('wraps a single hazard object in an array', () => {
    const capture = baseCapture({ hazardObservations: highHazard });
    const result = getHazardEvidenceSummary(capture);
    expect(result).toHaveLength(1);
    expect(result[0].hazardId).toBe('hz-high');
  });
});

// ─── hasBlockingHazard ────────────────────────────────────────────────────────

describe('hasBlockingHazard', () => {
  it('returns false when no hazards', () => {
    expect(hasBlockingHazard(baseCapture())).toBe(false);
  });

  it('returns false when only low hazards are present', () => {
    const capture = baseCapture({ hazardObservations: [lowHazard] });
    expect(hasBlockingHazard(capture)).toBe(false);
  });

  it('returns true for a confirmed high-severity hazard', () => {
    const capture = baseCapture({ hazardObservations: [highHazard] });
    expect(hasBlockingHazard(capture)).toBe(true);
  });

  it('returns true for a pending blocking-severity hazard', () => {
    const capture = baseCapture({ hazardObservations: [criticalHazard] });
    expect(hasBlockingHazard(capture)).toBe(true);
  });

  it('returns false when the only high hazard is rejected', () => {
    const capture = baseCapture({ hazardObservations: [rejectedHighHazard] });
    expect(hasBlockingHazard(capture)).toBe(false);
  });

  it('returns true when mix includes a non-rejected high hazard', () => {
    const capture = baseCapture({
      hazardObservations: [lowHazard, rejectedHighHazard, highHazard],
    });
    expect(hasBlockingHazard(capture)).toBe(true);
  });
});
