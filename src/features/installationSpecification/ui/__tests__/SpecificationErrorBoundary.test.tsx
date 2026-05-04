/**
 * SpecificationErrorBoundary.test.tsx
 *
 * Tests for the Installation Specification error boundary.
 *
 * Covers:
 *   1. Renders children when no error is thrown.
 *   2. Renders recovery card when a child throws.
 *   3. "Back to survey" button calls onBack.
 *   4. "Try again" button resets the error state and re-mounts children.
 *   5. Recovery card does NOT show a blank screen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpecificationErrorBoundary } from '../SpecificationErrorBoundary';

// ─── Helper: a component that throws unconditionally ─────────────────────────

function Bomb(): never {
  throw new Error('Specification component exploded');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SpecificationErrorBoundary', () => {
  // Suppress console.error noise from intentional throws in tests.
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = () => {};
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });
  it('renders children when no error is thrown', () => {
    render(
      <SpecificationErrorBoundary onBack={vi.fn()}>
        <p data-testid="child">All good</p>
      </SpecificationErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('renders recovery card when a child throws', () => {
    render(
      <SpecificationErrorBoundary onBack={vi.fn()}>
        <Bomb />
      </SpecificationErrorBoundary>,
    );
    expect(screen.getByTestId('specification-error-boundary')).toBeTruthy();
  });

  it('shows the "Installation Specification could not open" message', () => {
    render(
      <SpecificationErrorBoundary onBack={vi.fn()}>
        <Bomb />
      </SpecificationErrorBoundary>,
    );
    expect(
      screen.getByText(/Installation Specification could not open/i),
    ).toBeTruthy();
  });

  it('shows the survey-not-lost message', () => {
    render(
      <SpecificationErrorBoundary onBack={vi.fn()}>
        <Bomb />
      </SpecificationErrorBoundary>,
    );
    expect(screen.getByText(/survey has not been lost/i)).toBeTruthy();
  });

  it('"Back to survey" button calls onBack', async () => {
    const onBack = vi.fn();
    render(
      <SpecificationErrorBoundary onBack={onBack}>
        <Bomb />
      </SpecificationErrorBoundary>,
    );
    await userEvent.click(screen.getByTestId('specification-error-back-btn'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('"Try again" button resets error state and re-mounts children', async () => {
    let shouldThrow = true;

    function Conditional() {
      if (shouldThrow) throw new Error('conditional boom');
      return <p data-testid="recovered">Recovered</p>;
    }

    const { rerender } = render(
      <SpecificationErrorBoundary onBack={vi.fn()}>
        <Conditional />
      </SpecificationErrorBoundary>,
    );

    // Boundary should be visible.
    expect(screen.getByTestId('specification-error-boundary')).toBeTruthy();

    // Stop throwing before the retry renders.
    shouldThrow = false;

    await userEvent.click(screen.getByTestId('specification-error-retry-btn'));

    // Children should now render without error.
    rerender(
      <SpecificationErrorBoundary onBack={vi.fn()}>
        <Conditional />
      </SpecificationErrorBoundary>,
    );
    expect(screen.getByTestId('recovered')).toBeTruthy();
  });

  it('does NOT render a blank page on error', () => {
    const { container } = render(
      <SpecificationErrorBoundary onBack={vi.fn()}>
        <Bomb />
      </SpecificationErrorBoundary>,
    );
    // Container should have content — not an empty element.
    expect(container.textContent).not.toBe('');
  });
});
