import { describe, expect, it } from 'vitest';
import type { CalmWelcomePackViewModelV1 } from '../../packRenderer/CalmWelcomePackViewModelV1';
import type { OperationalDigestV1 } from '../../../workflow/operationalDigest/OperationalDigestV1';
import type { EducationalContentV1 } from '../../content/EducationalContentV1';
import { buildLibraryAudienceProjection } from '../buildLibraryAudienceProjection';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function makeViewModel(overrideCards?: CalmWelcomePackViewModelV1['customerFacingSections']): CalmWelcomePackViewModelV1 {
  return {
    packId: 'test-pack',
    recommendedScenarioId: 'scenario-1',
    title: 'Your recommendation',
    generatedAt: '2026-01-01T00:00:00Z',
    customerFacingSections: overrideCards ?? [
      {
        sectionId: 'what_changes',
        title: 'What changes',
        cards: [
          {
            conceptId: 'sealed_system_conversion',
            title: 'Open-vented to sealed conversion',
            summary: 'Conversion replaces tank-fed operation with a sealed circuit.',
          },
          {
            conceptId: 'pressure_vs_storage',
            title: 'Pressure vs storage',
            summary: 'Pressure and stored volume are independent system dimensions.',
          },
          {
            conceptId: 'MNT-02',
            title: 'Inhibitor dosing requirements',
            summary: 'Inhibitor dosing must be confirmed before commissioning.',
          },
          {
            conceptId: 'g3_certification',
            title: 'G3 qualification check',
            summary: 'G3 installer certification must be verified before unvented work.',
          },
        ],
      },
    ],
    qrDestinations: [],
    internalOmissionLog: [],
    pageEstimate: { usedPages: 2, maxPages: 7 },
    readiness: { safeForCustomer: true, blockingReasons: [] },
  };
}

function makeDigest(): OperationalDigestV1 {
  return {
    digestVersion: 'v1',
    generatedAt: '2026-01-01T00:00:00Z',
    primaryItemLimit: 12,
    totalItems: 4,
    items: [
      {
        id: 'survey_task_001',
        title: 'Measure pipe bore at boiler location',
        summary: 'Record bore size to confirm sizing adequacy.',
        owner: 'surveyor',
        installPhase: 'survey',
        severity: 'important',
        linkedTaskIds: ['task_001'],
        evidenceRequired: [],
        unresolvedDependencies: [],
        locationState: 'needs_survey',
        visibility: ['installer_only'],
      },
      {
        id: 'coord_task_001',
        title: 'Confirm G3-qualified installer availability',
        summary: 'G3 qualification required before unvented work begins.',
        owner: 'office',
        installPhase: 'coordination',
        severity: 'blocker',
        linkedTaskIds: ['task_002'],
        evidenceRequired: [],
        unresolvedDependencies: [],
        locationState: 'confirmed',
        visibility: ['office_only'],
      },
      {
        id: 'install_task_001',
        title: 'Commission cylinder — check expansion vessel pre-charge',
        summary: 'Verify expansion vessel pre-charge pressure before filling.',
        owner: 'surveyor',
        installPhase: 'installation',
        severity: 'blocker',
        linkedTaskIds: ['task_003'],
        evidenceRequired: [],
        unresolvedDependencies: [],
        locationState: 'unresolved',
        visibility: ['installer_only'],
      },
      {
        id: 'audit_task_001',
        title: 'BS7593 compliance check',
        summary: 'Water treatment compliance record under BS7593.',
        owner: 'office',
        installPhase: 'coordination',
        severity: 'important',
        linkedTaskIds: ['task_004'],
        evidenceRequired: [],
        unresolvedDependencies: [],
        locationState: 'confirmed',
        visibility: ['compliance_audit'],
      },
    ],
  };
}

