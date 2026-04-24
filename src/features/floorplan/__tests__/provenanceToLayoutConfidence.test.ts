/**
 * provenanceToLayoutConfidence.test.ts
 *
 * PR11 — Tests for the shared provenance → confidence mapper.
 *
 * Covers:
 *   provenanceToLayoutConfidence()
 *     - manual + corrected   → confirmed
 *     - manual + reviewed    → confirmed
 *     - manual + unreviewed  → fallback / needs_verification
 *     - scanned + reviewed   → confirmed
 *     - scanned + corrected  → confirmed
 *     - scanned + unreviewed → needs_verification
 *     - imported_legacy + reviewed   → confirmed
 *     - imported_legacy + unreviewed → needs_verification
 *     - inferred (any review status) → inferred
 *     - missing provenance           → fallback ?? needs_verification
 *
 *   routeProvenanceToLayoutConfidence()
 *     - assumed status always → assumed (regardless of provenance)
 *     - proposed + manual/corrected provenance → confirmed
 *     - proposed + no provenance → needs_verification
 *     - existing + no provenance → confirmed
 *     - existing + scanned/unreviewed → needs_verification
 */

import { describe, expect, it } from 'vitest';
import {
  provenanceToLayoutConfidence,
  routeProvenanceToLayoutConfidence,
} from '../provenanceToLayoutConfidence';
import type { EntityProvenance } from '../../../components/floorplan/propertyPlan.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prov(overrides: Partial<EntityProvenance>): EntityProvenance {
  return {
    source: 'manual',
    reviewStatus: 'unreviewed',
    ...overrides,
  };
}

// ─── provenanceToLayoutConfidence ─────────────────────────────────────────────

describe('provenanceToLayoutConfidence — manual source', () => {
  it('manual + corrected → confirmed', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'manual', reviewStatus: 'corrected' }))).toBe('confirmed');
  });

  it('manual + reviewed → confirmed', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'manual', reviewStatus: 'reviewed' }))).toBe('confirmed');
  });

  it('manual + unreviewed → needs_verification (no fallback)', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'manual', reviewStatus: 'unreviewed' }))).toBe('needs_verification');
  });

  it('manual + unreviewed → uses fallback when provided', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'manual', reviewStatus: 'unreviewed' }), 'assumed')).toBe('assumed');
  });
});

describe('provenanceToLayoutConfidence — scanned source', () => {
  it('scanned + reviewed → confirmed', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'scanned', reviewStatus: 'reviewed' }))).toBe('confirmed');
  });

  it('scanned + corrected → confirmed', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'scanned', reviewStatus: 'corrected' }))).toBe('confirmed');
  });

  it('scanned + unreviewed → needs_verification', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'scanned', reviewStatus: 'unreviewed' }))).toBe('needs_verification');
  });

  it('scanned + unreviewed ignores fallback (unreviewed scan is always needs_verification)', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'scanned', reviewStatus: 'unreviewed' }), 'confirmed')).toBe('needs_verification');
  });
});

describe('provenanceToLayoutConfidence — imported_legacy source', () => {
  it('imported_legacy + reviewed → confirmed', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'imported_legacy', reviewStatus: 'reviewed' }))).toBe('confirmed');
  });

  it('imported_legacy + corrected → confirmed', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'imported_legacy', reviewStatus: 'corrected' }))).toBe('confirmed');
  });

  it('imported_legacy + unreviewed → needs_verification', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'imported_legacy', reviewStatus: 'unreviewed' }))).toBe('needs_verification');
  });
});

describe('provenanceToLayoutConfidence — inferred source', () => {
  it('inferred + unreviewed → inferred', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'inferred', reviewStatus: 'unreviewed' }))).toBe('inferred');
  });

  it('inferred + reviewed → inferred (review status ignored for inferred data)', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'inferred', reviewStatus: 'reviewed' }))).toBe('inferred');
  });

  it('inferred + corrected → inferred', () => {
    expect(provenanceToLayoutConfidence(prov({ source: 'inferred', reviewStatus: 'corrected' }))).toBe('inferred');
  });
});

describe('provenanceToLayoutConfidence — missing provenance', () => {
  it('undefined → needs_verification (no fallback)', () => {
    expect(provenanceToLayoutConfidence(undefined)).toBe('needs_verification');
  });

  it('undefined → uses fallback when provided', () => {
    expect(provenanceToLayoutConfidence(undefined, 'confirmed')).toBe('confirmed');
  });

  it('undefined + inferred fallback → inferred', () => {
    expect(provenanceToLayoutConfidence(undefined, 'inferred')).toBe('inferred');
  });
});

// ─── routeProvenanceToLayoutConfidence ────────────────────────────────────────

describe('routeProvenanceToLayoutConfidence — assumed status', () => {
  it('assumed status with manual/corrected provenance → assumed (not upgraded to confirmed)', () => {
    const manualConfirmed = prov({ source: 'manual', reviewStatus: 'corrected' });
    expect(routeProvenanceToLayoutConfidence('assumed', manualConfirmed)).toBe('assumed');
  });

  it('assumed status with no provenance → assumed', () => {
    expect(routeProvenanceToLayoutConfidence('assumed', undefined)).toBe('assumed');
  });

  it('assumed status with scanned/reviewed provenance → assumed', () => {
    const scannedReviewed = prov({ source: 'scanned', reviewStatus: 'reviewed' });
    expect(routeProvenanceToLayoutConfidence('assumed', scannedReviewed)).toBe('assumed');
  });
});

describe('routeProvenanceToLayoutConfidence — proposed status', () => {
  it('proposed + no provenance → needs_verification', () => {
    expect(routeProvenanceToLayoutConfidence('proposed', undefined)).toBe('needs_verification');
  });

  it('proposed + manual/corrected provenance → confirmed', () => {
    const manualConfirmed = prov({ source: 'manual', reviewStatus: 'corrected' });
    expect(routeProvenanceToLayoutConfidence('proposed', manualConfirmed)).toBe('confirmed');
  });

  it('proposed + scanned/reviewed provenance → confirmed', () => {
    const scannedReviewed = prov({ source: 'scanned', reviewStatus: 'reviewed' });
    expect(routeProvenanceToLayoutConfidence('proposed', scannedReviewed)).toBe('confirmed');
  });

  it('proposed + scanned/unreviewed provenance → needs_verification', () => {
    const scannedUnreviewed = prov({ source: 'scanned', reviewStatus: 'unreviewed' });
    expect(routeProvenanceToLayoutConfidence('proposed', scannedUnreviewed)).toBe('needs_verification');
  });
});

describe('routeProvenanceToLayoutConfidence — existing status', () => {
  it('existing + no provenance → confirmed (intentional default)', () => {
    expect(routeProvenanceToLayoutConfidence('existing', undefined)).toBe('confirmed');
  });

  it('existing + manual/corrected → confirmed', () => {
    const manualConfirmed = prov({ source: 'manual', reviewStatus: 'corrected' });
    expect(routeProvenanceToLayoutConfidence('existing', manualConfirmed)).toBe('confirmed');
  });

  it('existing + scanned/unreviewed → needs_verification', () => {
    const scannedUnreviewed = prov({ source: 'scanned', reviewStatus: 'unreviewed' });
    expect(routeProvenanceToLayoutConfidence('existing', scannedUnreviewed)).toBe('needs_verification');
  });

  it('existing + inferred → inferred', () => {
    const inferred = prov({ source: 'inferred', reviewStatus: 'unreviewed' });
    expect(routeProvenanceToLayoutConfidence('existing', inferred)).toBe('inferred');
  });
});
