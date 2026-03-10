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
//   - Setup button navigates back to stepper

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExplainersHubPage from '../ExplainersHubPage'

// ─── Helper: advance through the stepper to the dashboard ────────────────────

function completeStepper() {
  // Click "Next →" until the "Launch Simulator →" button appears, then click it.
  // This is resilient to changes in the total number of stepper steps.
  let safetyLimit = 10;
  while (safetyLimit-- > 0) {
    const launchBtn = screen.queryByRole('button', { name: /launch simulator/i })
    if (launchBtn) {
      fireEvent.click(launchBtn)
      return
    }
    const nextBtn = screen.queryByRole('button', { name: /go to next step/i })
    if (!nextBtn) break
    fireEvent.click(nextBtn)
  }
}

// ─── Page title ───────────────────────────────────────────────────────────────

describe('ExplainersHubPage — page title', () => {
  it('renders Simulator Dashboard as the page title', () => {
    render(<ExplainersHubPage />)
    expect(screen.getByRole('heading', { name: /simulator dashboard/i })).toBeTruthy()
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
    expect(screen.getByRole('button', { name: /expand draw-off status/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /expand efficiency/i })).toBeTruthy()
  })

  it('shows the Setup button after completing the stepper', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    expect(screen.getByRole('button', { name: /return to setup/i })).toBeTruthy()
  })

  it('clicking Setup returns to the stepper', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    const setupBtn = screen.getByRole('button', { name: /return to setup/i })
    fireEvent.click(setupBtn)
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

  it('renders the Draw-Off Status panel after stepper', () => {
    render(<ExplainersHubPage />)
    completeStepper()
    expect(screen.getByRole('button', { name: /expand draw-off status/i })).toBeTruthy()
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
