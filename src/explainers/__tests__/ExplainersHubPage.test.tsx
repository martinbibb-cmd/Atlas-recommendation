// src/explainers/__tests__/ExplainersHubPage.test.tsx
//
// Tests for the ExplainersHubPage — PR5 lab navigation.
//
// Coverage:
//   - House View is the default lab mode on first render
//   - LabModeStrip renders both mode buttons
//   - Switching to Advanced Builder shows the builder section
//   - Switching back to House View restores the house view
//   - Builder remains accessible from advanced mode

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExplainersHubPage from '../ExplainersHubPage'

describe('ExplainersHubPage — lab navigation (PR5)', () => {
  // ── Default mode ────────────────────────────────────────────────────────

  it('renders House View as the default mode', () => {
    render(<ExplainersHubPage />)
    const houseBtn = screen.getByRole('button', { name: /house view/i })
    expect(houseBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('renders Advanced Builder button in non-active state by default', () => {
    render(<ExplainersHubPage />)
    const builderBtn = screen.getByRole('button', { name: /advanced builder/i })
    expect(builderBtn.getAttribute('aria-pressed')).toBe('false')
  })

  // ── Mode strip presence ─────────────────────────────────────────────────

  it('shows both mode buttons in the strip', () => {
    render(<ExplainersHubPage />)
    expect(screen.getByRole('button', { name: /house view/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /advanced builder/i })).toBeTruthy()
  })

  it('mode strip has lab nav aria-label', () => {
    render(<ExplainersHubPage />)
    expect(screen.getByRole('navigation', { name: /lab mode/i })).toBeTruthy()
  })

  // ── Mode switching ──────────────────────────────────────────────────────

  it('switching to Advanced Builder marks that button active', () => {
    render(<ExplainersHubPage />)
    const builderBtn = screen.getByRole('button', { name: /advanced builder/i })
    fireEvent.click(builderBtn)
    expect(builderBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('switching to Advanced Builder deactivates House View button', () => {
    render(<ExplainersHubPage />)
    fireEvent.click(screen.getByRole('button', { name: /advanced builder/i }))
    const houseBtn = screen.getByRole('button', { name: /house view/i })
    expect(houseBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('switching back to House View re-activates that button', () => {
    render(<ExplainersHubPage />)
    fireEvent.click(screen.getByRole('button', { name: /advanced builder/i }))
    fireEvent.click(screen.getByRole('button', { name: /house view/i }))
    const houseBtn = screen.getByRole('button', { name: /house view/i })
    expect(houseBtn.getAttribute('aria-pressed')).toBe('true')
  })

  // ── Builder accessibility ────────────────────────────────────────────────

  it('builder section is reachable via Advanced Builder mode', () => {
    render(<ExplainersHubPage />)
    fireEvent.click(screen.getByRole('button', { name: /advanced builder/i }))
    // LegoScenarioBuilder is mounted in this mode — verify no crash and some content renders
    // The demo-lab-section container should be present
    const section = document.querySelector('.demo-lab-section')
    expect(section).not.toBeNull()
  })

  // ── Lab header ───────────────────────────────────────────────────────────

  it('always shows the Demo Lab title', () => {
    render(<ExplainersHubPage />)
    expect(screen.getByRole('heading', { name: /demo lab/i })).toBeTruthy()
  })

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
