/**
 * locationActions.test.ts
 *
 * Unit tests for the pure location-action helpers.
 *
 * Acceptance criteria from the problem statement:
 *   - confirmLocation promotes scan_inferred to scan_confirmed and clears
 *     needs_verification confidence.
 *   - confirmLocation is idempotent when already confirmed.
 *   - confirmLocation does NOT change non-needs_verification confidence.
 *   - moveLocation sets provenance to 'manual' and updates planCoord.
 *   - moveLocation preserves audit trail (confidence unchanged).
 *   - addManualLocation creates a new entry with 'manual' provenance.
 *   - markNeedsVerification sets confidence without altering provenance.
 *   - rejectLocation sets rejected=true (soft-delete).
 *   - applyToLocation applies a mutation to the matching location only.
 *   - getLocationBadgeLabel maps provenance + confidence to badge labels.
 *   - getRequiredLocationSlots returns correct slots per job type.
 *   - isSlotSatisfied returns true when a matching active location exists.
 */

import { describe, it, expect } from 'vitest';
import {
  confirmLocation,
  moveLocation,
  addManualLocation,
  markNeedsVerification,
  rejectLocation,
  applyToLocation,
  getLocationBadgeLabel,
  getRequiredLocationSlots,
  isSlotSatisfied,
} from '../locationActions';
import type { QuotePlanLocationV1 } from '../QuoteInstallationPlanV1';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeLocation(partial: Partial<QuotePlanLocationV1>): QuotePlanLocationV1 {
  return {
    locationId:  'loc-001',
    kind:        'existing_boiler',
    provenance:  'scan_inferred',
    confidence:  'needs_verification',
    ...partial,
  };
}

// ─── confirmLocation ─────────────────────────────────────────────────────────

describe('confirmLocation', () => {
  it('sets provenance to scan_confirmed', () => {
    const loc = makeLocation({ provenance: 'scan_inferred', confidence: 'needs_verification' });
    expect(confirmLocation(loc).provenance).toBe('scan_confirmed');
  });

  it('promotes needs_verification confidence to high', () => {
    const loc = makeLocation({ confidence: 'needs_verification' });
    expect(confirmLocation(loc).confidence).toBe('high');
  });

  it('preserves non-needs_verification confidence', () => {
    const loc = makeLocation({ confidence: 'medium', provenance: 'scan_inferred' });
    expect(confirmLocation(loc).confidence).toBe('medium');
  });

  it('is idempotent when called on an already-confirmed location', () => {
    const loc = makeLocation({ provenance: 'scan_confirmed', confidence: 'high' });
    const result = confirmLocation(loc);
    expect(result.provenance).toBe('scan_confirmed');
    expect(result.confidence).toBe('high');
  });

  it('clears rejected flag when confirming a previously rejected location', () => {
    const loc = makeLocation({ rejected: true });
    expect(confirmLocation(loc).rejected).toBe(false);
  });
});

// ─── moveLocation ────────────────────────────────────────────────────────────

describe('moveLocation', () => {
  it('sets provenance to manual', () => {
    const loc = makeLocation({ provenance: 'scan_inferred', confidence: 'high' });
    expect(moveLocation(loc, { x: 0.5, y: 0.5 }).provenance).toBe('manual');
  });

  it('updates planCoord to the new position', () => {
    const loc = makeLocation({});
    const moved = moveLocation(loc, { x: 0.3, y: 0.7 });
    expect(moved.planCoord).toEqual({ x: 0.3, y: 0.7 });
  });

  it('preserves confidence when moving', () => {
    const loc = makeLocation({ confidence: 'high' });
    expect(moveLocation(loc, { x: 0.1, y: 0.1 }).confidence).toBe('high');
  });

  it('appends a note when provided', () => {
    const loc = makeLocation({ notes: 'original note' });
    const moved = moveLocation(loc, { x: 0, y: 0 }, 'moved by engineer');
    expect(moved.notes).toBe('original note | moved by engineer');
  });

  it('sets notes to the new note when no existing note', () => {
    const loc = makeLocation({ notes: undefined });
    const moved = moveLocation(loc, { x: 0, y: 0 }, 'placed on plan');
    expect(moved.notes).toBe('placed on plan');
  });

  it('does not add undefined to notes when no note is provided', () => {
    const loc = makeLocation({ notes: 'existing' });
    const moved = moveLocation(loc, { x: 0, y: 0 });
    expect(moved.notes).toBe('existing');
  });
});

