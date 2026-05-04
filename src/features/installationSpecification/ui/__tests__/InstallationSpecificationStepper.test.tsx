/**
 * InstallationSpecificationStepper.test.tsx
 *
 * Acceptance tests for the layered Installation Specification stepper.
 *
 * Coverage:
 *   1.  Renders — stepper mounts, progress visible.
 *   2.  CurrentSystemStep renders three existence tiles.
 *   3.  CurrentSystemStep does NOT render a normal "Unknown" tile.
 *   4.  Exception path "Cannot confirm — needs technical review" exists.
 *   5.  Exception path requires a note before Next is enabled.
 *   6.  Selecting a normal tile clears the exception path.
 *   7.  no_wet_heating skips heat source / hot water / primary circuit steps.
 *   8.  has_wet_heating shows CurrentHeatSourceStep with all ten tiles.
 *   9.  combi heat source skips hot water, shows primary circuit.
 *   10. Proposed heat source step — tiles selectable, Next enabled.
 *   11. Classification: combi→combi = Like-for-like; combi→heat pump = Heat-pump conversion.
 *   12. Atlas recommendation seed pre-selects tile and shows badge.
 *   13. Back/Next navigation works correctly.
 *   14. ASHP step gating — heat pump path shows outdoor unit siting, not flue.
 *   15. ASHP→gas exception gating.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstallationSpecificationStepper } from '../InstallationSpecificationStepper';
import { InstallationSpecificationPage } from '../InstallationSpecificationPage';
import type { UiProposedHeatSourceLabel } from '../installationSpecificationUiTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderStepper(onBack = vi.fn()) {
  return render(<InstallationSpecificationStepper onBack={onBack} />);
}

function renderSeededStepper(seedValue: UiProposedHeatSourceLabel, onBack = vi.fn()) {
  return render(
    <InstallationSpecificationStepper onBack={onBack} seedProposedSystem={seedValue} />,
  );
}

function nextBtn() {
  return screen.getByText('Next →').closest('button') as HTMLButtonElement;
}

/**
 * Advance from step 0 to proposed_heat_source using 'no_wet_heating'.
 * This is the shortest path — skips heat source, hot water, and primary circuit.
 */
function advanceToProposedHeatSourceStep() {
  fireEvent.click(
    screen.getByRole('button', { name: /No existing wet heating system/i }),
  );
  fireEvent.click(nextBtn());
}

/**
 * Advance to proposed_heat_source via 'has_wet_heating' → combi heat source.
 * Combi skips hot water but shows primary circuit.
 */
function advanceToProposedViaCombiHeatSource() {
  // Step 1: existence — has wet heating
  fireEvent.click(
    screen.getByRole('button', { name: /^Existing wet heating system/i }),
  );
  fireEvent.click(nextBtn());
  // Step 2: heat source — combi (skips hot water, shows primary circuit)
  fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
  fireEvent.click(nextBtn());
  // Step 3: primary circuit — select sealed
  fireEvent.click(screen.getByRole('button', { name: /Sealed primary/i }));
  fireEvent.click(nextBtn());
  // Now at proposed_heat_source
}

/**
 * Advance to proposed_heat_source with heat pump as the current heat source.
 * heat_pump → shows hot water step (NOT isCombiHeatSource) → skips primary circuit (NOT isBoilerHeatSource).
 */
function advanceToProposedWithHeatPumpCurrent() {
  // Step 1: existence — has wet heating
  fireEvent.click(
    screen.getByRole('button', { name: /^Existing wet heating system/i }),
  );
  fireEvent.click(nextBtn());
  // Step 2: heat source — heat pump
  fireEvent.click(screen.getByRole('button', { name: /^Heat pump/i }));
  fireEvent.click(nextBtn());
  // Step 3: current hot water — heat pump is not combi so this step is shown
  fireEvent.click(screen.getByRole('button', { name: /^No cylinder/i }));
  fireEvent.click(nextBtn());
  // primary circuit is skipped (heat_pump is NOT isBoilerHeatSource)
  // Now at proposed_heat_source
}

// ─── 1. Renders ───────────────────────────────────────────────────────────────

describe('InstallationSpecificationStepper — renders', () => {
  it('mounts without crashing', () => {
    renderStepper();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows the existence-step heading on mount', () => {
    renderStepper();
    expect(screen.getByText('What is currently installed?')).toBeTruthy();
  });

  it('renders Back and Next buttons', () => {
    renderStepper();
    expect(screen.getByText('← Back')).toBeTruthy();
    expect(screen.getByText('Next →')).toBeTruthy();
  });

  it('progress pill "Current system" is active on step 0', () => {
    renderStepper();
    const activePills = document.querySelectorAll('.qp-progress__step--active');
    expect(activePills.length).toBe(1);
    expect(activePills[0].textContent).toBe('Current system');
  });
});

