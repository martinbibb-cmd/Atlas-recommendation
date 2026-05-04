/**
 * InstallationSpecificationStepper.test.tsx
 *
 * Acceptance tests for the Installation Specification visual stepper shell.
 *
 * Coverage (from problem statement):
 *   1.  Renders route/page — stepper mounts, progress is visible.
 *   2.  CurrentSystemStep renders graphical tiles (title + subtitle).
 *   3.  CurrentSystemStep does NOT render a normal "Unknown" tile.
 *   4.  Exception path "Cannot confirm — needs technical review" exists.
 *   5.  Exception path requires a note before Next is enabled.
 *   6.  Selecting a normal tile clears the exception path.
 *   7.  Selecting proposed system updates draft — tile becomes selected.
 *   8.  Combi → Combi shows like-for-like/relocation path.
 *   9.  Regular/open vent → Combi shows conversion path.
 *   10. Combi → System boiler + cylinder shows stored hot-water upgrade path.
 *   11. Proposed system can be prefilled from Atlas recommendation.
 *   12. Atlas selected badge shown when seeded.
 *   13. Back/Next navigation works.
 *   14. No visible copy contains Unknown as normal tile label.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstallationSpecificationStepper } from '../InstallationSpecificationStepper';
import { InstallationSpecificationPage } from '../InstallationSpecificationPage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderStepper(onBack = vi.fn()) {
  return render(<InstallationSpecificationStepper onBack={onBack} />);
}

function renderSeededStepper(seedValue: 'combi' | 'system_boiler' | 'heat_pump', onBack = vi.fn()) {
  return render(<InstallationSpecificationStepper onBack={onBack} seedProposedSystem={seedValue} />);
}

/** Advance from step 1 to step 2 by clicking the first Combi tile then Next. */
function advanceToProposedStep() {
  const combiBtn = screen.getAllByRole('button', { name: /Combination boiler/i })[0];
  fireEvent.click(combiBtn);
  fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
}

// ─── 1. Renders route / page ──────────────────────────────────────────────────

describe('InstallationSpecificationStepper — renders', () => {
  it('mounts without crashing', () => {
    renderStepper();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows the current-system step heading on mount', () => {
    renderStepper();
    expect(screen.getByText('What system do you have now?')).toBeTruthy();
  });

  it('renders Back and Next buttons', () => {
    renderStepper();
    expect(screen.getByText('← Back')).toBeTruthy();
    expect(screen.getByText('Next →')).toBeTruthy();
  });

  it('progress pills are visible', () => {
    renderStepper();
    expect(screen.getByText('Current system')).toBeTruthy();
  });
});

// ─── 2. CurrentSystemStep renders graphical tiles ─────────────────────────────

describe('CurrentSystemStep — graphical tiles', () => {
  it('renders all seven system tile titles', () => {
    renderStepper();
    expect(screen.getByText('Combination boiler')).toBeTruthy();
    expect(screen.getByText('System boiler + cylinder')).toBeTruthy();
    expect(screen.getByText('Regular / open vent')).toBeTruthy();
    expect(screen.getByText('Storage combi')).toBeTruthy();
    expect(screen.getByText('Thermal store')).toBeTruthy();
    expect(screen.getByText('Heat pump')).toBeTruthy();
    expect(screen.getByText('Warm air')).toBeTruthy();
  });

  it('renders the subtitle for the combi tile', () => {
    renderStepper();
    expect(screen.getByText('On-demand hot water')).toBeTruthy();
  });

  it('renders the subtitle for the system boiler tile', () => {
    renderStepper();
    expect(screen.getByText('Stored hot water, sealed primary')).toBeTruthy();
  });
});

// ─── 3. No normal "Unknown" tile ─────────────────────────────────────────────

describe('CurrentSystemStep — no normal Unknown tile', () => {
  it('does not render a button with label "Unknown"', () => {
    renderStepper();
    const unknownBtn = screen.queryByRole('button', { name: /^Unknown$/i });
    expect(unknownBtn).toBeNull();
  });

  it('does not render a tile labelled "Unknown" anywhere in the grid', () => {
    renderStepper();
    // The text "Unknown" should not appear as a standalone tile label.
    const unknownText = screen.queryByText('Unknown');
    expect(unknownText).toBeNull();
  });
});

// ─── 4. Exception path exists ─────────────────────────────────────────────────

