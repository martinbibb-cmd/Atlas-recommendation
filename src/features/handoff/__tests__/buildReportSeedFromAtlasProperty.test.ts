/**
 * buildReportSeedFromAtlasProperty.test.ts
 *
 * Tests for buildReportSeedFromAtlasProperty().
 *
 * Coverage:
 *   1. Returns a ReportSeed with the correct shape
 *   2. atlasProperty is the same reference passed in
 *   3. engineInput is the same reference passed in
 *   4. engineOutput is the same reference passed in
 *   5. source is preserved correctly for each HandoffSource value
 *   6. Does not mutate any input
 */

import { describe, it, expect } from 'vitest';
import { buildReportSeedFromAtlasProperty } from '../importer/buildReportSeedFromAtlasProperty';
import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function fv<T>(value: T) {
  return { value, source: 'engineer_entered' as const, confidence: 'medium' as const };
}

const BASE_PROPERTY: AtlasPropertyV1 = {
  version: '1.0',
  propertyId: 'prop_report_seed_test',
  createdAt: '2024-06-01T10:00:00Z',
  updatedAt: '2024-06-01T10:00:00Z',
  status: 'draft',
  sourceApps: ['atlas_mind'],
  property: { postcode: 'SW1A 1AA' },
  capture: { sessionId: 'session_01' },
  building: {
    floors: [], rooms: [], zones: [], boundaries: [],
    openings: [], emitters: [], systemComponents: [],
  },
  household: {
    composition: {
      adultCount: fv(2),
      childCount0to4: fv(0),
      childCount5to10: fv(0),
      childCount11to17: fv(0),
      youngAdultCount18to25AtHome: fv(0),
    },
    hotWaterUsage: { bathPresent: fv(true) },
  },
  currentSystem: { family: fv('combi'), dhwType: fv('combi') },
  evidence: { photos: [], voiceNotes: [], textNotes: [], qaFlags: [], timeline: [] },
};

const ENGINE_INPUT: Partial<EngineInputV2_3> = {
  postcode: 'SW1A 1AA',
  heatLossWatts: 7500,
  currentHeatSourceType: 'combi',
};

// Minimal EngineOutputV1 shape — only fields required by the type boundary
const ENGINE_OUTPUT = {
  runId: 'run_report_seed_test_01',
  options: [],
} as unknown as EngineOutputV1;

// ─── 1. Correct result shape ──────────────────────────────────────────────────

describe('buildReportSeedFromAtlasProperty — result shape', () => {
  it('returns a ReportSeed with atlasProperty, engineInput, engineOutput, source', () => {
    const seed = buildReportSeedFromAtlasProperty(
      BASE_PROPERTY, ENGINE_INPUT, ENGINE_OUTPUT, 'manual_import',
    );
    expect(seed).toHaveProperty('atlasProperty');
    expect(seed).toHaveProperty('engineInput');
    expect(seed).toHaveProperty('engineOutput');
    expect(seed).toHaveProperty('source');
  });
});

// ─── 2–4. Reference identity ──────────────────────────────────────────────────

describe('buildReportSeedFromAtlasProperty — reference identity', () => {
  it('atlasProperty is the same reference as the input', () => {
    const seed = buildReportSeedFromAtlasProperty(
      BASE_PROPERTY, ENGINE_INPUT, ENGINE_OUTPUT, 'manual_import',
    );
    expect(seed.atlasProperty).toBe(BASE_PROPERTY);
  });

  it('engineInput is the same reference as the input', () => {
    const seed = buildReportSeedFromAtlasProperty(
      BASE_PROPERTY, ENGINE_INPUT, ENGINE_OUTPUT, 'manual_import',
    );
    expect(seed.engineInput).toBe(ENGINE_INPUT);
  });

  it('engineOutput is the same reference as the input', () => {
    const seed = buildReportSeedFromAtlasProperty(
      BASE_PROPERTY, ENGINE_INPUT, ENGINE_OUTPUT, 'manual_import',
    );
    expect(seed.engineOutput).toBe(ENGINE_OUTPUT);
  });
});

// ─── 5. Source values ─────────────────────────────────────────────────────────

describe('buildReportSeedFromAtlasProperty — source', () => {
  it("preserves 'manual_import' source", () => {
    const seed = buildReportSeedFromAtlasProperty(BASE_PROPERTY, ENGINE_INPUT, ENGINE_OUTPUT, 'manual_import');
    expect(seed.source).toBe('manual_import');
  });

  it("preserves 'atlas_scan_handoff' source", () => {
    const seed = buildReportSeedFromAtlasProperty(BASE_PROPERTY, ENGINE_INPUT, ENGINE_OUTPUT, 'atlas_scan_handoff');
    expect(seed.source).toBe('atlas_scan_handoff');
  });

  it("preserves 'dev_fixture' source", () => {
    const seed = buildReportSeedFromAtlasProperty(BASE_PROPERTY, ENGINE_INPUT, ENGINE_OUTPUT, 'dev_fixture');
    expect(seed.source).toBe('dev_fixture');
  });
});

// ─── 6. Does not mutate inputs ────────────────────────────────────────────────

describe('buildReportSeedFromAtlasProperty — immutability', () => {
  it('does not mutate atlasProperty', () => {
    const prop = JSON.parse(JSON.stringify(BASE_PROPERTY)) as AtlasPropertyV1;
    const original = JSON.stringify(prop);
    buildReportSeedFromAtlasProperty(prop, ENGINE_INPUT, ENGINE_OUTPUT, 'manual_import');
    expect(JSON.stringify(prop)).toBe(original);
  });

  it('does not mutate engineInput', () => {
    const input = { ...ENGINE_INPUT };
    const original = JSON.stringify(input);
    buildReportSeedFromAtlasProperty(BASE_PROPERTY, input, ENGINE_OUTPUT, 'manual_import');
    expect(JSON.stringify(input)).toBe(original);
  });
});
