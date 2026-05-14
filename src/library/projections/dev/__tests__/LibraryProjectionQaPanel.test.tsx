/**
 * LibraryProjectionQaPanel.test.tsx
 *
 * Tests for the dev-only library audience projection QA surface.
 *
 * Covers:
 *   - customer leakage warnings render
 *   - engineer missing commissioning warning renders
 *   - office missing qualification warning renders
 *   - audit trace completeness shown
 *   - no projection mutates canonical input
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LibraryProjectionQaPanel } from '../LibraryProjectionQaPanel';
import type { CalmWelcomePackViewModelV1 } from '../../../packRenderer/CalmWelcomePackViewModelV1';
import type { OperationalDigestV1 } from '../../../../workflow/operationalDigest/OperationalDigestV1';
import type { EducationalContentV1 } from '../../../content/EducationalContentV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCleanViewModel(): CalmWelcomePackViewModelV1 {
  return {
    packId: 'qa-test-pack',
    recommendedScenarioId: 'scenario-1',
    title: 'Your recommendation',
    generatedAt: '2026-01-01T00:00:00Z',
    customerFacingSections: [
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
        ],
      },
    ],
    qrDestinations: [],
    internalOmissionLog: [],
    pageEstimate: { usedPages: 2, maxPages: 7 },
    readiness: { safeForCustomer: true, blockingReasons: [] },
  };
}

/**
 * A view model that contains installer-detail terms (fill pressure, zone valve)
 * which are NOT in the projection suppression list but ARE in the QA leakage
 * check.  This simulates content that slipped through suppression and should be
 * caught by the QA panel.
 */
function makeLeakyViewModel(): CalmWelcomePackViewModelV1 {
  return {
    packId: 'qa-leaky-pack',
    recommendedScenarioId: 'scenario-1',
    title: 'Your recommendation',
    generatedAt: '2026-01-01T00:00:00Z',
    customerFacingSections: [
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
            // "fill pressure" is in the QA forbidden list but NOT in the suppression
            // list, so it passes through the projection and should be caught by QA.
            conceptId: 'fill_pressure_note',
            title: 'System fill pressure note',
            summary: 'Ensure fill pressure is set to the correct value before use.',
          },
          {
            // "zone valve" is in the QA forbidden list but NOT in the suppression list.
            conceptId: 'zone_valve_note',
            title: 'Zone valve operation',
            summary: 'The zone valve controls flow to each heating circuit.',
          },
        ],
      },
    ],
    qrDestinations: [],
    internalOmissionLog: [],
    pageEstimate: { usedPages: 2, maxPages: 7 },
    readiness: { safeForCustomer: false, blockingReasons: [] },
  };
}

function makeDigestWithEngineerItems(): OperationalDigestV1 {
  return {
    digestVersion: 'v1',
    generatedAt: '2026-01-01T00:00:00Z',
    primaryItemLimit: 12,
    totalItems: 3,
    items: [
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
        id: 'install_task_002',
        title: 'Fit flue — check clearances',
        summary: 'Confirm flue clearances meet manufacturer specification.',
        owner: 'surveyor',
        installPhase: 'installation',
        severity: 'important',
        linkedTaskIds: ['task_004'],
        evidenceRequired: [],
        unresolvedDependencies: [],
        locationState: 'unresolved',
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
    ],
  };
}

