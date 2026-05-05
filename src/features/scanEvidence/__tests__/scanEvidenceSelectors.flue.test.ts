/**
 * scanEvidenceSelectors.flue.test.ts
 *
 * Unit tests for the flue evidence readiness selectors added to
 * scanEvidenceSelectors.ts:
 *
 *   - hasExternalFlueScan
 *   - hasFlueTerminalPin
 *   - hasExternalMeasurements
 *   - getFlueEvidenceReadiness
 */

import { describe, it, expect } from 'vitest';
import type { SessionCaptureV2, ExternalAreaScanV1 } from '../../scanImport/contracts/sessionCaptureV2';
import {
  hasExternalFlueScan,
  hasFlueTerminalPin,
  hasExternalMeasurements,
  getFlueEvidenceReadiness,
} from '../scanEvidenceSelectors';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function baseCapture(
  overrides: Partial<SessionCaptureV2> = {},
): SessionCaptureV2 {
  return {
    version: '2.0',
    sessionId: 'sc-flue-test',
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

const scanWithFlueTerminalAndMeasurements: ExternalAreaScanV1 = {
  scanId: 'ext-rear-001',
  label: 'Rear elevation',
  capturedAt: '2026-05-01T10:00:00Z',
  reviewStatus: 'confirmed',
  objectPins: [
    { pinId: 'ep-flue-001', objectType: 'flue_terminal', label: 'Rear flue exit' },
  ],
  measurementLines: [
    { lineId: 'ml-001', label: 'Flue setback from opening', lengthM: 0.9 },
  ],
};

const scanWithFlueTerminalOnly: ExternalAreaScanV1 = {
  scanId: 'ext-rear-002',
  label: 'Rear elevation (no measurements)',
  capturedAt: '2026-05-01T10:00:00Z',
  objectPins: [
    { pinId: 'ep-flue-002', objectType: 'flue_terminal', label: 'Rear flue exit' },
  ],
};

const scanWithMeasurementsOnly: ExternalAreaScanV1 = {
  scanId: 'ext-rear-003',
  label: 'Rear elevation (no terminal)',
  capturedAt: '2026-05-01T10:00:00Z',
  measurementLines: [
    { lineId: 'ml-002', label: 'Flue height', lengthM: 2.1 },
  ],
};

const scanWithNoPins: ExternalAreaScanV1 = {
  scanId: 'ext-rear-004',
  label: 'Rear elevation (empty)',
  capturedAt: '2026-05-01T10:00:00Z',
};

// ─── hasExternalFlueScan ──────────────────────────────────────────────────────

describe('hasExternalFlueScan', () => {
  it('returns false when no externalAreaScans field', () => {
    expect(hasExternalFlueScan(baseCapture())).toBe(false);
  });

  it('returns false when externalAreaScans is an empty array', () => {
    expect(hasExternalFlueScan(baseCapture({ externalAreaScans: [] }))).toBe(false);
  });

  it('returns true when at least one external area scan is present', () => {
    expect(
      hasExternalFlueScan(baseCapture({ externalAreaScans: [scanWithNoPins] })),
    ).toBe(true);
  });

  it('returns true even when the scan has no pins or measurements', () => {
    expect(
      hasExternalFlueScan(baseCapture({ externalAreaScans: [scanWithNoPins] })),
    ).toBe(true);
  });
});

// ─── hasFlueTerminalPin ───────────────────────────────────────────────────────

describe('hasFlueTerminalPin', () => {
  it('returns false when no external area scans', () => {
    expect(hasFlueTerminalPin(baseCapture())).toBe(false);
  });

  it('returns false when a scan is present but has no flue_terminal pins', () => {
    expect(
      hasFlueTerminalPin(baseCapture({ externalAreaScans: [scanWithMeasurementsOnly] })),
    ).toBe(false);
  });

  it('returns false when scan objectPins array is absent', () => {
    expect(
      hasFlueTerminalPin(baseCapture({ externalAreaScans: [scanWithNoPins] })),
    ).toBe(false);
  });

  it('returns true when a flue_terminal pin is present', () => {
    expect(
      hasFlueTerminalPin(
        baseCapture({ externalAreaScans: [scanWithFlueTerminalAndMeasurements] }),
      ),
    ).toBe(true);
  });

  it('returns true when flue_terminal exists in any scan', () => {
    expect(
      hasFlueTerminalPin(
        baseCapture({
          externalAreaScans: [scanWithMeasurementsOnly, scanWithFlueTerminalOnly],
        }),
      ),
    ).toBe(true);
  });

  it('returns false when scan only has non-flue pins', () => {
    const scanWithObstruction: ExternalAreaScanV1 = {
      scanId: 'ext-obs-001',
      capturedAt: '2026-05-01T10:00:00Z',
      objectPins: [{ pinId: 'ep-obs-001', objectType: 'obstruction' }],
    };
    expect(
      hasFlueTerminalPin(baseCapture({ externalAreaScans: [scanWithObstruction] })),
    ).toBe(false);
  });
});

// ─── hasExternalMeasurements ──────────────────────────────────────────────────

describe('hasExternalMeasurements', () => {
  it('returns false when no external area scans', () => {
    expect(hasExternalMeasurements(baseCapture())).toBe(false);
  });

  it('returns false when scans are present but no measurement lines', () => {
    expect(
      hasExternalMeasurements(
        baseCapture({ externalAreaScans: [scanWithFlueTerminalOnly] }),
      ),
    ).toBe(false);
  });

  it('returns false when scan measurementLines field is absent', () => {
    expect(
      hasExternalMeasurements(baseCapture({ externalAreaScans: [scanWithNoPins] })),
    ).toBe(false);
  });

  it('returns true when at least one measurement line is present', () => {
    expect(
      hasExternalMeasurements(
        baseCapture({ externalAreaScans: [scanWithMeasurementsOnly] }),
      ),
    ).toBe(true);
  });

  it('returns true when measurement lines are spread across multiple scans', () => {
    expect(
      hasExternalMeasurements(
        baseCapture({
          externalAreaScans: [scanWithFlueTerminalOnly, scanWithMeasurementsOnly],
        }),
      ),
    ).toBe(true);
  });
});

// ─── getFlueEvidenceReadiness ─────────────────────────────────────────────────

describe('getFlueEvidenceReadiness', () => {
  it('returns "missing" when no external area scans', () => {
    expect(getFlueEvidenceReadiness(baseCapture())).toBe('missing');
  });

  it('returns "missing" when externalAreaScans is an empty array', () => {
    expect(
      getFlueEvidenceReadiness(baseCapture({ externalAreaScans: [] })),
    ).toBe('missing');
  });

  it('returns "complete" when external scan + flue terminal + measurements are all present', () => {
    expect(
      getFlueEvidenceReadiness(
        baseCapture({ externalAreaScans: [scanWithFlueTerminalAndMeasurements] }),
      ),
    ).toBe('complete');
  });

  it('returns "partial" when external scan is present but no flue terminal or measurements', () => {
    expect(
      getFlueEvidenceReadiness(baseCapture({ externalAreaScans: [scanWithNoPins] })),
    ).toBe('partial');
  });

  it('returns "partial" when external scan + flue terminal but no measurements', () => {
    expect(
      getFlueEvidenceReadiness(
        baseCapture({ externalAreaScans: [scanWithFlueTerminalOnly] }),
      ),
    ).toBe('partial');
  });

  it('returns "partial" when external scan + measurements but no flue terminal', () => {
    expect(
      getFlueEvidenceReadiness(
        baseCapture({ externalAreaScans: [scanWithMeasurementsOnly] }),
      ),
    ).toBe('partial');
  });

  it('returns "complete" when evidence is spread across two scans', () => {
    // One scan has the terminal, another has the measurement — together = complete.
    expect(
      getFlueEvidenceReadiness(
        baseCapture({
          externalAreaScans: [scanWithFlueTerminalOnly, scanWithMeasurementsOnly],
        }),
      ),
    ).toBe('complete');
  });
});
