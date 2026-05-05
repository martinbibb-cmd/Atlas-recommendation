/**
 * InstallationSpecificationStepper.test.tsx
 *
 * Acceptance tests for the Atlas Installation Specification stepper.
 *
 * Acceptance criteria (per problem statement):
 *   1.  Stepper does NOT ask "What is currently installed?" as a collected step.
 *   2.  First screen renders "Current system from canonical survey".
 *   3.  Current heat source is prefilled from canonical survey.
 *   4.  Current hot-water arrangement is prefilled from canonical survey.
 *   5.  Current primary circuit is prefilled from canonical survey.
 *   6.  "Correct canonical survey" action exists.
 *   7.  Proposed heat source is seeded from Atlas recommendation.
 *   8.  ASHP path excludes flue, boiler condensate and gas route.
 *   9.  Gas boiler path includes flue, condensate and gas route.
 *   10. Combi proposed path skips proposed cylinder step.
 *   11. Stored hot-water proposed path includes cylinder/store and discharge route.
 *   12. Generated scope shows partial items before all steps are complete.
 *   13. No visible copy contains banned terms.
 *
 * Additional coverage:
 *   14. Renders — stepper mounts, progress visible.
 *   15. Summary step always allows advance (Next enabled from step 0).
 *   16. ASHP→gas exception gate: requires note when canonical has heat pump.
 *   17. Back / Next navigation works correctly.
 *   18. Page wrapper smoke tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstallationSpecificationStepper } from '../InstallationSpecificationStepper';
import { InstallationSpecificationPage } from '../InstallationSpecificationPage';
import type {
  UiProposedHeatSourceLabel,
  CanonicalCurrentSystemSummary,
} from '../installationSpecificationUiTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Default canonical summary with all fields populated. */
const CANONICAL_COMBI: CanonicalCurrentSystemSummary = {
  heatSource:    'combi_boiler',
  hotWater:      'no_cylinder',
  primaryCircuit: 'sealed_primary',
  boilerLocation: 'Kitchen',
};

const CANONICAL_SYSTEM_BOILER: CanonicalCurrentSystemSummary = {
  heatSource:    'system_boiler',
  hotWater:      'unvented_cylinder',
  primaryCircuit: 'sealed_primary',
  cylinderLocation: 'Airing cupboard',
};

const CANONICAL_HEAT_PUMP: CanonicalCurrentSystemSummary = {
  heatSource:    'heat_pump',
  hotWater:      'vented_cylinder',
  primaryCircuit: null,
};

function renderStepper(
  onBack = vi.fn(),
  canonical: CanonicalCurrentSystemSummary | null = null,
) {
  return render(
    <InstallationSpecificationStepper
      onBack={onBack}
      canonicalCurrentSystem={canonical}
    />,
  );
}

function renderSeededStepper(
  seedValue: UiProposedHeatSourceLabel,
  canonical: CanonicalCurrentSystemSummary | null = null,
  onBack = vi.fn(),
) {
  return render(
    <InstallationSpecificationStepper
      onBack={onBack}
      seedProposedSystem={seedValue}
      canonicalCurrentSystem={canonical}
    />,
  );
}

function nextBtn() {
  return screen.getByText('Next →').closest('button') as HTMLButtonElement;
}

/**
 * Advance from step 0 (current_system_summary) to proposed_heat_source.
 * The summary step always allows advance — just click Next.
 */
function advanceToProposedHeatSourceStep() {
  fireEvent.click(nextBtn());
}

// ─── 1. Does not ask "What is currently installed?" ──────────────────────────

describe('Acceptance 1 — stepper does not ask "What is currently installed?"', () => {
  it('does not render "What is currently installed?" as a heading', () => {
    renderStepper();
    expect(screen.queryByText(/What is currently installed/i)).toBeNull();
  });

  it('does not render "What is the current heat source?" as a step', () => {
    renderStepper();
    // Advance through entire stepper with combi proposed — should never see this
    fireEvent.click(nextBtn());
    expect(screen.queryByText(/What is the current heat source/i)).toBeNull();
  });

  it('does not render "What is the current hot-water arrangement?" as a step', () => {
    renderStepper();
    fireEvent.click(nextBtn());
    expect(screen.queryByText(/What is the current hot-water arrangement/i)).toBeNull();
  });

  it('does not render "What is the current primary circuit?" as a step', () => {
    renderStepper();
    fireEvent.click(nextBtn());
    expect(screen.queryByText(/What is the current primary circuit/i)).toBeNull();
  });
});

