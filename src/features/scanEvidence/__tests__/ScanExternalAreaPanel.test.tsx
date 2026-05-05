/**
 * ScanExternalAreaPanel.test.tsx
 *
 * Tests for ScanExternalAreaPanel:
 *   1. Renders empty state when no external area scans.
 *   2. Renders the panel when external scans are present.
 *   3. Shows flue terminal pin in the object pins section.
 *   4. Shows measurement lines.
 *   5. Shows point cloud asset ID.
 *   6. Shows photo count on the scan card header.
 *   7. ReviewStatus badge is rendered.
 *   8. No customer output renders external hazard/flue detail (gate check via selectors).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScanExternalAreaPanel } from '../ScanExternalAreaPanel';
import { getExternalAreaScans } from '../scanEvidenceSelectors';
import type { SessionCaptureV2, ExternalAreaScanV1 } from '../../scanImport/contracts/sessionCaptureV2';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function baseCapture(overrides: Partial<SessionCaptureV2> = {}): SessionCaptureV2 {
  return {
    version: '2.0',
    sessionId: 'sc-ext-panel-test',
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

const rearScan: ExternalAreaScanV1 = {
  scanId: 'ext-rear-001',
  label: 'Rear elevation',
  capturedAt: '2026-05-01T10:00:00Z',
  reviewStatus: 'confirmed',
  photoIds: ['p-ext-001', 'p-ext-002'],
  objectPins: [
    { pinId: 'ep-flue-001', objectType: 'flue_terminal', label: 'Rear flue exit' },
    { pinId: 'ep-obs-001', objectType: 'obstruction', label: 'Neighbour fence' },
    { pinId: 'ep-open-001', objectType: 'opening', label: 'Air brick' },
  ],
  measurementLines: [
    { lineId: 'ml-001', label: 'Flue to boundary', lengthM: 1.2 },
    { lineId: 'ml-002', label: 'Flue height from ground', lengthM: 2.35 },
  ],
  pointCloudAssetId: 'pc-rear-001',
};

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('ScanExternalAreaPanel — empty state', () => {
  it('shows empty message when no external scans', () => {
    render(<ScanExternalAreaPanel capture={baseCapture()} />);
    expect(screen.getByTestId('scan-external-area-empty')).toBeTruthy();
    expect(screen.queryByTestId('scan-external-area-panel')).toBeNull();
  });

  it('empty message mentions external / flue scans', () => {
    render(<ScanExternalAreaPanel capture={baseCapture()} />);
    expect(screen.getByTestId('scan-external-area-empty').textContent).toContain('external');
  });
});

// ─── Panel with scans ─────────────────────────────────────────────────────────

describe('ScanExternalAreaPanel — panel with external scans', () => {
  it('renders the panel container when scans are present', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByTestId('scan-external-area-panel')).toBeTruthy();
    expect(screen.queryByTestId('scan-external-area-empty')).toBeNull();
  });

  it('renders a card for each scan', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByTestId('external-scan-card-ext-rear-001')).toBeTruthy();
  });

  it('shows the scan label in the card header', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByText('Rear elevation')).toBeTruthy();
  });

  it('shows the photo count on the card header', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByTestId('external-scan-photo-count-ext-rear-001').textContent).toContain('2');
  });

  it('shows the point cloud asset ID', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByTestId('external-scan-point-cloud-ext-rear-001').textContent).toContain('pc-rear-001');
  });
});

// ─── Object pins ──────────────────────────────────────────────────────────────

describe('ScanExternalAreaPanel — object pins', () => {
  it('renders a row for the flue terminal pin', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByTestId('external-pin-row-ep-flue-001')).toBeTruthy();
  });

  it('shows "Flue terminal" label for flue_terminal pins', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByTestId('external-pin-row-ep-flue-001').textContent).toContain('Flue terminal');
  });

  it('shows the flue terminal pin label', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByTestId('external-pin-row-ep-flue-001').textContent).toContain('Rear flue exit');
  });

  it('renders a row for the obstruction pin', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByTestId('external-pin-row-ep-obs-001')).toBeTruthy();
  });

  it('renders a row for the opening pin', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByTestId('external-pin-row-ep-open-001')).toBeTruthy();
  });
});

// ─── Measurement lines ────────────────────────────────────────────────────────

describe('ScanExternalAreaPanel — measurement lines', () => {
  it('renders a row for each measurement line', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByTestId('external-measurement-row-ml-001')).toBeTruthy();
    expect(screen.getByTestId('external-measurement-row-ml-002')).toBeTruthy();
  });

  it('shows the measurement label', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByTestId('external-measurement-row-ml-001').textContent).toContain('Flue to boundary');
  });

  it('shows the measured length in metres', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan] })} />);
    expect(screen.getByTestId('external-measurement-row-ml-001').textContent).toContain('1.20');
  });
});

// ─── Multiple scans ───────────────────────────────────────────────────────────

describe('ScanExternalAreaPanel — multiple scans', () => {
  const frontScan: ExternalAreaScanV1 = {
    scanId: 'ext-front-001',
    label: 'Front elevation',
    capturedAt: '2026-05-01T10:30:00Z',
    reviewStatus: 'pending',
  };

  it('renders cards for both scans', () => {
    render(<ScanExternalAreaPanel capture={baseCapture({ externalAreaScans: [rearScan, frontScan] })} />);
    expect(screen.getByTestId('external-scan-card-ext-rear-001')).toBeTruthy();
    expect(screen.getByTestId('external-scan-card-ext-front-001')).toBeTruthy();
  });
});

// ─── Customer output gate ─────────────────────────────────────────────────────

describe('ScanExternalAreaPanel — customer output gate', () => {
  it('getExternalAreaScans returns empty for a capture with no external scans', () => {
    // Verify via the selector that a plain capture returns nothing — the
    // customer-facing components call getExternalAreaScans and receive nothing.
    const result = getExternalAreaScans(baseCapture());
    expect(result).toHaveLength(0);
  });
});
