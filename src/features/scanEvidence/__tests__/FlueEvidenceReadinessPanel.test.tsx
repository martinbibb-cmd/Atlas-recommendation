/**
 * FlueEvidenceReadinessPanel.test.tsx
 *
 * Tests for FlueEvidenceReadinessPanel:
 *   1. Renders with "missing" state when no external scans.
 *   2. Renders with "partial" state when some evidence is present.
 *   3. Renders with "complete" state when all three signals are present.
 *   4. Evidence rows reflect individual boolean signals.
 *   5. Compliance note is always shown.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlueEvidenceReadinessPanel } from '../FlueEvidenceReadinessPanel';
import type { SessionCaptureV2, ExternalAreaScanV1 } from '../../scanImport/contracts/sessionCaptureV2';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function baseCapture(overrides: Partial<SessionCaptureV2> = {}): SessionCaptureV2 {
  return {
    version: '2.0',
    sessionId: 'sc-flue-panel-test',
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

const completeScan: ExternalAreaScanV1 = {
  scanId: 'ext-rear-001',
  label: 'Rear elevation',
  capturedAt: '2026-05-01T10:00:00Z',
  reviewStatus: 'confirmed',
  objectPins: [
    { pinId: 'ep-flue-001', objectType: 'flue_terminal', label: 'Rear flue exit' },
  ],
  measurementLines: [
    { lineId: 'ml-001', label: 'Flue setback', lengthM: 0.9 },
  ],
};

const partialScan: ExternalAreaScanV1 = {
  scanId: 'ext-rear-002',
  label: 'Rear elevation (partial)',
  capturedAt: '2026-05-01T10:00:00Z',
  objectPins: [
    { pinId: 'ep-flue-002', objectType: 'flue_terminal' },
  ],
  // no measurementLines
};

const emptyScan: ExternalAreaScanV1 = {
  scanId: 'ext-rear-003',
  label: 'Rear elevation (empty)',
  capturedAt: '2026-05-01T10:00:00Z',
  // no pins, no measurements
};

// ─── Panel rendering ──────────────────────────────────────────────────────────

describe('FlueEvidenceReadinessPanel — always renders', () => {
  it('renders the panel even when no external scans', () => {
    render(<FlueEvidenceReadinessPanel capture={baseCapture()} />);
    expect(screen.getByTestId('flue-evidence-readiness-panel')).toBeTruthy();
  });

  it('renders the panel with complete evidence', () => {
    render(
      <FlueEvidenceReadinessPanel
        capture={baseCapture({ externalAreaScans: [completeScan] })}
      />,
    );
    expect(screen.getByTestId('flue-evidence-readiness-panel')).toBeTruthy();
  });
});

// ─── Readiness badge ──────────────────────────────────────────────────────────

describe('FlueEvidenceReadinessPanel — readiness badge', () => {
  it('shows "No evidence captured" badge when missing', () => {
    render(<FlueEvidenceReadinessPanel capture={baseCapture()} />);
    expect(screen.getByTestId('flue-evidence-readiness-badge').textContent).toContain(
      'No evidence captured',
    );
  });

  it('shows "Partial evidence" badge for partial state', () => {
    render(
      <FlueEvidenceReadinessPanel
        capture={baseCapture({ externalAreaScans: [partialScan] })}
      />,
    );
    expect(screen.getByTestId('flue-evidence-readiness-badge').textContent).toContain(
      'Partial evidence',
    );
  });

  it('shows "Evidence complete" badge for complete state', () => {
    render(
      <FlueEvidenceReadinessPanel
        capture={baseCapture({ externalAreaScans: [completeScan] })}
      />,
    );
    expect(screen.getByTestId('flue-evidence-readiness-badge').textContent).toContain(
      'Evidence complete',
    );
  });

  it('shows "Partial evidence" badge when scan present but no pins or measurements', () => {
    render(
      <FlueEvidenceReadinessPanel
        capture={baseCapture({ externalAreaScans: [emptyScan] })}
      />,
    );
    expect(screen.getByTestId('flue-evidence-readiness-badge').textContent).toContain(
      'Partial evidence',
    );
  });
});

// ─── Evidence rows ────────────────────────────────────────────────────────────

describe('FlueEvidenceReadinessPanel — evidence rows', () => {
  it('renders the external scan row', () => {
    render(<FlueEvidenceReadinessPanel capture={baseCapture()} />);
    expect(screen.getByTestId('flue-evidence-row-external-scan')).toBeTruthy();
  });

  it('renders the flue terminal row', () => {
    render(<FlueEvidenceReadinessPanel capture={baseCapture()} />);
    expect(screen.getByTestId('flue-evidence-row-terminal-pin')).toBeTruthy();
  });

  it('renders the measurements row', () => {
    render(<FlueEvidenceReadinessPanel capture={baseCapture()} />);
    expect(screen.getByTestId('flue-evidence-row-measurements')).toBeTruthy();
  });

  it('external scan row shows "External flue evidence captured" label', () => {
    render(<FlueEvidenceReadinessPanel capture={baseCapture()} />);
    expect(
      screen.getByTestId('flue-evidence-row-external-scan').textContent,
    ).toContain('External flue evidence captured');
  });

  it('terminal row shows "Flue terminal marked" label', () => {
    render(<FlueEvidenceReadinessPanel capture={baseCapture()} />);
    expect(
      screen.getByTestId('flue-evidence-row-terminal-pin').textContent,
    ).toContain('Flue terminal marked');
  });

  it('measurements row shows "Measurement lines recorded" label', () => {
    render(<FlueEvidenceReadinessPanel capture={baseCapture()} />);
    expect(
      screen.getByTestId('flue-evidence-row-measurements').textContent,
    ).toContain('Measurement lines recorded');
  });
});

// ─── Compliance note ──────────────────────────────────────────────────────────

describe('FlueEvidenceReadinessPanel — compliance note', () => {
  it('always shows the compliance note', () => {
    render(<FlueEvidenceReadinessPanel capture={baseCapture()} />);
    expect(screen.getByTestId('flue-evidence-compliance-note')).toBeTruthy();
  });

  it('compliance note text mentions clearance compliance', () => {
    render(<FlueEvidenceReadinessPanel capture={baseCapture()} />);
    expect(
      screen.getByTestId('flue-evidence-compliance-note').textContent,
    ).toContain('Clearance compliance not calculated yet');
  });

  it('compliance note is also shown when evidence is complete', () => {
    render(
      <FlueEvidenceReadinessPanel
        capture={baseCapture({ externalAreaScans: [completeScan] })}
      />,
    );
    expect(
      screen.getByTestId('flue-evidence-compliance-note').textContent,
    ).toContain('Clearance compliance not calculated yet');
  });
});
