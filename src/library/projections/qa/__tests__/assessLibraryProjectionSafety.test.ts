import { describe, expect, it } from 'vitest';
import { assessLibraryProjectionSafety } from '../assessLibraryProjectionSafety';
import type { LibraryContentProjectionV1 } from '../../LibraryContentProjectionV1';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeCustomerProjection(
  overrideCards?: LibraryContentProjectionV1['visibleCards'],
  overrideProps?: Partial<LibraryContentProjectionV1>,
): LibraryContentProjectionV1 {
  return {
    audience: 'customer',
    visibleConcepts: ['sealed_system_conversion'],
    visibleCards: overrideCards ?? [
      {
        title: 'What changes in your home',
        summary:
          'What you may notice: a pressure gauge near the boiler. What this means: the circuit is now sealed.',
      },
    ],
    visibleDiagrams: [
      {
        diagramId: 'sealed_system_overview',
        title: 'Sealed system overview',
        description: 'Before and after layout.',
        conceptIds: ['sealed_system_conversion'],
        defaultRenderer: 'svg',
      },
    ],
    hiddenReasonLog: [],
    auditTrace: [],
    ...overrideProps,
  };
}

function makeSafeCards(): LibraryContentProjectionV1['visibleCards'] {
  return [
    {
      title: 'Decision summary',
      summary: 'A sealed system with an unvented cylinder is the best fit for this home.',
    },
    {
      title: 'What you may notice',
      summary:
        'What you may notice: a pressure gauge near the boiler. What this means: the system is sealed.',
    },
  ];
}

function makeAuditProjection(): LibraryContentProjectionV1 {
  return {
    audience: 'audit',
    visibleConcepts: ['sealed_system_conversion', 'MNT-02', 'inhibitor_dosing'],
    visibleCards: [
      { conceptId: 'MNT-02', title: 'Inhibitor dosing requirements', summary: 'BS7593 compliance.' },
      { title: 'G3 mechanics overview', summary: 'G3 qualification check required.' },
    ],
    visibleDiagrams: [],
    hiddenReasonLog: [],
    auditTrace: [],
  };
}

// ─── Leakage blocks customer output ──────────────────────────────────────────

describe('assessLibraryProjectionSafety — leakage blocking', () => {
  it('blocks when "inhibitor" appears in a card title', () => {
    const projection = makeCustomerProjection([
      { title: 'Inhibitor dosing requirements', summary: 'Must dose before commissioning.' },
    ]);
    const result = assessLibraryProjectionSafety(projection);
    expect(result.safeForCustomer).toBe(false);
    expect(result.leakageTerms).toContain('inhibitor');
    expect(result.blockingReasons.join(' ')).toMatch(/inhibitor/i);
  });

  it('blocks when "bs7593" appears in a card summary', () => {
    const projection = makeCustomerProjection([
      { title: 'Water treatment', summary: 'BS7593 compliance record required.' },
    ]);
    const result = assessLibraryProjectionSafety(projection);
    expect(result.safeForCustomer).toBe(false);
    expect(result.leakageTerms).toContain('bs7593');
  });

  it('blocks when "benchmark" appears in a card title', () => {
    const projection = makeCustomerProjection([
      { title: 'Benchmark commissioning', summary: 'Complete the Benchmark record.' },
    ]);
    const result = assessLibraryProjectionSafety(projection);
    expect(result.safeForCustomer).toBe(false);
    expect(result.leakageTerms).toContain('benchmark');
  });

  it('blocks when "fill pressure" appears in a card summary', () => {
    const projection = makeCustomerProjection([
      { title: 'System filling', summary: 'Set fill pressure to 1.0 bar before sealing.' },
    ]);
    const result = assessLibraryProjectionSafety(projection);
    expect(result.safeForCustomer).toBe(false);
    expect(result.leakageTerms).toContain('fill pressure');
  });

  it('blocks when "zone valve" appears in a card title', () => {
    const projection = makeCustomerProjection([
      { title: 'Zone valve selection', summary: 'Choose motorised zone valve type.' },
    ]);
    const result = assessLibraryProjectionSafety(projection);
    expect(result.safeForCustomer).toBe(false);
    expect(result.leakageTerms).toContain('zone valve');
  });

  it('blocks when "g3 mechanics" appears in a card summary', () => {
    const projection = makeCustomerProjection([
      { title: 'Safety devices', summary: 'G3 mechanics require a certified installer.' },
    ]);
    const result = assessLibraryProjectionSafety(projection);
    expect(result.safeForCustomer).toBe(false);
    expect(result.leakageTerms).toContain('g3 mechanics');
  });

  it('blocks when "mcs mechanics" appears in a card title', () => {
    const projection = makeCustomerProjection([
      { title: 'MCS mechanics explained', summary: 'Installer certification check.' },
    ]);
    const result = assessLibraryProjectionSafety(projection);
    expect(result.safeForCustomer).toBe(false);
    expect(result.leakageTerms).toContain('mcs mechanics');
  });

  it('blocks when a suppressed concept ID is present in a visible card', () => {
    const projection = makeCustomerProjection([
      {
        conceptId: 'MNT-02',
        title: 'Maintenance note',
        summary: 'Seasonal maintenance schedule.',
      },
    ]);
    const result = assessLibraryProjectionSafety(projection);
    expect(result.safeForCustomer).toBe(false);
    expect(result.blockingReasons.join(' ')).toMatch(/MNT-02/);
  });

  it('collects each distinct leakage term only once even if multiple cards contain it', () => {
    const projection = makeCustomerProjection([
      { title: 'Inhibitor dosing step 1', summary: 'First inhibitor dose.' },
      { title: 'Inhibitor dosing step 2', summary: 'Second inhibitor top-up.' },
    ]);
    const result = assessLibraryProjectionSafety(projection);
    expect(result.leakageTerms.filter((t) => t === 'inhibitor')).toHaveLength(1);
  });
});

