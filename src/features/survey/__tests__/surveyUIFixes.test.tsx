/**
 * surveyUIFixes.test.tsx
 *
 * Regression tests for recent survey UI fixes:
 *   1. UsageStep renders "Step 2: Home & Household" (not "Step 6").
 *   2. ServicesStep hides hardness band buttons behind an override toggle
 *      when a lookup result is present.
 *   3. ServicesStep dynamic pressure input is empty when the prop is undefined.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UsageStep } from '../usage/UsageStep';
import { INITIAL_HOME_STATE } from '../usage/usageTypes';

import { ServicesStep } from '../services/ServicesStep';
import {
  INITIAL_WATER_QUALITY_STATE,
  type WaterQualityState,
} from '../services/waterQualityTypes';

// ─── Shared stubs ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

const noop = vi.fn();

/** A state that simulates a successful postcode lookup. */
const LOOKUP_RESULT_STATE: WaterQualityState = {
  source: 'lookup',
  postcode: 'SW1A',
  hardnessBand: 'hard',
  hardnessPpm: 250,
  limescaleRisk: 'medium',
  silicateRisk: 'unknown',
  confidenceNote: 'Based on DWI zone data.',
};

// ─── 1. Step numbering ────────────────────────────────────────────────────────

describe('UsageStep – step numbering', () => {
  it('renders the canonical "Home & Household" heading from the registry', () => {
    render(
      <UsageStep
        state={INITIAL_HOME_STATE}
        onChange={noop}
        onNext={noop}
        onPrev={noop}
      />,
    );

    const heading = screen.getByRole('heading', { level: 2 });
    // Heading is now derived from the canonical registry — no longer includes "Step N:"
    expect(heading.textContent).toContain('Home');
    expect(heading.textContent).not.toContain('Step 6');
  });
});

// ─── 2. Water quality override toggle ─────────────────────────────────────────

describe('ServicesStep – hardness override toggle', () => {
  it('hides band buttons and shows override toggle when a lookup result exists', () => {
    render(
      <ServicesStep
        state={LOOKUP_RESULT_STATE}
        onChange={noop}
        onNext={noop}
        onPrev={noop}
      />,
    );

    // The override toggle link should be visible
    expect(screen.getByTestId('hardness-override-toggle')).toBeTruthy();

    // Band buttons should NOT be in the document
    expect(screen.queryByTestId('hardness-band-soft')).toBeNull();
    expect(screen.queryByTestId('hardness-band-moderate')).toBeNull();
    expect(screen.queryByTestId('hardness-band-hard')).toBeNull();
    expect(screen.queryByTestId('hardness-band-very_hard')).toBeNull();
  });

  it('reveals band buttons after clicking the override toggle', async () => {
    const user = userEvent.setup();

    render(
      <ServicesStep
        state={LOOKUP_RESULT_STATE}
        onChange={noop}
        onNext={noop}
        onPrev={noop}
      />,
    );

    await user.click(screen.getByTestId('hardness-override-toggle'));

    // Now all band buttons should be visible
    expect(screen.getByTestId('hardness-band-soft')).toBeTruthy();
    expect(screen.getByTestId('hardness-band-moderate')).toBeTruthy();
    expect(screen.getByTestId('hardness-band-hard')).toBeTruthy();
    expect(screen.getByTestId('hardness-band-very_hard')).toBeTruthy();
  });

  it('shows band buttons directly when no lookup result exists (source === unknown)', () => {
    render(
      <ServicesStep
        state={INITIAL_WATER_QUALITY_STATE}
        onChange={noop}
        onNext={noop}
        onPrev={noop}
      />,
    );

    // No override toggle when there is no result
    expect(screen.queryByTestId('hardness-override-toggle')).toBeNull();

    // Band buttons visible immediately
    expect(screen.getByTestId('hardness-band-soft')).toBeTruthy();
    expect(screen.getByTestId('hardness-band-moderate')).toBeTruthy();
  });
});

// ─── 3. Dynamic pressure field ────────────────────────────────────────────────

describe('ServicesStep – dynamic pressure input', () => {
  it('renders an empty input when dynamicPressureBar is undefined', () => {
    render(
      <ServicesStep
        state={INITIAL_WATER_QUALITY_STATE}
        onChange={noop}
        onNext={noop}
        onPrev={noop}
        dynamicPressureBar={undefined}
      />,
    );

    const input = screen.getByTestId('dynamic-pressure-input') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('shows the provided value when dynamicPressureBar is set', () => {
    render(
      <ServicesStep
        state={INITIAL_WATER_QUALITY_STATE}
        onChange={noop}
        onNext={noop}
        onPrev={noop}
        dynamicPressureBar={2.5}
      />,
    );

    const input = screen.getByTestId('dynamic-pressure-input') as HTMLInputElement;
    expect(input.value).toBe('2.5');
  });
});