function makeEducationalContent(): EducationalContentV1[] {
  return [
    {
      contentId: 'EC-001',
      conceptId: 'sealed_system_conversion',
      title: 'Open-vented to sealed conversion',
      plainEnglishSummary: 'What changes during a sealed conversion.',
      customerExplanation: 'What you may notice: a pressure gauge near the boiler. What this means: the system is sealed.',
      analogyOptions: [],
      commonMisunderstanding: 'Conversion is only cosmetic.',
      dangerousOversimplification: 'Convert without commissioning checks.',
      printSummary: 'Sealed conversion overview.',
      readingLevel: 'standard',
      accessibilityNotes: [],
      requiredEvidenceFacts: [],
      confidenceLevel: 'standards_based',
    },
    {
      contentId: 'EC-002',
      conceptId: 'MNT-02',
      title: 'Inhibitor dosing',
      plainEnglishSummary: 'Why inhibitor dosing matters.',
      customerExplanation: 'Inhibitor protects the system.',
      analogyOptions: [],
      commonMisunderstanding: 'Inhibitor is optional.',
      dangerousOversimplification: 'Skip inhibitor treatment.',
      printSummary: 'Inhibitor dosing summary.',
      readingLevel: 'technical',
      accessibilityNotes: [],
      requiredEvidenceFacts: [],
      confidenceLevel: 'standards_based',
    },
  ];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildLibraryAudienceProjection', () => {
  it('customer projection excludes inhibitor and G3 mechanics', () => {
    const projection = buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest: makeDigest(),
      educationalContent: makeEducationalContent(),
      audience: 'customer',
    });

    const cardTitles = projection.visibleCards.map((c) => c.title);
    expect(cardTitles).not.toContain('Inhibitor dosing requirements');
    expect(cardTitles).not.toContain('G3 qualification check');
    expect(cardTitles).toContain('Open-vented to sealed conversion');
    expect(cardTitles).toContain('Pressure vs storage');

    const hiddenTitles = projection.hiddenReasonLog.map((r) => r.title);
    expect(hiddenTitles).toContain('Inhibitor dosing requirements');
    expect(hiddenTitles).toContain('G3 qualification check');
  });

  it('customer projection does not include operational digest items', () => {
    const projection = buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest: makeDigest(),
      educationalContent: makeEducationalContent(),
      audience: 'customer',
    });

    const cardIds = projection.visibleCards.map((c) => c.conceptId);
    expect(cardIds).not.toContain('survey_task_001');
    expect(cardIds).not.toContain('install_task_001');
  });

  it('engineer projection includes commissioning/check items from installation phase', () => {
    const projection = buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest: makeDigest(),
      educationalContent: makeEducationalContent(),
      audience: 'engineer',
    });

    const cardTitles = projection.visibleCards.map((c) => c.title);
    expect(cardTitles).toContain('Commission cylinder — check expansion vessel pre-charge');
  });

  it('engineer projection shows all view-model cards without customer suppression', () => {
    const projection = buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest: makeDigest(),
      educationalContent: makeEducationalContent(),
      audience: 'engineer',
    });

    const cardTitles = projection.visibleCards.map((c) => c.title);
    expect(cardTitles).toContain('Inhibitor dosing requirements');
    expect(cardTitles).toContain('G3 qualification check');
    expect(projection.hiddenReasonLog).toHaveLength(0);
  });

  it('office projection includes qualification requirements from coordination phase', () => {
    const projection = buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest: makeDigest(),
      educationalContent: makeEducationalContent(),
      audience: 'office',
    });

    const cardTitles = projection.visibleCards.map((c) => c.title);
    expect(cardTitles).toContain('Confirm G3-qualified installer availability');
  });

  it('office projection excludes inhibitor/G3 view-model cards from customer section', () => {
    const projection = buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest: makeDigest(),
      educationalContent: makeEducationalContent(),
      audience: 'office',
    });

    const cardTitles = projection.visibleCards.map((c) => c.title);
    expect(cardTitles).not.toContain('Inhibitor dosing requirements');
    expect(cardTitles).not.toContain('G3 qualification check');
  });

  it('surveyor projection includes survey-phase items', () => {
    const projection = buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest: makeDigest(),
      educationalContent: makeEducationalContent(),
      audience: 'surveyor',
    });

    const cardTitles = projection.visibleCards.map((c) => c.title);
    expect(cardTitles).toContain('Measure pipe bore at boiler location');
  });

  it('audit projection preserves all linked IDs from digest items', () => {
    const projection = buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest: makeDigest(),
      educationalContent: makeEducationalContent(),
      audience: 'audit',
    });

    const auditConceptIds = projection.auditTrace.flatMap((entry) => entry.linkedConceptIds);

    // All digest item IDs should be traceable
    expect(auditConceptIds).toContain('survey_task_001');
    expect(auditConceptIds).toContain('coord_task_001');
    expect(auditConceptIds).toContain('install_task_001');
    expect(auditConceptIds).toContain('audit_task_001');

    // All linked task IDs from digest items should be in the trace
    expect(auditConceptIds).toContain('task_001');
    expect(auditConceptIds).toContain('task_002');
    expect(auditConceptIds).toContain('task_003');
    expect(auditConceptIds).toContain('task_004');
  });

  it('audit projection includes all view-model cards and all digest items', () => {
    const projection = buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest: makeDigest(),
      educationalContent: makeEducationalContent(),
      audience: 'audit',
    });

    // All 4 view-model cards visible (no suppression for audit)
    expect(projection.visibleCards.length).toBeGreaterThanOrEqual(4);
    expect(projection.hiddenReasonLog).toHaveLength(0);

    // All 4 digest items included as cards
    const cardTitles = projection.visibleCards.map((c) => c.title);
    expect(cardTitles).toContain('Measure pipe bore at boiler location');
    expect(cardTitles).toContain('Confirm G3-qualified installer availability');
    expect(cardTitles).toContain('Commission cylinder — check expansion vessel pre-charge');
    expect(cardTitles).toContain('BS7593 compliance check');
  });

  it('no projection mutates the canonical calmViewModel', () => {
    const calmViewModel = makeViewModel();
    const originalSectionsLength = calmViewModel.customerFacingSections.length;
    const originalCardsLength = calmViewModel.customerFacingSections[0]!.cards.length;

    buildLibraryAudienceProjection({
      calmViewModel,
      operationalDigest: makeDigest(),
      educationalContent: makeEducationalContent(),
      audience: 'customer',
    });

    expect(calmViewModel.customerFacingSections.length).toBe(originalSectionsLength);
    expect(calmViewModel.customerFacingSections[0]!.cards.length).toBe(originalCardsLength);
  });

  it('no projection mutates the canonical operationalDigest', () => {
    const operationalDigest = makeDigest();
    const originalItemCount = operationalDigest.items.length;

    buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest,
      educationalContent: makeEducationalContent(),
      audience: 'engineer',
    });

    expect(operationalDigest.items.length).toBe(originalItemCount);
  });

  it('no projection mutates the canonical educationalContent', () => {
    const educationalContent = makeEducationalContent();
    const originalLength = educationalContent.length;

    buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest: makeDigest(),
      educationalContent,
      audience: 'audit',
    });

    expect(educationalContent.length).toBe(originalLength);
  });

  it('visibleConcepts contains only concept IDs from visible cards', () => {
    const projection = buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest: makeDigest(),
      educationalContent: makeEducationalContent(),
      audience: 'customer',
    });

    expect(projection.visibleConcepts).toContain('sealed_system_conversion');
    expect(projection.visibleConcepts).toContain('pressure_vs_storage');
    expect(projection.visibleConcepts).not.toContain('MNT-02');
    expect(projection.visibleConcepts).not.toContain('g3_certification');
  });

  it('auditTrace covers all items considered (visible + hidden)', () => {
    const projection = buildLibraryAudienceProjection({
      calmViewModel: makeViewModel(),
      operationalDigest: makeDigest(),
      educationalContent: makeEducationalContent(),
      audience: 'customer',
    });

    // 4 view-model cards → should all appear in the audit trace
    expect(projection.auditTrace.length).toBe(4);
    const decisions = projection.auditTrace.map((e) => e.decision);
    expect(decisions).toContain('visible');
    expect(decisions).toContain('hidden');
  });
});
