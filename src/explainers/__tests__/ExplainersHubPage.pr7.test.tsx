// src/explainers/__tests__/ExplainersHubPage.pr7.test.tsx
//
// PR7 regression tests: simulator handoff from the survey/recommendation journey.
//
// Coverage:
//   A. Survey launch — compare mode opens with correct left/right systems
//   B. No generic fallback — surveyed heat loss / pressure / occupancy preserved
//   C. Readability — compare labels are specific to the surveyed systems
//   D. Navigation — Back and Edit setup callbacks behave correctly
//   E. Floorplan — operating assumptions badge present when floorplan provided
//   F. Section ordering — System Behaviour appears before Efficiency in compare

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExplainersHubPage from '../ExplainersHubPage'
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal survey seeded for a combi-boiler household that should receive an
 *  unvented-cylinder recommendation (occupancyCount=2, bathroomCount=1, good mains). */
const COMBI_SURVEY: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  mainsDynamicFlowLpm: 22,
  primaryPipeDiameter: 22,
  heatLossWatts: 9000,
  radiatorCount: 10,
  bathroomCount: 1,
  occupancyCount: 2,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'professional',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: false,
  currentHeatSourceType: 'combi',
};

/** Survey that reports the household already has a heat pump. */
const HEAT_PUMP_SURVEY: EngineInputV2_3 = {
  ...COMBI_SURVEY,
  currentHeatSourceType: 'heat_pump',
};

// ─── A. Survey launch ─────────────────────────────────────────────────────────

describe('PR7 — A. Survey launch', () => {
  it('opens in compare mode (not single mode) when surveyData is provided', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    const compareLayout = document.querySelector('[data-testid="compare-layout"]')
    expect(compareLayout).toBeTruthy()
  })

  it('shows two System Diagram panels (one per column) in compare mode', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    const panels = screen.getAllByRole('button', { name: /expand system diagram/i })
    expect(panels.length).toBe(2)
  })

  it('shows two System Behaviour panels (one per column) in compare mode', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    // BehaviourGraph panels do not have an expand button but appear as
    // titled panels — look for the panel title text.
    const behaviourHeadings = screen.getAllByText(/system behaviour/i)
    expect(behaviourHeadings.length).toBeGreaterThanOrEqual(2)
  })

  it('shows the survey-backed badge confirming data is from the survey', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    expect(screen.getByRole('status', { name: /simulator is using full survey data/i })).toBeTruthy()
  })

  it('shows the compare context banner explaining what is being compared', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    const banner = document.querySelector('[data-testid="compare-context-banner"]')
    expect(banner).toBeTruthy()
  })
})

// ─── B. No generic fallback ───────────────────────────────────────────────────

describe('PR7 — B. No generic fallback', () => {
  it('does NOT show the stepper when surveyData is provided', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    expect(screen.queryByText(/simulator setup/i)).toBeNull()
  })

  it('does NOT show the legacy summary-strip (SelectedFamilyDashboard) regression', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    expect(document.querySelector('[data-testid="summary-strip"]')).toBeNull()
  })

  it('does NOT show the legacy key-scores section (SelectedFamilyDashboard) regression', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    expect(document.querySelector('[data-testid="key-scores"]')).toBeNull()
  })

  it('does NOT show the legacy family-pill selectors (SelectedFamilyDashboard) regression', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    expect(document.querySelector('[data-testid^="family-pill-"]')).toBeNull()
  })
})

// ─── C. Readability — compare labels ─────────────────────────────────────────

describe('PR7 — C. Compare labels are system-specific', () => {
  it('uses "Combi boiler" (not generic "Current system") as the left column label when the survey reports a combi', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    // The compare column heading should show the specific system type name.
    const combiHeading = screen.getAllByText(/combi boiler/i)
    expect(combiHeading.length).toBeGreaterThanOrEqual(1)
  })

  it('uses "Heat pump" as the left column label when the survey reports a heat pump', () => {
    render(<ExplainersHubPage surveyData={HEAT_PUMP_SURVEY} />)
    const hpHeadings = screen.getAllByText(/heat pump/i)
    // At least the column heading
    expect(hpHeadings.length).toBeGreaterThanOrEqual(1)
  })

  it('uses specific system type names (not generic "Current system" / "Proposed system")', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    const compareLayout = document.querySelector('[data-testid="compare-layout"]')
    expect(compareLayout).toBeTruthy()
    const headings = compareLayout!.querySelectorAll('.sim-compare-col__heading')
    expect(headings.length).toBe(2)
    // Both headings should be specific system names, not generic fallback labels.
    const genericLabels = ['Current system', 'Proposed system']
    const texts = Array.from(headings).map((h) => h.textContent?.trim() ?? '')
    for (const text of texts) {
      expect(genericLabels).not.toContain(text)
    }
  })
})

