/**
 * ScanHazardObservationPanel.test.tsx
 *
 * Tests for ScanHazardObservationPanel:
 *   1. Renders empty state when no hazard data.
 *   2. Renders asbestos_suspected / high / blocking example.
 *   3. Rejected hazard is marked audit-only.
 *   4. Blocking banner appears for high/critical non-rejected hazards.
 *   5. Low hazard does not trigger blocking banner.
 *   6. Linked photo IDs are shown.
 *   7. Linked object pin IDs are shown.
 *   8. Customer output components do not render hazard text (verified via
 *      getCustomerSafeFabricEvidence returning empty — tested in selectors).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScanHazardObservationPanel } from '../ScanHazardObservationPanel';
import type { SessionCaptureV2 } from '../../scanImport/contracts/sessionCaptureV2';
import type { HazardObservationCaptureV1 } from '../../scanImport/contracts/sessionCaptureV2';

function baseCapture(
  overrides: Partial<SessionCaptureV2> = {},
): SessionCaptureV2 {
  return {
    version: '2.0',
    sessionId: 'sc-hazard-panel-test',
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

const asbestosHazard: HazardObservationCaptureV1 = {
  hazardId: 'hz-asbestos',
  category: 'asbestos_suspected',
  severity: 'high',
  title: 'Suspected asbestos ceiling tiles',
  description: 'Textured ceiling tiles in utility room.',
  linkedPhotoIds: ['p-001', 'p-002'],
  linkedObjectPinIds: ['op-007'],
  actionRequired: 'Do not disturb. Refer to licensed contractor.',
  reviewStatus: 'confirmed',
};

const criticalHazard: HazardObservationCaptureV1 = {
  hazardId: 'hz-structural',
  category: 'structural',
  severity: 'blocking',
  title: 'Structural crack above lintel',
  reviewStatus: 'pending',
};

const lowHazard: HazardObservationCaptureV1 = {
  hazardId: 'hz-low',
  category: 'other',
  severity: 'low',
  title: 'Minor staining on wall',
  reviewStatus: 'confirmed',
};

const rejectedHazard: HazardObservationCaptureV1 = {
  hazardId: 'hz-rejected',
  category: 'electrical',
  severity: 'high',
  title: 'Exposed wiring — dismissed by engineer',
  reviewStatus: 'rejected',
};

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('ScanHazardObservationPanel — empty state', () => {
  it('shows empty message when no hazards', () => {
    render(<ScanHazardObservationPanel capture={baseCapture()} />);
    expect(screen.getByTestId('scan-hazard-observation-empty')).toBeTruthy();
    expect(screen.queryByTestId('scan-hazard-observation-panel')).toBeNull();
  });
});

// ─── Asbestos / high / blocking ───────────────────────────────────────────────

describe('ScanHazardObservationPanel — asbestos_suspected high example', () => {
  it('renders the panel', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [asbestosHazard] })} />);
    expect(screen.getByTestId('scan-hazard-observation-panel')).toBeTruthy();
  });

  it('renders a row for the hazard', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [asbestosHazard] })} />);
    expect(screen.getByTestId('hazard-row-hz-asbestos')).toBeTruthy();
  });

  it('shows the hazard title', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [asbestosHazard] })} />);
    expect(screen.getByText('Suspected asbestos ceiling tiles')).toBeTruthy();
  });

  it('shows the description', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [asbestosHazard] })} />);
    expect(screen.getByText(/Textured ceiling tiles/)).toBeTruthy();
  });

  it('shows the action required text', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [asbestosHazard] })} />);
    expect(screen.getByText(/Do not disturb/)).toBeTruthy();
  });

  it('shows linked photo IDs', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [asbestosHazard] })} />);
    const photoEl = screen.getByTestId('hazard-photo-ids-hz-asbestos');
    expect(photoEl.textContent).toContain('p-001');
    expect(photoEl.textContent).toContain('p-002');
  });

  it('shows linked object pin IDs', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [asbestosHazard] })} />);
    const pinEl = screen.getByTestId('hazard-pin-ids-hz-asbestos');
    expect(pinEl.textContent).toContain('op-007');
  });

  it('shows blocking banner for a high non-rejected hazard', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [asbestosHazard] })} />);
    expect(screen.getByTestId('scan-hazard-blocking-banner')).toBeTruthy();
  });

  it('shows blocking banner for a blocking pending hazard', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [criticalHazard] })} />);
    expect(screen.getByTestId('scan-hazard-blocking-banner')).toBeTruthy();
  });

  it('does not show blocking banner for a low hazard', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [lowHazard] })} />);
    expect(screen.queryByTestId('scan-hazard-blocking-banner')).toBeNull();
  });
});

// ─── Rejected hazard as audit-only ───────────────────────────────────────────

describe('ScanHazardObservationPanel — rejected hazard is audit-only', () => {
  it('renders the rejected hazard row', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [rejectedHazard] })} />);
    expect(screen.getByTestId('hazard-row-hz-rejected')).toBeTruthy();
  });

  it('shows Rejected badge on the row', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [rejectedHazard] })} />);
    const row = screen.getByTestId('hazard-row-hz-rejected');
    expect(row.textContent).toContain('Rejected');
  });

  it('shows audit only note on the rejected row', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [rejectedHazard] })} />);
    const row = screen.getByTestId('hazard-row-hz-rejected');
    expect(row.textContent).toContain('audit only');
  });

  it('does not show blocking banner for a rejected high hazard', () => {
    render(<ScanHazardObservationPanel capture={baseCapture({ hazardObservations: [rejectedHazard] })} />);
    expect(screen.queryByTestId('scan-hazard-blocking-banner')).toBeNull();
  });
});