// ─── Safe projection remains renderable ──────────────────────────────────────

describe('assessLibraryProjectionSafety — safe projection', () => {
  it('returns safeForCustomer=true for a clean customer projection', () => {
    const projection = makeCustomerProjection(makeSafeCards());
    const result = assessLibraryProjectionSafety(projection);
    expect(result.safeForCustomer).toBe(true);
    expect(result.blockingReasons).toHaveLength(0);
    expect(result.leakageTerms).toHaveLength(0);
  });

  it('produces no blocking reasons for a clean projection', () => {
    const projection = makeCustomerProjection(makeSafeCards());
    const result = assessLibraryProjectionSafety(projection);
    expect(result.blockingReasons).toHaveLength(0);
  });
});

// ─── Audit output is not blocked ─────────────────────────────────────────────

describe('assessLibraryProjectionSafety — audit audience', () => {
  it('never blocks the audit audience even when it contains forbidden terms', () => {
    const result = assessLibraryProjectionSafety(makeAuditProjection());
    expect(result.safeForCustomer).toBe(true);
    expect(result.blockingReasons).toHaveLength(0);
    expect(result.leakageTerms).toHaveLength(0);
  });

  it('returns empty warnings for the audit audience', () => {
    const result = assessLibraryProjectionSafety(makeAuditProjection());
    expect(result.warnings).toHaveLength(0);
  });
});

// ─── Portal falls back safely ─────────────────────────────────────────────────

describe('assessLibraryProjectionSafety — portal fallback integration', () => {
  it('indicates missing diagrams when projection has none', () => {
    const projection = makeCustomerProjection(makeSafeCards(), { visibleDiagrams: [] });
    const result = assessLibraryProjectionSafety(projection);
    expect(result.warnings.join(' ')).toMatch(/no diagrams/i);
    expect(result.missingRequiredContent).toContain('diagrams');
  });

  it('indicates missing "what you may notice" content when absent', () => {
    const projection = makeCustomerProjection([
      {
        title: 'Decision summary',
        summary: 'A sealed system is recommended.',
      },
    ]);
    const result = assessLibraryProjectionSafety(projection);
    expect(result.warnings.join(' ')).toMatch(/what you may notice/i);
    expect(result.missingRequiredContent).toContain('what_you_may_notice');
  });

  it('warns when the customer projection has too many cards', () => {
    const manyCards = Array.from({ length: 10 }, (_, i) => ({
      title: `Card ${i + 1}`,
      summary: `Summary for card ${i + 1} — what you may notice: nothing unusual.`,
    }));
    const projection = makeCustomerProjection(manyCards);
    const result = assessLibraryProjectionSafety(projection);
    expect(result.warnings.join(' ')).toMatch(/10 cards/i);
  });

  it('safeForCustomer is not affected by warnings alone', () => {
    // No diagrams, no calm summary, no "what you may notice" — but no leakage
    const projection = makeCustomerProjection([{ title: 'Welcome', summary: 'Overview.' }], {
      visibleDiagrams: [],
    });
    const result = assessLibraryProjectionSafety(projection);
    expect(result.safeForCustomer).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ─── Supporting PDF readiness reports blocked ─────────────────────────────────

describe('assessLibraryProjectionSafety — supporting PDF readiness', () => {
  it('missingRequiredContent is populated for each absent category', () => {
    const projection = makeCustomerProjection(
      [{ title: 'Overview', summary: 'Plain overview.' }],
      { visibleDiagrams: [] },
    );
    const result = assessLibraryProjectionSafety(projection);
    expect(result.missingRequiredContent).toContain('diagrams');
    expect(result.missingRequiredContent).toContain('what_you_may_notice');
  });
});
