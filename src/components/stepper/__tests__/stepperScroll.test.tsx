/**
 * Stepper scroll-to-top tests.
 *
 * Verifies that window.scrollTo(0, 0) is called whenever the user navigates
 * between steps (Next / Back) so that each new step starts at the top of the
 * viewport, preventing the "mid-page carryover" issue.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FullSurveyStepper from '../FullSurveyStepper';

// jsdom does not implement window.scrollTo — stub it so we can spy on calls.
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

/** Fill system_builder minimum so the "Next →" button becomes enabled. */
async function fillSystemBuilderMinimum(user: ReturnType<typeof userEvent.setup>) {
  const heatSource = document.querySelector('[data-testid="heat-source-combi"]') as HTMLElement | null;
  if (heatSource) await user.click(heatSource);
  const dhwType = document.querySelector('[data-testid="dhw-type-plate_hex"]') as HTMLElement | null;
  if (dhwType) await user.click(dhwType);
  const emitter = document.querySelector('[data-testid="emitter-radiators_standard"]') as HTMLElement | null;
  if (emitter) await user.click(emitter);
}

describe('FullSurveyStepper — scroll-to-top on navigation', () => {
  it('scrolls to top when the Next button is clicked', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await fillSystemBuilderMinimum(user);
    const nextBtn = screen.getByRole('button', { name: /next/i });
    await user.click(nextBtn);

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('scrolls to top when the Back button is clicked (not at first step)', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    // Advance to step 2 (usage) first so the Back button navigates within the stepper
    // rather than calling the onBack prop.
    await fillSystemBuilderMinimum(user);
    const nextBtn = screen.getByRole('button', { name: /next/i });
    await user.click(nextBtn);

    // Clear any calls from the Next click.
    vi.clearAllMocks();

    // On step 2 there are two "← Back" buttons (header + step-actions).
    // Both call prev(); click the first one found.
    const backBtns = screen.getAllByRole('button', { name: /back/i });
    await user.click(backBtns[0]);

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('does not scroll to top on local state changes within a step', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    // Clear the initial mount scroll.
    vi.clearAllMocks();

    // Interact with a heat-source chip — this changes local state without
    // triggering step navigation and must NOT call scrollTo.
    const combiBtn = document.querySelector('[data-testid="heat-source-combi"]') as HTMLElement | null;
    if (combiBtn) await user.click(combiBtn);

    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
