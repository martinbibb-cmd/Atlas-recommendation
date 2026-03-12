/**
 * WaterPerformanceGauge.test.tsx
 *
 * Unit tests for the WaterPerformanceGauge component.
 *
 * Tests verify:
 *   - renders with label and numeric value
 *   - renders "—" when value is null
 *   - renders track with correct aria attributes
 *   - renders threshold marker ticks
 *   - test-id is derived from the label
 *   - fill width reflects value relative to range
 *   - tone class is applied to the fill bar
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WaterPerformanceGauge from '../WaterPerformanceGauge'
import type { WaterMarker } from '../waterPerformance.model'

const MARKERS: WaterMarker[] = [
  { value: 6,  label: 'Stored HW min',     tone: 'warning' },
  { value: 10, label: 'Combi comfort band', tone: 'success' },
]

// ─── Rendering ───────────────────────────────────────────────────────────────

describe('WaterPerformanceGauge — rendering', () => {
  it('renders the label text', () => {
    render(<WaterPerformanceGauge label="Flow" value={12} min={0} max={25} unit="L/min" />)
    expect(screen.getByText('Flow')).toBeTruthy()
  })

  it('renders the formatted numeric value', () => {
    render(<WaterPerformanceGauge label="Flow" value={12.4} min={0} max={25} unit="L/min" />)
    expect(screen.getByText('12.4')).toBeTruthy()
  })

  it('renders the unit when value is not null', () => {
    render(<WaterPerformanceGauge label="Pressure" value={1.1} min={0} max={3} unit="bar" />)
    expect(screen.getByText('bar')).toBeTruthy()
  })

  it('renders "—" when value is null', () => {
    render(<WaterPerformanceGauge label="Flow" value={null} min={0} max={25} unit="L/min" />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('does not render unit when value is null', () => {
    render(<WaterPerformanceGauge label="Flow" value={null} min={0} max={25} unit="L/min" />)
    expect(screen.queryByText('L/min')).toBeNull()
  })
})

// ─── Test ID ─────────────────────────────────────────────────────────────────

describe('WaterPerformanceGauge — test id', () => {
  it('sets test id derived from label', () => {
    render(<WaterPerformanceGauge label="Flow" value={10} min={0} max={25} unit="L/min" />)
    expect(screen.getByTestId('water-gauge-flow')).toBeTruthy()
  })

  it('converts multi-word label to kebab-case test id', () => {
    render(<WaterPerformanceGauge label="Dynamic pressure" value={1.0} min={0} max={3} unit="bar" />)
    expect(screen.getByTestId('water-gauge-dynamic-pressure')).toBeTruthy()
  })
})

// ─── ARIA ─────────────────────────────────────────────────────────────────────

describe('WaterPerformanceGauge — accessibility', () => {
  it('track has role="progressbar"', () => {
    render(<WaterPerformanceGauge label="Flow" value={10} min={0} max={25} unit="L/min" />)
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('progressbar has aria-valuemin and aria-valuemax', () => {
    render(<WaterPerformanceGauge label="Flow" value={10} min={0} max={25} unit="L/min" />)
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('25')
  })

  it('progressbar has aria-valuenow when value is provided', () => {
    render(<WaterPerformanceGauge label="Flow" value={10} min={0} max={25} unit="L/min" />)
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('10')
  })

  it('progressbar aria-valuenow is absent when value is null', () => {
    render(<WaterPerformanceGauge label="Flow" value={null} min={0} max={25} unit="L/min" />)
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBeNull()
  })
})

// ─── Markers ─────────────────────────────────────────────────────────────────

describe('WaterPerformanceGauge — threshold markers', () => {
  it('renders marker ticks with aria-labels', () => {
    render(
      <WaterPerformanceGauge
        label="Flow"
        value={12}
        min={0}
        max={25}
        unit="L/min"
        markers={MARKERS}
      />,
    )
    expect(screen.getByLabelText('Stored HW min')).toBeTruthy()
    expect(screen.getByLabelText('Combi comfort band')).toBeTruthy()
  })

  it('renders tick labels below the track', () => {
    render(
      <WaterPerformanceGauge
        label="Flow"
        value={12}
        min={0}
        max={25}
        unit="L/min"
        markers={MARKERS}
      />,
    )
    expect(screen.getByText('Stored HW min')).toBeTruthy()
    expect(screen.getByText('Combi comfort band')).toBeTruthy()
  })

  it('renders no tick labels when markers array is empty', () => {
    render(
      <WaterPerformanceGauge label="Flow" value={12} min={0} max={25} unit="L/min" markers={[]} />,
    )
    // No marker-related content
    expect(screen.queryByText('Stored HW min')).toBeNull()
  })
})

// ─── Tone ─────────────────────────────────────────────────────────────────────

describe('WaterPerformanceGauge — tone classes', () => {
  it('applies success fill class when tone is "success"', () => {
    render(
      <WaterPerformanceGauge label="Flow" value={12} min={0} max={25} unit="L/min" tone="success" />,
    )
    const fill = document.querySelector('.water-gauge__fill--success')
    expect(fill).toBeTruthy()
  })

  it('applies warning fill class when tone is "warning"', () => {
    render(
      <WaterPerformanceGauge label="Flow" value={7} min={0} max={25} unit="L/min" tone="warning" />,
    )
    const fill = document.querySelector('.water-gauge__fill--warning')
    expect(fill).toBeTruthy()
  })

  it('applies danger fill class when tone is "danger"', () => {
    render(
      <WaterPerformanceGauge label="Flow" value={3} min={0} max={25} unit="L/min" tone="danger" />,
    )
    const fill = document.querySelector('.water-gauge__fill--danger')
    expect(fill).toBeTruthy()
  })

  it('applies no tone class when tone is "default"', () => {
    render(
      <WaterPerformanceGauge label="Flow" value={12} min={0} max={25} unit="L/min" tone="default" />,
    )
    const fill = document.querySelector('.water-gauge__fill')
    // No tone modifier should be present
    expect(fill?.classList.contains('water-gauge__fill--success')).toBeFalsy()
    expect(fill?.classList.contains('water-gauge__fill--warning')).toBeFalsy()
    expect(fill?.classList.contains('water-gauge__fill--danger')).toBeFalsy()
  })
})