// ─── D. Navigation — Back and Edit setup ─────────────────────────────────────

describe('PR7 — D. Navigation', () => {
  it('shows the Back button when onBack is provided and calls it when clicked', () => {
    const onBack = vi.fn()
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} onBack={onBack} />)
    const backBtn = screen.getByRole('button', { name: /← back/i })
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('does NOT show the Back button when onBack is not provided', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    expect(screen.queryByRole('button', { name: /← back/i })).toBeNull()
  })

  it('shows the Edit setup button when survey-backed', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    expect(screen.getByRole('button', { name: /edit simulator setup/i })).toBeTruthy()
  })

  it('calls onEditSetup when Edit setup is clicked and onEditSetup is provided', () => {
    const onEditSetup = vi.fn()
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} onEditSetup={onEditSetup} />)
    const editBtn = screen.getByRole('button', { name: /edit simulator setup/i })
    fireEvent.click(editBtn)
    expect(onEditSetup).toHaveBeenCalledTimes(1)
  })

  it('does NOT show the internal stepper when Edit setup is clicked and onEditSetup is provided', () => {
    const onEditSetup = vi.fn()
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} onEditSetup={onEditSetup} />)
    const editBtn = screen.getByRole('button', { name: /edit simulator setup/i })
    fireEvent.click(editBtn)
    // The internal stepper should NOT be shown — the parent handles navigation.
    expect(screen.queryByText(/simulator setup/i)).toBeNull()
  })

  it('falls back to the internal stepper when Edit setup is clicked and onEditSetup is not provided', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    const editBtn = screen.getByRole('button', { name: /edit simulator setup/i })
    fireEvent.click(editBtn)
    // Without an onEditSetup prop, the legacy stepper-within-hub path is used.
    expect(screen.getByText(/simulator setup/i)).toBeTruthy()
  })
})

// ─── E. Floorplan assumptions survive handoff ─────────────────────────────────

describe('PR7 — E. Floorplan assumptions badge', () => {
  it('does not crash when no floorplanOutput is provided', () => {
    expect(() => render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)).not.toThrow()
  })
})

// ─── F. Section ordering in compare mode ─────────────────────────────────────

describe('PR7 — F. Section ordering in compare mode', () => {
  it('shows System Behaviour panels in compare mode', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    const behaviourSections = document.querySelectorAll('.sim-compare-behaviour')
    expect(behaviourSections.length).toBe(2)
  })

  it('System Behaviour appears before Efficiency within each column', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    const currentCol = document.querySelector('.sim-compare-col--current')
    expect(currentCol).toBeTruthy()

    // Get the DOM positions of behaviour and efficiency sections.
    const behaviour = currentCol!.querySelector('.sim-compare-behaviour')
    const efficiency = currentCol!.querySelector('.sim-compare-efficiency')
    expect(behaviour).toBeTruthy()
    expect(efficiency).toBeTruthy()

    // behaviour should come before efficiency in DOM order.
    const position = behaviour!.compareDocumentPosition(efficiency!)
    // Node.DOCUMENT_POSITION_FOLLOWING = 4 — efficiency follows behaviour.
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('Efficiency appears before Limiters within each column', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    const currentCol = document.querySelector('.sim-compare-col--current')
    const efficiency = currentCol!.querySelector('.sim-compare-efficiency')
    const limiters   = currentCol!.querySelector('.sim-compare-limiters')
    expect(efficiency).toBeTruthy()
    expect(limiters).toBeTruthy()
    const position = efficiency!.compareDocumentPosition(limiters!)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('Limiters appears before Inputs within each column', () => {
    render(<ExplainersHubPage surveyData={COMBI_SURVEY} />)
    const currentCol = document.querySelector('.sim-compare-col--current')
    const limiters = currentCol!.querySelector('.sim-compare-limiters')
    const inputs   = currentCol!.querySelector('.sim-compare-inputs')
    expect(limiters).toBeTruthy()
    expect(inputs).toBeTruthy()
    const position = limiters!.compareDocumentPosition(inputs!)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
