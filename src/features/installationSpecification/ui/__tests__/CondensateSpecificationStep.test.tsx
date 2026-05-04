/**
 * CondensateSpecificationStep.test.tsx
 *
 * Acceptance tests for the Condensate Specification step.
 *
 * Coverage (from problem statement):
 *   1.  Heading and copy renders correctly.
 *   2.  Four discharge method tiles render (external_trace_heat removed).
 *   3.  external_trace_heat tile does NOT render.
 *   4.  Selecting a tile calls onCondensateRouteChange with the correct kind.
 *   5.  Selected tile becomes aria-pressed=true.
 *   6.  Route details section appears after a discharge kind is selected.
 *   7.  Freeze-risk notice shown for external discharge kinds.
 *   8.  Freeze-risk notice NOT shown for internal discharge kinds.
 *   9.  Pipe run length input updates the route.
 *  10.  Invalid / blank pipe run input keeps pipeRunM as null.
 *  11.  Needs surveyor decision toggle updates the route.
 *  12.  Surveyor decision warning shown when flagged.
 *  13.  Notes field updates the route.
 *  14.  Nudge hint shown when no discharge kind is selected.
 *  15.  Nudge hint hidden after a discharge kind is selected.
 *  16.  Route type label shows "Internal" / "External" as appropriate.
 *  17.  Legacy condensate option warning shown when plan carries external_trace_heat.
 *  18.  External gully and soakaway tiles show Freeze risk badge.
 *  19.  Condensate pump tile shows power-and-maintenance note.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CondensateSpecificationStep } from '../steps/CondensateSpecificationStep';
import type { QuotePlanCondensateRouteV1, CondensateDischargeKind, LegacyCondensateDischargeKind } from '../../model/QuoteInstallationPlanV1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderStep(
  condensateRoute: QuotePlanCondensateRouteV1 | null = null,
  onCondensateRouteChange = vi.fn(),
) {
  return render(
    <CondensateSpecificationStep
      condensateRoute={condensateRoute}
      onCondensateRouteChange={onCondensateRouteChange}
    />,
  );
}

// ─── 1. Heading and copy ──────────────────────────────────────────────────────

describe('CondensateSpecificationStep — heading and copy', () => {
  it('shows the correct heading', () => {
    renderStep();
    expect(screen.getByText('Condensate specification')).toBeTruthy();
  });

  it('shows the subheading copy (not "confirm the route")', () => {
    renderStep();
    expect(
      screen.getByText('Select the discharge method and specify the route.'),
    ).toBeTruthy();
  });
});

// ─── 2. Four discharge method tiles render ────────────────────────────────────

describe('CondensateSpecificationStep — discharge tiles', () => {
  it('renders the discharge method tile group', () => {
    renderStep();
    expect(screen.getByRole('group', { name: 'Condensate discharge method' })).toBeTruthy();
  });

  it('renders exactly four discharge kind tiles', () => {
    renderStep();
    expect(screen.getByRole('button', { name: /Internal waste/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /External gully/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Soakaway/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Condensate pump/i })).toBeTruthy();
  });
});

// ─── 3. external_trace_heat tile does NOT render ──────────────────────────────

describe('CondensateSpecificationStep — no trace heat tile', () => {
  it('does NOT render an External with trace heat tile', () => {
    renderStep();
    expect(screen.queryByRole('button', { name: /External with trace heat/i })).toBeNull();
  });

  it('does NOT render any tile with "trace" in the label', () => {
    renderStep();
    expect(screen.queryByText(/trace/i)).toBeNull();
  });
});

// ─── 4. Selecting a tile calls onCondensateRouteChange ───────────────────────

describe('CondensateSpecificationStep — tile selection', () => {
  it('selecting internal_waste calls onCondensateRouteChange with correct kind', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    expect(onChange).toHaveBeenCalledOnce();
    const route: QuotePlanCondensateRouteV1 = onChange.mock.calls[0][0];
    expect(route.dischargeKind).toBe('internal_waste');
  });

  it('selecting external_gully calls onCondensateRouteChange with isExternal=true', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /External gully/i }));
    const route: QuotePlanCondensateRouteV1 = onChange.mock.calls[0][0];
    expect(route.dischargeKind).toBe('external_gully');
    expect(route.isExternal).toBe(true);
  });

  it('selecting condensate_pump produces isExternal=false', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Condensate pump/i }));
    const route: QuotePlanCondensateRouteV1 = onChange.mock.calls[0][0];
    expect(route.isExternal).toBe(false);
  });

  it('changing discharge kind from internal to external updates isExternal', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    // Select internal first
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    expect(onChange.mock.calls[0][0].isExternal).toBe(false);
    // Then switch to external within the same mounted instance
    fireEvent.click(screen.getByRole('button', { name: /Soakaway/i }));
    const lastCall = onChange.mock.calls.at(-1)![0] as QuotePlanCondensateRouteV1;
    expect(lastCall.isExternal).toBe(true);
    expect(lastCall.dischargeKind).toBe('soakaway');
  });
});

// ─── 5. Selected tile aria-pressed ───────────────────────────────────────────

describe('CondensateSpecificationStep — aria-pressed', () => {
  it('selected tile has aria-pressed=true', () => {
    renderStep();
    const btn = screen.getByRole('button', { name: /Internal waste/i });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('unselected tiles have aria-pressed=false', () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    const externalGully = screen.getByRole('button', { name: /External gully/i });
    expect(externalGully.getAttribute('aria-pressed')).toBe('false');
  });
});

// ─── 6. Route details section after selection ─────────────────────────────────

describe('CondensateSpecificationStep — route details section', () => {
  it('route details section hidden before any selection', () => {
    renderStep();
    expect(screen.queryByTestId('condensate-route-details')).toBeNull();
  });

  it('route details section shown after selecting a discharge kind', () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    expect(screen.getByTestId('condensate-route-details')).toBeTruthy();
  });
});

// ─── 7. Freeze-risk notice for external routes ────────────────────────────────

describe('CondensateSpecificationStep — freeze-risk notice', () => {
  it('shows freeze-risk notice for external_gully', () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /External gully/i }));
    expect(screen.getByTestId('condensate-freeze-notice')).toBeTruthy();
    expect(screen.getByText(/freezing/i)).toBeTruthy();
  });

  it('shows freeze-risk notice for soakaway', () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Soakaway/i }));
    expect(screen.getByTestId('condensate-freeze-notice')).toBeTruthy();
  });
});

// ─── 8. No freeze-risk notice for internal routes ────────────────────────────

describe('CondensateSpecificationStep — no freeze-risk for internal', () => {
  it('does NOT show freeze-risk notice for internal_waste', () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    expect(screen.queryByTestId('condensate-freeze-notice')).toBeNull();
  });

  it('does NOT show freeze-risk notice for condensate_pump', () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Condensate pump/i }));
    expect(screen.queryByTestId('condensate-freeze-notice')).toBeNull();
  });
});

// ─── 9. Pipe run length input ─────────────────────────────────────────────────

describe('CondensateSpecificationStep — pipe run length', () => {
  it('entering a length calls onCondensateRouteChange with pipeRunM set', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    fireEvent.change(screen.getByLabelText(/Approximate pipe run in metres/i), {
      target: { value: '2.5' },
    });
    const route: QuotePlanCondensateRouteV1 = onChange.mock.calls.at(-1)![0];
    expect(route.pipeRunM).toBeCloseTo(2.5);
  });

  it('shows route card with length input after discharge selection', () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    expect(screen.getByLabelText(/Approximate pipe run in metres/i)).toBeTruthy();
  });

  it('pipeRunM remains null until entered', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    const route: QuotePlanCondensateRouteV1 = onChange.mock.calls[0][0];
    expect(route.pipeRunM).toBeNull();
  });
});

// ─── 10. Invalid pipe run keeps pipeRunM null ──────────────────────────────────

describe('CondensateSpecificationStep — invalid pipe run', () => {
  it('blank length input keeps pipeRunM as null', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    const input = screen.getByLabelText(/Approximate pipe run in metres/i);
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.change(input, { target: { value: '' } });
    const route: QuotePlanCondensateRouteV1 = onChange.mock.calls.at(-1)![0];
    expect(route.pipeRunM).toBeNull();
  });

  it('negative length input keeps pipeRunM as null', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    fireEvent.change(screen.getByLabelText(/Approximate pipe run in metres/i), {
      target: { value: '-1' },
    });
    const route: QuotePlanCondensateRouteV1 = onChange.mock.calls.at(-1)![0];
    expect(route.pipeRunM).toBeNull();
  });
});

// ─── 11. Needs surveyor decision toggle ──────────────────────────────────────

describe('CondensateSpecificationStep — needs surveyor decision toggle', () => {
  it('checking the checkbox calls onCondensateRouteChange with needsVerification=true', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    fireEvent.click(
      screen.getByLabelText(/Mark condensate route as needing surveyor decision/i),
    );
    const route: QuotePlanCondensateRouteV1 = onChange.mock.calls.at(-1)![0];
    expect(route.needsVerification).toBe(true);
  });

  it('unchecking the toggle sets needsVerification back to false', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    const checkbox = screen.getByLabelText(/Mark condensate route as needing surveyor decision/i);
    // Toggle on
    fireEvent.click(checkbox);
    // Toggle off
    fireEvent.click(checkbox);
    const route: QuotePlanCondensateRouteV1 = onChange.mock.calls.at(-1)![0];
    expect(route.needsVerification).toBe(false);
  });
});

// ─── 12. Surveyor decision warning when flagged ───────────────────────────────

describe('CondensateSpecificationStep — surveyor decision warning', () => {
  it('shows surveyor decision warning when needsVerification is true', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    fireEvent.click(
      screen.getByLabelText(/Mark condensate route as needing surveyor decision/i),
    );
    expect(screen.getByTestId('condensate-verify-warning')).toBeTruthy();
  });

  it('does not show surveyor decision warning initially', () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    expect(screen.queryByTestId('condensate-verify-warning')).toBeNull();
  });

  it('warning uses surveyor-tool language (not "verify on site")', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    fireEvent.click(
      screen.getByLabelText(/Mark condensate route as needing surveyor decision/i),
    );
    const warning = screen.getByTestId('condensate-verify-warning');
    expect(warning.textContent).not.toMatch(/verify on site/i);
    expect(warning.textContent).not.toMatch(/confirm on site/i);
    expect(warning.textContent).toMatch(/surveyor decision/i);
  });
});

// ─── 13. Notes field ─────────────────────────────────────────────────────────

describe('CondensateSpecificationStep — notes field', () => {
  it('entering a note calls onCondensateRouteChange with notes set', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    fireEvent.change(screen.getByLabelText(/Condensate route notes/i), {
      target: { value: 'via kitchen sink' },
    });
    const route: QuotePlanCondensateRouteV1 = onChange.mock.calls.at(-1)![0];
    expect(route.notes).toBe('via kitchen sink');
  });

  it('clearing the notes field sets notes to undefined', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    const textarea = screen.getByLabelText(/Condensate route notes/i);
    fireEvent.change(textarea, { target: { value: 'some note' } });
    fireEvent.change(textarea, { target: { value: '' } });
    const route: QuotePlanCondensateRouteV1 = onChange.mock.calls.at(-1)![0];
    expect(route.notes).toBeUndefined();
  });
});

// ─── 14. Nudge hint when no selection ────────────────────────────────────────

describe('CondensateSpecificationStep — nudge hint', () => {
  it('shows nudge hint when no discharge kind is selected', () => {
    renderStep();
    expect(
      screen.getByText(/Select a discharge method above/i),
    ).toBeTruthy();
  });

  it('hides nudge hint after a discharge kind is selected', () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    expect(screen.queryByText(/Select a discharge method above/i)).toBeNull();
  });
});

// ─── 15. Route type label ─────────────────────────────────────────────────────

describe('CondensateSpecificationStep — route type label', () => {
  it('shows "Internal" route type for internal_waste', () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /Internal waste/i }));
    expect(screen.getByText('Internal')).toBeTruthy();
  });

  it('shows "External" route type for external_gully', () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /External gully/i }));
    expect(screen.getByText('External')).toBeTruthy();
  });
});

// ─── 16. Dedicated condensate route feeds generated scope ─────────────────────

describe('CondensateSpecificationStep — condensate route feeds scope', () => {
  it('selected condensate route has the expected discharge kind', () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: /Soakaway/i }));
    const route: QuotePlanCondensateRouteV1 = onChange.mock.calls[0][0];
    expect(route.dischargeKind).toBe('soakaway');
  });
});

// ─── 17. Legacy condensate warning ───────────────────────────────────────────

describe('CondensateSpecificationStep — legacy warning', () => {
  it('shows legacy warning when plan carries external_trace_heat', () => {
    const legacyRoute = {
      dischargeKind: 'external_trace_heat' as CondensateDischargeKind | LegacyCondensateDischargeKind,
      isExternal: true,
      pipeRunM: null,
      needsVerification: false,
    } as unknown as QuotePlanCondensateRouteV1;
    renderStep(legacyRoute);
    expect(screen.getByTestId('condensate-legacy-warning')).toBeTruthy();
    expect(screen.getByText(/Legacy condensate option/i)).toBeTruthy();
  });

  it('does NOT show legacy warning for normal routes', () => {
    renderStep();
    expect(screen.queryByTestId('condensate-legacy-warning')).toBeNull();
  });
});

// ─── 18. External gully and soakaway show Freeze risk badge ──────────────────

describe('CondensateSpecificationStep — freeze risk badges on tiles', () => {
  it('external gully tile has Freeze risk badge', () => {
    renderStep();
    const gully = screen.getByRole('button', { name: /External gully/i });
    expect(gully.textContent).toMatch(/Freeze risk/i);
  });

  it('soakaway tile has Freeze risk badge', () => {
    renderStep();
    const soakaway = screen.getByRole('button', { name: /Soakaway/i });
    expect(soakaway.textContent).toMatch(/Freeze risk/i);
  });

  it('internal waste tile does NOT have Freeze risk badge', () => {
    renderStep();
    const internal = screen.getByRole('button', { name: /Internal waste/i });
    expect(internal.textContent).not.toMatch(/Freeze risk/i);
  });
});

// ─── 19. Condensate pump note ─────────────────────────────────────────────────

describe('CondensateSpecificationStep — condensate pump note', () => {
  it('condensate pump tile shows power and maintenance note', () => {
    renderStep();
    const pump = screen.getByRole('button', { name: /Condensate pump/i });
    expect(pump.textContent).toMatch(/Power and maintenance consideration/i);
  });
});
