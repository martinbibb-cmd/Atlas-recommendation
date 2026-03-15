/**
 * drivingStyleExplainer.test.ts
 *
 * Unit tests for static row-descriptor generation logic.
 *
 * Tests cover:
 *   - buildDrivingStyleRows returns exactly 4 rows with correct ids
 *   - Each row has required fields with correct types
 *   - Energy rank ordering: heat pump < Mixergy < system < combi
 *   - Path variants are correctly assigned per drivetrain
 *   - Combi warningChip present iff peakConcurrentOutlets >= 2
 *   - Other rows never have warningChip
 *   - eventChip present/absent per row as specified
 *   - resolveExplainerInput fills defaults correctly
 */

import { describe, it, expect } from 'vitest';
import {
  buildDrivingStyleRows,
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

// ─── Row shape ────────────────────────────────────────────────────────────────

describe('buildDrivingStyleRows — row shape', () => {
  it('returns exactly 4 rows', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    expect(rows).toHaveLength(4);
  });

  it('returns rows for all four drivetrains', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    const ids = rows.map(r => r.id);
    expect(ids).toContain('combi');
    expect(ids).toContain('system');
    expect(ids).toContain('mixergy');
    expect(ids).toContain('heatpump');
  });

  it('each row has required string fields', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    rows.forEach(row => {
      expect(typeof row.id).toBe('string');
      expect(typeof row.title).toBe('string');
      expect(typeof row.subtitle).toBe('string');
      expect(typeof row.vehicleLabel).toBe('string');
      expect(typeof row.systemLabel).toBe('string');
      expect(typeof row.pathVariant).toBe('string');
      expect(typeof row.powerBadge).toBe('string');
      expect(typeof row.caption).toBe('string');
      expect(typeof row.energyRank).toBe('number');
    });
  });

  it('row titles are non-empty', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    rows.forEach(row => {
      expect(row.title.length).toBeGreaterThan(0);
    });
  });

  it('row captions are non-empty', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    rows.forEach(row => {
      expect(row.caption.length).toBeGreaterThan(0);
    });
  });
});

// ─── Energy ranking ───────────────────────────────────────────────────────────

describe('buildDrivingStyleRows — energy ranking', () => {
  it('heat pump has lowest energy rank (1)', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    const hp = rows.find(r => r.id === 'heatpump')!;
    expect(hp.energyRank).toBe(1);
  });

  it('combi has highest energy rank (4)', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    const combi = rows.find(r => r.id === 'combi')!;
    expect(combi.energyRank).toBe(4);
  });

  it('energy rank ordering: heatpump < mixergy < system < combi', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    const get = (id: string) => rows.find(r => r.id === id)!.energyRank;
    expect(get('heatpump')).toBeLessThan(get('mixergy'));
    expect(get('mixergy')).toBeLessThan(get('system'));
    expect(get('system')).toBeLessThan(get('combi'));
  });
});

// ─── Path variants ────────────────────────────────────────────────────────────

describe('buildDrivingStyleRows — path variants', () => {
  it('combi has jagged-reverse path variant', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    expect(rows.find(r => r.id === 'combi')!.pathVariant).toBe('jagged-reverse');
  });

  it('system has steady path variant', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    expect(rows.find(r => r.id === 'system')!.pathVariant).toBe('steady');
  });

  it('mixergy has smooth path variant', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    expect(rows.find(r => r.id === 'mixergy')!.pathVariant).toBe('smooth');
  });

  it('heatpump has slow-smooth path variant', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    expect(rows.find(r => r.id === 'heatpump')!.pathVariant).toBe('slow-smooth');
  });
});

// ─── Warning chip — combi concurrent outlet gate ──────────────────────────────

describe('buildDrivingStyleRows — warning chip', () => {
  it('combi row has warningChip when peakConcurrentOutlets >= 2', () => {
    const rows = buildDrivingStyleRows({ ...BASE_INPUT, peakConcurrentOutlets: 2 });
    const combi = rows.find(r => r.id === 'combi')!;
    expect(combi.warningChip).toBeTruthy();
  });

  it('combi warningChip text references concurrent demand when outlets >= 2', () => {
    const rows = buildDrivingStyleRows({ ...BASE_INPUT, peakConcurrentOutlets: 2 });
    const combi = rows.find(r => r.id === 'combi')!;
    expect(combi.warningChip).toMatch(/second tap/i);
  });

  it('combi row has no warningChip when peakConcurrentOutlets is 1', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    const combi = rows.find(r => r.id === 'combi')!;
    expect(combi.warningChip).toBeUndefined();
  });

  it('other rows never have warningChip regardless of outlets', () => {
    const rows = buildDrivingStyleRows({ ...BASE_INPUT, peakConcurrentOutlets: 3 });
    (['system', 'mixergy', 'heatpump'] as const).forEach(id => {
      expect(rows.find(r => r.id === id)!.warningChip).toBeUndefined();
    });
  });
});

// ─── Event chips ──────────────────────────────────────────────────────────────

describe('buildDrivingStyleRows — event chips', () => {
  it('system row has an eventChip', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    expect(rows.find(r => r.id === 'system')!.eventChip).toBeTruthy();
  });

  it('mixergy row has an eventChip', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    expect(rows.find(r => r.id === 'mixergy')!.eventChip).toBeTruthy();
  });

  it('heatpump row has an eventChip', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    expect(rows.find(r => r.id === 'heatpump')!.eventChip).toBeTruthy();
  });

  it('combi row has no eventChip', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    expect(rows.find(r => r.id === 'combi')!.eventChip).toBeUndefined();
  });
});

// ─── System labels ────────────────────────────────────────────────────────────

describe('buildDrivingStyleRows — system labels', () => {
  it('combi row has systemLabel "Combi"', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    expect(rows.find(r => r.id === 'combi')!.systemLabel).toBe('Combi');
  });

  it('heatpump row has systemLabel "Heat pump"', () => {
    const rows = buildDrivingStyleRows(BASE_INPUT);
    expect(rows.find(r => r.id === 'heatpump')!.systemLabel).toBe('Heat pump');
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