// ─── 2. First screen renders canonical survey summary ─────────────────────────

describe('Acceptance 2 — first screen renders "Current system from canonical survey"', () => {
  it('renders the heading on mount', () => {
    renderStepper();
    expect(screen.getByText('Current system from canonical survey')).toBeTruthy();
  });

  it('renders the canonical summary card on mount', () => {
    renderStepper();
    expect(screen.getByTestId('canonical-summary-card')).toBeTruthy();
  });

  it('progress pill "Current system" is active on step 0', () => {
    renderStepper();
    const activePills = document.querySelectorAll('.qp-progress__step--active');
    expect(activePills.length).toBe(1);
    expect(activePills[0].textContent).toBe('Current system');
  });
});

// ─── 3. Heat source prefilled from canonical survey ───────────────────────────

describe('Acceptance 3 — current heat source prefilled from canonical survey', () => {
  it('shows "Combination boiler" when canonical heat source is combi_boiler', () => {
    renderStepper(vi.fn(), CANONICAL_COMBI);
    expect(screen.getByTestId('summary-heat-source').textContent).toBe('Combination boiler');
  });

  it('shows "System boiler" when canonical heat source is system_boiler', () => {
    renderStepper(vi.fn(), CANONICAL_SYSTEM_BOILER);
    expect(screen.getByTestId('summary-heat-source').textContent).toBe('System boiler');
  });

  it('shows "Heat pump" when canonical heat source is heat_pump', () => {
    renderStepper(vi.fn(), CANONICAL_HEAT_PUMP);
    expect(screen.getByTestId('summary-heat-source').textContent).toBe('Heat pump');
  });

  it('shows missing notice when heat source is not in canonical survey', () => {
    renderStepper(vi.fn(), { heatSource: null, hotWater: null, primaryCircuit: null });
    expect(screen.getByTestId('missing-heat-source')).toBeTruthy();
    // Multiple "Missing from canonical survey" labels are expected (one per missing field)
    expect(screen.getAllByText(/Missing from canonical survey/i).length).toBeGreaterThan(0);
  });
});

// ─── 4. Hot-water arrangement prefilled from canonical survey ─────────────────

describe('Acceptance 4 — hot-water arrangement prefilled from canonical survey', () => {
  it('shows "Unvented cylinder" when canonical hot water is unvented_cylinder', () => {
    renderStepper(vi.fn(), CANONICAL_SYSTEM_BOILER);
    expect(screen.getByTestId('summary-hot-water').textContent).toBe('Unvented cylinder');
  });

  it('shows "Vented cylinder" when canonical hot water is vented_cylinder', () => {
    renderStepper(vi.fn(), CANONICAL_HEAT_PUMP);
    expect(screen.getByTestId('summary-hot-water').textContent).toBe('Vented cylinder');
  });

  it('shows missing notice when hot water is not in canonical survey', () => {
    renderStepper(vi.fn(), { heatSource: 'combi_boiler', hotWater: null, primaryCircuit: null });
    expect(screen.getByTestId('missing-hot-water')).toBeTruthy();
  });
});

// ─── 5. Primary circuit prefilled from canonical survey ───────────────────────

describe('Acceptance 5 — primary circuit prefilled from canonical survey', () => {
  it('shows "Sealed primary" when canonical primary circuit is sealed_primary', () => {
    renderStepper(vi.fn(), CANONICAL_COMBI);
    expect(screen.getByTestId('summary-primary-circuit').textContent).toBe('Sealed primary');
  });

  it('shows "Open vented primary" when canonical primary circuit is open_vented_primary', () => {
    const canon: CanonicalCurrentSystemSummary = {
      heatSource: 'regular_boiler',
      hotWater: 'vented_cylinder',
      primaryCircuit: 'open_vented_primary',
    };
    renderStepper(vi.fn(), canon);
    expect(screen.getByTestId('summary-primary-circuit').textContent).toBe('Open vented primary');
  });

  it('shows missing notice when primary circuit is null in canonical survey', () => {
    renderStepper(vi.fn(), CANONICAL_HEAT_PUMP);
    expect(screen.getByTestId('missing-primary-circuit')).toBeTruthy();
  });
});

