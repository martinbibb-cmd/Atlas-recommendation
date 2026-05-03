/**
 * ScanFabricEvidencePanel.test.tsx
 *
 * Tests for ScanFabricEvidencePanel:
 *   1. Renders empty state when no fabric data.
 *   2. Renders room card with room name and dimensions.
 *   3. Renders boundary rows with type/dimensions/material.
 *   4. Renders opening rows with type/dimensions/material/linked boundary.
 *   5. Rejected boundary is shown with audit-only marker.
 *   6. Missing reviewStatus defaults to "Pending".
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScanFabricEvidencePanel } from '../ScanFabricEvidencePanel';
import type { SessionCaptureV2 } from '../../scanImport/contracts/sessionCaptureV2';

function baseCapture(
  overrides: Partial<SessionCaptureV2> = {},
): SessionCaptureV2 {
  return {
    version: '2.0',
    sessionId: 'sc-fabric-panel-test',
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

const fullFabric = {
  roomId: 'r1',
  roomName: 'Living Room',
  floorAreaM2: 18.5,
  ceilingHeightM: 2.4,
  perimeterM: 17.2,
  boundaries: [
    {
      boundaryId: 'b1',
      type: 'external' as const,
      lengthM: 5.0,
      heightM: 2.4,
      material: 'solid brick',
      reviewStatus: 'confirmed' as const,
    },
    {
      boundaryId: 'b2',
      type: 'party' as const,
      lengthM: 3.5,
      heightM: 2.4,
      reviewStatus: 'rejected' as const,
    },
    {
      boundaryId: 'b3',
      type: 'internal' as const,
    },
  ],
  openings: [
    {
      openingId: 'o1',
      type: 'window' as const,
      widthM: 1.2,
      heightM: 1.1,
      material: 'uPVC double glazed',
      linkedBoundaryId: 'b1',
      reviewStatus: 'confirmed' as const,
    },
  ],
};

describe('ScanFabricEvidencePanel — empty state', () => {
  it('shows empty message when no fabric data', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture()} />);
    expect(screen.getByTestId('scan-fabric-evidence-empty')).toBeTruthy();
    expect(screen.queryByTestId('scan-fabric-evidence-panel')).toBeNull();
  });
});

describe('ScanFabricEvidencePanel — room card', () => {
  it('renders the panel when fabric is present', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    expect(screen.getByTestId('scan-fabric-evidence-panel')).toBeTruthy();
  });

  it('shows the room name', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    expect(screen.getByText('Living Room')).toBeTruthy();
  });

  it('shows the floor area', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    expect(screen.getByText(/18\.50 m²/)).toBeTruthy();
  });

  it('shows the ceiling height', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    const card = screen.getByTestId('fabric-room-card-r1');
    expect(card.textContent).toContain('Ceiling');
    expect(card.textContent).toContain('2.40 m');
  });
});

describe('ScanFabricEvidencePanel — boundary rows', () => {
  it('renders a row for the external boundary', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    expect(screen.getByTestId('fabric-boundary-row-b1')).toBeTruthy();
  });

  it('shows the boundary type label', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    expect(screen.getByTestId('fabric-boundary-row-b1').textContent).toContain('External');
  });

  it('shows the boundary material', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    expect(screen.getByTestId('fabric-boundary-row-b1').textContent).toContain('solid brick');
  });

  it('shows Confirmed badge for confirmed boundary', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    const row = screen.getByTestId('fabric-boundary-row-b1');
    expect(row.textContent).toContain('Confirmed');
  });

  it('shows Rejected badge for rejected boundary', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    const row = screen.getByTestId('fabric-boundary-row-b2');
    expect(row.textContent).toContain('Rejected');
  });

  it('shows audit only note for rejected boundary', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    const row = screen.getByTestId('fabric-boundary-row-b2');
    expect(row.textContent).toContain('audit only');
  });

  it('shows Pending badge when reviewStatus is absent', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    const row = screen.getByTestId('fabric-boundary-row-b3');
    expect(row.textContent).toContain('Pending');
  });
});

describe('ScanFabricEvidencePanel — opening rows', () => {
  it('renders an opening row', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    expect(screen.getByTestId('fabric-opening-row-o1')).toBeTruthy();
  });

  it('shows the opening type label', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    expect(screen.getByTestId('fabric-opening-row-o1').textContent).toContain('Window');
  });

  it('shows the linked boundary ID', () => {
    render(<ScanFabricEvidencePanel capture={baseCapture({ floorPlanFabric: [fullFabric] })} />);
    const row = screen.getByTestId('fabric-opening-row-o1');
    expect(row.textContent).toContain('b1');
  });
});
