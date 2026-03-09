/**
 * evidenceContext.test.ts
 *
 * Unit tests for the three PR7 helpers exported from RecommendationHub:
 *
 *   sortEvidenceItems      — orders evidence items by decision value
 *   classifyContextBullet  — classifies context bullets into display groups
 *   buildNextCheckHint     — derives "Most useful next check" from top unlock item
 */
import { describe, it, expect } from 'vitest';
import {
  sortEvidenceItems,
  classifyContextBullet,
  buildNextCheckHint,
} from '../RecommendationHub';
import type { EvidenceItemV1 } from '../../../contracts/EngineOutputV1';

// ─── Minimal evidence item factory ───────────────────────────────────────────

function makeEvidence(
  id: string,
  fieldPath: string,
  label: string,
  source: EvidenceItemV1['source'] = 'manual',
): EvidenceItemV1 {
  return {
    id,
    fieldPath,
    label,
    value: 'n/a',
    source,
    confidence: 'high',
    affectsOptionIds: [],
  };
}

// ─── sortEvidenceItems ────────────────────────────────────────────────────────

describe('sortEvidenceItems', () => {
  it('returns empty array unchanged', () => {
    expect(sortEvidenceItems([])).toEqual([]);
  });

  it('returns single-item array unchanged', () => {
    const item = makeEvidence('e1', 'heatLoss', 'Design heat loss');
    expect(sortEvidenceItems([item])).toEqual([item]);
  });

  it('places mains/pressure items first', () => {
    const heatLoss = makeEvidence('e-heat', 'heatLossWatts', 'Design heat loss');
    const mains    = makeEvidence('e-mains', 'dynamicMainsPressure', 'Mains pressure (dynamic)');
    const sorted = sortEvidenceItems([heatLoss, mains]);
    expect(sorted[0].id).toBe('e-mains');
    expect(sorted[1].id).toBe('e-heat');
  });

  it('places DHW/bathroom items before component condition', () => {
    const cylinder = makeEvidence('e-cyl', 'cylinderCondition', 'Cylinder condition');
    const bathroom = makeEvidence('e-bath', 'bathroomCount', 'Peak simultaneous DHW outlets');
    const sorted = sortEvidenceItems([cylinder, bathroom]);
    expect(sorted[0].id).toBe('e-bath');
    expect(sorted[1].id).toBe('e-cyl');
  });

  it('places mains before bathroom before cylinder', () => {
    const cylinder = makeEvidence('e-cyl', 'cylinderCondition', 'Cylinder condition');
    const bathroom = makeEvidence('e-bath', 'bathroomCount', 'Peak simultaneous DHW outlets');
    const pressure = makeEvidence('e-pres', 'dynamicMainsPressure', 'Mains pressure');
    const sorted = sortEvidenceItems([cylinder, bathroom, pressure]);
    expect(sorted[0].id).toBe('e-pres');
    expect(sorted[1].id).toBe('e-bath');
    expect(sorted[2].id).toBe('e-cyl');
  });

  it('places component condition before heat loss', () => {
    const heatLoss = makeEvidence('e-heat', 'heatLossWatts', 'Design heat loss');
    const hexCond  = makeEvidence('e-hex', 'plateHex.condition', 'Plate heat exchanger condition');
    const sorted = sortEvidenceItems([heatLoss, hexCond]);
    expect(sorted[0].id).toBe('e-hex');
    expect(sorted[1].id).toBe('e-heat');
  });

  it('places all unmatched items after known-priority items', () => {
    const unknown = makeEvidence('e-unk', 'someOtherField', 'Some other item');
    const mains   = makeEvidence('e-mains', 'dynamicMainsPressure', 'Mains pressure');
    const sorted = sortEvidenceItems([unknown, mains]);
    expect(sorted[0].id).toBe('e-mains');
    expect(sorted[1].id).toBe('e-unk');
  });

  it('preserves relative order within the same priority band (stable sort)', () => {
    const bath1 = makeEvidence('e-bath1', 'bathroomCount', 'Bathrooms');
    const bath2 = makeEvidence('e-bath2', 'combiDhwV1.verdict', 'Combi DHW risk');
    const sorted = sortEvidenceItems([bath1, bath2]);
    expect(sorted[0].id).toBe('e-bath1');
    expect(sorted[1].id).toBe('e-bath2');
  });

  it('does not mutate the original array', () => {
    const items = [
      makeEvidence('e1', 'cylinderCondition', 'Cylinder'),
      makeEvidence('e2', 'dynamicMainsPressure', 'Mains pressure'),
    ];
    const originalIds = items.map(i => i.id);
    sortEvidenceItems(items);
    expect(items.map(i => i.id)).toEqual(originalIds);
  });

  it('matches combi field path as DHW/demand priority band', () => {
    const combi = makeEvidence('e-combi', 'combiDhwV1.verdict.combiRisk', 'Combi DHW risk verdict');
    const heat  = makeEvidence('e-heat', 'heatLossWatts', 'Design heat loss');
    const sorted = sortEvidenceItems([heat, combi]);
    expect(sorted[0].id).toBe('e-combi');
  });
});

// ─── classifyContextBullet ────────────────────────────────────────────────────

