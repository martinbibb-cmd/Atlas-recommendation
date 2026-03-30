// src/explainers/__tests__/ExplainersHubPage.test.tsx
//
// Tests for ExplainersHubPage — PR6 Simulator Correctness Reset.
//
// Coverage:
//   - Simulator Dashboard title is visible from the first render
//   - Stepper is shown before the simulator panels
//   - After completing the stepper, the 4 simulator panels are visible
//   - Panel expansion (modal) works after stepper completion
//   - Back button behaviour
//   - Home button navigates back to stepper
//   - Survey-backed entry renders canonical SimulatorDashboard panels (not legacy SelectedFamilyDashboard)

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExplainersHubPage from '../ExplainersHubPage'
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3'

// ─── Minimal survey input ─────────────────────────────────────────────────────

const SURVEY_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 1.8,
  mainsDynamicFlowLpm: 14,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  bathroomCount: 1,
  occupancyCount: 3,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'professional',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: true,
  currentHeatSourceType: 'combi',
};

// ─── Helper: advance through the stepper to the dashboard ────────────────────

function completeStepper() {
  // Select a system type on Step 1 so the Next button becomes enabled,
  // then click "Next →" until the "Launch Simulator →" button appears.
  const combiCard = screen.queryByRole('button', { name: /combi boiler/i })
  if (combiCard) fireEvent.click(combiCard)

  let safetyLimit = 10;
  while (safetyLimit-- > 0) {
    const launchBtn = screen.queryByRole('button', { name: /launch simulator/i })
    if (launchBtn) {
      fireEvent.click(launchBtn)
      return
    }
    const nextBtn = screen.queryByRole('button', { name: /go to next step/i })
    if (!nextBtn) break
    // Only click Next if it is enabled
    const isDisabled = (nextBtn as HTMLButtonElement).disabled
    if (isDisabled) break
    fireEvent.click(nextBtn)
  }
}

// ─── Page title ───────────────────────────────────────────────────────────────

describe('ExplainersHubPage — page title', () => {
  it('renders Simulator as the page title', () => {
    render(<ExplainersHubPage />)
    expect(screen.getByRole('heading', { name: /^simulator$/i })).toBeTruthy()
  })

  it('does NOT render the old Demo Lab title', () => {
    render(<ExplainersHubPage />)
    const demolabHeadings = screen.queryAllByRole('heading', { name: /demo lab/i })
    expect(demolabHeadings).toHaveLength(0)
  })
})

// ─── Stepper (first screen) ───────────────────────────────────────────────────

describe('ExplainersHubPage — stepper flow', () => {
  it('shows the setup stepper on first render', () => {
    render(<ExplainersHubPage />)
    expect(screen.getByText(/simulator setup/i)).toBeTruthy()
  })

  it('shows system type choices in the stepper', () => {
    render(<ExplainersHubPage />)
    // Check the card labels specifically (not description text which may also contain similar words).
    const combiCard = screen.getByRole('button', { name: /combi boiler/i })
    expect(combiCard).toBeTruthy()
    const unventedCard = screen.getByRole('button', { name: /unvented cylinder/i })
    expect(unventedCard).toBeTruthy()
    const ventedCard = screen.getByRole('button', { name: /open vented cylinder/i })
    expect(ventedCard).toBeTruthy()
    const hpCard = screen.getByRole('button', { name: /^heat pump/i })
    expect(hpCard).toBeTruthy()
  })

  it('does NOT show the simulator panels before the stepper is completed', () => {
    render(<ExplainersHubPage />)
    const panelButtons = screen.queryAllByRole('button', { name: /expand system diagram/i })
    expect(panelButtons).toHaveLength(0)
  })

  it('shows the 4 simulator panels after completing the stepper', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    expect(screen.getByRole('button', { name: /expand system diagram/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /expand house view/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /expand draw-off behaviour/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /expand efficiency/i })).toBeTruthy()
  })

  it('shows the Home button after completing the stepper', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    expect(screen.getByRole('button', { name: /^home$/i })).toBeTruthy()
  })

  it('clicking Home returns to the stepper', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    const homeBtn = screen.getByRole('button', { name: /^home$/i })
    fireEvent.click(homeBtn)
    // Back on stepper
    expect(screen.getByText(/simulator setup/i)).toBeTruthy()
    const panelButtons = screen.queryAllByRole('button', { name: /expand system diagram/i })
    expect(panelButtons).toHaveLength(0)
  })
})

// ─── 4 panels (post-stepper) ──────────────────────────────────────────────────

describe('ExplainersHubPage — simulator panels', () => {
  it('renders the System Diagram panel after stepper', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    expect(screen.getByRole('button', { name: /expand system diagram/i })).toBeTruthy()
  })

  it('renders the House View panel after stepper', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    expect(screen.getByRole('button', { name: /expand house view/i })).toBeTruthy()
  })

  it('renders the Draw-Off Behaviour panel after stepper', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    expect(screen.getByRole('button', { name: /expand draw-off behaviour/i })).toBeTruthy()
  })

  it('renders the Efficiency panel after stepper', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    expect(screen.getByRole('button', { name: /expand efficiency/i })).toBeTruthy()
  })
})

// ─── Old mode strip is gone ───────────────────────────────────────────────────

