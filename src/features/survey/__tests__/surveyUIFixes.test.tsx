/**
 * surveyUIFixes.test.tsx
 *
 * Regression tests for recent survey UI fixes:
 *   1. UsageStep renders "Step 2: Home & Household" (not "Step 6").
 *   2. ServicesStep hides hardness band buttons behind an override toggle
 *      when a lookup result is present.
 *   3. ServicesStep mains supply block renders standing pressure input and
 *      four flow-test inputs (one per standard test pressure).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

// ─── 3. Mains supply — standing pressure + flow-test inputs ──────────────────

describe('ServicesStep – mains supply inputs', () => {
  it('renders the standing pressure input with no pre-filled value', () => {
    render(
      <ServicesStep
        state={INITIAL_WATER_QUALITY_STATE}
        onChange={noop}
        onNext={noop}
        onPrev={noop}
      />,
    );

    const input = screen.getByTestId('static-pressure-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('');
  });

  it('pre-fills the standing pressure input when staticPressureBar is provided', () => {
    render(
      <ServicesStep
        state={INITIAL_WATER_QUALITY_STATE}
        onChange={noop}
        onNext={noop}
        onPrev={noop}
        staticPressureBar={3.5}
      />,
    );

    const input = screen.getByTestId('static-pressure-input') as HTMLInputElement;
    expect(input.value).toBe('3.5');
  });

  it('renders all four flow-test inputs in the flow readings block', () => {
    render(
      <ServicesStep
        state={INITIAL_WATER_QUALITY_STATE}
        onChange={noop}
        onNext={noop}
        onPrev={noop}
      />,
    );

    // Flow readings container
    expect(screen.getByTestId('flow-readings-block')).toBeTruthy();

    // One input per standard test pressure
    expect(screen.getByTestId('flow-at-2-bar')).toBeTruthy();
    expect(screen.getByTestId('flow-at-1-bar')).toBeTruthy();
    expect(screen.getByTestId('flow-at-0.5-bar')).toBeTruthy();
    expect(screen.getByTestId('flow-at-0-bar')).toBeTruthy();
  });

  it('pre-fills flow inputs when flowReadings are provided', () => {
    render(
      <ServicesStep
        state={INITIAL_WATER_QUALITY_STATE}
        onChange={noop}
        onNext={noop}
        onPrev={noop}
        flowReadings={{ at2BarLpm: 14, at1BarLpm: 10 }}
      />,
    );

    const at2Bar = screen.getByTestId('flow-at-2-bar') as HTMLInputElement;
    const at1Bar = screen.getByTestId('flow-at-1-bar') as HTMLInputElement;
    const at0p5Bar = screen.getByTestId('flow-at-0.5-bar') as HTMLInputElement;

    expect(at2Bar.value).toBe('14');
    expect(at1Bar.value).toBe('10');
    expect(at0p5Bar.value).toBe('');
  });

  it('calls onMeasurementsChange with updated flow readings when a flow input changes', () => {
    const onChange = vi.fn();

    render(
      <ServicesStep
        state={INITIAL_WATER_QUALITY_STATE}
        onChange={noop}
        onNext={noop}
        onPrev={noop}
        onMeasurementsChange={onChange}
      />,
    );

    const at2Bar = screen.getByTestId('flow-at-2-bar') as HTMLInputElement;
    fireEvent.change(at2Bar, { target: { value: '12' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [staticBar, readings] = onChange.mock.calls[0];
    expect(staticBar).toBeUndefined();
    expect(readings).toMatchObject({ at2BarLpm: 12 });
  });
});