describe('classifyContextBullet', () => {
  // ── Site context ──────────────────────────────────────────────────────────

  it('classifies occupancy bullets as site_context', () => {
    expect(classifyContextBullet('3 people in a 4-bed property.')).toBe('site_context');
    expect(classifyContextBullet('1 person in the household.')).toBe('site_context');
    expect(classifyContextBullet('4-bedroom property.')).toBe('site_context');
  });

  it('classifies single-bathroom bullet as site_context', () => {
    expect(classifyContextBullet('Single bathroom — simultaneous demand is low.')).toBe('site_context');
  });

  it('classifies current system bullet as site_context', () => {
    expect(classifyContextBullet('Current system: Combi boiler.')).toBe('site_context');
  });

  it('classifies adequate-space bullet as site_context', () => {
    expect(classifyContextBullet('Adequate space available for a standard cylinder.')).toBe('site_context');
  });

  it('classifies mains supply bullet as site_context', () => {
    expect(classifyContextBullet('Mains supply: 2.5 bar dynamic, 3.2 bar static.')).toBe('site_context');
    expect(classifyContextBullet('Mains pressure: 2.5 bar.')).toBe('site_context');
  });

  // ── Key constraints ───────────────────────────────────────────────────────

  it('classifies multi-bathroom simultaneous demand bullet as key_constraint', () => {
    expect(classifyContextBullet('2 bathrooms — simultaneous DHW demand is a factor.')).toBe('key_constraint');
  });

  it('classifies loft conversion bullet as key_constraint', () => {
    expect(classifyContextBullet('Loft conversion planned — affects tank/cylinder placement options.')).toBe('key_constraint');
  });

  it('classifies additional bathroom planned bullet as key_constraint', () => {
    expect(classifyContextBullet('Additional bathroom planned — increases future DHW demand.')).toBe('key_constraint');
  });

  it('classifies limited space bullet as key_constraint', () => {
    expect(classifyContextBullet('Limited space for a cylinder — compact or Mixergy option preferred.')).toBe('key_constraint');
  });

  // ── Key constraint takes priority over site context when patterns overlap ─

  it('classifies simultaneous-demand bullet as key_constraint even if it also matches site context', () => {
    // "2 bathrooms — simultaneous" matches both SITE_CONTEXT and KEY_CONSTRAINT
    // KEY_CONSTRAINT should win (checked first)
    expect(classifyContextBullet('2 bathrooms — simultaneous DHW demand is a factor.')).toBe('key_constraint');
  });

  // ── General ───────────────────────────────────────────────────────────────

  it('classifies boiler sizing bullet as general', () => {
    expect(classifyContextBullet('Boiler nominal output: 24 kW.')).toBe('general');
    expect(classifyContextBullet('Estimated peak heat loss: 6.5 kW.')).toBe('general');
    expect(classifyContextBullet('Oversize ratio: 1.8× (oversized — increased cycling losses).')).toBe('general');
  });

  it('classifies fabric model bullet as general', () => {
    expect(classifyContextBullet('Fabric heat-loss estimate: High (modelled estimate).')).toBe('general');
    expect(classifyContextBullet('Thermal inertia (Heavy mass): heavy — holds warmth through unheated periods (modelled estimate).')).toBe('general');
  });

  it('classifies unknown bullet text as general', () => {
    expect(classifyContextBullet('Some unrecognised survey note.')).toBe('general');
  });
});

// ─── buildNextCheckHint ───────────────────────────────────────────────────────

describe('buildNextCheckHint', () => {
  it('returns null for empty input', () => {
    expect(buildNextCheckHint([])).toBeNull();
  });

  it('returns the first item as the check', () => {
    const result = buildNextCheckHint(['static pressure measurement']);
    expect(result).not.toBeNull();
    expect(result!.check).toBe('static pressure measurement');
  });

  it('gives a "confirms mains-fed" reason for static pressure items', () => {
    const result = buildNextCheckHint(['static pressure reading']);
    expect(result!.whyItMatters).toMatch(/confirms.*mains-fed/i);
  });

  it('gives a "simultaneous hot-water" reason for dynamic/flow items', () => {
    const result = buildNextCheckHint(['dynamic flow rate test']);
    expect(result!.whyItMatters).toMatch(/simultaneous/i);
  });

  it('gives a "retained or requires replacement" reason for cylinder items', () => {
    const result = buildNextCheckHint(['cylinder condition assessment']);
    expect(result!.whyItMatters).toMatch(/retained|replacement/i);
  });

  it('gives a "fouling" reason for plate HEX items', () => {
    const result = buildNextCheckHint(['plate hex condition check']);
    expect(result!.whyItMatters).toMatch(/fouling/i);
  });

  it('gives a "remaining component life" reason for age items', () => {
    const result = buildNextCheckHint(['appliance age assessment']);
    expect(result!.whyItMatters).toMatch(/component life/i);
  });

  it('uses the first item from a pre-sorted list', () => {
    // When fed a sorted list (static pressure first), uses static pressure item
    const result = buildNextCheckHint([
      'static pressure measurement',
      'cylinder condition assessment',
    ]);
    expect(result!.check).toBe('static pressure measurement');
    expect(result!.whyItMatters).toMatch(/confirms/i);
  });

  it('returns a generic why when item does not match any known pattern', () => {
    const result = buildNextCheckHint(['an unrecognised survey item']);
    expect(result).not.toBeNull();
    expect(result!.check).toBe('an unrecognised survey item');
    expect(result!.whyItMatters).toMatch(/accuracy/i);
  });

  it('is case-insensitive in pattern matching', () => {
    const result = buildNextCheckHint(['STATIC PRESSURE CHECK']);
    expect(result!.whyItMatters).toMatch(/confirms/i);
  });
});
