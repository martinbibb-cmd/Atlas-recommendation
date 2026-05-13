/**
 * QuoteCollectionStep.test.tsx
 *
 * Regression tests for the Installation Specification entry card (Step 9).
 *
 * Asserts:
 *   - Renders the correct heading and body copy
 *   - Renders "Open specification" button
 *   - Renders "Continue without specification" button
 *   - Does NOT render any contractor-quote UI
 *   - Does NOT block progress when no specification exists (Continue without spec calls onNext)
 *   - Clicking "Open specification" calls onOpenSpecification
 *   - Shows status when specificationStatus is provided
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuoteCollectionStep } from '../QuoteCollectionStep';

const BASE_PROPS = {
  onNext: vi.fn(),
  onPrev: vi.fn(),
  onOpenSpecification: vi.fn(),
};

describe('QuoteCollectionStep — Installation Specification entry card', () => {
  it('renders "Installation Specification" as the step heading', () => {
    render(<QuoteCollectionStep {...BASE_PROPS} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain(
      'Installation Specification',
    );
  });

  it('renders the correct body copy', () => {
    render(<QuoteCollectionStep {...BASE_PROPS} />);
    expect(
      screen.getByText(/Build the technical install specification/i),
    ).toBeTruthy();
  });

  it('renders "Open specification" button', () => {
    render(<QuoteCollectionStep {...BASE_PROPS} />);
    expect(screen.getByTestId('open-specification-btn')).toBeTruthy();
  });

  it('renders "Continue without specification" button', () => {
    render(<QuoteCollectionStep {...BASE_PROPS} />);
    expect(screen.getByTestId('continue-without-specification-btn')).toBeTruthy();
  });

  it('does NOT render "Contractor Quotes" as a section heading', () => {
    render(<QuoteCollectionStep {...BASE_PROPS} />);
    // The old UI had a "Contractor Quotes" section heading; it is now gone.
    // Body copy that mentions "contractor quotes" in a descriptive sentence is fine.
    expect(screen.queryByRole('heading', { name: /Contractor Quotes/i })).toBeNull();
  });

  it('does NOT render "+ Add quote"', () => {
    render(<QuoteCollectionStep {...BASE_PROPS} />);
    expect(screen.queryByText(/\+ Add quote/i)).toBeNull();
  });

  it('does NOT render "Quote A"', () => {
    render(<QuoteCollectionStep {...BASE_PROPS} />);
    expect(screen.queryByText(/^Quote A$/i)).toBeNull();
  });

  it('does NOT render "Enter the contractor quotes you have received"', () => {
    render(<QuoteCollectionStep {...BASE_PROPS} />);
    expect(
      screen.queryByText(/Enter the contractor quotes you have received/i),
    ).toBeNull();
  });

  it('does NOT render "View Insight Pack" as primary action', () => {
    render(<QuoteCollectionStep {...BASE_PROPS} />);
    expect(screen.queryByText(/View Insight Pack/i)).toBeNull();
  });

  it('does not block progress — "Continue without specification" calls onNext immediately', async () => {
    const onNext = vi.fn();
    render(<QuoteCollectionStep {...BASE_PROPS} onNext={onNext} />);
    await userEvent.click(screen.getByTestId('continue-without-specification-btn'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('clicking "Open specification" calls onOpenSpecification', async () => {
    const onOpenSpecification = vi.fn();
    render(<QuoteCollectionStep {...BASE_PROPS} onOpenSpecification={onOpenSpecification} />);
    await userEvent.click(screen.getByTestId('open-specification-btn'));
    expect(onOpenSpecification).toHaveBeenCalledTimes(1);
  });

  it('shows "Not started" status when no specificationStatus is provided', () => {
    render(<QuoteCollectionStep {...BASE_PROPS} />);
    expect(screen.getByText(/Not started/i)).toBeTruthy();
  });

  it('shows "Specification complete" badge when spec is complete', () => {
    render(
      <QuoteCollectionStep
        {...BASE_PROPS}
        specificationStatus={{ started: true, complete: true, scopeItemCount: 6 }}
      />,
    );
    expect(screen.getByText(/Specification complete/i)).toBeTruthy();
  });

  it('shows "Specification started" badge when spec is started but not complete', () => {
    render(
      <QuoteCollectionStep
        {...BASE_PROPS}
        specificationStatus={{ started: true, complete: false, scopeItemCount: 2 }}
      />,
    );
    expect(screen.getByText(/Specification started/i)).toBeTruthy();
  });

  it('shows scope item count when specificationStatus provides it', () => {
    render(
      <QuoteCollectionStep
        {...BASE_PROPS}
        specificationStatus={{ started: true, complete: true, scopeItemCount: 6 }}
      />,
    );
    expect(screen.getByText(/6 items/i)).toBeTruthy();
  });
});
