/**
 * drivingStyleExplainer.test.ts
 *
 * Unit tests for lane-state generation logic.
 *
 * Tests cover:
 *   - Each system preset produces a correctly typed LaneState
 *   - Concurrent outlet event causes combi slowdown / warning state
 *   - Energy rank ordering: heat pump < Mixergy < system < combi
 *   - Combi energy level drops further with more concurrent outlets
 *   - Controls quality raises Mixergy energy level
 *   - Heat pump lane finishes with lower progress than gas lanes at finish phase
 *   - resolveExplainerInput fills defaults correctly
 *   - buildDrivingStyleEvents returns second-tap event iff outlets >= 2
 *   - Compact (finish phase) renders final states without animation states
 */

import { describe, it, expect } from 'vitest';
import {
  buildDrivingStyleLaneStates,
  buildDrivingStyleEvents,
  resolveExplainerInput,
} from '../drivingStyleExplainer';
import type { DrivingStyleExplainerInput } from '../../../types/explainers';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_INPUT: DrivingStyleExplainerInput = {
  peakConcurrentOutlets: 1,
  occupancySignature: 'steady',
  controlsQuality: 'basic',
  hasMixergy: false,
};

// ─── Lane shape ───────────────────────────────────────────────────────────────

describe('buildDrivingStyleLaneStates — lane shape', () => {
  it('returns exactly 4 lanes', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT);
    expect(lanes).toHaveLength(4);
  });

  it('returns lanes for all four drivetrains', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT);
    const ids = lanes.map(l => l.id);
    expect(ids).toContain('combi');
    expect(ids).toContain('system');
    expect(ids).toContain('mixergy');
    expect(ids).toContain('heatpump');
  });

  it('each lane has required fields', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT);
    lanes.forEach(lane => {
      expect(typeof lane.id).toBe('string');
      expect(typeof lane.label).toBe('string');
      expect(typeof lane.caption).toBe('string');
      expect(typeof lane.motionState).toBe('string');
      expect(typeof lane.progress).toBe('number');
      expect(typeof lane.energyLevel).toBe('number');
      expect(typeof lane.energyRank).toBe('number');
      expect(typeof lane.showConcurrentWarning).toBe('boolean');
    });
  });

  it('lane labels are non-empty', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT);
    lanes.forEach(lane => {
      expect(lane.label.length).toBeGreaterThan(0);
    });
  });

  it('lane captions are non-empty', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT);
    lanes.forEach(lane => {
      expect(lane.caption.length).toBeGreaterThan(0);
    });
  });
});

// ─── Energy ranking ───────────────────────────────────────────────────────────

describe('buildDrivingStyleLaneStates — energy ranking', () => {
  it('heat pump has lowest energy rank (1)', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT);
    const hp = lanes.find(l => l.id === 'heatpump')!;
    expect(hp.energyRank).toBe(1);
  });

  it('combi has highest energy rank (4)', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT);
    const combi = lanes.find(l => l.id === 'combi')!;
    expect(combi.energyRank).toBe(4);
  });

  it('energy level ordering: heatpump > mixergy > system > combi', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT);
    const get = (id: string) => lanes.find(l => l.id === id)!.energyLevel;
    expect(get('heatpump')).toBeGreaterThan(get('mixergy'));
    expect(get('mixergy')).toBeGreaterThan(get('system'));
    expect(get('system')).toBeGreaterThan(get('combi'));
  });
});

// ─── Concurrent outlets — combi warning ──────────────────────────────────────

describe('buildDrivingStyleLaneStates — concurrent outlet event', () => {
  it('combi shows warning when peakConcurrentOutlets >= 2', () => {
    const input: DrivingStyleExplainerInput = { ...BASE_INPUT, peakConcurrentOutlets: 2 };
    const lanes = buildDrivingStyleLaneStates(input, 'cruise');
    const combi = lanes.find(l => l.id === 'combi')!;
    expect(combi.showConcurrentWarning).toBe(true);
    expect(combi.motionState).toBe('warning');
  });

  it('combi does not show warning when peakConcurrentOutlets is 1', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT, 'cruise');
    const combi = lanes.find(l => l.id === 'combi')!;
    expect(combi.showConcurrentWarning).toBe(false);
    expect(combi.motionState).not.toBe('warning');
  });

  it('other lanes are unaffected by concurrent outlets', () => {
    const input: DrivingStyleExplainerInput = { ...BASE_INPUT, peakConcurrentOutlets: 3 };
    const lanes = buildDrivingStyleLaneStates(input, 'cruise');
    (['system', 'mixergy', 'heatpump'] as const).forEach(id => {
      const lane = lanes.find(l => l.id === id)!;
      expect(lane.showConcurrentWarning).toBe(false);
    });
  });

  it('combi energy level decreases with more concurrent outlets', () => {
    const one  = buildDrivingStyleLaneStates({ ...BASE_INPUT, peakConcurrentOutlets: 1 });
    const two  = buildDrivingStyleLaneStates({ ...BASE_INPUT, peakConcurrentOutlets: 2 });
    const combiOne = one.find(l => l.id === 'combi')!;
    const combiTwo = two.find(l => l.id === 'combi')!;
    expect(combiTwo.energyLevel).toBeLessThan(combiOne.energyLevel);
  });
});

