/**
 * Unit tests for DaySchedulePanel temperature-parsing helpers.
 *
 * These tests verify the fix for the "509°" bug where a time string like
 * "05:09" (or "08:30") was accidentally fed into the temperature field and
 * parseInt("0509", 10) = 509 was stored as targetC, producing an invalid
 * "509°" display.
 *
 * The fix: parseTemperatureInput clamps to MIN_HEATING_TEMP_C..MAX_HEATING_TEMP_C
 * so even if a time-derived string leaks in, the value is always safe.
 */
import { describe, it, expect } from 'vitest';
import {
  parseTemperatureInput,
  MIN_HEATING_TEMP_C,
  MAX_HEATING_TEMP_C,
} from '../../components/daypainter/DaySchedulePanel';

describe('parseTemperatureInput — "509°" regression guard', () => {
  // ── Core range tests ──────────────────────────────────────────────────────

  it('valid mid-range value "21" returns 21', () => {
    expect(parseTemperatureInput('21')).toBe(21);
  });

  it('minimum boundary value returns MIN_HEATING_TEMP_C', () => {
    expect(parseTemperatureInput(String(MIN_HEATING_TEMP_C))).toBe(MIN_HEATING_TEMP_C);
  });

  it('maximum boundary value returns MAX_HEATING_TEMP_C', () => {
    expect(parseTemperatureInput(String(MAX_HEATING_TEMP_C))).toBe(MAX_HEATING_TEMP_C);
  });

  // ── Clamp tests (the "509°" bug guard) ────────────────────────────────────

  it('"509" (from time string "05:09" stripped of colon) clamps to MAX_HEATING_TEMP_C', () => {
    // Bug scenario: "05:09" → strip non-digits → "0509" → parseInt = 509
    // Fix: Math.min(MAX_HEATING_TEMP_C, 509) = MAX_HEATING_TEMP_C (30)
    expect(parseTemperatureInput('509')).toBe(MAX_HEATING_TEMP_C);
  });

  it('"0509" (digits of time string "05:09") clamps to MAX_HEATING_TEMP_C', () => {
    expect(parseTemperatureInput('0509')).toBe(MAX_HEATING_TEMP_C);
  });

  it('"0830" (digits of time string "08:30") clamps to MAX_HEATING_TEMP_C', () => {
    // parseInt("0830", 10) = 830 → Math.min(MAX_HEATING_TEMP_C, 830) = MAX_HEATING_TEMP_C (30)
    expect(parseTemperatureInput('0830')).toBe(MAX_HEATING_TEMP_C);
  });

  it('"830" clamps to MAX_HEATING_TEMP_C', () => {
    expect(parseTemperatureInput('830')).toBe(MAX_HEATING_TEMP_C);
  });

  it('value below MIN_HEATING_TEMP_C (e.g. "5") clamps to MIN_HEATING_TEMP_C', () => {
    expect(parseTemperatureInput('5')).toBe(MIN_HEATING_TEMP_C);
  });

  it('value of "2" (intermediate typing of "21") clamps to MIN_HEATING_TEMP_C', () => {
    // When user types "2" as the first digit of "21", it should clamp to MIN not store 2
    expect(parseTemperatureInput('2')).toBe(MIN_HEATING_TEMP_C);
  });

  // ── Time-string scenarios with colons ─────────────────────────────────────

  it('time string "05:09" strips colon, parses 509, clamps to MAX_HEATING_TEMP_C', () => {
    // The exact bug: time input value "05:09" leaked into temperature handler
    expect(parseTemperatureInput('05:09')).toBe(MAX_HEATING_TEMP_C);
  });

  it('time string "08:30" strips colon, parses 830, clamps to MAX_HEATING_TEMP_C', () => {
    expect(parseTemperatureInput('08:30')).toBe(MAX_HEATING_TEMP_C);
  });

  it('time string "22:00" strips colon, parses 2200, clamps to MAX_HEATING_TEMP_C', () => {
    expect(parseTemperatureInput('22:00')).toBe(MAX_HEATING_TEMP_C);
  });

  // ── Null / empty cases — keep previous state ──────────────────────────────

  it('empty string returns null (keeps previous state)', () => {
    expect(parseTemperatureInput('')).toBeNull();
  });

  it('non-numeric string "abc" returns null', () => {
    expect(parseTemperatureInput('abc')).toBeNull();
  });

  it('colon-only string ":" returns null (no digits)', () => {
    expect(parseTemperatureInput(':')).toBeNull();
  });

  // ── Normal domestic range ─────────────────────────────────────────────────

  it.each([10, 14, 16, 18, 19, 20, 21, 22, 25, 30])(
    'domestic setpoint %d°C is returned unchanged',
    (temp) => {
      expect(parseTemperatureInput(String(temp))).toBe(temp);
    },
  );

  // ── Returned values are always within the valid range ─────────────────────

  it('all parsed non-null values are within [MIN_HEATING_TEMP_C, MAX_HEATING_TEMP_C]', () => {
    const inputs = ['0', '5', '9', '10', '21', '30', '31', '100', '509', '0509', '08:30', '22:00'];
    for (const input of inputs) {
      const result = parseTemperatureInput(input);
      if (result !== null) {
        expect(result).toBeGreaterThanOrEqual(MIN_HEATING_TEMP_C);
        expect(result).toBeLessThanOrEqual(MAX_HEATING_TEMP_C);
      }
    }
  });
});
