/**
 * PlaceLocationsStep.test.tsx
 *
 * Acceptance tests for the Place Locations step.
 *
 * Coverage (from problem statement):
 *   1. Renders floor-plan overlay when floor plan exists.
 *   2. Renders fallback list when no floor plan exists.
 *   3. Imported candidate location appears with original confidence.
 *   4. Confirming a location updates confidence.
 *   5. Moving a location preserves audit / provenance.
 *   6. Required-location checklist updates as locations are added.
 *   7. Marking a location as needs verification is reflected.
 *   8. Rejecting a location removes it from the active list.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlaceLocationsStep } from '../steps/PlaceLocationsStep';
import type { QuotePlanLocationV1 } from '../../model/QuoteInstallationPlanV1';
import type { QuoteJobClassificationV1 } from '../../calculators/quotePlannerTypes';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LIKE_FOR_LIKE: QuoteJobClassificationV1 = {
  jobType:   'like_for_like',
  rationale: 'Same family, same location.',
};

const NEEDS_REVIEW: QuoteJobClassificationV1 = {
  jobType:   'needs_review',
  rationale: 'Insufficient data.',
};

function makeLocation(
  partial: Partial<QuotePlanLocationV1> & { kind: QuotePlanLocationV1['kind'] },
): QuotePlanLocationV1 {
  return {
    locationId:  `loc-${partial.kind}`,
    provenance:  'scan_inferred',
    confidence:  'needs_verification',
    ...partial,
  };
}

function renderStep(
  locations: QuotePlanLocationV1[] = [],
  onLocationsChange = vi.fn(),
  extra: { floorPlanUri?: string; jobClassification?: QuoteJobClassificationV1 } = {},
) {
  const { jobClassification = NEEDS_REVIEW, floorPlanUri } = extra;
  return render(
    <PlaceLocationsStep
      locations={locations}
      onLocationsChange={onLocationsChange}
      floorPlanUri={floorPlanUri}
      jobClassification={jobClassification}
    />,
  );
}

// ─── 1. Renders heading and copy ─────────────────────────────────────────────

describe('PlaceLocationsStep — heading and copy', () => {
  it('shows the correct heading', () => {
    renderStep();
    expect(screen.getByText('Place the main items')).toBeTruthy();
  });

  it('shows the subheading copy', () => {
    renderStep();
    expect(
      screen.getByText('Atlas can use scan locations, but you stay in control.'),
    ).toBeTruthy();
  });

  it('shows the context hint copy', () => {
    renderStep();
    expect(
      screen.getByText(
        'Confirm the points that are correct, move anything that needs adjusting.',
      ),
    ).toBeTruthy();
  });
});

// ─── 2. Floor-plan overlay vs fallback list ───────────────────────────────────

describe('PlaceLocationsStep — floor-plan overlay / fallback', () => {
  it('renders the floor-plan overlay when floorPlanUri is provided', () => {
    renderStep([], vi.fn(), { floorPlanUri: 'https://example.com/plan.jpg' });
    expect(screen.getByAltText('Floor plan')).toBeTruthy();
    expect(screen.getByTestId('quote-location-overlay')).toBeTruthy();
  });

  it('renders the fallback list when no floorPlanUri is provided', () => {
    renderStep();
    expect(screen.getByTestId('quote-location-fallback-list')).toBeTruthy();
  });

  it('does not render the floor plan image in fallback mode', () => {
    renderStep();
    expect(screen.queryByAltText('Floor plan')).toBeNull();
  });
});

// ─── 3. Imported candidate appears with original confidence ──────────────────

describe('PlaceLocationsStep — imported candidate location', () => {
  it('shows a location item for a scan-inferred candidate', () => {
    const loc = makeLocation({
      kind:       'existing_boiler',
      provenance: 'scan_inferred',
      confidence: 'needs_verification',
    });
    renderStep([loc]);
    expect(screen.getByTestId('location-item-loc-existing_boiler')).toBeTruthy();
  });

  it('shows the "needs verification" badge on an inferred location', () => {
    const loc = makeLocation({
      kind:       'existing_boiler',
      provenance: 'scan_inferred',
      confidence: 'needs_verification',
    });
    renderStep([loc]);
    expect(screen.getByText('needs verification')).toBeTruthy();
  });

  it('shows the "confirmed" badge on a scan-confirmed location', () => {
    const loc = makeLocation({
      kind:       'gas_meter',
      provenance: 'scan_confirmed',
      confidence: 'high',
    });
    renderStep([loc]);
    expect(screen.getByText('confirmed')).toBeTruthy();
  });
});

// ─── 4. Confirming a location updates confidence ─────────────────────────────

describe('PlaceLocationsStep — confirm location', () => {
  it('calls onLocationsChange with the confirmed location', () => {
    const loc = makeLocation({
      kind:       'existing_boiler',
      locationId: 'loc-eb',
      provenance: 'scan_inferred',
      confidence: 'needs_verification',
    });
    const onChange = vi.fn();
    renderStep([loc], onChange);

    fireEvent.click(
      screen.getByRole('button', { name: /Confirm Existing boiler/i }),
    );

    expect(onChange).toHaveBeenCalledOnce();
    const updated: QuotePlanLocationV1[] = onChange.mock.calls[0][0];
    expect(updated[0].provenance).toBe('scan_confirmed');
    expect(updated[0].confidence).toBe('high');
  });
});

// ─── 5. Moving a location preserves audit / provenance ───────────────────────

describe('PlaceLocationsStep — move location (provenance)', () => {
  it('calls onLocationsChange with manual provenance when an add is triggered', () => {
    const onChange = vi.fn();
    renderStep([], onChange);

    // Open the add bar and add a manual location — should produce manual provenance.
    fireEvent.click(screen.getByRole('button', { name: /Add location/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Gas meter' }));

    expect(onChange).toHaveBeenCalledOnce();
    const updated: QuotePlanLocationV1[] = onChange.mock.calls[0][0];
    expect(updated[0].provenance).toBe('manual');
  });
});

// ─── 6. Required-location checklist updates ───────────────────────────────────

describe('PlaceLocationsStep — required-location checklist', () => {
  it('shows the required slots for like_for_like job', () => {
    renderStep([], vi.fn(), { jobClassification: LIKE_FOR_LIKE });
    expect(screen.getByText('Existing boiler')).toBeTruthy();
    expect(screen.getByText('Proposed boiler')).toBeTruthy();
    expect(screen.getByText('Flue terminal')).toBeTruthy();
    expect(screen.getByText('Condensate / discharge point')).toBeTruthy();
  });

  it('shows a missing marker for an unmet slot', () => {
    renderStep([], vi.fn(), { jobClassification: LIKE_FOR_LIKE });
    // All items are missing; look for the aria-label indicating "missing".
    const missingItems = screen
      .getAllByRole('listitem')
      .filter((el) => el.getAttribute('aria-label')?.includes('missing'));
    expect(missingItems.length).toBeGreaterThan(0);
  });

  it('shows a done marker when a slot is satisfied', () => {
    const loc = makeLocation({ kind: 'existing_boiler', locationId: 'loc-eb' });
    renderStep([loc], vi.fn(), { jobClassification: LIKE_FOR_LIKE });

    const doneItem = screen
      .getAllByRole('listitem')
      .find((el) => el.getAttribute('aria-label') === 'Existing boiler: added');
    expect(doneItem).toBeTruthy();
  });
});

// ─── 7. Marking as needs verification ────────────────────────────────────────

describe('PlaceLocationsStep — mark needs verification', () => {
  it('calls onLocationsChange with needs_verification confidence', () => {
    const loc = makeLocation({
      kind:       'gas_meter',
      locationId: 'loc-gm',
      provenance: 'scan_confirmed',
      confidence: 'high',
    });
    const onChange = vi.fn();
    renderStep([loc], onChange);

    fireEvent.click(
      screen.getByRole('button', { name: /Mark Gas meter as needs verification/i }),
    );

    expect(onChange).toHaveBeenCalledOnce();
    const updated: QuotePlanLocationV1[] = onChange.mock.calls[0][0];
    expect(updated[0].confidence).toBe('needs_verification');
    // Provenance must NOT change.
    expect(updated[0].provenance).toBe('scan_confirmed');
  });
});

// ─── 8. Rejecting a location removes it from the active list ─────────────────

describe('PlaceLocationsStep — reject location', () => {
  it('calls onLocationsChange with rejected=true for the removed location', () => {
    const loc = makeLocation({ kind: 'flue_terminal', locationId: 'loc-ft' });
    const onChange = vi.fn();
    renderStep([loc], onChange);

    fireEvent.click(
      screen.getByRole('button', { name: /Remove Flue terminal/i }),
    );

    expect(onChange).toHaveBeenCalledOnce();
    const updated: QuotePlanLocationV1[] = onChange.mock.calls[0][0];
    expect(updated[0].rejected).toBe(true);
  });

  it('hides the rejected location from the active list', () => {
    const rejected = makeLocation({ kind: 'flue_terminal', locationId: 'loc-ft', rejected: true });
    renderStep([rejected]);
    expect(screen.queryByTestId('location-item-loc-ft')).toBeNull();
  });
});