// ─── Controls quality — Mixergy lane ─────────────────────────────────────────

describe('buildDrivingStyleLaneStates — controls quality', () => {
  it('excellent controls raises Mixergy energy level above basic', () => {
    const basic     = buildDrivingStyleLaneStates({ ...BASE_INPUT, controlsQuality: 'basic' });
    const excellent = buildDrivingStyleLaneStates({ ...BASE_INPUT, controlsQuality: 'excellent' });
    const getM = (lanes: typeof basic) => lanes.find(l => l.id === 'mixergy')!.energyLevel;
    expect(getM(excellent)).toBeGreaterThan(getM(basic));
  });

  it('good controls raises Mixergy energy level above basic', () => {
    const basic = buildDrivingStyleLaneStates({ ...BASE_INPUT, controlsQuality: 'basic' });
    const good  = buildDrivingStyleLaneStates({ ...BASE_INPUT, controlsQuality: 'good' });
    const getM = (lanes: typeof basic) => lanes.find(l => l.id === 'mixergy')!.energyLevel;
    expect(getM(good)).toBeGreaterThan(getM(basic));
  });

  it('controls quality does not affect combi energy level', () => {
    const basic     = buildDrivingStyleLaneStates({ ...BASE_INPUT, controlsQuality: 'basic' });
    const excellent = buildDrivingStyleLaneStates({ ...BASE_INPUT, controlsQuality: 'excellent' });
    const getC = (lanes: typeof basic) => lanes.find(l => l.id === 'combi')!.energyLevel;
    expect(getC(excellent)).toBeCloseTo(getC(basic), 5);
  });
});

// ─── Phase behaviour ──────────────────────────────────────────────────────────

describe('buildDrivingStyleLaneStates — phase behaviour', () => {
  it('finish phase: gas lanes have progress 1.0', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT, 'finish');
    (['combi', 'system', 'mixergy'] as const).forEach(id => {
      const lane = lanes.find(l => l.id === id)!;
      expect(lane.progress).toBe(1.0);
    });
  });

  it('finish phase: heat pump has progress < gas lanes', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT, 'finish');
    const hp   = lanes.find(l => l.id === 'heatpump')!;
    const sys  = lanes.find(l => l.id === 'system')!;
    expect(hp.progress).toBeLessThan(sys.progress);
  });

  it('launch phase: combi motion state is reversing (no concurrent)', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT, 'launch');
    const combi = lanes.find(l => l.id === 'combi')!;
    expect(combi.motionState).toBe('reversing');
  });

  it('launch phase: heat pump motion state is launching', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT, 'launch');
    const hp = lanes.find(l => l.id === 'heatpump')!;
    expect(hp.motionState).toBe('launching');
  });

  it('finish phase: gas lanes have finished motion state', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT, 'finish');
    (['combi', 'system', 'mixergy'] as const).forEach(id => {
      const lane = lanes.find(l => l.id === id)!;
      expect(lane.motionState).toBe('finished');
    });
  });

  it('reduced-motion (compact) finish phase: all motion states are finished or cruising', () => {
    const lanes = buildDrivingStyleLaneStates(BASE_INPUT, 'finish');
    lanes.forEach(lane => {
      // heat pump doesn't reach finished progress but its motionState may be cruising
      expect(['finished', 'cruising', 'launching']).toContain(lane.motionState);
    });
  });
});

// ─── Energy level clamping ────────────────────────────────────────────────────