describe('CurrentSystemStep — exception path', () => {
  it('renders the "Cannot confirm" exception action button', () => {
    renderStepper();
    expect(
      screen.getByRole('button', { name: /Cannot confirm — needs technical review/i }),
    ).toBeTruthy();
  });

  it('tapping the exception button shows a note textarea', () => {
    renderStepper();
    const exceptionBtn = screen.getByRole('button', {
      name: /Cannot confirm — needs technical review/i,
    });
    fireEvent.click(exceptionBtn);
    expect(screen.getByRole('textbox', { name: /Technical review note/i })).toBeTruthy();
  });

  it('shows "Needs technical review" warning when exception panel is open', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /Cannot confirm — needs technical review/i }),
    );
    expect(screen.getByText(/Needs technical review/i)).toBeTruthy();
  });
});

// ─── 5. Exception path requires a note ───────────────────────────────────────

describe('CurrentSystemStep — exception note required', () => {
  it('Next remains disabled when exception path is open with no note', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /Cannot confirm — needs technical review/i }),
    );
    const nextBtn = screen.getByText('Next →').closest('button') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });

  it('Next becomes enabled once a note is entered on the exception path', () => {
    renderStepper();
    fireEvent.click(
      screen.getByRole('button', { name: /Cannot confirm — needs technical review/i }),
    );
    const noteInput = screen.getByRole('textbox', { name: /Technical review note/i });
    fireEvent.change(noteInput, { target: { value: 'Unable to access boiler cupboard.' } });
    const nextBtn = screen.getByText('Next →').closest('button') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);
  });
});

// ─── 6. Normal tile clears exception path ────────────────────────────────────

describe('CurrentSystemStep — tile clears exception', () => {
  it('selecting a normal tile after opening the exception panel hides the panel', () => {
    renderStepper();
    // Open exception panel.
    fireEvent.click(
      screen.getByRole('button', { name: /Cannot confirm — needs technical review/i }),
    );
    expect(screen.getByRole('textbox', { name: /Technical review note/i })).toBeTruthy();
    // Click a normal tile — panel should disappear.
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    expect(screen.queryByRole('textbox', { name: /Technical review note/i })).toBeNull();
  });
});

// ─── 7. Selecting current/proposed system updates draft ───────────────────────