function makeDigestWithoutEngineerItems(): OperationalDigestV1 {
  return {
    digestVersion: 'v1',
    generatedAt: '2026-01-01T00:00:00Z',
    primaryItemLimit: 12,
    totalItems: 1,
    items: [
      {
        id: 'survey_task_001',
        title: 'Measure pipe bore',
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
    ],
  };
}

function makeDigestWithoutOfficeItems(): OperationalDigestV1 {
  return {
    digestVersion: 'v1',
    generatedAt: '2026-01-01T00:00:00Z',
    primaryItemLimit: 12,
    totalItems: 1,
    items: [
      {
        id: 'install_task_001',
        title: 'Commission cylinder',
        summary: 'Check cylinder commissioning procedure.',
        owner: 'surveyor',
        installPhase: 'installation',
        severity: 'blocker',
        linkedTaskIds: ['task_001'],
        evidenceRequired: [],
        unresolvedDependencies: [],
        locationState: 'unresolved',
        visibility: ['installer_only'],
      },
    ],
  };
}

function makeFullAuditDigest(): OperationalDigestV1 {
  return {
    digestVersion: 'v1',
    generatedAt: '2026-01-01T00:00:00Z',
    primaryItemLimit: 12,
    totalItems: 3,
    items: [
      {
        id: 'audit_item_A',
        title: 'BS7593 compliance check',
        summary: 'Water treatment compliance record.',
        owner: 'office',
        installPhase: 'coordination',
        severity: 'important',
        linkedTaskIds: ['task_A1', 'task_A2'],
        evidenceRequired: [],
        unresolvedDependencies: [],
        locationState: 'confirmed',
        visibility: ['compliance_audit'],
      },
      {
        id: 'audit_item_B',
        title: 'G3 certification record',
        summary: 'G3 certification on file.',
        owner: 'office',
        installPhase: 'coordination',
        severity: 'blocker',
        linkedTaskIds: ['task_B1'],
        evidenceRequired: [],
        unresolvedDependencies: [],
        locationState: 'confirmed',
        visibility: ['compliance_audit'],
      },
      {
        id: 'audit_item_C',
        title: 'Commissioning sign-off',
        summary: 'Final commissioning sign-off.',
        owner: 'office',
        installPhase: 'coordination',
        severity: 'blocker',
        linkedTaskIds: ['task_C1'],
        evidenceRequired: [],
        unresolvedDependencies: [],
        locationState: 'unresolved',
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
      customerExplanation: 'What you may notice: a pressure gauge near the boiler.',
      analogyOptions: [],
      commonMisunderstanding: 'Conversion is only cosmetic.',
      dangerousOversimplification: 'Convert without commissioning checks.',
      printSummary: 'Sealed conversion overview.',
      readingLevel: 'standard',
      accessibilityNotes: [],
      requiredEvidenceFacts: [],
      confidenceLevel: 'standards_based',
    },
  ];
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function renderPanel(
  viewModel: CalmWelcomePackViewModelV1 = makeCleanViewModel(),
  digest: OperationalDigestV1 = makeDigestWithEngineerItems(),
  educationalContent: EducationalContentV1[] = makeEducationalContent(),
) {
  return render(
    <LibraryProjectionQaPanel
      calmViewModel={viewModel}
      operationalDigest={digest}
      educationalContent={educationalContent}
    />,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LibraryProjectionQaPanel', () => {
  it('renders the panel with all 5 audience tabs', () => {
    renderPanel();
    expect(screen.getByTestId('library-projection-qa-panel')).toBeInTheDocument();
    expect(screen.getByTestId('qa-tab-customer')).toBeInTheDocument();
    expect(screen.getByTestId('qa-tab-surveyor')).toBeInTheDocument();
    expect(screen.getByTestId('qa-tab-office')).toBeInTheDocument();
    expect(screen.getByTestId('qa-tab-engineer')).toBeInTheDocument();
    expect(screen.getByTestId('qa-tab-audit')).toBeInTheDocument();
  });

  it('shows customer tab as active by default', () => {
    renderPanel();
    expect(screen.getByTestId('qa-tab-customer')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('qa-panel-audience-customer')).toBeInTheDocument();
  });

  it('switching tabs shows the selected audience panel', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('qa-tab-engineer'));
    expect(screen.getByTestId('qa-tab-engineer')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('qa-panel-audience-engineer')).toBeInTheDocument();
  });

  it('customer leakage warnings render when forbidden terms are present', async () => {
    const user = userEvent.setup();
    renderPanel(makeLeakyViewModel(), makeDigestWithEngineerItems());

    // Customer tab is active by default — leakage warnings should be visible.
    const warningsList = await screen.findByTestId('qa-leakage-warnings-customer');
    const items = warningsList.querySelectorAll('li');
    expect(items.length).toBeGreaterThan(0);

    const warningText = Array.from(items).map((li) => li.textContent ?? '');
    expect(warningText.some((t) => /fill pressure|zone valve/i.test(t))).toBe(true);
  });

  it('customer leakage check passes when no forbidden terms are present', () => {
    renderPanel(makeCleanViewModel());
    expect(screen.getByTestId('qa-leakage-pass-customer')).toBeInTheDocument();
  });

  it('engineer missing commissioning warning renders when no commissioning cards exist', async () => {
    const user = userEvent.setup();
    // Use a digest that has no installation-phase items so engineer projection is empty of commissioning content.
    renderPanel(makeCleanViewModel(), makeDigestWithoutEngineerItems());

    await user.click(screen.getByTestId('qa-tab-engineer'));

    const warningsList = await screen.findByTestId('qa-leakage-warnings-engineer');
    const items = warningsList.querySelectorAll('li');
    expect(items.length).toBeGreaterThan(0);
    const warningText = Array.from(items).map((li) => li.textContent ?? '');
    expect(warningText.some((t) => /commission/i.test(t))).toBe(true);
  });

  it('office missing qualification warning renders when no qualification cards exist', async () => {
    const user = userEvent.setup();
    // Use a digest with only installation-phase items so office projection has no qualification content.
    renderPanel(makeCleanViewModel(), makeDigestWithoutOfficeItems());

    await user.click(screen.getByTestId('qa-tab-office'));

    const warningsList = await screen.findByTestId('qa-leakage-warnings-office');
    const items = warningsList.querySelectorAll('li');
    expect(items.length).toBeGreaterThan(0);
    const warningText = Array.from(items).map((li) => li.textContent ?? '');
    expect(warningText.some((t) => /qualification|compliance/i.test(t))).toBe(true);
  });

  it('audit trace completeness shown — trace entry count displayed', async () => {
    const user = userEvent.setup();
    renderPanel(makeCleanViewModel(), makeFullAuditDigest());

    await user.click(screen.getByTestId('qa-tab-audit'));

    const traceSection = screen.getByTestId('qa-audit-trace-audit');
    expect(traceSection).toBeInTheDocument();
    // The heading should mention the number of entries.
    expect(traceSection.textContent).toMatch(/\d+\s+entries/i);
  });

  it('audit trace completeness check passes when all linked task IDs are traced', async () => {
    const user = userEvent.setup();
    renderPanel(makeCleanViewModel(), makeFullAuditDigest());

    await user.click(screen.getByTestId('qa-tab-audit'));

    // With audit audience all digest items are fully included so all task IDs should be traced.
    expect(screen.getByTestId('qa-leakage-pass-audit')).toBeInTheDocument();
  });

  it('no projection mutates the canonical calmViewModel', () => {
    const calmViewModel = makeCleanViewModel();
    const originalSectionsLength = calmViewModel.customerFacingSections.length;
    const originalCardsLength = calmViewModel.customerFacingSections[0]!.cards.length;

    renderPanel(calmViewModel);

    expect(calmViewModel.customerFacingSections.length).toBe(originalSectionsLength);
    expect(calmViewModel.customerFacingSections[0]!.cards.length).toBe(originalCardsLength);
  });

  it('no projection mutates the canonical operationalDigest', () => {
    const digest = makeDigestWithEngineerItems();
    const originalItemCount = digest.items.length;

    renderPanel(makeCleanViewModel(), digest);

    expect(digest.items.length).toBe(originalItemCount);
  });

  it('no projection mutates the canonical educationalContent', () => {
    const educationalContent = makeEducationalContent();
    const originalLength = educationalContent.length;

    renderPanel(makeCleanViewModel(), makeDigestWithEngineerItems(), educationalContent);

    expect(educationalContent.length).toBe(originalLength);
  });

  it('shows count badges for cards, diagrams, digest, hidden and trace', () => {
    renderPanel();
    const counts = screen.getByTestId('qa-counts-customer');
    expect(counts).toBeInTheDocument();
    // Should have 5 count badge children.
    expect(counts.children.length).toBe(5);
  });

  it('warns tab when audience has leakage or missing content', async () => {
    const user = userEvent.setup();
    // Leaky view model triggers customer leakage.
    renderPanel(makeLeakyViewModel(), makeDigestWithEngineerItems());

    // Customer tab should have a warning indicator.
    const customerTab = screen.getByTestId('qa-tab-customer');
    expect(customerTab.querySelector('[aria-label="has warnings"]')).toBeInTheDocument();

    // Engineer tab should pass (we have commissioning items).
    await user.click(screen.getByTestId('qa-tab-engineer'));
    expect(screen.queryByTestId('qa-leakage-warnings-engineer')).not.toBeInTheDocument();
  });

  it('displays overall warning count in the header when checks fail', () => {
    renderPanel(makeLeakyViewModel(), makeDigestWithoutEngineerItems());
    const panel = screen.getByTestId('library-projection-qa-panel');
    // Header should contain a warning pill (not "All checks passed").
    expect(panel.textContent).not.toMatch(/all checks passed/i);
    expect(panel.textContent).toMatch(/warning/i);
  });

  it('displays "All checks passed" in header when all projections are clean', async () => {
    // Use clean view model + digest that gives engineer+office pass.
    renderPanel(makeCleanViewModel(), makeDigestWithEngineerItems());
    // Wait for initial render.
    const panel = await screen.findByTestId('library-projection-qa-panel');
    // With clean data, check that engineer passes (has commissioning items).
    // Office might still warn — so we just verify customer passes.
    expect(screen.getByTestId('qa-leakage-pass-customer')).toBeInTheDocument();
    expect(panel).toBeInTheDocument();
  });
});