// ─── addManualLocation ───────────────────────────────────────────────────────

describe('addManualLocation', () => {
  it('sets provenance to manual', () => {
    expect(addManualLocation('gas_meter').provenance).toBe('manual');
  });

  it('sets confidence to medium', () => {
    expect(addManualLocation('gas_meter').confidence).toBe('medium');
  });

  it('assigns the correct kind', () => {
    expect(addManualLocation('flue_terminal').kind).toBe('flue_terminal');
  });

  it('includes planCoord when provided', () => {
    const coord = { x: 0.2, y: 0.8 };
    expect(addManualLocation('cylinder', coord).planCoord).toEqual(coord);
  });

  it('has no planCoord when none is provided', () => {
    expect(addManualLocation('soil_stack').planCoord).toBeUndefined();
  });

  it('includes a note when provided', () => {
    expect(addManualLocation('gully', undefined, 'rear garden').notes).toBe('rear garden');
  });

  it('generates a non-empty locationId', () => {
    expect(addManualLocation('other').locationId).toBeTruthy();
  });

  it('generates different locationIds across calls', () => {
    const a = addManualLocation('internal_waste');
    const b = addManualLocation('internal_waste');
    expect(a.locationId).not.toBe(b.locationId);
  });
});

// ─── markNeedsVerification ───────────────────────────────────────────────────

describe('markNeedsVerification', () => {
  it('sets confidence to needs_verification', () => {
    const loc = makeLocation({ confidence: 'high' });
    expect(markNeedsVerification(loc).confidence).toBe('needs_verification');
  });

  it('does not change provenance', () => {
    const loc = makeLocation({ provenance: 'scan_confirmed' });
    expect(markNeedsVerification(loc).provenance).toBe('scan_confirmed');
  });

  it('is idempotent when already needs_verification', () => {
    const loc = makeLocation({ confidence: 'needs_verification' });
    expect(markNeedsVerification(loc).confidence).toBe('needs_verification');
  });
});

// ─── rejectLocation ──────────────────────────────────────────────────────────

describe('rejectLocation', () => {
  it('sets rejected to true', () => {
    const loc = makeLocation({});
    expect(rejectLocation(loc).rejected).toBe(true);
  });

  it('does not alter provenance', () => {
    const loc = makeLocation({ provenance: 'scan_confirmed' });
    expect(rejectLocation(loc).provenance).toBe('scan_confirmed');
  });

  it('is idempotent', () => {
    const loc = makeLocation({ rejected: true });
    expect(rejectLocation(loc).rejected).toBe(true);
  });
});

// ─── applyToLocation ─────────────────────────────────────────────────────────

describe('applyToLocation', () => {
  it('mutates only the matching location', () => {
    const locs: QuotePlanLocationV1[] = [
      makeLocation({ locationId: 'loc-a', provenance: 'scan_inferred' }),
      makeLocation({ locationId: 'loc-b', provenance: 'scan_inferred' }),
    ];
    const result = applyToLocation(locs, 'loc-a', confirmLocation);
    expect(result[0].provenance).toBe('scan_confirmed');
    expect(result[1].provenance).toBe('scan_inferred');
  });

  it('returns a new array (does not mutate the original)', () => {
    const locs: QuotePlanLocationV1[] = [makeLocation({ locationId: 'loc-a' })];
    const result = applyToLocation(locs, 'loc-a', confirmLocation);
    expect(result).not.toBe(locs);
  });

  it('returns the array unchanged when no location matches', () => {
    const locs: QuotePlanLocationV1[] = [makeLocation({ locationId: 'loc-a' })];
    const result = applyToLocation(locs, 'loc-x', confirmLocation);
    expect(result[0]).toBe(locs[0]);
  });
});

// ─── getLocationBadgeLabel ───────────────────────────────────────────────────

