/**
 * InstallationSpecificationStepper.test.tsx
 *
 * Acceptance tests for the Installation Specification visual stepper shell.
 *
 * Coverage (from problem statement):
 *   1. Renders route/page — stepper mounts, progress is visible.
 *   2. Selecting current system updates draft — tile becomes selected.
 *   3. Selecting proposed system updates draft — tile becomes selected.
 *   4. Job classification updates — JobTypeStep shows derived type.
 *   5. Recommendation-seeded proposed system shown with Atlas Pick badge.
 *   6. Back/Next navigation works.
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

  it('shows all eight current-system tiles', () => {
    renderStepper();
    expect(screen.getByText('Combi')).toBeTruthy();
    expect(screen.getByText('System boiler')).toBeTruthy();
    expect(screen.getByText('Regular / open vent')).toBeTruthy();
    expect(screen.getByText('Storage combi')).toBeTruthy();
    expect(screen.getByText('Thermal store')).toBeTruthy();
    expect(screen.getByText('Heat pump')).toBeTruthy();
    expect(screen.getByText('Warm air')).toBeTruthy();
    expect(screen.getByText('Unknown')).toBeTruthy();
  });

  it('renders Back and Next buttons', () => {
    renderStepper();
    expect(screen.getByText('← Back')).toBeTruthy();
    expect(screen.getByText('Next →')).toBeTruthy();
  });

  it('progress pills are visible', () => {
    renderStepper();
    // The active "Current" pill should be present.
    expect(screen.getByText('Current system')).toBeTruthy();
  });
});

// ─── 2. Selecting current system updates draft ────────────────────────────────

describe('InstallationSpecificationStepper — current system selection', () => {
  it('tile becomes aria-pressed=true when clicked', () => {
    renderStepper();
    // Use getAllByRole + first to avoid matching "Storage combi" which also contains "combi".
    const combiBtns = screen.getAllByRole('button', { name: /^Combi$/i });
    expect(combiBtns.length).toBeGreaterThan(0);
    fireEvent.click(combiBtns[0]);
    expect(combiBtns[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('only one tile is selected at a time', () => {
    renderStepper();
    const combiBtns = screen.getAllByRole('button', { name: /^Combi$/i });
    const unknownBtns = screen.getAllByRole('button', { name: /^Unknown$/i });
    fireEvent.click(combiBtns[0]);
    fireEvent.click(unknownBtns[0]);
    expect(combiBtns[0].getAttribute('aria-pressed')).toBe('false');
    expect(unknownBtns[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('Next button becomes enabled after selecting a tile', () => {
    renderStepper();
    const nextBtn = screen.getByText('Next →').closest('button') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
    const combiBtns = screen.getAllByRole('button', { name: /^Combi$/i });
    fireEvent.click(combiBtns[0]);
    expect(nextBtn.disabled).toBe(false);
  });
});

// ─── 3. Selecting proposed system updates draft ───────────────────────────────

describe('InstallationSpecificationStepper — proposed system selection', () => {
  it('advances to proposed system step after current-system selection', () => {
    renderStepper();
    // Select a current system then advance.
    const combiBtns = screen.getAllByRole('button', { name: /^Combi$/i });
    fireEvent.click(combiBtns[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    expect(screen.getByText('What system are you proposing?')).toBeTruthy();
  });

  it('proposed tile becomes aria-pressed=true when clicked', () => {
    renderStepper();
    // Step 1: select current system → advance.
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);

    // Step 2: select proposed system tile.
    const proposedCombiBtn = screen.getAllByRole('button', { name: /^Combi$/i })[0];
    fireEvent.click(proposedCombiBtn);
    expect(proposedCombiBtn.getAttribute('aria-pressed')).toBe('true');
  });
});

// ─── 4. Job classification updates ───────────────────────────────────────────

describe('InstallationSpecificationStepper — job classification', () => {
  it('shows "Needs review" when combi → combi is selected (no location data available)', () => {
    // classifyQuoteJob returns needs_review for same-family when no location data is provided
    // by the stepper shell — this is correct engine behaviour, not a UI bug.
    renderStepper();
    // Step 1
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 2
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 3 — needs_review because location data is not available in the stepper shell.
    expect(screen.getByText('Job classification')).toBeTruthy();
    expect(screen.getByText('Needs review')).toBeTruthy();
  });

  it('shows "Stored hot-water upgrade" when combi → system boiler is selected', () => {
    renderStepper();
    // Step 1
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 2
    fireEvent.click(screen.getByRole('button', { name: /^System boiler$/i }));
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 3
    expect(screen.getByText('Stored hot-water upgrade')).toBeTruthy();
  });

  it('shows "Low-carbon conversion" when combi → heat pump is selected', () => {
    renderStepper();
    // Step 1
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 2
    fireEvent.click(screen.getByRole('button', { name: /^Heat pump$/i }));
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 3
    expect(screen.getByText('Low-carbon conversion')).toBeTruthy();
  });
});

// ─── 5. Recommendation-seeded proposed system shows Atlas Pick badge ──────────

describe('InstallationSpecificationStepper — Atlas Pick badge', () => {
  it('shows Atlas Pick badge on the seeded tile', () => {
    renderSeededStepper('system_boiler');
    // Advance to the proposed system step.
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // The "System boiler" tile should carry the Atlas Pick badge.
    expect(screen.getByText('Atlas Pick')).toBeTruthy();
  });

  it('pre-selects the seeded tile in ProposedSystemStep', () => {
    renderSeededStepper('combi');
    // Advance to step 2.
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // The combi tile in step 2 should already be selected (aria-pressed=true).
    // With aria-label on the button the name is just the label text.
    const combiButtons = screen.getAllByRole('button', { name: /^Combi$/i });
    const selectedCombi = combiButtons.find((b) => b.getAttribute('aria-pressed') === 'true');
    expect(selectedCombi).toBeTruthy();
  });

  it('does not show Atlas Pick when seedProposedSystem is absent', () => {
    renderStepper();
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    expect(screen.queryByText('Atlas Pick')).toBeNull();
  });
});

// ─── 6. Back / Next navigation ────────────────────────────────────────────────

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
    // Advance to step 1.
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    expect(screen.getByText('What system are you proposing?')).toBeTruthy();
    fireEvent.click(screen.getByText('← Back').closest('button') as HTMLButtonElement);
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText('What system do you have now?')).toBeTruthy();
  });

  it('advancing from step 2 to step 3 shows JobTypeStep', () => {
    renderStepper();
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    // Step 2: select a proposed system.
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    expect(screen.getByText('Job classification')).toBeTruthy();
  });

  it('progress pill for the active step is labelled "Current" on step 0', () => {
    renderStepper();
    const activePills = document.querySelectorAll('.qp-progress__step--active');
    expect(activePills.length).toBe(1);
    expect(activePills[0].textContent).toBe('Current system');
  });

  it('progress pill advances to "Proposed" on step 1', () => {
    renderStepper();
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    const activePills = document.querySelectorAll('.qp-progress__step--active');
    expect(activePills.length).toBe(1);
    expect(activePills[0].textContent).toBe('Proposed system');
  });
});

// ─── InstallationSpecificationPage — smoke test ───────────────────────────────────────────

describe('InstallationSpecificationPage', () => {
  it('renders the stepper through the page wrapper', () => {
    render(<InstallationSpecificationPage onBack={vi.fn()} />);
    expect(screen.getByText('What system do you have now?')).toBeTruthy();
  });

  it('accepts a seed proposed system and passes it to the stepper', () => {
    render(<InstallationSpecificationPage onBack={vi.fn()} seedProposedSystem="heat_pump" />);
    // Navigate to step 2 to see the badge.
    fireEvent.click(screen.getAllByRole('button', { name: /^Combi$/i })[0]);
    fireEvent.click(screen.getByText('Next →').closest('button') as HTMLButtonElement);
    expect(screen.getByText('Atlas Pick')).toBeTruthy();
  });
});