describe('ExplainersHubPage — old UI elements removed', () => {
  it('does not render the old House View mode button', () => {
    render(<ExplainersHubPage />)
    const navEl = document.querySelector('.lab-mode-strip')
    expect(navEl).toBeNull()
  })

  it('does not render the old Advanced Builder mode button', () => {
    render(<ExplainersHubPage />)
    const advancedBtns = screen.queryAllByRole('button', { name: /advanced builder/i })
    expect(advancedBtns).toHaveLength(0)
  })
})

// ─── Panel expansion ─────────────────────────────────────────────────────────

describe('ExplainersHubPage — panel expansion', () => {
  it('clicking a panel opens an expanded modal', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    const systemPanel = screen.getByRole('button', { name: /expand system diagram/i })
    fireEvent.click(systemPanel)
    expect(screen.getByRole('dialog', { name: /system diagram expanded view/i })).toBeTruthy()
  })

  it('modal has a close button that dismisses it', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    fireEvent.click(screen.getByRole('button', { name: /expand system diagram/i }))
    const closeBtn = screen.getByRole('button', { name: /close expanded view/i })
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// ─── Back button ─────────────────────────────────────────────────────────────

describe('ExplainersHubPage — back button', () => {
  it('shows Back button when onBack prop is provided', () => {
    render(<ExplainersHubPage onBack={() => {}} />)
    expect(screen.getByRole('button', { name: /← back/i })).toBeTruthy()
  })

  it('does not show Back button when onBack is absent', () => {
    render(<ExplainersHubPage />)
    const backBtns = screen.queryAllByRole('button', { name: /← back/i })
    expect(backBtns).toHaveLength(0)
  })
})

// ─── Secondary content moved to global menu ───────────────────────────────────

describe('ExplainersHubPage — secondary content moved to global menu', () => {
  it('does not render Physics Explainers section inline after completing the stepper', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    // The "Physics Explainers" heading should not appear inline in the page body.
    // It is only accessible via the global menu.
    const explainerHeadings = screen.queryAllByRole('heading', { name: /^physics explainers$/i })
    expect(explainerHeadings).toHaveLength(0)
  })

  it('does not render Energy Literacy section inline after completing the stepper', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    // The Energy Literacy panel heading should not appear inline.
    const energyHeadings = screen.queryAllByRole('heading', { name: /energy literacy/i })
    expect(energyHeadings).toHaveLength(0)
  })
})

// ─── Survey-backed entry: canonical simulator (regression) ────────────────────
//
// These tests guard against the regression where the survey-backed entry opened
// SelectedFamilyDashboard (the legacy analysis shell with family pills, tab bar
// and scores) instead of the canonical SimulatorDashboard.
//
// When launched with surveyData, ExplainersHubPage immediately opens
// SimulatorDashboard in compare mode (current vs proposed), bypassing the
// stepper.  Compare mode renders two columns each showing System Diagram,
// Efficiency, System Limiters, System Inputs, and System Behaviour panels.

describe('ExplainersHubPage — survey-backed entry opens canonical SimulatorDashboard', () => {
  it('shows the compare layout (two-column canonical simulator) when surveyData is provided', () => {
    render(<ExplainersHubPage surveyData={SURVEY_INPUT} />)
    const compareLayout = document.querySelector('[data-testid="compare-layout"]')
    expect(compareLayout).toBeTruthy()
  })

  it('shows at least one System Diagram panel when surveyData is provided', () => {
    render(<ExplainersHubPage surveyData={SURVEY_INPUT} />)
    const panels = screen.getAllByRole('button', { name: /expand system diagram/i })
    expect(panels.length).toBeGreaterThanOrEqual(1)
  })

  it('shows at least one Efficiency panel when surveyData is provided', () => {
    render(<ExplainersHubPage surveyData={SURVEY_INPUT} />)
    const panels = screen.getAllByRole('button', { name: /expand efficiency/i })
    expect(panels.length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT show the stepper when surveyData is provided', () => {
    render(<ExplainersHubPage surveyData={SURVEY_INPUT} />)
    expect(screen.queryByText(/simulator setup/i)).toBeNull()
  })

  it('does NOT show the legacy SelectedFamilyDashboard summary strip when surveyData is provided', () => {
    render(<ExplainersHubPage surveyData={SURVEY_INPUT} />)
    // summary-strip is the hallmark of the legacy SelectedFamilyDashboard analysis shell.
    const summaryStrip = document.querySelector('[data-testid="summary-strip"]')
    expect(summaryStrip).toBeNull()
  })

  it('does NOT show the legacy SelectedFamilyDashboard key-scores section when surveyData is provided', () => {
    render(<ExplainersHubPage surveyData={SURVEY_INPUT} />)
    // key-scores is only part of SelectedFamilyDashboard, not SimulatorDashboard.
    const scoresStrip = document.querySelector('[data-testid="key-scores"]')
    expect(scoresStrip).toBeNull()
  })

  it('does NOT show the legacy SelectedFamilyDashboard family pills (data-testid) when surveyData is provided', () => {
    render(<ExplainersHubPage surveyData={SURVEY_INPUT} />)
    // These specific data-testids only exist on SelectedFamilyDashboard family selector pills.
    const combiPill = document.querySelector('[data-testid="family-pill-combi"]')
    expect(combiPill).toBeNull()
  })
})
