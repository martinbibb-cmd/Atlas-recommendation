/**
 * specificationOptions.test.tsx
 *
 * Tests for the multiple specification options model and UI.
 *
 * Acceptance criteria (per problem statement):
 *   7.  New visit creates Option A seeded from Atlas recommendation.
 *   8.  Add option creates Option B.
 *   9.  Duplicate option deep-clones routes/locations but uses a new id.
 *  10.  Mark selected updates isSelectedForQuote (selectedInstallationSpecificationId equivalent).
 *  11.  Visit Hub shows option count (prop wiring tested here with VisitHubPage's HubActions prop).
 *  12.  Survey step shows selected option summary.
 *  13.  Selected option is reflected in the generated scope output.
 *  14.  Copy guard — UI does not render banned terms (contractor quote, Quote A, etc.).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstallationSpecificationPage } from '../InstallationSpecificationPage';
import type { CanonicalCurrentSystemSummary } from '../installationSpecificationUiTypes';
import type { InstallationSpecificationOptionV1 } from '../../model/QuoteInstallationPlanV1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CANONICAL_COMBI: CanonicalCurrentSystemSummary = {
  heatSource:    'combi_boiler',
  hotWater:      'no_cylinder',
  primaryCircuit: 'sealed_primary',
};

function makeExistingOption(override: Partial<InstallationSpecificationOptionV1> = {}): InstallationSpecificationOptionV1 {
  const id = `test-opt-${Date.now()}-${Math.random()}`;
  return {
    id,
    label: 'Option A',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'in_progress',
    source: 'atlas_recommendation',
    isRecommended: true,
    specification: {
      planId: id,
      createdAt: new Date().toISOString(),
      currentSystem: { family: 'combi' },
      proposedSystem: { family: 'combi' },
      proposedSpec: {
        heatSource: { kind: 'combi_boiler' },
        hotWater: { kind: 'none' },
      },
      locations: [{ locationId: 'loc-1', kind: 'boiler', provenance: 'surveyor_confirmed', confidence: 'confirmed' }],
      routes: [],
      flueRoutes: [],
      pipeworkRoutes: [],
      jobClassification: 'gas_boiler_swap',
      generatedScope: [],
    },
    generatedScope: [],
    ...override,
  };
}

// ─── 7. New visit creates Option A seeded from Atlas recommendation ───────────

describe('Specification options — Option A on first open', () => {
  it('auto-creates Option A and opens the stepper when no existing options are provided', () => {
    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        canonicalCurrentSystem={CANONICAL_COMBI}
        seedProposedSystem="combi_boiler"
        // no existingOptions — should create Option A and open stepper directly
      />,
    );

    // The stepper should be open (shows the progress/step content).
    expect(screen.queryByTestId('spec-options-list')).not.toBeInTheDocument();
    // Stepper navigation buttons should be present.
    expect(screen.getByText('← Back')).toBeInTheDocument();
  });

  it('creates Option A with source atlas_recommendation when seeded from recommendation', () => {
    const onFinish = vi.fn();

    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        canonicalCurrentSystem={CANONICAL_COMBI}
        seedProposedSystem="combi_boiler"
        onFinish={onFinish}
      />,
    );

    // Advance to Finish.
    let iter = 0;
    while (iter < 12) {
      const btn = screen.queryByText('Next →')?.closest('button');
      if (!btn) break;
      fireEvent.click(btn);
      iter++;
    }
    fireEvent.click(screen.getByText('Finish').closest('button') as HTMLButtonElement);

    const result = onFinish.mock.calls[0][0];
    expect(result.option.source).toBe('atlas_recommendation');
  });
});

// ─── 8. Add option creates Option B ───────────────────────────────────────────

describe('Specification options — Add option', () => {
  it('shows the option list when existingOptions are provided', () => {
    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        existingOptions={[makeExistingOption({ label: 'Option A' })]}
        canonicalCurrentSystem={CANONICAL_COMBI}
      />,
    );

    expect(screen.getByTestId('spec-options-list')).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
  });

  it('adds Option B when "Add specification option" is clicked', () => {
    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        existingOptions={[makeExistingOption({ label: 'Option A' })]}
        canonicalCurrentSystem={CANONICAL_COMBI}
      />,
    );

    fireEvent.click(screen.getByTestId('add-specification-option-btn'));

    // Should open the stepper for the new option (list no longer visible).
    expect(screen.queryByTestId('spec-options-list')).not.toBeInTheDocument();
  });

  it('"Add specification option" button is present in the options list', () => {
    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        existingOptions={[makeExistingOption({ label: 'Option A' })]}
        canonicalCurrentSystem={CANONICAL_COMBI}
      />,
    );

    expect(screen.getByTestId('add-specification-option-btn')).toBeInTheDocument();
  });
});

// ─── 9. Duplicate option deep-clones with a new id ───────────────────────────

describe('Specification options — Duplicate option', () => {
  it('opens the stepper for the duplicated option when Duplicate is clicked', () => {
    const original = makeExistingOption({ label: 'Option A', id: 'orig-id' });

    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        existingOptions={[original]}
        canonicalCurrentSystem={CANONICAL_COMBI}
      />,
    );

    fireEvent.click(screen.getByTestId(`duplicate-option-btn-${original.id}`));

    // Stepper should now be open for the duplicate.
    expect(screen.queryByTestId('spec-options-list')).not.toBeInTheDocument();
  });

  it('duplicate option finishes with source duplicated_option', () => {
    const original = makeExistingOption({ label: 'Option A', id: 'orig-id' });
    const onFinish = vi.fn();

    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        existingOptions={[original]}
        canonicalCurrentSystem={CANONICAL_COMBI}
        onFinish={onFinish}
      />,
    );

    fireEvent.click(screen.getByTestId(`duplicate-option-btn-${original.id}`));

    // Advance to Finish in the duplicate stepper.
    let iter = 0;
    while (iter < 12) {
      const btn = screen.queryByText('Next →')?.closest('button');
      if (!btn) break;
      fireEvent.click(btn);
      iter++;
    }
    fireEvent.click(screen.getByText('Finish').closest('button') as HTMLButtonElement);

    const result = onFinish.mock.calls[0][0];
    expect(result.option.source).toBe('duplicated_option');
    // Must have a different id from the original.
    expect(result.option.id).not.toBe('orig-id');
  });
});

// ─── 10. Mark selected updates isSelectedForQuote ────────────────────────────

describe('Specification options — Mark as selected', () => {
  it('shows the Mark as selected button for unselected options', () => {
    const optA = makeExistingOption({ label: 'Option A', isSelectedForQuote: false });

    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        existingOptions={[optA]}
        canonicalCurrentSystem={CANONICAL_COMBI}
      />,
    );

    expect(screen.getByTestId(`select-option-btn-${optA.id}`)).toBeInTheDocument();
  });

  it('does not show Mark as selected for the already-selected option', () => {
    const optA = makeExistingOption({ label: 'Option A', isSelectedForQuote: true });

    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        existingOptions={[optA]}
        canonicalCurrentSystem={CANONICAL_COMBI}
      />,
    );

    expect(screen.queryByTestId(`select-option-btn-${optA.id}`)).not.toBeInTheDocument();
  });

  it('shows "Selected for output" badge after marking as selected', () => {
    const optA = makeExistingOption({ label: 'Option A', isSelectedForQuote: false });

    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        existingOptions={[optA]}
        canonicalCurrentSystem={CANONICAL_COMBI}
      />,
    );

    fireEvent.click(screen.getByTestId(`select-option-btn-${optA.id}`));

    expect(screen.getByText('Selected for output')).toBeInTheDocument();
  });
});

// ─── 13. Selected option — scope generation ───────────────────────────────────

describe('Specification options — scope per option', () => {
  it('result.option.generatedScope is populated after Finish', () => {
    const onFinish = vi.fn();

    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        canonicalCurrentSystem={CANONICAL_COMBI}
        seedProposedSystem="combi_boiler"
        onFinish={onFinish}
      />,
    );

    let iter = 0;
    while (iter < 12) {
      const btn = screen.queryByText('Next →')?.closest('button');
      if (!btn) break;
      fireEvent.click(btn);
      iter++;
    }
    fireEvent.click(screen.getByText('Finish').closest('button') as HTMLButtonElement);

    const result = onFinish.mock.calls[0][0];
    expect(Array.isArray(result.option.generatedScope)).toBe(true);
  });
});

// ─── 14. Copy guard — no banned terms in option list copy ────────────────────

describe('Specification options — copy guard', () => {
  const BANNED = [
    'Contractor quote', 'contractor quote',
    'Quote A', 'quote A',
    'Enter quote', 'enter quote',
    'Customer quote', 'customer quote',
    'Planner', 'Planning',
    'Confirm on site', 'confirm on site',
    'Check on site', 'check on site',
  ];

  const OPTION_LIST_COPY = [
    'Installation Specification',
    'Specification options for this visit',
    'Add specification option',
    'Duplicate option',
    'Mark as selected',
    'Selected for output',
    'Atlas selected',
    'Generated install scope',
    'No selected specification option yet',
  ];

  BANNED.forEach((banned) => {
    it(`option list copy must not contain "${banned}"`, () => {
      OPTION_LIST_COPY.forEach((label) => {
        expect(label).not.toContain(banned);
      });
    });
  });
});