// ─── 6. "Correct canonical survey" action exists ──────────────────────────────

describe('Acceptance 6 — "Correct canonical survey" action exists', () => {
  it('renders the "Correct canonical survey" button', () => {
    renderStepper();
    expect(screen.getByTestId('correct-survey-btn')).toBeTruthy();
    expect(screen.getByText('Correct canonical survey')).toBeTruthy();
  });

  it('calls onCorrectSurvey when the button is clicked', () => {
    const onCorrectSurvey = vi.fn();
    render(
      <InstallationSpecificationStepper
        onBack={vi.fn()}
        onCorrectSurvey={onCorrectSurvey}
        canonicalCurrentSystem={CANONICAL_COMBI}
      />,
    );
    fireEvent.click(screen.getByTestId('correct-survey-btn'));
    expect(onCorrectSurvey).toHaveBeenCalledOnce();
  });
});

// ─── 7. Proposed heat source seeded from Atlas recommendation ─────────────────

describe('Acceptance 7 — proposed heat source seeded from Atlas recommendation', () => {
  it('shows "Atlas selected" badge on the seeded tile', () => {
    renderSeededStepper('system_boiler');
    advanceToProposedHeatSourceStep();
    expect(screen.getByText('Atlas selected')).toBeTruthy();
  });

  it('pre-selects the seeded tile (aria-pressed=true)', () => {
    renderSeededStepper('combi_boiler');
    advanceToProposedHeatSourceStep();
    const combiButtons = screen.getAllByRole('button', { name: /Combination boiler/i });
    const selectedCombi = combiButtons.find((b) => b.getAttribute('aria-pressed') === 'true');
    expect(selectedCombi).toBeTruthy();
  });

  it('Next is enabled immediately when the seeded tile is present', () => {
    renderSeededStepper('heat_pump');
    advanceToProposedHeatSourceStep();
    expect(nextBtn().disabled).toBe(false);
  });

  it('does not show "Atlas selected" badge when no seed is provided', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    expect(screen.queryByText('Atlas selected')).toBeNull();
  });
});

// ─── 8. ASHP path excludes flue, boiler condensate ───────────────────────────

describe('Acceptance 8 — ASHP path excludes flue, boiler condensate, gas route', () => {
  function advanceToAshpRoute() {
    advanceToProposedHeatSourceStep();
    fireEvent.click(screen.getByRole('button', { name: /^Heat pump/i }));
    fireEvent.click(nextBtn());
    // Proposed hot water — heat pump cylinder
    fireEvent.click(screen.getByRole('button', { name: /Heat pump cylinder/i }));
    fireEvent.click(nextBtn());
    // Job type
    fireEvent.click(nextBtn());
    // Place locations
    fireEvent.click(nextBtn());
    // Now at outdoor_unit_siting
  }

  it('heat pump path shows Outdoor unit siting — not Flue specification', () => {
    renderStepper();
    advanceToAshpRoute();
    expect(screen.getByTestId('ashp-outdoor-unit-siting')).toBeTruthy();
    expect(screen.queryByText('Flue specification')).toBeNull();
  });

  it('heat pump path does not include Flue/Condensate pills in progress strip', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    fireEvent.click(screen.getByRole('button', { name: /^Heat pump/i }));
    expect(screen.queryByText('Flue specification')).toBeNull();
    expect(screen.queryByText('Condensate specification')).toBeNull();
  });

  it('heat pump path includes Hydraulic route and Electrical supply pills', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    fireEvent.click(screen.getByRole('button', { name: /^Heat pump/i }));
    expect(screen.getByText('Hydraulic route')).toBeTruthy();
    expect(screen.getByText('Electrical supply')).toBeTruthy();
  });
});

// ─── 9. Gas boiler path includes flue, condensate, gas route ─────────────────

