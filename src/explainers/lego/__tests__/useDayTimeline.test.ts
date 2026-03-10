/**
 * Tests for useDayTimeline — the 24-hour day timeline display adapter.
 *
 * Validates that computeDayTimeline:
 *   - Returns the fixed UK winter astronomy constants
 *   - Derives isDaytime correctly from sunrise/sunset boundaries
 *   - Formats simTimeLabel as zero-padded HH:00
 *   - Clamps out-of-range inputs to 0–23
 */

import { describe, it, expect } from 'vitest'
import {
  computeDayTimeline,
  SUNRISE_HOUR,
  SUNSET_HOUR,
  MOONRISE_HOUR,
  MOONSET_HOUR,
} from '../simulator/useDayTimeline'

// ─── Constants ────────────────────────────────────────────────────────────────

describe('useDayTimeline — fixed astronomy constants', () => {
  it('SUNRISE_HOUR is 8 (UK winter reference)', () => {
    expect(SUNRISE_HOUR).toBe(8)
  })

  it('SUNSET_HOUR is 16 (UK winter reference)', () => {
    expect(SUNSET_HOUR).toBe(16)
  })

  it('MOONRISE_HOUR is 22 (UK winter reference)', () => {
    expect(MOONRISE_HOUR).toBe(22)
  })

  it('MOONSET_HOUR is 10 (UK winter reference)', () => {
    expect(MOONSET_HOUR).toBe(10)
  })
})

// ─── simHour passthrough ──────────────────────────────────────────────────────

describe('computeDayTimeline — simHour', () => {
  it('returns simHour 0 for input 0', () => {
    expect(computeDayTimeline(0).simHour).toBe(0)
  })

  it('returns simHour 12 for input 12', () => {
    expect(computeDayTimeline(12).simHour).toBe(12)
  })

  it('returns simHour 23 for input 23', () => {
    expect(computeDayTimeline(23).simHour).toBe(23)
  })

  it('clamps negative input to 0', () => {
    expect(computeDayTimeline(-1).simHour).toBe(0)
  })

  it('clamps input above 23 to 23', () => {
    expect(computeDayTimeline(25).simHour).toBe(23)
  })
})

// ─── simTimeLabel ─────────────────────────────────────────────────────────────

describe('computeDayTimeline — simTimeLabel', () => {
  it('formats midnight as "00:00"', () => {
    expect(computeDayTimeline(0).simTimeLabel).toBe('00:00')
  })

  it('formats 6 as "06:00"', () => {
    expect(computeDayTimeline(6).simTimeLabel).toBe('06:00')
  })

  it('formats 12 as "12:00"', () => {
    expect(computeDayTimeline(12).simTimeLabel).toBe('12:00')
  })

  it('formats 23 as "23:00"', () => {
    expect(computeDayTimeline(23).simTimeLabel).toBe('23:00')
  })
})

// ─── isDaytime ────────────────────────────────────────────────────────────────

describe('computeDayTimeline — isDaytime', () => {
  it('is false before sunrise (hour 7)', () => {
    expect(computeDayTimeline(7).isDaytime).toBe(false)
  })

  it('is true at sunrise (hour 8)', () => {
    expect(computeDayTimeline(8).isDaytime).toBe(true)
  })

  it('is true at noon (hour 12)', () => {
    expect(computeDayTimeline(12).isDaytime).toBe(true)
  })

  it('is true one hour before sunset (hour 15)', () => {
    expect(computeDayTimeline(15).isDaytime).toBe(true)
  })

  it('is false at sunset (hour 16)', () => {
    expect(computeDayTimeline(16).isDaytime).toBe(false)
  })

  it('is false after sunset (hour 20)', () => {
    expect(computeDayTimeline(20).isDaytime).toBe(false)
  })

  it('is false at midnight (hour 0)', () => {
    expect(computeDayTimeline(0).isDaytime).toBe(false)
  })
})

// ─── Fixed astronomy in output ────────────────────────────────────────────────

describe('computeDayTimeline — astronomy fields', () => {
  it('always returns the fixed sunrise constant', () => {
    expect(computeDayTimeline(10).sunriseHour).toBe(SUNRISE_HOUR)
  })

  it('always returns the fixed sunset constant', () => {
    expect(computeDayTimeline(10).sunsetHour).toBe(SUNSET_HOUR)
  })

  it('always returns the fixed moonrise constant', () => {
    expect(computeDayTimeline(10).moonriseHour).toBe(MOONRISE_HOUR)
  })

  it('always returns the fixed moonset constant', () => {
    expect(computeDayTimeline(10).moonsetHour).toBe(MOONSET_HOUR)
  })
})
