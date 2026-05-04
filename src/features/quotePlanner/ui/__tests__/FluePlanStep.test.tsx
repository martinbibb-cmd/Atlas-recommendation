/**
 * FluePlanStep.test.tsx
 *
 * Acceptance tests for the Flue Plan step.
 *
 * Coverage (from problem statement):
 *   1. Heading and copy renders correctly.
 *   2. Flue family tiles render and selecting one calls onFlueRouteChange.
 *   3. Adding a straight segment triggers calculation and shows result.
 *   4. Adding a 90° elbow adds 2.0 m equivalent length (generic estimate).
 *   5. Adding two 45° elbows adds 2.0 m equivalent length (generic estimate).
 *   6. Calculation summary shows "Needs model-specific check" when no max.
 *   7. Removing a segment updates the calculation.
 *   8. Generic estimate banner is displayed.
 *   9. Calculation breakdown labels are visible.
 *  10. Location selectors render the active locations list.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FluePlanStep } from '../steps/FluePlanStep';
import type { QuotePlanLocationV1, QuotePlanCandidateFlueRouteV1 } from '../../model/QuoteInstallationPlanV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLocation(
  partial: Partial<QuotePlanLocationV1> & { kind: QuotePlanLocationV1['kind'] },
): QuotePlanLocationV1 {
  return {
    locationId:  `loc-${partial.kind}`,
    provenance:  'manual',
    confidence:  'high',
    ...partial,
  };
}

const BOILER_LOC   = makeLocation({ kind: 'proposed_boiler', locationId: 'loc-boiler' });
const TERMINAL_LOC = makeLocation({ kind: 'flue_terminal',   locationId: 'loc-terminal' });

function renderStep(
  flueRoute: QuotePlanCandidateFlueRouteV1 | null = null,
  onFlueRouteChange = vi.fn(),
  locations: QuotePlanLocationV1[] = [],
) {
  return render(
    <FluePlanStep
      flueRoute={flueRoute}
      onFlueRouteChange={onFlueRouteChange}
      locations={locations}
    />,
  );
}

// ─── Helper: add a straight segment via the UI ────────────────────────────────

function addStraightSegment(lengthM: number) {
  fireEvent.click(screen.getByRole('button', { name: '+ Add segment' }));
  fireEvent.click(screen.getByRole('button', { name: /Straight section/i }));
  fireEvent.change(screen.getByLabelText('Straight length in metres'), {
    target: { value: String(lengthM) },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

// Helper: add a fitting segment (no length required)
function addFittingSegment(namePattern: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: '+ Add segment' }));
  // Scope to the picker group to avoid matching Remove buttons with the same label text.
  const picker = screen.getByRole('group', { name: 'Segment type picker' });
  fireEvent.click(within(picker).getByRole('button', { name: namePattern }));
}

// ─── 1. Heading and copy ──────────────────────────────────────────────────────

describe('FluePlanStep — heading and copy', () => {
  it('shows the correct heading', () => {
    renderStep();
    expect(screen.getByText('Flue plan')).toBeTruthy();
  });

  it('shows the subheading copy', () => {
    renderStep();
    expect(
      screen.getByText('Build the flue route and check the equivalent length.'),
    ).toBeTruthy();
  });
});

// ─── 2. Flue family tiles ─────────────────────────────────────────────────────

describe('FluePlanStep — flue family tiles', () => {
  it('renders the flue family tile group', () => {
    renderStep();
    expect(screen.getByRole('group', { name: 'Flue family' })).toBeTruthy();
  });

  it('renders all six family tiles', () => {
    renderStep();
    expect(screen.getByRole('button', { name: /Horizontal — rear/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Horizontal — side/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Vertical$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Vertical with offsets/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Plume management/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Not yet confirmed/i })).toBeTruthy();
  });

  it('selecting a family tile calls onFlueRouteChange with updated family', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Horizontal — rear/i }));
    expect(onChange).toHaveBeenCalledOnce();
    const route: QuotePlanCandidateFlueRouteV1 = onChange.mock.calls[0][0];
    expect(route.family).toBe('horizontal_rear');
  });

  it('selected tile becomes aria-pressed=true', () => {
    renderStep();
    const btn = screen.getByRole('button', { name: /Horizontal — side/i });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});

// ─── 3. Adding a straight segment triggers calculation ────────────────────────

describe('FluePlanStep — straight segment calculation', () => {
  it('adding a 3 m straight segment shows 3.0 m equivalent length', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    addStraightSegment(3);
    // After adding, calculation should show 3.0 m equivalent
    const summary = screen.getByTestId('flue-calc-summary');
    expect(summary).toBeTruthy();
    expect(screen.getByTestId('flue-calc-equivalent').textContent).toContain('3.0');
  });

  it('calculation summary is shown after first segment is added', () => {
    renderStep();
    addStraightSegment(1.5);
    expect(screen.getByTestId('flue-calc-summary')).toBeTruthy();
  });
});

// ─── 4. 90° elbow adds 2.0 m generic estimate ────────────────────────────────

describe('FluePlanStep — 90° elbow (generic estimate)', () => {
  it('3 m straight + 1 × 90° elbow = 5.0 m equivalent', () => {
    renderStep();
    addStraightSegment(3);
    addFittingSegment(/90° elbow/i);
    expect(screen.getByTestId('flue-calc-equivalent').textContent).toContain('5.0');
  });

  it('calls onFlueRouteChange with calculation after adding elbow', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    addStraightSegment(3);
    addFittingSegment(/90° elbow/i);
    const route: QuotePlanCandidateFlueRouteV1 = onChange.mock.calls.at(-1)![0];
    expect(route.calculation?.equivalentLengthM).toBeCloseTo(5, 5);
    expect(route.calculation?.calculationMode).toBe('generic_estimate');
  });
});

// ─── 5. Two 45° elbows add 2.0 m generic estimate ────────────────────────────

describe('FluePlanStep — 45° elbows (generic estimate)', () => {
  it('3 m straight + 2 × 45° elbows = 5.0 m equivalent', () => {
    renderStep();
    addStraightSegment(3);
    addFittingSegment(/45° elbow/i);
    addFittingSegment(/45° elbow/i);
    expect(screen.getByTestId('flue-calc-equivalent').textContent).toContain('5.0');
  });
});

// ─── 6. No max → needs model-specific check ───────────────────────────────────

describe('FluePlanStep — no max allowance', () => {
  it('shows "Needs model-specific check" result when no max is set', () => {
    renderStep();
    addStraightSegment(3);
    addFittingSegment(/90° elbow/i);
    const resultEl = screen.getByTestId('flue-calc-result');
    expect(resultEl.textContent).toMatch(/needs model-specific check/i);
  });
});

// ─── 7. Removing a segment updates calculation ────────────────────────────────

describe('FluePlanStep — remove segment', () => {
  it('removing a segment reduces the equivalent length', () => {
    renderStep();
    addStraightSegment(3);
    addFittingSegment(/90° elbow/i);
    // 5.0 m before removal
    expect(screen.getByTestId('flue-calc-equivalent').textContent).toContain('5.0');
    // Remove the 90° elbow (index 1)
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
    fireEvent.click(removeButtons[removeButtons.length - 1]); // remove last
    expect(screen.getByTestId('flue-calc-equivalent').textContent).toContain('3.0');
  });
});

// ─── 8. Generic estimate banner ───────────────────────────────────────────────

describe('FluePlanStep — generic estimate banner', () => {
  it('shows the generic estimate notice in the calculation summary', () => {
    renderStep();
    addStraightSegment(1);
    expect(
      screen.getByText(/Generic estimate/i),
    ).toBeTruthy();
  });
});

// ─── 9. Calculation breakdown labels ─────────────────────────────────────────

describe('FluePlanStep — calculation breakdown', () => {
  it('shows physical length and equivalent length labels', () => {
    renderStep();
    addStraightSegment(3);
    expect(screen.getByText('Physical straight length')).toBeTruthy();
    expect(screen.getByText(/Total equivalent length/i)).toBeTruthy();
    expect(screen.getByText('Manufacturer max allowance')).toBeTruthy();
  });

  it('shows "Not selected yet" for max allowance when none set', () => {
    renderStep();
    addStraightSegment(3);
    expect(screen.getByText('Not selected yet')).toBeTruthy();
  });
});

// ─── 10. Location selectors ───────────────────────────────────────────────────

describe('FluePlanStep — location selectors', () => {
  it('renders the boiler location select', () => {
    renderStep(null, vi.fn(), [BOILER_LOC]);
    expect(screen.getByLabelText('Proposed boiler location')).toBeTruthy();
  });

  it('renders the terminal location select', () => {
    renderStep(null, vi.fn(), [TERMINAL_LOC]);
    expect(screen.getByLabelText('Proposed flue terminal location')).toBeTruthy();
  });

  it('shows active locations in the boiler select', () => {
    renderStep(null, vi.fn(), [BOILER_LOC]);
    const boilerSelect = screen.getByLabelText('Proposed boiler location');
    const options = boilerSelect.querySelectorAll('option');
    const labels = Array.from(options).map((o) => (o as HTMLOptionElement).text);
    expect(labels.some((l) => l.includes('Proposed boiler'))).toBe(true);
  });

  it('does not show rejected locations', () => {
    const rejected = makeLocation({
      kind:       'proposed_boiler',
      locationId: 'loc-rejected',
      rejected:   true,
    });
    renderStep(null, vi.fn(), [rejected]);
    // Only the placeholder "Not yet selected" option should be present for this location
    const boilerSelect = screen.getByLabelText('Proposed boiler location');
    expect(boilerSelect).toBeTruthy();
    // Rejected location should not appear as an option
    const options = boilerSelect.querySelectorAll('option');
    const ids = Array.from(options).map((o) => (o as HTMLOptionElement).value);
    expect(ids).not.toContain('loc-rejected');
  });

  it('selecting a boiler location calls onFlueRouteChange with boilerLocationId', () => {
    const onChange = vi.fn();
    renderStep(null, onChange, [BOILER_LOC]);
    const select = screen.getByLabelText('Proposed boiler location');
    fireEvent.change(select, { target: { value: 'loc-boiler' } });
    expect(onChange).toHaveBeenCalled();
    const route: QuotePlanCandidateFlueRouteV1 = onChange.mock.calls.at(-1)![0];
    expect(route.boilerLocationId).toBe('loc-boiler');
  });
});

// ─── Nudge hint when no segments ──────────────────────────────────────────────

describe('FluePlanStep — no segments hint', () => {
  it('shows hint text when no segments are present', () => {
    renderStep();
    expect(
      screen.getByText(/Add at least one segment/i),
    ).toBeTruthy();
  });

  it('hides the hint once a segment is added', () => {
    renderStep();
    addStraightSegment(1);
    expect(
      screen.queryByText(/Add at least one segment/i),
    ).toBeNull();
  });
});