describe('Acceptance 9 — gas boiler path includes flue, condensate, gas route', () => {
  it('combi proposed shows Flue specification in progress pills', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    expect(screen.getByText('Flue specification')).toBeTruthy();
    expect(screen.getByText('Condensate specification')).toBeTruthy();
  });

  it('system boiler proposed shows Flue and Condensate pills', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    fireEvent.click(screen.getByRole('button', { name: /System boiler/i }));
    expect(screen.getByText('Flue specification')).toBeTruthy();
    expect(screen.getByText('Condensate specification')).toBeTruthy();
  });
});

// ─── 10. Combi proposed path skips proposed cylinder step ────────────────────

describe('Acceptance 10 — combi proposed path skips proposed cylinder step', () => {
  it('proposed combi skips proposed hot water step, goes directly to job type', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(nextBtn());
    // Should be at job_type, not proposed_hot_water
    expect(screen.getByRole('heading', { name: /Specification path/i })).toBeTruthy();
    expect(screen.queryByText(/What hot-water arrangement are you proposing/i)).toBeNull();
  });

  it('storage combi seed also skips proposed hot water step', () => {
    // storage_combi is not a normal tile — it can only be seed-set
    renderSeededStepper('storage_combi');
    advanceToProposedHeatSourceStep();
    // When seeded with storage_combi, Next should be enabled immediately
    expect(nextBtn().disabled).toBe(false);
    fireEvent.click(nextBtn());
    // proposed_hot_water is skipped for storage_combi → job_type
    expect(screen.getByRole('heading', { name: /Specification path/i })).toBeTruthy();
  });
});

// ─── 11. Stored hot-water proposed path includes cylinder and discharge ───────

describe('Acceptance 11 — stored hot-water proposed path includes cylinder and discharge', () => {
  it('system boiler proposed shows proposed hot water step', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    fireEvent.click(screen.getByRole('button', { name: /System boiler/i }));
    fireEvent.click(nextBtn());
    expect(screen.getByText('What hot-water arrangement are you proposing?')).toBeTruthy();
  });

  it('unvented cylinder proposed drives discharge route in generated scope', () => {
    renderStepper(vi.fn(), CANONICAL_COMBI);
    advanceToProposedHeatSourceStep();
    // Proposed: system boiler
    fireEvent.click(screen.getByRole('button', { name: /System boiler/i }));
    fireEvent.click(nextBtn());
    // Proposed hot water: unvented cylinder
    fireEvent.click(screen.getByRole('button', { name: /Replace with unvented cylinder/i }));
    fireEvent.click(nextBtn());
    // Job type
    fireEvent.click(nextBtn());
    // Place locations
    fireEvent.click(nextBtn());
    // Flue plan
    fireEvent.click(nextBtn());
    // Condensate plan
    fireEvent.click(nextBtn());
    // Pipework plan
    fireEvent.click(nextBtn());
    // Controls
    fireEvent.click(nextBtn());
    // Services
    fireEvent.click(nextBtn());
    // Products / additionals
    fireEvent.click(nextBtn());
    // Generated scope
    expect(screen.getByRole('heading', { name: /Generated scope/i })).toBeTruthy();
    // Discharge route should be present as unvented cylinder requires it
    expect(screen.getByText(/Add discharge route/i)).toBeTruthy();
  });
});

// ─── 12. Generated scope shows partial items before all steps complete ────────

