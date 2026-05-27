/**
 * DailyEfficiencySummaryPanel.test.tsx
 *
 * Rendering tests for the DailyEfficiencySummaryPanel — the daily operating
 * efficiency / COP summary displayed below the simulator dashboard.
 *
 * Coverage:
 *   boiler systems
 *     - renders the summary label
 *     - renders the formatted efficiency value
 *     - renders the explanation line
 *     - applies "good" tone class when efficiency >= 88
 *     - applies "warning" tone class when efficiency in [80, 88)
 *     - applies "poor" tone class when efficiency < 80
 *
 *   heat pump systems
 *     - renders daily COP value
 *     - applies "good" tone class when COP >= 3.5
 *     - applies "warning" tone class when COP in [2.8, 3.5)
 *     - applies "poor" tone class when COP < 2.8
 *
 *   season context badge
 *     - renders season context badge when seasonContext is provided
 *     - does not render badge when seasonContext is absent
 *
 *   accessibility
 *     - has role="region" with aria-label "Daily efficiency summary"
 *     - carries data-testid="daily-efficiency-summary"
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DailyEfficiencySummaryPanel from '../DailyEfficiencySummaryPanel'
import type { DailyEfficiencySummaryState } from '../../useDailyEfficiencySummary'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBoilerState(
  dailyEfficiencyPct: number,
  overrides: Partial<DailyEfficiencySummaryState> = {},
): DailyEfficiencySummaryState {
  return {
    systemKind: 'boiler',
    dailyEfficiencyPct,
    summaryLabel: 'Estimated daily operating efficiency',
    summaryValue: `${Math.round(dailyEfficiencyPct)}%`,
    explanationLine: 'Operating within expected parameters.',
    ...overrides,
  }
}

function makeHeatPumpState(
  dailyCop: number,
  overrides: Partial<DailyEfficiencySummaryState> = {},
): DailyEfficiencySummaryState {
  return {
    systemKind: 'heat_pump',
    dailyCop,
    summaryLabel: 'Estimated daily COP',
    summaryValue: dailyCop.toFixed(1),
    explanationLine: 'Operating within expected parameters.',
    ...overrides,
  }
}

// ─── Boiler rendering ──────────────────────────────────────────────────────────

describe('DailyEfficiencySummaryPanel — boiler system', () => {
  it('renders the summary label', () => {
    render(<DailyEfficiencySummaryPanel state={makeBoilerState(88)} />)
    expect(screen.getByText('Estimated daily operating efficiency')).toBeTruthy()
  })

  it('renders the formatted efficiency value', () => {
    render(<DailyEfficiencySummaryPanel state={makeBoilerState(88)} />)
    expect(screen.getByText('88%')).toBeTruthy()
  })

  it('renders the explanation line', () => {
    render(<DailyEfficiencySummaryPanel state={makeBoilerState(88)} />)
    expect(screen.getByText('Operating within expected parameters.')).toBeTruthy()
  })

  it('applies "good" tone class when efficiency >= 88', () => {
    const { container } = render(<DailyEfficiencySummaryPanel state={makeBoilerState(91)} />)
    expect(container.querySelector('.daily-summary--good')).not.toBeNull()
  })

  it('applies "warning" tone class when efficiency is in [80, 88)', () => {
    const { container } = render(<DailyEfficiencySummaryPanel state={makeBoilerState(83)} />)
    expect(container.querySelector('.daily-summary--warning')).not.toBeNull()
  })

  it('applies "poor" tone class when efficiency < 80', () => {
    const { container } = render(<DailyEfficiencySummaryPanel state={makeBoilerState(72)} />)
    expect(container.querySelector('.daily-summary--poor')).not.toBeNull()
  })
})

// ─── Heat pump rendering ───────────────────────────────────────────────────────

describe('DailyEfficiencySummaryPanel — heat pump system', () => {
  it('renders daily COP label', () => {
    render(<DailyEfficiencySummaryPanel state={makeHeatPumpState(3.6)} />)
    expect(screen.getByText('Estimated daily COP')).toBeTruthy()
  })

  it('renders the COP value', () => {
    render(<DailyEfficiencySummaryPanel state={makeHeatPumpState(3.6)} />)
    expect(screen.getByText('3.6')).toBeTruthy()
  })

  it('applies "good" tone class when COP >= 3.5', () => {
    const { container } = render(<DailyEfficiencySummaryPanel state={makeHeatPumpState(3.8)} />)
    expect(container.querySelector('.daily-summary--good')).not.toBeNull()
  })

  it('applies "warning" tone class when COP in [2.8, 3.5)', () => {
    const { container } = render(<DailyEfficiencySummaryPanel state={makeHeatPumpState(3.0)} />)
    expect(container.querySelector('.daily-summary--warning')).not.toBeNull()
  })

  it('applies "poor" tone class when COP < 2.8', () => {
    const { container } = render(<DailyEfficiencySummaryPanel state={makeHeatPumpState(2.5)} />)
    expect(container.querySelector('.daily-summary--poor')).not.toBeNull()
  })
})

// ─── Season context badge ──────────────────────────────────────────────────────

describe('DailyEfficiencySummaryPanel — season context badge', () => {
  it('renders the season context badge when seasonContext is provided', () => {
    render(<DailyEfficiencySummaryPanel state={makeBoilerState(88, { seasonContext: 'Winter day' })} />)
    expect(screen.getByText('Winter day')).toBeTruthy()
  })

  it('renders "Summer day" badge when provided', () => {
    render(<DailyEfficiencySummaryPanel state={makeBoilerState(91, { seasonContext: 'Summer day' })} />)
    expect(screen.getByText('Summer day')).toBeTruthy()
  })

  it('does not render season badge when seasonContext is absent', () => {
    render(<DailyEfficiencySummaryPanel state={makeBoilerState(88)} />)
    // No badge text like "Winter day" should appear
    expect(screen.queryByLabelText(/Scenario:/)).toBeNull()
  })
})

// ─── Accessibility ─────────────────────────────────────────────────────────────

describe('DailyEfficiencySummaryPanel — accessibility', () => {
  it('has role="region" with aria-label "Daily efficiency summary"', () => {
    render(<DailyEfficiencySummaryPanel state={makeBoilerState(88)} />)
    expect(screen.getByRole('region', { name: 'Daily efficiency summary' })).toBeTruthy()
  })

  it('carries data-testid="daily-efficiency-summary"', () => {
    const { container } = render(<DailyEfficiencySummaryPanel state={makeBoilerState(88)} />)
    expect(container.querySelector('[data-testid="daily-efficiency-summary"]')).not.toBeNull()
  })
})