describe('InstallationSpecificationStepper — selection', () => {
  it('tile becomes aria-pressed=true when clicked', () => {
    renderStepper();
    const combiBtns = screen.getAllByRole('button', { name: /Combination boiler/i });
    expect(combiBtns.length).toBeGreaterThan(0);
    fireEvent.click(combiBtns[0]);
    expect(combiBtns[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('only one tile is selected at a time', () => {
    renderStepper();
    const combiBtns = screen.getAllByRole('button', { name: /Combination boiler/i });
    const heatPumpBtns = screen.getAllByRole('button', { name: /Heat pump/i });
    fireEvent.click(combiBtns[0]);
    fireEvent.click(heatPumpBtns[0]);
    expect(combiBtns[0].getAttribute('aria-pressed')).toBe('false');
    expect(heatPumpBtns[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('Next button becomes enabled after selecting a tile', () => {
    renderStepper();
    const nextBtn = screen.getByText('Next →').closest('button') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    expect(nextBtn.disabled).toBe(false);
  });

  it('advances to proposed system step after current-system selection', () => {
    renderStepper();
    advanceToProposedStep();
    expect(screen.getByText('What system are you proposing?')).toBeTruthy();
  });

  it('proposed tile becomes aria-pressed=true when clicked', () => {
    renderStepper();
    advanceToProposedStep();
    const proposedCombiBtn = screen.getAllByRole('button', { name: /Combination boiler/i })[0];
    fireEvent.click(proposedCombiBtn);
    expect(proposedCombiBtn.getAttribute('aria-pressed')).toBe('true');
  });
});

// ─── 8–10. Job classification / narrowing ────────────────────────────────────

describe('InstallationSpecificationStepper — specification path', () => {
  it('combi → combi shows Needs review (no location data in stepper)', () => {
    renderStepper();
    // Step 1: combi
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 2: combi
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 3
    expect(screen.getAllByText('Specification path').length).toBeGreaterThan(0);
    expect(screen.getByText('Needs technical review')).toBeTruthy();
  });

  it('regular/open vent → combi shows Conversion path with correct narrowing items', () => {
    renderStepper();
    // Step 1: regular / open vent
    fireEvent.click(screen.getAllByRole('button', { name: /Regular \/ open vent/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 2: combi
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 3 — should show Conversion and the redundant-cylinder narrowing item
    expect(screen.getByText('Conversion')).toBeTruthy();
    expect(screen.getByText('Redundant cylinder and tank scope')).toBeTruthy();
    expect(screen.getByText('Flue route')).toBeTruthy();
    expect(screen.getByText('Condensate route')).toBeTruthy();
  });

  it('combi → system boiler + cylinder shows Stored hot-water upgrade', () => {
    renderStepper();
    // Step 1: combi
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 2: system boiler
    fireEvent.click(screen.getByRole('button', { name: /System boiler \+ cylinder/i }));
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 3
    expect(screen.getByText('Stored hot-water upgrade')).toBeTruthy();
    expect(screen.getByText('Cylinder location')).toBeTruthy();
  });

  it('combi → heat pump shows Heat-pump conversion with outdoor unit item', () => {
    renderStepper();
    // Step 1: combi
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 2: heat pump
    fireEvent.click(screen.getByRole('button', { name: /Heat pump/i }));
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 3
    expect(screen.getByText('Heat-pump conversion')).toBeTruthy();
    expect(screen.getByText('Outdoor unit location')).toBeTruthy();
  });
});

// ─── 11–12. Recommendation-seeded proposed system ────────────────────────────

describe('InstallationSpecificationStepper — Atlas selected badge', () => {
  it('shows Atlas selected badge on the seeded tile', () => {
    renderSeededStepper('system_boiler');
    advanceToProposedStep();
    expect(screen.getByText('Atlas selected')).toBeTruthy();
  });

  it('pre-selects the seeded tile in ProposedSystemStep', () => {
    renderSeededStepper('combi');
    advanceToProposedStep();
    const combiButtons = screen.getAllByRole('button', { name: /Combination boiler/i });
    const selectedCombi = combiButtons.find((b) => b.getAttribute('aria-pressed') === 'true');
    expect(selectedCombi).toBeTruthy();
  });

  it('does not show Atlas selected when seedProposedSystem is absent', () => {
    renderStepper();
    advanceToProposedStep();
    expect(screen.queryByText('Atlas selected')).toBeNull();
  });

  it('proposed system can be prefilled from Atlas recommendation (Next enabled)', () => {
    renderSeededStepper('heat_pump');
    advanceToProposedStep();
    const nextBtn = screen.getByText('Next →').closest('button') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);
  });
});

// ─── 13. Back / Next navigation ──────────────────────────────────────────────

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
    advanceToProposedStep();
    expect(screen.getByText('What system are you proposing?')).toBeTruthy();
    fireEvent.click(screen.getByText('← Back').closest('button') as HTMLButtonElement);
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText('What system do you have now?')).toBeTruthy();
  });

  it('advancing from step 2 to step 3 shows JobTypeStep', () => {
    renderStepper();
    advanceToProposedStep();
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    expect(screen.getAllByText('Specification path').length).toBeGreaterThan(0);
  });

  it('progress pill for the active step is labelled "Current system" on step 0', () => {
    renderStepper();
    const activePills = document.querySelectorAll('.qp-progress__step--active');
    expect(activePills.length).toBe(1);
    expect(activePills[0].textContent).toBe('Current system');
  });

  it('progress pill advances to "Proposed system" on step 1', () => {
    renderStepper();
    advanceToProposedStep();
    const activePills = document.querySelectorAll('.qp-progress__step--active');
    expect(activePills.length).toBe(1);
    expect(activePills[0].textContent).toBe('Proposed system');
  });
});

// ─── 14. No banned copy ───────────────────────────────────────────────────────

describe('InstallationSpecificationStepper — no banned copy', () => {
  it('does not show "Unknown" as a normal tile label in CurrentSystemStep', () => {
    renderStepper();
    // The word "Unknown" should not be visible as a standalone label anywhere
    // in the normal tile grid (exception path label text is "Needs technical review").
    expect(screen.queryByText('Unknown')).toBeNull();
  });

  it('does not show "Atlas Pick" (deprecated badge label)', () => {
    renderSeededStepper('combi');
    advanceToProposedStep();
    expect(screen.queryByText('Atlas Pick')).toBeNull();
  });
});

// ─── ASHP step gating ─────────────────────────────────────────────────────────

describe('InstallationSpecificationStepper — ASHP step gating', () => {
  /** Navigate current=combi → proposed=heat_pump → job type → key locations → step 5 */
  function advanceToAshpStep5() {
    // Step 1: current system = combi
    fireEvent.click(screen.getAllByRole('button', { name: /Combination boiler/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 2: proposed = heat pump
    fireEvent.click(screen.getByRole('button', { name: /Heat pump/i }));
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 3: job type (no selection required)
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 4: key locations (no selection required)
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
  }

  it('ASHP path step 5 shows Outdoor unit siting — not Flue specification', () => {
    renderStepper();
    advanceToAshpStep5();
    expect(screen.getByTestId('ashp-outdoor-unit-siting')).toBeTruthy();
    expect(screen.queryByText('Flue specification')).toBeNull();
  });

  it('ASHP path step 5 progress pill shows "Outdoor unit siting"', () => {
    renderStepper();
    advanceToAshpStep5();
    // "Outdoor unit siting" appears in both the pill strip and the step heading.
    const matches = screen.getAllByText('Outdoor unit siting');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('ASHP path does not include Flue specification in progress pills', () => {
    renderStepper();
    advanceToProposedStep();
    fireEvent.click(screen.getByRole('button', { name: /Heat pump/i }));
    expect(screen.queryByText('Flue specification')).toBeNull();
  });

  it('ASHP path does not include Condensate specification in progress pills', () => {
    renderStepper();
    advanceToProposedStep();
    fireEvent.click(screen.getByRole('button', { name: /Heat pump/i }));
    expect(screen.queryByText('Condensate specification')).toBeNull();
  });

  it('ASHP path includes Hydraulic route and Electrical supply in progress pills', () => {
    renderStepper();
    advanceToProposedStep();
    fireEvent.click(screen.getByRole('button', { name: /Heat pump/i }));
    expect(screen.getByText('Hydraulic route')).toBeTruthy();
    expect(screen.getByText('Electrical supply')).toBeTruthy();
  });
});

// ─── ASHP → gas exception gating ─────────────────────────────────────────────

describe('InstallationSpecificationStepper — ASHP current system proposed tiles', () => {
  /** Navigate to proposed system step with current = heat_pump */
  function advanceToProposedWithHeatPumpCurrent() {
    const heatPumpBtns = screen.getAllByRole('button', { name: /Heat pump/i });
    fireEvent.click(heatPumpBtns[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
  }

  it('when current is heat_pump, gas boiler tiles are not shown as normal proposed tiles', () => {
    renderStepper();
    advanceToProposedWithHeatPumpCurrent();
    // Normal gas boiler tiles must not be visible outside the exception panel.
    // We check that only the Heat pump tile is available as a primary choice.
    expect(screen.queryByRole('button', { name: /Combination boiler/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /System boiler \+ cylinder/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Regular \/ open vent/i })).toBeNull();
  });

  it('when current is heat_pump, a heat_pump tile is still shown', () => {
    renderStepper();
    advanceToProposedWithHeatPumpCurrent();
    expect(screen.getByRole('button', { name: /Heat pump/i })).toBeTruthy();
  });

  it('when current is heat_pump, an ASHP→gas exception button is present', () => {
    renderStepper();
    advanceToProposedWithHeatPumpCurrent();
    expect(screen.getByTestId('ashp-gas-exception-btn')).toBeTruthy();
  });

  it('ASHP → gas requires technical review note before Next is enabled', () => {
    renderStepper();
    advanceToProposedWithHeatPumpCurrent();

    // Open the exception panel
    fireEvent.click(screen.getByTestId('ashp-gas-exception-btn'));
    expect(screen.getByTestId('ashp-exception-panel')).toBeTruthy();

    // Select a gas system inside the exception panel
    const combiBtns = screen.getAllByRole('button', { name: /Combination boiler/i });
    fireEvent.click(combiBtns[0]);

    // Next should still be disabled (no note)
    const nextBtn = screen.getByText('Next →').closest('button') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    // Enter a reason note
    fireEvent.change(screen.getByLabelText(/ASHP to gas exception note/i), {
      target: { value: 'Customer has decided to revert to gas due to cost.' },
    });

    // Now Next should be enabled
    expect(nextBtn.disabled).toBe(false);
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
    expect(screen.getByText('What system do you have now?')).toBeTruthy();
  });

  it('accepts a seed proposed system and passes it to the stepper', () => {
    render(<InstallationSpecificationPage onBack={vi.fn()} seedProposedSystem="heat_pump" />);
    advanceToProposedStep();
    expect(screen.getByText('Atlas selected')).toBeTruthy();
  });
});