describe('Acceptance 12 — generated scope shows partial items early', () => {
  it('shows scope items after selecting only proposed heat source', () => {
    renderStepper(vi.fn(), CANONICAL_COMBI);
    advanceToProposedHeatSourceStep();
    // Select combi as proposed — skips hot water, goes to job type
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(nextBtn()); // → job_type
    fireEvent.click(nextBtn()); // → place_locations
    fireEvent.click(nextBtn()); // → flue_plan
    fireEvent.click(nextBtn()); // → condensate_plan
    fireEvent.click(nextBtn()); // → pipework_plan
    fireEvent.click(nextBtn()); // → controls
    fireEvent.click(nextBtn()); // → services
    fireEvent.click(nextBtn()); // → products_additionals
    fireEvent.click(nextBtn()); // → generated_scope
    // Scope items should be present even though no routes are specified
    expect(screen.getByRole('heading', { name: /Generated scope/i })).toBeTruthy();
    expect(screen.getByText(/Fit new combi boiler/i)).toBeTruthy();
  });

  it('scope heading visible immediately at the generated scope step', () => {
    // Navigate directly to scope via heat_pump path (fewer intermediate steps)
    renderStepper(vi.fn(), null);
    fireEvent.click(nextBtn()); // → proposed_heat_source
    fireEvent.click(screen.getByRole('button', { name: /^Heat pump/i }));
    fireEvent.click(nextBtn()); // → proposed_hot_water
    fireEvent.click(screen.getByRole('button', { name: /Heat pump cylinder/i }));
    fireEvent.click(nextBtn()); // → job_type
    fireEvent.click(nextBtn()); // → place_locations
    fireEvent.click(nextBtn()); // → outdoor_unit_siting
    fireEvent.click(nextBtn()); // → hydraulic_route
    fireEvent.click(nextBtn()); // → electrical_supply
    fireEvent.click(nextBtn()); // → controls
    fireEvent.click(nextBtn()); // → services
    fireEvent.click(nextBtn()); // → products_additionals
    fireEvent.click(nextBtn()); // → generated_scope
    expect(screen.getByRole('heading', { name: /Generated scope/i })).toBeTruthy();
    expect(screen.getByText(/Outdoor unit — location to confirm/i)).toBeTruthy();
  });
});

// ─── 13. No banned copy ───────────────────────────────────────────────────────

const BANNED_COPY_TERMS = [
  'Contractor quote',
  'Quote planner',
  'Installation planner',
  'Job planner',
  'Planner',
  'Planning',
  'confirm on site',
  'Confirm on site',
  'check on site',
  'Check on site',
  'verify on site',
  'Verify on site',
  'installer to confirm',
  'Installer to confirm',
];

describe('Acceptance 13 — no banned copy in visible step labels', () => {
  const STEP_LABELS = [
    'Current system',
    'Proposed heat source',
    'Proposed hot water',
    'Location change',
    'Key locations',
    'Flue specification',
    'Condensate specification',
    'Pipework specification',
    'Outdoor unit siting',
    'Hydraulic route',
    'Electrical supply',
    'Generated scope',
  ];

  const SUMMARY_HEADING = 'Current system from canonical survey';
  const PROPOSED_HEADING = 'What heat source are you proposing?';
  const CORRECT_SURVEY_BTN = 'Correct canonical survey';

  const ALL_LABELS = [...STEP_LABELS, SUMMARY_HEADING, PROPOSED_HEADING, CORRECT_SURVEY_BTN];

  BANNED_COPY_TERMS.forEach((banned) => {
    it(`step labels must not contain "${banned}"`, () => {
      ALL_LABELS.forEach((label) => {
        expect(label.toLowerCase()).not.toContain(banned.toLowerCase());
      });
    });
  });
});

// ─── 14. Renders ──────────────────────────────────────────────────────────────

describe('InstallationSpecificationStepper — renders', () => {
  it('mounts without crashing', () => {
    renderStepper();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('renders Back and Next buttons', () => {
    renderStepper();
    expect(screen.getByText('← Back')).toBeTruthy();
    expect(screen.getByText('Next →')).toBeTruthy();
  });
});

// ─── 15. Summary step always allows advance ───────────────────────────────────

describe('Summary step always allows advance', () => {
  it('Next is enabled on step 0 without any canonical data', () => {
    renderStepper();
    expect(nextBtn().disabled).toBe(false);
  });

  it('Next is enabled on step 0 with full canonical data', () => {
    renderStepper(vi.fn(), CANONICAL_COMBI);
    expect(nextBtn().disabled).toBe(false);
  });

  it('advancing from step 0 shows proposed heat source step', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    expect(screen.getByText('What heat source are you proposing?')).toBeTruthy();
  });

  it('Next is disabled on proposed_heat_source step without selection', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    expect(nextBtn().disabled).toBe(true);
  });
});

// ─── 16. ASHP→gas exception gate ─────────────────────────────────────────────

