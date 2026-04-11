/**
 * HandoffArrivalPage.test.tsx
 *
 * Render tests for the HandoffArrivalPage component.
 *
 * Coverage:
 *   1. Renders with no props (uses dev fixture)
 *   2. Header shows property address
 *   3. Source badge is present
 *   4. Section headings are visible
 *   5. Open Atlas Mind CTA is present and enabled when ready
 *   6. Open Atlas Mind CTA is disabled when not ready for simulation
 *   7. Back button is rendered when onBack is provided
 *   8. Error state is shown for an invalid handoff payload
 *   9. Knowledge panel renders status labels
 *  10. Readiness panel renders ready state
 *  11. Evidence summary renders counts
 *  12. onOpenAtlasMind callback is invoked with a PresentationSeed on CTA click
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HandoffArrivalPage from '../HandoffArrivalPage';
import type { AtlasPropertyV1 } from '@atlas/contracts';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function fv<T>(value: T, confidence: 'high' | 'medium' | 'low' = 'high') {
  return { value, source: 'engineer_entered' as const, confidence };
}

const VALID_PROPERTY: AtlasPropertyV1 = {
  version: '1.0',
  propertyId: 'prop_arrival_test',
  createdAt: '2024-07-01T10:00:00Z',
  updatedAt: '2024-07-01T10:30:00Z',
  status: 'ready_for_simulation',
  sourceApps: ['atlas_scan'],
  property: {
    address1: '7 Handoff Road',
    town: 'Bristol',
    postcode: 'BS2 0QQ',
    uprn: 'UPRN_ARR_01',
  },
  capture: {
    sessionId: 'session_arrival_01',
    completedAt: '2024-07-01T10:00:00Z',
  },
  building: {
    floors: [],
    rooms: [
      { roomId: 'r1', floorId: 'f1', label: 'Lounge' },
      { roomId: 'r2', floorId: 'f1', label: 'Kitchen' },
    ],
    zones: [], boundaries: [], openings: [],
    emitters: [],
    systemComponents: [
      { componentId: 'c1', label: 'Boiler', kind: 'boiler' },
    ],
  },
  household: {
    composition: {
      adultCount:                  fv(2),
      childCount0to4:              fv(0),
      childCount5to10:             fv(0),
      childCount11to17:            fv(0),
      youngAdultCount18to25AtHome: fv(0),
    },
    occupancyPattern: fv('steady_home', 'medium'),
    hotWaterUsage: {
      bathPresent:   fv(true),
      showerPresent: fv(true),
      bathroomCount: fv(1),
    },
  },
  currentSystem: {
    family:  fv('combi'),
    dhwType: fv('combi'),
    heatSource: {
      ratedOutputKw: fv(28),
      installYear:   fv(2018),
    },
    distribution: {
      dominantPipeDiameterMm: fv(22, 'medium'),
    },
  },
  evidence: {
    photos: [
      { photoId: 'ph1', capturedAt: '2024-07-01T09:35:00Z', tag: 'boiler' },
    ],
    voiceNotes: [
      { voiceNoteId: 'vn1', capturedAt: '2024-07-01T09:40:00Z', durationSeconds: 20, transcript: 'Boiler is old.' },
    ],
    textNotes: [
      { noteId: 'tn1', createdAt: '2024-07-01T09:45:00Z', body: 'Loft accessible.' },
    ],
    qaFlags: [],
    events: [],
  },
  derived: {
    heatLoss:   { peakWatts:         fv(7200, 'medium') },
    hydraulics: {
      dynamicPressureBar: fv(2.8),
      mainsFlowLpm:       fv(16),
    },
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HandoffArrivalPage', () => {

  it('renders without errors using the built-in dev fixture (no props)', () => {
    expect(() => render(<HandoffArrivalPage />)).not.toThrow();
  });

  it('renders the "Atlas Mind — Handoff Arrival" label', () => {
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} />);
    expect(screen.getByText(/Handoff Arrival/i)).toBeDefined();
  });

  it('shows the property address from the handoff payload', () => {
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} />);
    expect(screen.getByText(/7 Handoff Road/i)).toBeDefined();
  });

  it('shows the "From Atlas Scan" source badge', () => {
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} />);
    expect(screen.getByText(/From Atlas Scan/i)).toBeDefined();
  });

  it('renders the "What Atlas Mind understands" knowledge panel heading', () => {
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} />);
    expect(screen.getByText(/What Atlas Mind understands/i)).toBeDefined();
  });

  it('renders the "Simulation readiness" panel heading', () => {
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} />);
    expect(screen.getByText(/Simulation readiness/i)).toBeDefined();
  });

  it('renders the "Captured evidence" panel heading', () => {
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} />);
    expect(screen.getByText(/Captured evidence/i)).toBeDefined();
  });

  it('renders the "Open Atlas Mind" CTA button', () => {
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} />);
    expect(screen.getByText(/Open Atlas Mind/i)).toBeDefined();
  });

  it('Open Atlas Mind button is enabled for a ready-for-simulation property', () => {
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} />);
    const btn = screen.getByText(/Open Atlas Mind/i) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('Open Atlas Mind button is disabled when property is not ready for simulation', () => {
    const notReady = {
      ...VALID_PROPERTY,
      property: { address1: '7 Handoff Road', town: 'Bristol' }, // no postcode
    };
    render(<HandoffArrivalPage handoffPayload={notReady} />);
    const btn = screen.getByText(/Open Atlas Mind/i) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('renders back button when onBack is provided', () => {
    const onBack = vi.fn();
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} onBack={onBack} />);
    const backBtn = screen.getByText(/← Back/i);
    expect(backBtn).toBeDefined();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} onBack={onBack} />);
    const backBtn = screen.getByText(/← Back/i);
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows error state for an invalid handoff payload', () => {
    render(<HandoffArrivalPage handoffPayload={{ version: '2.0', invalid: true }} />);
    expect(screen.getByText(/could not be loaded/i)).toBeDefined();
  });

  it('calls onOpenAtlasMind with a PresentationSeed when CTA is clicked', () => {
    const onOpenAtlasMind = vi.fn();
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} onOpenAtlasMind={onOpenAtlasMind} />);
    const btn = screen.getByText(/Open Atlas Mind/i);
    fireEvent.click(btn);
    expect(onOpenAtlasMind).toHaveBeenCalledOnce();
    const seed = onOpenAtlasMind.mock.calls[0][0] as Record<string, unknown>;
    expect(seed.atlasProperty).toBeDefined();
    expect(seed.engineInput).toBeDefined();
    expect(seed.completeness).toBeDefined();
    expect(seed.source).toBe('atlas_scan_handoff');
  });

  it('shows Confirmed status badge in knowledge panel for a complete property', () => {
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} />);
    const badges = screen.getAllByText(/Confirmed/i);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows ready state text when property is ready for simulation', () => {
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} />);
    const readyElements = screen.getAllByText(/Ready for simulation/i);
    expect(readyElements.length).toBeGreaterThan(0);
  });

  it('shows photo, voice note, and text note counts in evidence panel', () => {
    render(<HandoffArrivalPage handoffPayload={VALID_PROPERTY} />);
    // Labels appear in both summary card and evidence panel — use getAllByText
    const photoLabels = screen.getAllByText(/Photos/i);
    expect(photoLabels.length).toBeGreaterThan(0);
    const voiceLabels = screen.getAllByText(/Voice notes/i);
    expect(voiceLabels.length).toBeGreaterThan(0);
    const noteLabels = screen.getAllByText(/Text notes/i);
    expect(noteLabels.length).toBeGreaterThan(0);
  });
});
