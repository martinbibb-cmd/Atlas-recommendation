/**
 * trustStrip.test.ts
 *
 * Unit tests for the sortUnlockBy helper exported from RecommendationHub.
 *
 * The helper sorts engine-supplied unlockBy[] strings by practical priority
 * so the action line reads most-actionable first:
 *   static pressure → dynamic/flow → cylinder → age/plate HEX → rest
 */
import { describe, it, expect } from 'vitest';
import { sortUnlockBy } from '../RecommendationHub';

describe('sortUnlockBy', () => {
  it('returns empty array when given empty input', () => {
    expect(sortUnlockBy([])).toEqual([]);
  });

  it('preserves single-item arrays unchanged', () => {
    expect(sortUnlockBy(['cylinder condition'])).toEqual(['cylinder condition']);
  });

  it('places static pressure before cylinder condition', () => {
    const result = sortUnlockBy(['cylinder condition', 'static pressure reading']);
    expect(result[0]).toMatch(/static\s*pressure/i);
    expect(result[1]).toMatch(/cylinder/i);
  });

  it('places dynamic flow before cylinder condition', () => {
    const result = sortUnlockBy(['cylinder sizing', 'dynamic flow measurement']);
    expect(result[0]).toMatch(/dynamic|flow/i);
    expect(result[1]).toMatch(/cylinder/i);
  });

  it('places static pressure before dynamic flow', () => {
    const result = sortUnlockBy(['flow rate under load', 'static pressure check']);
    expect(result[0]).toMatch(/static\s*pressure/i);
    expect(result[1]).toMatch(/flow/i);
  });

  it('places plate HEX items before unmatched items', () => {
    const result = sortUnlockBy(['any other survey item', 'plate hex condition']);
    expect(result[0]).toMatch(/plate\s*hex/i);
    expect(result[1]).toBe('any other survey item');
  });

  it('places appliance age items before unmatched items', () => {
    const result = sortUnlockBy(['unrelated contextual item', 'appliance age assessment']);
    expect(result[0]).toMatch(/age/i);
    expect(result[1]).toBe('unrelated contextual item');
  });

  it('sorts full realistic unlockBy list in correct priority order', () => {
    const input = [
      'Obtain quote for pipe upgrade',
      'cylinder condition assessment',
      'appliance age and plate HEX performance',
      'static pressure measurement',
      'dynamic flow rate test',
    ];
    const result = sortUnlockBy(input);
    const indexOf = (re: RegExp) => result.findIndex(s => re.test(s));

    expect(indexOf(/static\s*pressure/i)).toBeLessThan(indexOf(/dynamic|flow/i));
    expect(indexOf(/dynamic|flow/i)).toBeLessThan(indexOf(/cylinder/i));
    expect(indexOf(/cylinder/i)).toBeLessThan(indexOf(/plate\s*hex|age/i));
    expect(indexOf(/plate\s*hex|age/i)).toBeLessThan(indexOf(/pipe upgrade/i));
  });

  it('preserves relative order of unmatched items (stable sort)', () => {
    const input = ['item alpha', 'item beta', 'item gamma'];
    const result = sortUnlockBy(input);
    expect(result).toEqual(['item alpha', 'item beta', 'item gamma']);
  });

  it('does not mutate the original array', () => {
    const input = ['cylinder condition', 'static pressure'];
    const original = [...input];
    sortUnlockBy(input);
    expect(input).toEqual(original);
  });

  it('matches static pressure case-insensitively', () => {
    const result = sortUnlockBy(['STATIC PRESSURE CHECK', 'Cylinder sizing']);
    expect(result[0]).toMatch(/static/i);
  });

  it('matches heat exchanger keyword as priority-4', () => {
    const result = sortUnlockBy(['unrelated item', 'heat exchanger inspection']);
    expect(result[0]).toMatch(/heat\s*exchanger/i);
    expect(result[1]).toBe('unrelated item');
  });
});