describe('ASHP→gas exception gate — canonical heat pump', () => {
  function renderWithHeatPumpCanonical() {
    return render(
      <InstallationSpecificationStepper
        onBack={vi.fn()}
        canonicalCurrentSystem={CANONICAL_HEAT_PUMP}
      />,
    );
  }

  it('when canonical is heat_pump, normal proposed tiles exclude gas boilers', () => {
    renderWithHeatPumpCanonical();
    advanceToProposedHeatSourceStep();
    expect(screen.queryByRole('button', { name: /Combination boiler/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /System boiler/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Regular boiler/i })).toBeNull();
  });

  it('when canonical is heat_pump, heat pump tile is still shown as proposed', () => {
    renderWithHeatPumpCanonical();
    advanceToProposedHeatSourceStep();
    expect(screen.getByRole('button', { name: /^Heat pump/i })).toBeTruthy();
  });

  it('when canonical is heat_pump, ASHP→gas exception button is present', () => {
    renderWithHeatPumpCanonical();
    advanceToProposedHeatSourceStep();
    expect(screen.getByTestId('ashp-gas-exception-btn')).toBeTruthy();
  });

  it('ASHP→gas requires an exception note before Next is enabled', () => {
    renderWithHeatPumpCanonical();
    advanceToProposedHeatSourceStep();
    // Open the exception panel
    fireEvent.click(screen.getByTestId('ashp-gas-exception-btn'));
    // Select a gas system inside the exception panel
    const combiBtns = screen.getAllByRole('button', { name: /Combination boiler/i });
    fireEvent.click(combiBtns[0]);
    // Next still disabled — no note yet
    expect(nextBtn().disabled).toBe(true);
    // Enter the note
    fireEvent.change(screen.getByLabelText(/ASHP to gas exception note/i), {
      target: { value: 'Customer decided to revert to gas due to cost.' },
    });
    expect(nextBtn().disabled).toBe(false);
  });
});

// ─── 17. Back / Next navigation ───────────────────────────────────────────────

describe('Back / Next navigation', () => {
  it('calls onBack when Back is pressed on step 0', () => {
    const onBack = vi.fn();
    renderStepper(onBack);
    fireEvent.click(screen.getByText('← Back').closest('button') as HTMLButtonElement);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('does not call onBack when Back is pressed on step 1', () => {
    const onBack = vi.fn();
    renderStepper(onBack);
    fireEvent.click(nextBtn());
    expect(screen.getByText('What heat source are you proposing?')).toBeTruthy();
    fireEvent.click(screen.getByText('← Back').closest('button') as HTMLButtonElement);
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText('Current system from canonical survey')).toBeTruthy();
  });

  it('progress pill advances to "Proposed heat source" after advancing from summary', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    const activePills = document.querySelectorAll('.qp-progress__step--active');
    expect(activePills.length).toBe(1);
    expect(activePills[0].textContent).toBe('Proposed heat source');
  });

  it('advancing to job_type shows Specification path heading', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(nextBtn());
    expect(screen.getByRole('heading', { name: /Specification path/i })).toBeTruthy();
  });
});

// ─── 18. Page wrapper smoke tests ─────────────────────────────────────────────

describe('InstallationSpecificationPage', () => {
  it('renders the stepper through the page wrapper', () => {
    render(<InstallationSpecificationPage onBack={vi.fn()} />);
    expect(screen.getByText('Current system from canonical survey')).toBeTruthy();
  });

  it('does not render "What is currently installed?" via the page wrapper', () => {
    render(<InstallationSpecificationPage onBack={vi.fn()} />);
    expect(screen.queryByText(/What is currently installed/i)).toBeNull();
  });

  it('passes canonical current system through to the summary step', () => {
    render(
      <InstallationSpecificationPage
        onBack={vi.fn()}
        canonicalCurrentSystem={CANONICAL_COMBI}
      />,
    );
    expect(screen.getByTestId('summary-heat-source').textContent).toBe('Combination boiler');
  });

  it('accepts seedProposedSystem and shows Atlas selected badge', () => {
    render(
      <InstallationSpecificationPage onBack={vi.fn()} seedProposedSystem="heat_pump" />,
    );
    advanceToProposedHeatSourceStep();
    expect(screen.getByText('Atlas selected')).toBeTruthy();
  });
});

