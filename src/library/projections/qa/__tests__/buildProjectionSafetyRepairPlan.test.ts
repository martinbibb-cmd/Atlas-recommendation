import { describe, expect, it } from 'vitest';
import type { LibraryContentProjectionV1 } from '../../LibraryContentProjectionV1';
import type { OperationalDigestV1 } from '../../../../workflow/operationalDigest/OperationalDigestV1';
import { assessLibraryProjectionSafety } from '../assessLibraryProjectionSafety';
import { buildProjectionSafetyRepairPlan } from '../buildProjectionSafetyRepairPlan';

function makeProjection(
  cards: LibraryContentProjectionV1['visibleCards'],
  override?: Partial<LibraryContentProjectionV1>,
): LibraryContentProjectionV1 {
  return {
    audience: 'customer',
    visibleConcepts: cards.flatMap((card) => (card.conceptId != null ? [card.conceptId] : [])),
    visibleCards: cards,
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
    ...override,
  };
}

function makeDigest(): OperationalDigestV1 {
  return {
    digestVersion: 'v1',
    generatedAt: '2026-01-01T00:00:00Z',
    primaryItemLimit: 10,
    totalItems: 1,
    items: [
      {
        id: 'digest-1',
        title: 'Installer action',
        summary: 'Do installer action.',
        owner: 'surveyor',
        installPhase: 'installation',
        severity: 'blocker',
        linkedTaskIds: ['task-123'],
        evidenceRequired: [],
        unresolvedDependencies: [],
        locationState: 'unresolved',
        visibility: ['installer_only'],
      },
    ],
  };
}

describe('buildProjectionSafetyRepairPlan', () => {
  it('inhibitor leakage produces installer and compliance audit repairs', () => {
    const projection = makeProjection([
      {
        assetId: 'digest-1',
        conceptId: 'inhibitor_dosing',
        title: 'Inhibitor dosing requirements',
        summary: 'Inhibitor dose required.',
      },
    ]);
    const safety = assessLibraryProjectionSafety(projection);
    const plan = buildProjectionSafetyRepairPlan({
      projection,
      safety,
      operationalDigest: makeDigest(),
    });

    const visibilities = plan.suggestedAudienceChanges.map((item) => item.visibility);
    expect(visibilities).toContain('installer_only');
    expect(visibilities).toContain('compliance_audit');
    expect(plan.repairItems.some((item) => /installer and compliance audit/i.test(item.recommendation))).toBe(true);
  });

  it('g3 leakage produces office and compliance audit repairs', () => {
    const projection = makeProjection([
      {
        conceptId: 'g3_certification',
        title: 'G3 mechanics overview',
        summary: 'G3 mechanics require a certified installer.',
      },
    ]);
    const safety = assessLibraryProjectionSafety(projection);
    const plan = buildProjectionSafetyRepairPlan({ projection, safety });

    const visibilities = plan.suggestedAudienceChanges.map((item) => item.visibility);
    expect(visibilities).toContain('office_only');
    expect(visibilities).toContain('compliance_audit');
    expect(plan.repairItems.some((item) => /office and compliance audit/i.test(item.recommendation))).toBe(true);
  });

  it('missing diagrams produces a diagram coverage suggestion', () => {
    const projection = makeProjection(
      [
        {
          conceptId: 'sealed_system_conversion',
          title: 'Decision summary',
          summary: 'A sealed system is recommended.',
        },
        {
          conceptId: 'sealed_system_conversion',
          title: 'What you may notice',
          summary: 'What you may notice: stable pressure. What this means: normal operation.',
        },
      ],
      { visibleDiagrams: [] },
    );
    const safety = assessLibraryProjectionSafety(projection);
    const plan = buildProjectionSafetyRepairPlan({ projection, safety });

    expect(plan.repairItems.some((item) => /diagram coverage/i.test(item.recommendation))).toBe(true);
  });

  it('suggests replacement copy when customer projection leaks technical wording', () => {
    const projection = makeProjection([
      {
        conceptId: 'sealed_system_conversion',
        title: 'System fill pressure note',
        summary: 'Set fill pressure before use.',
      },
    ]);
    const safety = assessLibraryProjectionSafety(projection);
    const plan = buildProjectionSafetyRepairPlan({ projection, safety });

    expect(plan.suggestedReplacementCopy.length).toBeGreaterThan(0);
    expect(plan.suggestedReplacementCopy[0]?.replacementText).toMatch(/what you may notice:/i);
  });
});