// ─── 2. CurrentSystemStep renders existence tiles ─────────────────────────────

describe('CurrentSystemStep — existence tiles', () => {
  it('renders the three existence tile titles', () => {
    renderStepper();
    expect(screen.getByText('Existing wet heating system')).toBeTruthy();
    expect(screen.getByText('No existing wet heating system')).toBeTruthy();
    expect(screen.getByText('Partial or abandoned system')).toBeTruthy();
  });

  it('renders subtitles for the existence tiles', () => {
    renderStepper();
    expect(screen.getByText(/Boiler, heat pump, or similar/i)).toBeTruthy();
    expect(screen.getByText(/First install, electric-only/i)).toBeTruthy();
    expect(screen.getByText(/Incomplete or decommissioned/i)).toBeTruthy();
  });
});

// ─── 3. No normal "Unknown" tile ──────────────────────────────────────────────

describe('CurrentSystemStep — no normal Unknown tile', () => {
  it('does not render a button labelled "Unknown"', () => {
    renderStepper();
    expect(screen.queryByRole('button', { name: /^Unknown$/i })).toBeNull();
  });

  it('does not render standalone "Unknown" text', () => {
    renderStepper();
    expect(screen.queryByText('Unknown')).toBeNull();
  });
});

// ─── 4. Exception path exists ─────────────────────────────────────────────────

describe('CurrentSystemStep — exception path', () => {
  it('renders the "Cannot confirm" exception button', () => {
    renderStepper();
    expect(
      screen.getByRole('button', { name: /Cannot confirm — needs technical review/i }),
    ).toBeTruthy();
  });

  it('tapping exception button shows the note textarea', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /Cannot confirm — needs technical review/i }),
    );
    expect(screen.getByRole('textbox', { name: /Technical review note/i })).toBeTruthy();
  });

  it('shows "Needs technical review" warning in the exception panel', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /Cannot confirm — needs technical review/i }),
    );
    expect(screen.getByText(/Needs technical review/i)).toBeTruthy();
  });
});

// ─── 5. Exception note required ───────────────────────────────────────────────

describe('CurrentSystemStep — exception note required', () => {
  it('Next remains disabled when exception panel is open with no note', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /Cannot confirm — needs technical review/i }),
    );
    expect(nextBtn().disabled).toBe(true);
  });

  it('Next becomes enabled once a note is entered', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /Cannot confirm — needs technical review/i }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: /Technical review note/i }), {
      target: { value: 'Unable to access boiler cupboard.' },
    });
    expect(nextBtn().disabled).toBe(false);
  });
});

// ─── 6. Normal tile clears exception path ─────────────────────────────────────

describe('CurrentSystemStep — tile clears exception', () => {
  it('selecting a tile after opening the exception panel hides the panel', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /Cannot confirm — needs technical review/i }),
    );
    expect(screen.getByRole('textbox', { name: /Technical review note/i })).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /^Existing wet heating system/i }),
    );
    expect(screen.queryByRole('textbox', { name: /Technical review note/i })).toBeNull();
  });
});

// ─── 7. no_wet_heating skips steps 2–4 ────────────────────────────────────────

describe('InstallationSpecificationStepper — no_wet_heating step skipping', () => {
  it('selecting no_wet_heating and Next goes directly to proposed heat source', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    expect(screen.getByText('What heat source are you proposing?')).toBeTruthy();
  });

  it('Next is disabled on step 0 without a tile selected', () => {
    renderStepper();
    expect(nextBtn().disabled).toBe(true);
  });

  it('Next becomes enabled after existence tile is selected', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /No existing wet heating system/i }),
    );
    expect(nextBtn().disabled).toBe(false);
  });
});

// ─── 8. has_wet_heating shows CurrentHeatSourceStep ───────────────────────────

