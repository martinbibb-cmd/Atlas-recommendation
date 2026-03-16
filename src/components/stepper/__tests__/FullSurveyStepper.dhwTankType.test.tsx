/**
 * FullSurveyStepper.dhwTankType.test.tsx
 *
 * Branch-coverage tests for the `dhwTankType` picker visibility rule in Step 5.
 *
 * The picker is visible when stored hot water is being considered:
 *   - A cylinder is already present (regardless of upgrade intent), OR
 *   - Upgrade intent is 'replace' (adding stored to a combi, or replacing existing), OR
 *   - Upgrade intent is 'unsure' (stored may still be selected)
 *
 * The picker is hidden when:
 *   - No cylinder is present AND upgrade intent is 'keep' (keeping an on-demand setup)
 *   - No cylinder is present AND upgrade intent is not yet set (initial state)
 *   - Cylinder presence is unknown AND upgrade intent is 'keep'
 *
 * Scenarios covered:
 *   1. currentCylinderPresent=false, dhwUpgradeIntent='keep'    → hidden
 *   2. currentCylinderPresent=false, dhwUpgradeIntent='replace' → visible (combi converting to stored)
 *   3. currentCylinderPresent=false, dhwUpgradeIntent='unsure'  → visible (undecided)
 *   4. currentCylinderPresent=undefined (unknown), no intent    → hidden (not yet assessed)
 *   5. currentCylinderPresent=undefined (unknown), intent='keep'→ hidden
 *   6. currentCylinderPresent=true, dhwUpgradeIntent='keep'     → visible (has cylinder, keeping)
 *   7. currentCylinderPresent=true, dhwUpgradeIntent='replace'  → visible (replacing with stored)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FullSurveyStepper from '../FullSurveyStepper';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';

// jsdom does not implement window.scrollTo — stub it.
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Navigate the stepper to the given 0-based step index by clicking Next. */
async function advanceToStep(user: ReturnType<typeof userEvent.setup>, targetIndex: number) {
  for (let i = 0; i < targetIndex; i++) {
    const nextBtn = screen.getByRole('button', { name: /next/i });
    await user.click(nextBtn);
  }
}

/**
 * Render the stepper with a prefilled fullSurvey.dhwCondition and advance to Step 5.
 * Returns the user event instance for further interactions.
 */
async function renderAtHotWaterStep(dhwCondition: FullSurveyModelV1['fullSurvey']['dhwCondition']) {
  const user = userEvent.setup();
  const prefill: Partial<FullSurveyModelV1> = {
    fullSurvey: { dhwCondition },
  };
  render(<FullSurveyStepper onBack={() => {}} prefill={prefill} />);
  // Advance to step 5 (hot_water — index 4).
  await advanceToStep(user, 4);
  return user;
}

// ─── dhwTankType picker visibility ───────────────────────────────────────────

describe('FullSurveyStepper — Step 5 dhwTankType picker visibility', () => {
  it('hides the picker when no cylinder is present and intent is "keep"', async () => {
    await renderAtHotWaterStep({
      currentCylinderPresent: false,
      dhwUpgradeIntent: 'keep',
    });

    expect(document.querySelector('[data-testid="survey-dhw-tank-type-picker"]')).toBeNull();
  });

  it('shows the picker when no cylinder is present but intent is "replace" (combi converting to stored)', async () => {
    await renderAtHotWaterStep({
      currentCylinderPresent: false,
      dhwUpgradeIntent: 'replace',
    });

    expect(document.querySelector('[data-testid="survey-dhw-tank-type-picker"]')).not.toBeNull();
  });

  it('shows the picker when no cylinder is present but intent is "unsure"', async () => {
    await renderAtHotWaterStep({
      currentCylinderPresent: false,
      dhwUpgradeIntent: 'unsure',
    });

    expect(document.querySelector('[data-testid="survey-dhw-tank-type-picker"]')).not.toBeNull();
  });

  it('hides the picker when cylinder presence is unknown and no intent is set', async () => {
    await renderAtHotWaterStep({
      currentCylinderPresent: undefined,
      dhwUpgradeIntent: undefined,
    });

    expect(document.querySelector('[data-testid="survey-dhw-tank-type-picker"]')).toBeNull();
  });

  it('hides the picker when cylinder presence is unknown and intent is "keep"', async () => {
    await renderAtHotWaterStep({
      currentCylinderPresent: undefined,
      dhwUpgradeIntent: 'keep',
    });

    expect(document.querySelector('[data-testid="survey-dhw-tank-type-picker"]')).toBeNull();
  });

  it('shows the picker when a cylinder is present and intent is "keep" (keeping existing stored)', async () => {
    await renderAtHotWaterStep({
      currentCylinderPresent: true,
      dhwUpgradeIntent: 'keep',
    });

    expect(document.querySelector('[data-testid="survey-dhw-tank-type-picker"]')).not.toBeNull();
  });

  it('shows the picker when a cylinder is present and intent is "replace" (replacing with new stored)', async () => {
    await renderAtHotWaterStep({
      currentCylinderPresent: true,
      dhwUpgradeIntent: 'replace',
    });

    expect(document.querySelector('[data-testid="survey-dhw-tank-type-picker"]')).not.toBeNull();
  });
});

// ─── Stored hot water explainer copy ─────────────────────────────────────────

describe('FullSurveyStepper — Step 5 stored hot water explainer', () => {
  it('shows the "Stored hot water is being considered" notice when the picker is visible', async () => {
    await renderAtHotWaterStep({
      currentCylinderPresent: false,
      dhwUpgradeIntent: 'replace',
    });

    expect(
      screen.getByText(/Stored hot water is being considered/i),
    ).toBeInTheDocument();
  });

  it('does not show the "Stored hot water is being considered" notice when the picker is hidden', async () => {
    await renderAtHotWaterStep({
      currentCylinderPresent: false,
      dhwUpgradeIntent: 'keep',
    });

    expect(
      screen.queryByText(/Stored hot water is being considered/i),
    ).toBeNull();
  });

  it('shows the cylinder age/condition explainer note when a cylinder is present', async () => {
    await renderAtHotWaterStep({
      currentCylinderPresent: true,
    });

    expect(
      screen.getByText(/Age and condition affect standing heat loss/i),
    ).toBeInTheDocument();
  });
});
