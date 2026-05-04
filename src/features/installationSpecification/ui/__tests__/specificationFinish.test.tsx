/**
 * specificationFinish.test.tsx
 *
 * Tests for the Installation Specification Finish action.
 *
 * Acceptance criteria (per problem statement):
 *   1.  Finish calls onSave with the latest option.
 *   2.  Finish calls onFinish.
 *   3.  Finish returns to Visit Hub when opened from Visit Hub (onFinish called,
 *       caller is responsible for navigation — tested via callback assertion).
 *   4.  Finish returns to survey step when opened from survey step (same pattern).
 *   5.  Finish has a fallback and is never a no-op (falls back to onBack when no onFinish).
 *   6.  Generated scope is saved on finish (result.generatedScope is not undefined).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstallationSpecificationStepper } from '../InstallationSpecificationStepper';
import { InstallationSpecificationPage } from '../InstallationSpecificationPage';
import type { CanonicalCurrentSystemSummary } from '../installationSpecificationUiTypes';
import type { InstallationSpecificationFinishResultV1 } from '../../model/QuoteInstallationPlanV1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CANONICAL_COMBI: CanonicalCurrentSystemSummary = {
  heatSource:    'combi_boiler',
  hotWater:      'no_cylinder',
  primaryCircuit: 'sealed_primary',
  boilerLocation: 'Kitchen',
};

function advanceToLastStep() {
  // Click Next until the button reads "Finish".
  // The stepper has 9 steps for a gas boiler with combi proposal.
  // After selecting the proposed heat source (step 1) the combi path has fewer steps.
  // We advance until the Finish button appears.
  let iterations = 0;
  while (iterations < 12) {
    const btn = screen.queryByText('Next →')?.closest('button');
    if (!btn) break;
    fireEvent.click(btn);
    iterations++;
  }
}

// ─── 1. Finish calls onSave with the latest option ────────────────────────────

describe('Specification Finish — onSave', () => {
  it('calls onSave with the built option when Finish is tapped', () => {
    const onSave = vi.fn();
    const onFinish = vi.fn();

    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        canonicalCurrentSystem={CANONICAL_COMBI}
        seedProposedSystem="combi_boiler"
        onSave={onSave}
        onFinish={onFinish}
      />,
    );

    // The page auto-opens the stepper for the first option.
    advanceToLastStep();

    const finishBtn = screen.getByText('Finish').closest('button') as HTMLButtonElement;
    fireEvent.click(finishBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    const savedOption = onSave.mock.calls[0][0];
    expect(savedOption).toHaveProperty('id');
    expect(savedOption).toHaveProperty('specification');
    expect(savedOption).toHaveProperty('generatedScope');
  });
});

// ─── 2. Finish calls onFinish ─────────────────────────────────────────────────

describe('Specification Finish — onFinish', () => {
  it('calls onFinish with a result object when Finish is tapped', () => {
    const onFinish = vi.fn();

    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        canonicalCurrentSystem={CANONICAL_COMBI}
        seedProposedSystem="combi_boiler"
        onFinish={onFinish}
      />,
    );

    advanceToLastStep();

    const finishBtn = screen.getByText('Finish').closest('button') as HTMLButtonElement;
    fireEvent.click(finishBtn);

    expect(onFinish).toHaveBeenCalledTimes(1);
    const result: InstallationSpecificationFinishResultV1 = onFinish.mock.calls[0][0];
    expect(result).toHaveProperty('option');
    expect(result).toHaveProperty('generatedScope');
    expect(result).toHaveProperty('status');
    expect(['complete', 'in_progress', 'needs_decision']).toContain(result.status);
  });
});

// ─── 3 & 4. Finish navigation via origin prop ─────────────────────────────────

describe('Specification Finish — origin-based navigation', () => {
  it('calls the provided onFinish (caller handles navigation) when origin is visit-hub', () => {
    const onFinish = vi.fn();

    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        canonicalCurrentSystem={CANONICAL_COMBI}
        seedProposedSystem="combi_boiler"
        origin="visit-hub"
        onFinish={onFinish}
      />,
    );

    advanceToLastStep();
    fireEvent.click(screen.getByText('Finish').closest('button') as HTMLButtonElement);

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('calls the provided onFinish when origin is survey-step', () => {
    const onFinish = vi.fn();

    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        canonicalCurrentSystem={CANONICAL_COMBI}
        seedProposedSystem="combi_boiler"
        origin="survey-step"
        onFinish={onFinish}
      />,
    );

    advanceToLastStep();
    fireEvent.click(screen.getByText('Finish').closest('button') as HTMLButtonElement);

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

// ─── 5. Finish is never a no-op ───────────────────────────────────────────────

describe('Specification Finish — fallback (no-op guard)', () => {
  it('calls onBack as fallback when onFinish is not provided (stepper direct)', () => {
    const onBack = vi.fn();

    render(
      <InstallationSpecificationStepper
        onBack={onBack}
        canonicalCurrentSystem={CANONICAL_COMBI}
        seedProposedSystem="combi_boiler"
        optionId="test-opt"
        optionLabel="Option A"
        // no onFinish provided
      />,
    );

    // Advance to Finish button.
    let iterations = 0;
    while (iterations < 12) {
      const btn = screen.queryByText('Next →')?.closest('button');
      if (!btn) break;
      fireEvent.click(btn);
      iterations++;
    }

    fireEvent.click(screen.getByText('Finish').closest('button') as HTMLButtonElement);

    // Must have called onBack as fallback — never a no-op.
    expect(onBack).toHaveBeenCalled();
  });
});

// ─── 6. Generated scope is saved on Finish ────────────────────────────────────

describe('Specification Finish — generated scope persistence', () => {
  it('result.generatedScope is an array (may be empty) saved onto the option', () => {
    const onFinish = vi.fn();

    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        canonicalCurrentSystem={CANONICAL_COMBI}
        seedProposedSystem="combi_boiler"
        onFinish={onFinish}
      />,
    );

    advanceToLastStep();
    fireEvent.click(screen.getByText('Finish').closest('button') as HTMLButtonElement);

    const result: InstallationSpecificationFinishResultV1 = onFinish.mock.calls[0][0];
    expect(Array.isArray(result.generatedScope)).toBe(true);
    // The option's persisted scope matches the result scope.
    expect(result.option.generatedScope).toEqual(result.generatedScope);
  });
});