describe('InstallationSpecificationStepper — has_wet_heating path', () => {
  it('selecting has_wet_heating and Next shows the current heat source step', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /^Existing wet heating system/i }),
    );
    fireEvent.click(nextBtn());
    expect(screen.getByText('What is the current heat source?')).toBeTruthy();
  });

  it('heat source step shows all ten tiles', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /^Existing wet heating system/i }),
    );
    fireEvent.click(nextBtn());
    expect(screen.getByText('Combination boiler')).toBeTruthy();
    expect(screen.getByText('Regular boiler')).toBeTruthy();
    expect(screen.getByText('System boiler')).toBeTruthy();
    expect(screen.getByText('Storage combi')).toBeTruthy();
    expect(screen.getByText('Heat pump')).toBeTruthy();
    expect(screen.getByText('Warm air unit')).toBeTruthy();
    expect(screen.getByText('Back boiler')).toBeTruthy();
    expect(screen.getByText('Direct electric')).toBeTruthy();
    expect(screen.getByText('Other heat source')).toBeTruthy();
    expect(screen.getByText('None')).toBeTruthy();
  });

  it('heat source step Next is disabled without a tile selected', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /^Existing wet heating system/i }),
    );
    fireEvent.click(nextBtn());
    expect(nextBtn().disabled).toBe(true);
  });
});

// ─── 9. combi heat source: skips hot water, shows primary circuit ─────────────

describe('InstallationSpecificationStepper — combi heat source routing', () => {
  it('combi heat source skips hot water and shows the primary circuit step', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /^Existing wet heating system/i }),
    );
    fireEvent.click(nextBtn());
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(nextBtn());
    expect(screen.getByText('What is the current primary circuit?')).toBeTruthy();
    expect(screen.queryByText(/What is the current hot-water arrangement/i)).toBeNull();
  });

  it('primary circuit step tiles are present', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /^Existing wet heating system/i }),
    );
    fireEvent.click(nextBtn());
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(nextBtn());
    expect(screen.getByRole('button', { name: /Open vented primary/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sealed primary/i })).toBeTruthy();
  });

  it('primary circuit step Next is disabled until a tile is selected', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /^Existing wet heating system/i }),
    );
    fireEvent.click(nextBtn());
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(nextBtn());
    expect(nextBtn().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Sealed primary/i }));
    expect(nextBtn().disabled).toBe(false);
  });
});

// ─── 10. Proposed heat source step ────────────────────────────────────────────

describe('InstallationSpecificationStepper — proposed heat source step', () => {
  it('shows proposed heat source heading after advancing', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    expect(screen.getByText('What heat source are you proposing?')).toBeTruthy();
  });

  it('proposed tile becomes aria-pressed=true when clicked', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    const combiBtn = screen.getAllByRole('button', { name: /Combination boiler/i })[0];
    fireEvent.click(combiBtn);
    expect(combiBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('Next becomes enabled after selecting a proposed tile', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    expect(nextBtn().disabled).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    expect(nextBtn().disabled).toBe(false);
  });

  it('only one proposed tile is selected at a time', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    const combiBtn = screen.getAllByRole('button', { name: /Combination boiler/i })[0];
    const heatPumpBtn = screen.getByRole('button', { name: /^Heat pump/i });
    fireEvent.click(combiBtn);
    fireEvent.click(heatPumpBtn);
    expect(combiBtn.getAttribute('aria-pressed')).toBe('false');
    expect(heatPumpBtn.getAttribute('aria-pressed')).toBe('true');
  });
});

// ─── 11. Classification path tests ────────────────────────────────────────────
// Note: combi→combi shows needs_review at job_type because the classifier
// requires heat-source location confirmation (not collected until place_locations).

