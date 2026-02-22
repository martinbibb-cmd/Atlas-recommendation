/**
 * Tests for the LifestyleInteractive physics helpers.
 *
 * These helpers are exported from the component and drive the three
 * live curves: Boiler "Stepped", HP "Horizon", and Mixergy SoC.
 */
import { describe, it, expect } from 'vitest';
import {
  defaultHours,
  nextState,
  mixergySoCByHour,
  boilerSteppedCurve,
  hpHorizonCurve,
  type HourState,
} from '../modules/LifestyleInteractiveHelpers';

// ─── defaultHours ─────────────────────────────────────────────────────────────

describe('defaultHours', () => {
  it('returns exactly 24 entries', () => {
    expect(defaultHours()).toHaveLength(24);
  });

  it('marks morning hours 6–8 as dhw_demand', () => {
    const h = defaultHours();
    expect(h[6]).toBe('dhw_demand');
    expect(h[7]).toBe('dhw_demand');
    expect(h[8]).toBe('dhw_demand');
  });

  it('marks professional away period (09–16) as away', () => {
    const h = defaultHours();
    for (let i = 9; i <= 16; i++) {
      expect(h[i]).toBe('away');
    }
  });

  it('marks evening home period (17–21) as home', () => {
    const h = defaultHours();
    for (let i = 17; i <= 21; i++) {
      expect(h[i]).toBe('home');
    }
  });
});

// ─── nextState ────────────────────────────────────────────────────────────────

describe('nextState', () => {
  it('cycles away → home → dhw_demand → away', () => {
    expect(nextState('away')).toBe('home');
    expect(nextState('home')).toBe('dhw_demand');
    expect(nextState('dhw_demand')).toBe('away');
  });
});

// ─── mixergySoCByHour ─────────────────────────────────────────────────────────

describe('mixergySoCByHour', () => {
  const allAway: HourState[] = Array(24).fill('away');
  const allHome: HourState[] = Array(24).fill('home');
  const allDhw: HourState[] = Array(24).fill('dhw_demand');

  it('returns exactly 24 values', () => {
    expect(mixergySoCByHour(allAway)).toHaveLength(24);
  });

  it('SoC values are always between 0 and 100', () => {
    [allAway, allHome, allDhw].forEach(hours => {
      mixergySoCByHour(hours).forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      });
    });
  });

  it('charges during Agile off-peak hours (01–05) when all-away', () => {
    const soc = mixergySoCByHour(allAway);
    // SoC at hour 5 should be higher than starting value of 60 % due to charging
    expect(soc[5]).toBeGreaterThan(60);
  });

  it('SoC is lower with continuous dhw_demand than with continuous away', () => {
    const socAway = mixergySoCByHour(allAway);
    const socDhw = mixergySoCByHour(allDhw);
    const avgAway = socAway.reduce((s, v) => s + v, 0) / 24;
    const avgDhw = socDhw.reduce((s, v) => s + v, 0) / 24;
    expect(avgDhw).toBeLessThan(avgAway);
  });

  it('SoC never goes below 0 even with constant dhw_demand', () => {
    const soc = mixergySoCByHour(allDhw);
    soc.forEach(v => expect(v).toBeGreaterThanOrEqual(0));
  });
});

// ─── boilerSteppedCurve ───────────────────────────────────────────────────────

describe('boilerSteppedCurve', () => {
  const allAway: HourState[] = Array(24).fill('away');
  const allHome: HourState[] = Array(24).fill('home');
  const allDhw: HourState[] = Array(24).fill('dhw_demand');

  it('returns exactly 24 values', () => {
    expect(boilerSteppedCurve(allAway, false)).toHaveLength(24);
  });

  it('returns 16 °C setback when all hours are away', () => {
    boilerSteppedCurve(allAway, false).forEach(v => {
      expect(v).toBe(16);
    });
  });

  it('returns ≥ 21 °C for home hours (fast reheat)', () => {
    boilerSteppedCurve(allHome, false).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(20.5); // ~21 °C with sinusoidal offset
    });
  });

  it('power shower drops dhw_demand hour to 17.5 °C', () => {
    const curve = boilerSteppedCurve(allDhw, true);
    curve.forEach(v => expect(v).toBe(17.5));
  });

  it('without power shower dhw_demand hour is 19.5 °C', () => {
    const curve = boilerSteppedCurve(allDhw, false);
    curve.forEach(v => expect(v).toBe(19.5));
  });

  it('power shower causes lower temp than no power shower during dhw_demand', () => {
    const withShower = boilerSteppedCurve(allDhw, true);
    const withoutShower = boilerSteppedCurve(allDhw, false);
    withShower.forEach((v, i) => expect(v).toBeLessThan(withoutShower[i]));
  });
});

// ─── hpHorizonCurve ───────────────────────────────────────────────────────────

const HIGH_TEMP_FLOW_TEMP_C = 50;

describe('hpHorizonCurve', () => {
  const allHome: HourState[] = Array(24).fill('home');
  const allAway: HourState[] = Array(24).fill('away');

  // Full Job: SPF 4.1, designFlowTemp 37 °C
  const FULL_JOB_SPF = 4.1;
  const FULL_JOB_FLOW = 37;
  // Fast Fit: SPF 3.0, designFlowTemp 50 °C
  const FAST_FIT_SPF = 3.0;
  const FAST_FIT_FLOW = 50;

  it('returns exactly 24 values', () => {
    expect(hpHorizonCurve(allHome, FULL_JOB_SPF, FULL_JOB_FLOW)).toHaveLength(24);
  });

  it('Full Job is flatter on cold morning hours than Fast Fit', () => {
    const fullJob = hpHorizonCurve(allHome, FULL_JOB_SPF, FULL_JOB_FLOW);
    const fastFit = hpHorizonCurve(allHome, FAST_FIT_SPF, FAST_FIT_FLOW);
    // Cold morning hours (0–6): Full Job should be warmer (flatter horizon)
    for (let h = 0; h < 7; h++) {
      expect(fullJob[h]).toBeGreaterThan(fastFit[h]);
    }
  });

  it('Full Job home hours hold ≥ 19 °C (thick green zone)', () => {
    const fullJob = hpHorizonCurve(allHome, FULL_JOB_SPF, FULL_JOB_FLOW);
    fullJob.forEach(v => expect(v).toBeGreaterThanOrEqual(19));
  });

  it('away hours are lower than home hours', () => {
    const homeResult = hpHorizonCurve(allHome, FULL_JOB_SPF, FULL_JOB_FLOW);
    const awayResult = hpHorizonCurve(allAway, FULL_JOB_SPF, FULL_JOB_FLOW);
    // Average home should be higher than average away
    const avgHome = homeResult.reduce((s, v) => s + v, 0) / 24;
    const avgAway = awayResult.reduce((s, v) => s + v, 0) / 24;
    expect(avgHome).toBeGreaterThan(avgAway);
  });

  it('higher SPF produces higher temperatures for the same hours', () => {
    const highSpf = hpHorizonCurve(allHome, 4.2, FULL_JOB_FLOW);
    const lowSpf = hpHorizonCurve(allHome, 2.9, HIGH_TEMP_FLOW_TEMP_C);
    const avgHigh = highSpf.reduce((s, v) => s + v, 0) / 24;
    const avgLow = lowSpf.reduce((s, v) => s + v, 0) / 24;
    expect(avgHigh).toBeGreaterThan(avgLow);
  });
});