describe('getLocationBadgeLabel', () => {
  it('returns "needs verification" when confidence is needs_verification', () => {
    const loc = makeLocation({ confidence: 'needs_verification', provenance: 'scan_confirmed' });
    expect(getLocationBadgeLabel(loc)).toBe('needs verification');
  });

  it('returns "confirmed" for scan_confirmed with non-needs_verification confidence', () => {
    const loc = makeLocation({ provenance: 'scan_confirmed', confidence: 'high' });
    expect(getLocationBadgeLabel(loc)).toBe('confirmed');
  });

  it('returns "measured" for scan_inferred with high confidence', () => {
    const loc = makeLocation({ provenance: 'scan_inferred', confidence: 'high' });
    expect(getLocationBadgeLabel(loc)).toBe('measured');
  });

  it('returns "estimated" for scan_inferred with medium confidence', () => {
    const loc = makeLocation({ provenance: 'scan_inferred', confidence: 'medium' });
    expect(getLocationBadgeLabel(loc)).toBe('estimated');
  });

  it('returns "estimated" for scan_inferred with low confidence', () => {
    const loc = makeLocation({ provenance: 'scan_inferred', confidence: 'low' });
    expect(getLocationBadgeLabel(loc)).toBe('estimated');
  });

  it('returns "assumed" for manual provenance', () => {
    const loc = makeLocation({ provenance: 'manual', confidence: 'medium' });
    expect(getLocationBadgeLabel(loc)).toBe('assumed');
  });

  it('returns "assumed" for unknown provenance', () => {
    const loc = makeLocation({ provenance: 'unknown', confidence: 'medium' });
    expect(getLocationBadgeLabel(loc)).toBe('assumed');
  });
});

// ─── getRequiredLocationSlots ────────────────────────────────────────────────

describe('getRequiredLocationSlots', () => {
  it('like_for_like includes existing boiler, proposed boiler, flue terminal, condensate', () => {
    const slots = getRequiredLocationSlots('like_for_like');
    const keys = slots.map((s) => s.slotKey);
    expect(keys).toContain('existing_boiler');
    expect(keys).toContain('proposed_boiler');
    expect(keys).toContain('flue_terminal');
    expect(keys).toContain('condensate');
  });

  it('relocation includes gas meter', () => {
    const slots = getRequiredLocationSlots('relocation');
    const keys = slots.map((s) => s.slotKey);
    expect(keys).toContain('gas_meter');
    expect(keys).toContain('flue_terminal');
    expect(keys).toContain('existing_boiler');
  });

  it('stored_hot_water_upgrade includes cylinder and gas meter', () => {
    const slots = getRequiredLocationSlots('stored_hot_water_upgrade');
    const keys = slots.map((s) => s.slotKey);
    expect(keys).toContain('cylinder');
    expect(keys).toContain('gas_meter');
    expect(keys).toContain('proposed_boiler');
    expect(keys).toContain('condensate');
  });

  it('needs_review returns at least proposed boiler and gas meter', () => {
    const slots = getRequiredLocationSlots('needs_review');
    const keys = slots.map((s) => s.slotKey);
    expect(keys).toContain('proposed_boiler');
    expect(keys).toContain('gas_meter');
  });
});

// ─── isSlotSatisfied ─────────────────────────────────────────────────────────

describe('isSlotSatisfied', () => {
  it('returns true when a non-rejected location of the required kind exists', () => {
    const slot = { slotKey: 'gas_meter', label: 'Gas meter', kinds: ['gas_meter' as const] };
    const locs: QuotePlanLocationV1[] = [
      makeLocation({ kind: 'gas_meter', locationId: 'loc-gm' }),
    ];
    expect(isSlotSatisfied(slot, locs)).toBe(true);
  });

  it('returns false when no matching location exists', () => {
    const slot = { slotKey: 'gas_meter', label: 'Gas meter', kinds: ['gas_meter' as const] };
    expect(isSlotSatisfied(slot, [])).toBe(false);
  });

  it('returns false when the matching location is rejected', () => {
    const slot = { slotKey: 'gas_meter', label: 'Gas meter', kinds: ['gas_meter' as const] };
    const locs: QuotePlanLocationV1[] = [
      makeLocation({ kind: 'gas_meter', rejected: true, locationId: 'loc-gm' }),
    ];
    expect(isSlotSatisfied(slot, locs)).toBe(false);
  });

  it('returns true when any of multiple kinds is present for a condensate slot', () => {
    const slot = {
      slotKey: 'condensate',
      label:   'Condensate',
      kinds:   ['internal_waste', 'soil_stack', 'gully', 'soakaway'] as const,
    };
    const locs: QuotePlanLocationV1[] = [
      makeLocation({ kind: 'soil_stack', locationId: 'loc-ss' }),
    ];
    expect(isSlotSatisfied(slot, locs)).toBe(true);
  });
});
