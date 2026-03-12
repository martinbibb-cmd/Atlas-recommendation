/**
 * waterPerformance.model.test.ts
 *
 * Unit tests for waterPerformance.model.ts.
 *
 * Tests verify:
 *   - clampValue handles in-range, below-min, above-max, and null inputs
 *   - flowTone returns correct tone bands
 *   - pressureTone returns correct tone bands
 *   - flowNote returns correct one-line notes
 *   - pressureNote returns correct one-line notes
 *   - FLOW_MARKERS and PRESSURE_MARKERS have the expected structure
 */

import { describe, it, expect } from 'vitest'
import {
  clampValue,
  flowTone,
  pressureTone,
  flowNote,
  pressureNote,
  FLOW_MARKERS,
  PRESSURE_MARKERS,
} from '../waterPerformance.model'

// ─── clampValue ──────────────────────────────────────────────────────────────

describe('clampValue', () => {
  it('returns null when value is null', () => {
    expect(clampValue(null, 0, 10)).toBeNull()
  })

  it('returns value when within range', () => {
    expect(clampValue(5, 0, 10)).toBe(5)
  })

  it('clamps to min when below range', () => {
    expect(clampValue(-1, 0, 10)).toBe(0)
  })

  it('clamps to max when above range', () => {
    expect(clampValue(15, 0, 10)).toBe(10)
  })

  it('returns min when value equals min', () => {
    expect(clampValue(0, 0, 10)).toBe(0)
  })

  it('returns max when value equals max', () => {
    expect(clampValue(10, 0, 10)).toBe(10)
  })
})

// ─── flowTone ────────────────────────────────────────────────────────────────

describe('flowTone', () => {
  it('returns "default" for null', () => {
    expect(flowTone(null)).toBe('default')
  })

  it('returns "danger" below 6 L/min', () => {
    expect(flowTone(0)).toBe('danger')
    expect(flowTone(5.9)).toBe('danger')
  })

  it('returns "warning" from 6 to below 10 L/min', () => {
    expect(flowTone(6)).toBe('warning')
    expect(flowTone(9.9)).toBe('warning')
  })

  it('returns "success" at 10 L/min and above', () => {
    expect(flowTone(10)).toBe('success')
    expect(flowTone(20)).toBe('success')
  })
})

// ─── pressureTone ────────────────────────────────────────────────────────────

describe('pressureTone', () => {
  it('returns "default" for null', () => {
    expect(pressureTone(null)).toBe('default')
  })

  it('returns "danger" below 0.7 bar', () => {
    expect(pressureTone(0)).toBe('danger')
    expect(pressureTone(0.69)).toBe('danger')
  })

  it('returns "warning" from 0.7 to below 1.0 bar', () => {
    expect(pressureTone(0.7)).toBe('warning')
    expect(pressureTone(0.99)).toBe('warning')
  })

  it('returns "success" at 1.0 bar and above', () => {
    expect(pressureTone(1.0)).toBe('success')
    expect(pressureTone(3.0)).toBe('success')
  })
})

// ─── flowNote ────────────────────────────────────────────────────────────────

describe('flowNote', () => {
  it('returns "—" for null', () => {
    expect(flowNote(null)).toBe('—')
  })

  it('returns threshold-specific note for very low flow', () => {
    expect(flowNote(3)).toContain('minimum threshold')
  })

  it('returns marginal note for moderate flow', () => {
    expect(flowNote(8)).toContain('Marginal')
  })

  it('returns comfortable note for good flow', () => {
    expect(flowNote(12)).toContain('Comfortable')
  })

  it('returns high-flow note for very high flow', () => {
    expect(flowNote(20)).toContain('High flow')
  })
})

// ─── pressureNote ────────────────────────────────────────────────────────────

describe('pressureNote', () => {
  it('returns "—" for null', () => {
    expect(pressureNote(null)).toBe('—')
  })

  it('returns below-minimum note for very low pressure', () => {
    expect(pressureNote(0.5)).toContain('minimum')
  })

  it('returns threshold note for marginal pressure', () => {
    expect(pressureNote(0.8)).toContain('threshold')
  })

  it('returns adequate note for good pressure', () => {
    expect(pressureNote(1.5)).toContain('Adequate')
  })
})

// ─── Marker sets ─────────────────────────────────────────────────────────────

describe('FLOW_MARKERS', () => {
  it('has at least two markers', () => {
    expect(FLOW_MARKERS.length).toBeGreaterThanOrEqual(2)
  })

  it('each marker has a value and label', () => {
    FLOW_MARKERS.forEach(m => {
      expect(typeof m.value).toBe('number')
      expect(typeof m.label).toBe('string')
      expect(m.label.length).toBeGreaterThan(0)
    })
  })

  it('markers are ordered by ascending value', () => {
    for (let i = 1; i < FLOW_MARKERS.length; i++) {
      expect(FLOW_MARKERS[i].value).toBeGreaterThan(FLOW_MARKERS[i - 1].value)
    }
  })
})

describe('PRESSURE_MARKERS', () => {
  it('has at least two markers', () => {
    expect(PRESSURE_MARKERS.length).toBeGreaterThanOrEqual(2)
  })

  it('each marker has a value and label', () => {
    PRESSURE_MARKERS.forEach(m => {
      expect(typeof m.value).toBe('number')
      expect(typeof m.label).toBe('string')
      expect(m.label.length).toBeGreaterThan(0)
    })
  })
})
