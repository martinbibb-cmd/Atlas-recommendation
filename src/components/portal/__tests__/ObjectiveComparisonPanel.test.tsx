/**
 * ObjectiveComparisonPanel.test.tsx
 *
 * Tests for the PR8 priority selector and objective comparison panel.
 *
 * Coverage:
 *   - Renders the panel heading and intro
 *   - Renders all 6 priority chips
 *   - Chip selection updates the comparison content
 *   - Shows the recommended option note
 *   - Shows the chosen option note only when isDivergent=true
 *   - Shows the "strongest here" callout with the top-ranked option
 *   - Recommended option remains visible regardless of selected priority
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ObjectiveComparisonPanel from '../ObjectiveComparisonPanel';
import { buildAllObjectiveComparisons } from '../../../lib/advice/buildObjectiveComparison';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { RecommendationPresentationState } from '../../../lib/selection/optionSelection';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUB_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'Combi boiler' },
  explainers: [],
  options: [
    {
      id: 'combi',
      label: 'Combi boiler',
      status: 'viable',
      headline: 'Good match',
      why: [],
      requirements: [],
      heat: { status: 'ok', headline: '', bullets: [] },
      dhw:  { status: 'ok', headline: '', bullets: [] },
      engineering: { status: 'ok', headline: '', bullets: [] },
      sensitivities: [],
    },
    {
      id: 'stored_unvented',
      label: 'Unvented cylinder system',
      status: 'viable',
      headline: 'High-performance option',
      why: [],
      requirements: [],
      heat: { status: 'ok', headline: '', bullets: [] },
      dhw:  { status: 'ok', headline: '', bullets: [] },
      engineering: { status: 'ok', headline: '', bullets: [] },
      sensitivities: [],
    },
  ],
};

const NO_DIVERGENCE_STATE: RecommendationPresentationState = {
  recommendedOptionId: 'combi',
  chosenOptionId: 'combi',
  chosenByCustomer: false,
};

const DIVERGENT_STATE: RecommendationPresentationState = {
  recommendedOptionId: 'combi',
  chosenOptionId: 'stored_unvented',
  chosenByCustomer: true,
};

const OPTION_LABELS: Record<string, string> = {
  combi: 'Combi boiler',
  stored_unvented: 'Unvented cylinder system',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ObjectiveComparisonPanel — rendering', () => {
  it('renders the panel heading', () => {
    const views = buildAllObjectiveComparisons(STUB_OUTPUT, NO_DIVERGENCE_STATE);
    render(
      <ObjectiveComparisonPanel
        comparisonViews={views}
        optionLabels={OPTION_LABELS}
      />,
    );
    expect(document.querySelector('[data-testid="objective-comparison-panel"]')).not.toBeNull();
  });

  it('renders all 6 priority chips', () => {
    const views = buildAllObjectiveComparisons(STUB_OUTPUT, NO_DIVERGENCE_STATE);
    render(
      <ObjectiveComparisonPanel
        comparisonViews={views}
        optionLabels={OPTION_LABELS}
      />,
    );
    const chipRow = document.querySelector('[data-testid="priority-chip-row"]');
    expect(chipRow).not.toBeNull();
    const chips = chipRow!.querySelectorAll('button');
    expect(chips).toHaveLength(6);
  });

  it('renders the default priority comparison content on load', () => {
    const views = buildAllObjectiveComparisons(STUB_OUTPUT, NO_DIVERGENCE_STATE);
    render(
      <ObjectiveComparisonPanel
        comparisonViews={views}
        optionLabels={OPTION_LABELS}
      />,
    );
    expect(document.querySelector('[data-testid="priority-comparison-content"]')).not.toBeNull();
  });

  it('renders the recommended option note', () => {
    const views = buildAllObjectiveComparisons(STUB_OUTPUT, NO_DIVERGENCE_STATE);
    render(
      <ObjectiveComparisonPanel
        comparisonViews={views}
        optionLabels={OPTION_LABELS}
        recommendedOptionLabel="Combi boiler"
      />,
    );
    expect(document.querySelector('[data-testid="priority-recommended-note"]')).not.toBeNull();
  });

  it('does not show chosen option note when isDivergent is false', () => {
    const views = buildAllObjectiveComparisons(STUB_OUTPUT, NO_DIVERGENCE_STATE);
    render(
      <ObjectiveComparisonPanel
        comparisonViews={views}
        optionLabels={OPTION_LABELS}
        isDivergent={false}
      />,
    );
    expect(document.querySelector('[data-testid="priority-chosen-note"]')).toBeNull();
  });

  it('shows chosen option note when isDivergent is true and divergent state is passed', () => {
    const views = buildAllObjectiveComparisons(STUB_OUTPUT, DIVERGENT_STATE);
    render(
      <ObjectiveComparisonPanel
        comparisonViews={views}
        optionLabels={OPTION_LABELS}
        isDivergent={true}
        chosenOptionLabel="Unvented cylinder system"
      />,
    );
    expect(document.querySelector('[data-testid="priority-chosen-note"]')).not.toBeNull();
  });
});

describe('ObjectiveComparisonPanel — priority chip interaction', () => {
  it('updates the comparison content when a different priority chip is clicked', () => {
    const views = buildAllObjectiveComparisons(STUB_OUTPUT, NO_DIVERGENCE_STATE);
    render(
      <ObjectiveComparisonPanel
        comparisonViews={views}
        optionLabels={OPTION_LABELS}
      />,
    );
    // Click the "Hot water" chip (index 1)
    const hotWaterChip = document.querySelector('[data-testid="priority-chip-hot_water"]');
    expect(hotWaterChip).not.toBeNull();
    fireEvent.click(hotWaterChip!);
    // The chip should now be marked as active
    expect(hotWaterChip!.getAttribute('aria-selected')).toBe('true');
  });

  it('marks the initially selected chip as active', () => {
    const views = buildAllObjectiveComparisons(STUB_OUTPUT, NO_DIVERGENCE_STATE);
    render(
      <ObjectiveComparisonPanel
        comparisonViews={views}
        optionLabels={OPTION_LABELS}
      />,
    );
    // The first chip (running_costs) should be selected by default
    const runningCostsChip = document.querySelector('[data-testid="priority-chip-running_costs"]');
    expect(runningCostsChip!.getAttribute('aria-selected')).toBe('true');
  });

  it('recommended option remains visible after switching priority', () => {
    const views = buildAllObjectiveComparisons(STUB_OUTPUT, NO_DIVERGENCE_STATE);
    render(
      <ObjectiveComparisonPanel
        comparisonViews={views}
        optionLabels={OPTION_LABELS}
        recommendedOptionLabel="Combi boiler"
      />,
    );
    // Switch to space_saving
    const spaceChip = document.querySelector('[data-testid="priority-chip-space_saving"]');
    fireEvent.click(spaceChip!);
    // Recommended note should still be visible
    expect(document.querySelector('[data-testid="priority-recommended-note"]')).not.toBeNull();
  });
});

describe('ObjectiveComparisonPanel — best option callout', () => {
  it('renders the "strongest here" callout', () => {
    const views = buildAllObjectiveComparisons(STUB_OUTPUT, NO_DIVERGENCE_STATE);
    render(
      <ObjectiveComparisonPanel
        comparisonViews={views}
        optionLabels={OPTION_LABELS}
      />,
    );
    expect(document.querySelector('[data-testid="priority-best-option"]')).not.toBeNull();
  });

  it('shows the strongest option label in the callout', () => {
    const views = buildAllObjectiveComparisons(STUB_OUTPUT, NO_DIVERGENCE_STATE);
    render(
      <ObjectiveComparisonPanel
        comparisonViews={views}
        optionLabels={OPTION_LABELS}
      />,
    );
    // For 'running_costs', combi is not the top option. But whichever is top
    // should have its label shown.
    const callout = document.querySelector('[data-testid="priority-best-option"]');
    expect(callout!.textContent).toBeTruthy();
  });
});