describe('InstallationSpecificationStepper — specification path', () => {
  it('combi → combi shows Needs technical review (location not yet collected)', () => {
    renderStepper();
    advanceToProposedViaCombiHeatSource();
    // Proposed: combi (skips proposed hot water)
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(nextBtn());
    // Same family but no location data collected yet → needs_review
    expect(screen.getByRole('heading', { name: /Specification path/i })).toBeTruthy();
    expect(screen.getByText('Needs technical review')).toBeTruthy();
  });

  it('combi → heat pump advances through proposed hot water to job type', () => {
    renderStepper();
    advanceToProposedViaCombiHeatSource();
    // Proposed: heat pump (shows proposed hot water)
    fireEvent.click(screen.getByRole('button', { name: /^Heat pump/i }));
    fireEvent.click(nextBtn());
    // Proposed hot water step — heat pump shows only "Heat pump cylinder"
    expect(screen.getByText('What hot-water arrangement are you proposing?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Heat pump cylinder/i }));
    fireEvent.click(nextBtn());
    // Job type step
    expect(screen.getByText('Heat-pump conversion')).toBeTruthy();
    expect(screen.getByText('Outdoor unit location')).toBeTruthy();
  });

  it('no_wet_heating → combi reaches job type step', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(nextBtn());
    // combi proposed skips proposed hot water → job type
    expect(screen.getAllByText('Specification path').length).toBeGreaterThan(0);
  });
});

// ─── 12. Atlas recommendation seed ───────────────────────────────────────────

describe('InstallationSpecificationStepper — Atlas selected badge', () => {
  it('shows Atlas selected badge on the seeded tile', () => {
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

  it('does not show Atlas selected when no seed is provided', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    expect(screen.queryByText('Atlas selected')).toBeNull();
  });

  it('does not show deprecated "Atlas Pick" badge label', () => {
    renderSeededStepper('combi_boiler');
    advanceToProposedHeatSourceStep();
    expect(screen.queryByText('Atlas Pick')).toBeNull();
  });
});

// ─── 13. Back/Next navigation ─────────────────────────────────────────────────

describe('InstallationSpecificationStepper — Back/Next navigation', () => {
  it('calls onBack when Back is pressed on step 0', () => {
    const onBack = vi.fn();
    renderStepper(onBack);
    fireEvent.click(screen.getByText('← Back').closest('button') as HTMLButtonElement);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('does not call onBack when Back is pressed on step 1', () => {
    const onBack = vi.fn();
    renderStepper(onBack);
    fireEvent.click(
      screen.getByRole('button', { name: /^Existing wet heating system/i }),
    );
    fireEvent.click(nextBtn());
    expect(screen.getByText('What is the current heat source?')).toBeTruthy();
    fireEvent.click(screen.getByText('← Back').closest('button') as HTMLButtonElement);
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText('What is currently installed?')).toBeTruthy();
  });

  it('progress pill advances to "Proposed heat source" after no_wet_heating', () => {
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

// ─── 14. ASHP step gating ─────────────────────────────────────────────────────

describe('InstallationSpecificationStepper — ASHP step gating', () => {
  /** Navigate to the first ASHP routing step (outdoor_unit_siting). */
  function advanceToAshpRoutingStep() {
    advanceToProposedHeatSourceStep();
    // Proposed: heat pump
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
    advanceToAshpRoutingStep();
    expect(screen.getByTestId('ashp-outdoor-unit-siting')).toBeTruthy();
    expect(screen.queryByText('Flue specification')).toBeNull();
  });

  it('heat pump path does not include Flue/Condensate specification in progress pills', () => {
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

  it('gas boiler path shows Flue specification in progress pills', () => {
    renderStepper();
    advanceToProposedHeatSourceStep();
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    expect(screen.getByText('Flue specification')).toBeTruthy();
  });
});

// ─── 15. ASHP → gas exception gating ─────────────────────────────────────────

describe('InstallationSpecificationStepper — ASHP current → gas exception', () => {
  it('when current is heat_pump, normal proposed tiles exclude gas boilers', () => {
    renderStepper();
    advanceToProposedWithHeatPumpCurrent();
    expect(screen.queryByRole('button', { name: /Combination boiler/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /System boiler/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Regular boiler/i })).toBeNull();
  });

  it('when current is heat_pump, heat pump tile is still shown as proposed', () => {
    renderStepper();
    advanceToProposedWithHeatPumpCurrent();
    expect(screen.getByRole('button', { name: /^Heat pump/i })).toBeTruthy();
  });

  it('when current is heat_pump, ASHP→gas exception button is present', () => {
    renderStepper();
    advanceToProposedWithHeatPumpCurrent();
    expect(screen.getByTestId('ashp-gas-exception-btn')).toBeTruthy();
  });

  it('ASHP → gas requires an exception note before Next is enabled', () => {
    renderStepper();
    advanceToProposedWithHeatPumpCurrent();
    // Open the exception panel
    fireEvent.click(screen.getByTestId('ashp-gas-exception-btn'));
    expect(screen.getByTestId('ashp-exception-panel')).toBeTruthy();
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

  it('exception panel shows "Technical review required" title', () => {
    renderStepper();
    advanceToProposedWithHeatPumpCurrent();
    fireEvent.click(screen.getByTestId('ashp-gas-exception-btn'));
    expect(screen.getByText(/Technical review required/i)).toBeTruthy();
  });
});

// ─── InstallationSpecificationPage — smoke tests ──────────────────────────────

describe('InstallationSpecificationPage', () => {
  it('renders the stepper through the page wrapper', () => {
    render(<InstallationSpecificationPage onBack={vi.fn()} />);
    expect(screen.getByText('What is currently installed?')).toBeTruthy();
  });

  it('accepts seed proposed system and shows Atlas selected badge', () => {
    render(
      <InstallationSpecificationPage onBack={vi.fn()} seedProposedSystem="heat_pump" />,
    );
    advanceToProposedHeatSourceStep();
    expect(screen.getByText('Atlas selected')).toBeTruthy();
  });
});
