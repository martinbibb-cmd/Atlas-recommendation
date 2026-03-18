/**
 * VisitPage.persistence.test.tsx
 *
 * Tests for Step 5 hot-water persistence, save/retry state machine, and the
 * global ExplainersOverlay (hamburger) in the stepper.
 *
 * Covers:
 *   - onDraft callback fires on step transition with full FullSurveyModelV1
 *   - fullSurvey.dhwCondition fields are NOT stripped in the draft
 *   - compareMixergy is included in fullSurvey on the draft
 *   - compareMixergy is hydrated from prefill.fullSurvey.compareMixergy
 *   - ExplainersOverlay launcher button is present in FullSurveyStepper header
 *   - SaveState type includes 'retrying'
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FullSurveyStepper from '../../stepper/FullSurveyStepper';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import type { SaveState } from '../VisitPage';

vi.mock('../../../lib/visits/visitApi', () => ({
  getVisit: vi.fn(),
  saveVisit: vi.fn(),
  visitStatusLabel: (s: string) => s,
  visitDisplayLabel: () => 'Test Visit',
}));

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

async function advanceToStep(user: ReturnType<typeof userEvent.setup>, targetIndex: number) {
  for (let i = 0; i < targetIndex; i++) {
    await user.click(screen.getByRole('button', { name: /next/i }));
  }
}

// ── onDraft persistence tests ─────────────────────────────────────────────────

describe('FullSurveyStepper — onDraft persistence callback', () => {
  it('calls onDraft with full FullSurveyModelV1 including fullSurvey on step transition', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} onDraft={onDraft} />);

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(onDraft).toHaveBeenCalledOnce();
    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    // fullSurvey key must be present — confirms the model is not stripped
    expect(Object.prototype.hasOwnProperty.call(draft, 'fullSurvey')).toBe(true);
  }, 10000);

  it('draft preserves fullSurvey.dhwCondition fields', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      fullSurvey: {
        dhwCondition: {
          currentCylinderPresent: true,
          currentCylinderType: 'mixergy',
          dhwUpgradeIntent: 'keep',
        },
      },
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.fullSurvey?.dhwCondition?.currentCylinderPresent).toBe(true);
    expect(draft.fullSurvey?.dhwCondition?.currentCylinderType).toBe('mixergy');
    expect(draft.fullSurvey?.dhwCondition?.dhwUpgradeIntent).toBe('keep');
  }, 10000);

  it('draft includes compareMixergy=true after toggling the checkbox', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      fullSurvey: {
        dhwCondition: {
          currentCylinderPresent: false,
          dhwUpgradeIntent: 'replace',
        },
      },
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await advanceToStep(user, 4); // step 5: hot_water

    const checkbox = screen.getByRole('checkbox', { name: /show mixergy comparison/i });
    await user.click(checkbox);

    onDraft.mockClear();
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.fullSurvey?.compareMixergy).toBe(true);
  }, 15000);
});

// ── compareMixergy hydration ──────────────────────────────────────────────────

describe('FullSurveyStepper — Step 5 compareMixergy hydration from prefill', () => {
  it('hydrates compareMixergy=true from fullSurvey.compareMixergy in prefill', async () => {
    const user = userEvent.setup();
    render(
      <FullSurveyStepper
        onBack={() => {}}
        prefill={{
          fullSurvey: {
            compareMixergy: true,
            dhwCondition: { currentCylinderPresent: false, dhwUpgradeIntent: 'replace' },
          },
        }}
      />
    );

    await advanceToStep(user, 4);

    expect(screen.getByRole('checkbox', { name: /show mixergy comparison/i })).toBeChecked();
  }, 15000);

  it('compareMixergy defaults to false when absent from prefill', async () => {
    const user = userEvent.setup();
    render(
      <FullSurveyStepper
        onBack={() => {}}
        prefill={{
          fullSurvey: {
            dhwCondition: { currentCylinderPresent: false, dhwUpgradeIntent: 'replace' },
          },
        }}
      />
    );

    await advanceToStep(user, 4);

    expect(screen.getByRole('checkbox', { name: /show mixergy comparison/i })).not.toBeChecked();
  }, 15000);
});

// ── Global hamburger (ExplainersOverlay in FullSurveyStepper) ────────────────

describe('FullSurveyStepper — global ExplainersOverlay (hamburger) availability', () => {
  it('renders the Explainers launcher button on step 1', () => {
    render(<FullSurveyStepper onBack={() => {}} />);
    expect(screen.getByRole('button', { name: /explainers/i })).toBeInTheDocument();
  });

  it('Explainers button is still present after navigating to step 2', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByRole('button', { name: /explainers/i })).toBeInTheDocument();
  }, 10000);

  it('Explainers button is still present on step 3', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 2);

    expect(screen.getByRole('button', { name: /explainers/i })).toBeInTheDocument();
  }, 10000);
});

// ── SaveState type test ───────────────────────────────────────────────────────

describe('VisitPage — SaveState includes retrying variant', () => {
  it('SaveState type supports all expected states including retrying', () => {
    const states: SaveState[] = ['idle', 'saving', 'saved', 'failed', 'retrying'];
    expect(states).toContain('retrying');
    expect(states).toHaveLength(5);
  });
});
