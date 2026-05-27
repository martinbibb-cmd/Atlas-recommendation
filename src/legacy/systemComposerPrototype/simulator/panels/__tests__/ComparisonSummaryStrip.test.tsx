/**
 * ComparisonSummaryStrip.test.tsx
 *
 * Rendering tests for the ComparisonSummaryStrip — the before/after physics
 * delta summary shown in compare mode.
 *
 * Coverage:
 *   structure
 *     - renders the "Current vs Improved" heading
 *     - renders all four metric labels
 *     - renders current and improved values for flow temperature
 *
 *   direction arrows
 *     - lower flow temp shows a "better" down-arrow delta
 *     - higher flow temp shows a "worse" up-arrow delta
 *     - equal flow temp shows a "same" right-arrow delta
 *     - fewer limiters shows a "better" delta
 *
 *   accessibility
 *     - has aria role="region" with accessible label
 *     - change direction is carried in aria-label on delta spans
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import ComparisonSummaryStrip from '../ComparisonSummaryStrip'
import type { EfficiencyDisplayState } from '../../useEfficiencyPlayback'
import type { EmitterPrimaryDisplayState } from '../../useEmitterPrimaryModel'
import type { LimiterDisplayState } from '../../useLimiterPlayback'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEmitter(overrides: Partial<EmitterPrimaryDisplayState> = {}): EmitterPrimaryDisplayState {
  return {
    requiredFlowTempC: 70,
    estimatedReturnTempC: 58,
    currentLoadFlowTempC: 62,
    currentLoadReturnTempC: 50,
    emitterAdequate: true,
    primaryAdequate: true,
    heatDemandKw: 14,
    primaryCapacityKw: 25,
    estimatedCop: 2.8,
    ...overrides,
  }
}

function makeEfficiency(overrides: Partial<EfficiencyDisplayState> = {}): EfficiencyDisplayState {
  return {
    systemKind: 'boiler',
    condensingState: 'not_condensing',
    returnTempC: 58,
    headlineEfficiencyText: 'Not condensing',
    statusDescription: '',
    penalties: [],
    statusTone: 'poor',
    ...overrides,
  }
}

function makeLimiters(count: number): LimiterDisplayState {
  const limiters = Array.from({ length: count }, (_, i) => ({
    id: `limiter-${i}`,
    severity: 'warning' as const,
    title: `Limiter ${i + 1}`,
    explanation: 'Some explanation',
  }))
  return {
    activeLimiters: limiters,
    hasCritical: false,
  }
}

function makeSide(
  emitterOverrides: Partial<EmitterPrimaryDisplayState> = {},
  efficiencyOverrides: Partial<EfficiencyDisplayState> = {},
  limiterCount = 2,
) {
  return {
    emitter: makeEmitter(emitterOverrides),
    efficiency: makeEfficiency(efficiencyOverrides),
    limiters: makeLimiters(limiterCount),
  }
}

// ─── Structure ─────────────────────────────────────────────────────────────────

describe('ComparisonSummaryStrip — structure', () => {
  it('renders the "Current vs Improved" heading', () => {
    const current = makeSide()
    const improved = makeSide({ requiredFlowTempC: 55, estimatedReturnTempC: 45 })
    render(<ComparisonSummaryStrip current={current} improved={improved} />)
    expect(screen.getByText('Current vs Improved')).toBeTruthy()
  })

  it('renders the "Flow temp required" metric label', () => {
    const current = makeSide()
    const improved = makeSide({ requiredFlowTempC: 55 })
    render(<ComparisonSummaryStrip current={current} improved={improved} />)
    expect(screen.getByText('Flow temp required')).toBeTruthy()
  })

  it('renders the "Estimated return temp" metric label', () => {
    const current = makeSide()
    const improved = makeSide()
    render(<ComparisonSummaryStrip current={current} improved={improved} />)
    expect(screen.getByText('Estimated return temp')).toBeTruthy()
  })

  it('renders the "Condensing / COP" metric label', () => {
    const current = makeSide()
    const improved = makeSide()
    render(<ComparisonSummaryStrip current={current} improved={improved} />)
    expect(screen.getByText('Condensing / COP')).toBeTruthy()
  })

  it('renders the "Active limiters" metric label', () => {
    const current = makeSide()
    const improved = makeSide()
    render(<ComparisonSummaryStrip current={current} improved={improved} />)
    expect(screen.getByText('Active limiters')).toBeTruthy()
  })

  it('renders current and improved flow temp values', () => {
    const current = makeSide({ requiredFlowTempC: 70 })
    const improved = makeSide({ requiredFlowTempC: 55 })
    render(<ComparisonSummaryStrip current={current} improved={improved} />)
    expect(screen.getByText('70°C')).toBeTruthy()
    expect(screen.getByText('55°C')).toBeTruthy()
  })
})

// ─── Direction arrows ──────────────────────────────────────────────────────────

describe('ComparisonSummaryStrip — direction deltas', () => {
  it('lower improved flow temp renders "better" delta (↓)', () => {
    const current = makeSide({ requiredFlowTempC: 70 })
    const improved = makeSide({ requiredFlowTempC: 55 })
    const { container } = render(<ComparisonSummaryStrip current={current} improved={improved} />)
    const betterDeltas = container.querySelectorAll('.cmp-delta--better')
    expect(betterDeltas.length).toBeGreaterThan(0)
    expect(betterDeltas[0].textContent).toBe('↓')
  })

  it('higher improved flow temp renders "worse" delta (↑)', () => {
    const current = makeSide({ requiredFlowTempC: 55 })
    const improved = makeSide({ requiredFlowTempC: 70 })
    const { container } = render(<ComparisonSummaryStrip current={current} improved={improved} />)
    const worseDeltas = container.querySelectorAll('.cmp-delta--worse')
    expect(worseDeltas.length).toBeGreaterThan(0)
    expect(worseDeltas[0].textContent).toBe('↑')
  })

  it('equal flow temps (within 0.5°C) renders "same" delta (→)', () => {
    const current = makeSide({ requiredFlowTempC: 70 })
    const improved = makeSide({ requiredFlowTempC: 70 })
    const { container } = render(<ComparisonSummaryStrip current={current} improved={improved} />)
    // At least the flow-temp metric should be "same"
    const sameDeltas = container.querySelectorAll('.cmp-delta--same')
    expect(sameDeltas.length).toBeGreaterThan(0)
    expect(sameDeltas[0].textContent).toBe('→')
  })

  it('fewer improved limiters renders "better" aria-label on limiter delta', () => {
    const current = makeSide({}, {}, 3)
    const improved = makeSide({}, {}, 1)
    render(<ComparisonSummaryStrip current={current} improved={improved} />)
    const betterDeltas = screen.getAllByLabelText('change: better')
    expect(betterDeltas.length).toBeGreaterThan(0)
  })
})

// ─── Accessibility ─────────────────────────────────────────────────────────────

describe('ComparisonSummaryStrip — accessibility', () => {
  it('has role="region" with aria-label="Comparison summary"', () => {
    const current = makeSide()
    const improved = makeSide()
    render(<ComparisonSummaryStrip current={current} improved={improved} />)
    expect(screen.getByRole('region', { name: 'Comparison summary' })).toBeTruthy()
  })

  it('carries data-testid="comparison-summary-strip"', () => {
    const current = makeSide()
    const improved = makeSide()
    const { container } = render(<ComparisonSummaryStrip current={current} improved={improved} />)
    expect(container.querySelector('[data-testid="comparison-summary-strip"]')).not.toBeNull()
  })

  it('delta spans carry aria-label describing the change direction', () => {
    const current = makeSide({ requiredFlowTempC: 70 })
    const improved = makeSide({ requiredFlowTempC: 55 })
    render(<ComparisonSummaryStrip current={current} improved={improved} />)
    // "better" direction carries aria-label "change: better"
    const betterDeltas = screen.getAllByLabelText('change: better')
    expect(betterDeltas.length).toBeGreaterThan(0)
  })
})

// ─── Heat pump COP display ──────────────────────────────────────────────────────

describe('ComparisonSummaryStrip — heat pump COP display', () => {
  it('shows COP value for heat pump systems in Condensing / COP column', () => {
    const hpEfficiency: Partial<EfficiencyDisplayState> = {
      systemKind: 'heat_pump',
      cop: 3.2,
    }
    const current = makeSide({}, hpEfficiency)
    const improved = makeSide({}, { ...hpEfficiency, cop: 3.8 })
    render(<ComparisonSummaryStrip current={current} improved={improved} />)
    expect(screen.getByText('COP 3.2')).toBeTruthy()
    expect(screen.getByText('COP 3.8')).toBeTruthy()
  })
})
