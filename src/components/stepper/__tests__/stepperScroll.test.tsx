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

describe('FullSurveyStepper — scroll-to-top on navigation', () => {
  it('scrolls to top when the Next button is clicked', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    const nextBtn = screen.getByRole('button', { name: /next/i });
    await user.click(nextBtn);

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('scrolls to top when the Back button is clicked (not at first step)', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    // Advance to step 2 first so the Back button navigates within the stepper
    // rather than calling the onBack prop.
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

    // Clear the initial mount scroll (step = 'location' on mount).
    vi.clearAllMocks();

    // Interact with the postcode input — this should NOT trigger a scroll.
    const postcodeInput = screen.getByPlaceholderText(/e\.g\. SW1A/i);
    await user.type(postcodeInput, 'B');

    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
