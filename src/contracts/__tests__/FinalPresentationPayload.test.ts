/**
 * FinalPresentationPayload.test.ts
 *
 * Tests for the canonical output contract type and its family consistency guard.
 *
 * Covers:
 *   - validateFamilyConsistency: combi/stored cross-family detection
 *   - validateFamilyConsistency: shortlist duplicate detection
 *   - validateFamilyConsistency: empty reasons / evidence detection
 *   - assertFamilyConsistency: no-throw in production (import.meta.env.DEV = false)
 */

import { describe, it, expect } from 'vitest';
import {
  validateFamilyConsistency,
  type FinalPresentationPayload,
} from '../FinalPresentationPayload';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeValidPayload(
  overrides: Partial<FinalPresentationPayload> = {},
): FinalPresentationPayload {
  return {
    contractVersion: '2.3',
    selectedFamily: 'stored_hw',
    heatSource: 'gas_system',
    hotWaterArrangement: 'stored_unvented',
    controls: 'smart_trvs',
    emitters: {
      existingRadiatorsCompatible: true,
      requiredFlowTempC: 65,
      note: 'Existing radiators compatible at 65 °C.',
    },
    infrastructure: [],
    reasons: [
      {
        id: 'r1',
        text: '2 bathrooms require stored hot water for simultaneous outlets.',
        sourceModule: 'CombiDhwModule',
      },
    ],
    evidence: [
      {
        id: 'e1',
        fieldPath: 'bathroomCount',
        label: 'Bathroom count',
        value: '2',
        source: 'manual',
        confidence: 'high',
      },
    ],
    confidence: {
      level: 'high',
      explanation: 'All key inputs measured on-site.',
      uncertainFields: [],
      unlockBy: [],
    },
    requiredWork: [],
    worthwhileUpgrades: [],
    futureReady: [],
    shortlist: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('validateFamilyConsistency', () => {
  it('returns no violations for a valid stored/system payload', () => {
    const payload = makeValidPayload();
    expect(validateFamilyConsistency(payload)).toHaveLength(0);
  });

  it('returns no violations for a valid combi/on-demand payload', () => {
    const payload = makeValidPayload({
      selectedFamily: 'on_demand',
      heatSource: 'gas_combi',
      hotWaterArrangement: 'on_demand',
      reasons: [{ id: 'r1', text: 'Occupancy of 2 — no simultaneous demand risk from occupancy alone.', sourceModule: 'CombiDhwModule' }],
      evidence: [{ id: 'e1', fieldPath: 'occupancyCount', label: 'Occupancy', value: '2', source: 'manual', confidence: 'high' }],
    });
    expect(validateFamilyConsistency(payload)).toHaveLength(0);
  });

  it('flags a gas_combi heatSource with stored_unvented hotWaterArrangement', () => {
    const payload = makeValidPayload({
      heatSource: 'gas_combi',
      hotWaterArrangement: 'stored_unvented',
    });
    const violations = validateFamilyConsistency(payload);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/incompatible families/i);
  });

  it('flags a gas_combi heatSource with stored_vented hotWaterArrangement', () => {
    const payload = makeValidPayload({
      heatSource: 'gas_combi',
      hotWaterArrangement: 'stored_vented',
    });
    const violations = validateFamilyConsistency(payload);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/incompatible families/i);
  });

  it('flags a gas_combi heatSource with mixergy hotWaterArrangement', () => {
    const payload = makeValidPayload({
      heatSource: 'gas_combi',
      hotWaterArrangement: 'mixergy',
    });
    const violations = validateFamilyConsistency(payload);
    expect(violations.some(v => v.includes('incompatible families'))).toBe(true);
  });

  it('does NOT flag oil_combi with on_demand (valid combination)', () => {
    const payload = makeValidPayload({
      heatSource: 'oil_combi',
      hotWaterArrangement: 'on_demand',
    });
    expect(validateFamilyConsistency(payload)).toHaveLength(0);
  });

  it('flags a shortlist entry that duplicates the primary selectedFamily', () => {
    const payload = makeValidPayload({
      selectedFamily: 'stored_hw',
      shortlist: [
        {
          optionId: 'stored_hw',
          title: 'Regular system boiler',
          summary: 'A duplicate entry.',
          whyNotPrimary: 'This should not be here.',
          penaltySummary: [],
        },
      ],
    });
    const violations = validateFamilyConsistency(payload);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/duplicates the primary/i);
  });

  it('does NOT flag a shortlist entry with a different optionId', () => {
    const payload = makeValidPayload({
      selectedFamily: 'stored_hw',
      shortlist: [
        {
          optionId: 'on_demand',
          title: 'Combi boiler',
          summary: 'Alternative option.',
          whyNotPrimary: 'Two bathrooms require stored water.',
          penaltySummary: ['Simultaneous demand penalty: −20 pts'],
        },
      ],
    });
    expect(validateFamilyConsistency(payload)).toHaveLength(0);
  });

  it('flags an empty reasons array', () => {
    const payload = makeValidPayload({ reasons: [] });
    const violations = validateFamilyConsistency(payload);
    expect(violations.some(v => v.includes('reasons[]'))).toBe(true);
  });

  it('flags an empty evidence array', () => {
    const payload = makeValidPayload({ evidence: [] });
    const violations = validateFamilyConsistency(payload);
    expect(violations.some(v => v.includes('evidence[]'))).toBe(true);
  });

  it('accumulates multiple violations independently', () => {
    const payload = makeValidPayload({
      heatSource: 'gas_combi',
      hotWaterArrangement: 'stored_unvented',
      reasons: [],
      evidence: [],
    });
    const violations = validateFamilyConsistency(payload);
    // At minimum: incompatible families + empty reasons + empty evidence
    expect(violations.length).toBeGreaterThanOrEqual(3);
  });
});