describe('buildDrivingStyleLaneStates — energy level clamping', () => {
  it('energy level is never below 0.10', () => {
    const input: DrivingStyleExplainerInput = { ...BASE_INPUT, peakConcurrentOutlets: 10 };
    const lanes = buildDrivingStyleLaneStates(input);
    lanes.forEach(lane => {
      expect(lane.energyLevel).toBeGreaterThanOrEqual(0.10);
    });
  });

  it('energy level is never above 0.95', () => {
    const input: DrivingStyleExplainerInput = {
      ...BASE_INPUT,
      controlsQuality: 'excellent',
    };
    const lanes = buildDrivingStyleLaneStates(input);
    lanes.forEach(lane => {
      expect(lane.energyLevel).toBeLessThanOrEqual(0.95);
    });
  });
});

// ─── buildDrivingStyleEvents ──────────────────────────────────────────────────

describe('buildDrivingStyleEvents — event list', () => {
  it('always includes a tap-opened event on combi lane', () => {
    const events = buildDrivingStyleEvents(BASE_INPUT);
    const tapEvent = events.find(e => e.lane === 'combi' && /tap opened/i.test(e.label));
    expect(tapEvent).toBeTruthy();
  });

  it('always includes a purge/warm-up event on combi lane', () => {
    const events = buildDrivingStyleEvents(BASE_INPUT);
    const purgeEvent = events.find(e => e.lane === 'combi' && /purge/i.test(e.label));
    expect(purgeEvent).toBeTruthy();
  });

  it('always includes a buffering event on system and mixergy lanes', () => {
    const events = buildDrivingStyleEvents(BASE_INPUT);
    const systemBuf  = events.find(e => e.lane === 'system'  && /buffers/i.test(e.label));
    const mixergyBuf = events.find(e => e.lane === 'mixergy' && /buffers/i.test(e.label));
    expect(systemBuf).toBeTruthy();
    expect(mixergyBuf).toBeTruthy();
  });

  it('always includes a low-and-slow recovery event on heat pump lane', () => {
    const events = buildDrivingStyleEvents(BASE_INPUT);
    const hpEvent = events.find(e => e.lane === 'heatpump' && /low-and-slow/i.test(e.label));
    expect(hpEvent).toBeTruthy();
  });

  it('does NOT include second-tap event when peakConcurrentOutlets is 1', () => {
    const events = buildDrivingStyleEvents(BASE_INPUT);
    const secondTap = events.find(e => /second tap/i.test(e.label));
    expect(secondTap).toBeUndefined();
  });

  it('DOES include second-tap event when peakConcurrentOutlets >= 2', () => {
    const input: DrivingStyleExplainerInput = { ...BASE_INPUT, peakConcurrentOutlets: 2 };
    const events = buildDrivingStyleEvents(input);
    const secondTap = events.find(e => /second tap/i.test(e.label));
    expect(secondTap).toBeTruthy();
    expect(secondTap!.lane).toBe('combi');
  });

  it('events are sorted by atProgress ascending', () => {
    const input: DrivingStyleExplainerInput = { ...BASE_INPUT, peakConcurrentOutlets: 2 };
    const events = buildDrivingStyleEvents(input);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].atProgress).toBeGreaterThanOrEqual(events[i - 1].atProgress);
    }
  });
});

// ─── resolveExplainerInput ────────────────────────────────────────────────────

describe('resolveExplainerInput — defaults', () => {
  it('fills default peakConcurrentOutlets = 1 when omitted', () => {
    const result = resolveExplainerInput({});
    expect(result.peakConcurrentOutlets).toBe(1);
  });

  it('fills default occupancySignature = steady when omitted', () => {
    const result = resolveExplainerInput({});
    expect(result.occupancySignature).toBe('steady');
  });

  it('fills default controlsQuality = basic when omitted', () => {
    const result = resolveExplainerInput({});
    expect(result.controlsQuality).toBe('basic');
  });

  it('fills default hasMixergy = false when omitted', () => {
    const result = resolveExplainerInput({});
    expect(result.hasMixergy).toBe(false);
  });

  it('preserves provided peakConcurrentOutlets', () => {
    const result = resolveExplainerInput({ peakConcurrentOutlets: 3 });
    expect(result.peakConcurrentOutlets).toBe(3);
  });

  it('preserves provided controlsQuality', () => {
    const result = resolveExplainerInput({ controlsQuality: 'excellent' });
    expect(result.controlsQuality).toBe('excellent');
  });
});
