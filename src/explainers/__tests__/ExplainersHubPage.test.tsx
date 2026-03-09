// src/explainers/__tests__/ExplainersHubPage.test.tsx
//
// Tests for the ExplainersHubPage — PR1 Simulator Dashboard.
//
// Coverage:
//   - Simulator Dashboard renders as the default lab landing
//   - Page title is "Simulator Dashboard"
//   - All 4 panels are present
//   - Panels are tappable and open an expanded modal
//   - Back button is shown when onBack prop is provided
//   - Back button is absent when onBack is not provided

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExplainersHubPage from '../ExplainersHubPage'

describe('ExplainersHubPage — Simulator Dashboard (PR1)', () => {
  // ── Page title ──────────────────────────────────────────────────────────

  it('renders Simulator Dashboard as the page title', () => {
    render(<ExplainersHubPage />)
    expect(screen.getByRole('heading', { name: /simulator dashboard/i })).toBeTruthy()
  })

  it('does NOT render the old Demo Lab title', () => {
    render(<ExplainersHubPage />)
    const demolabHeadings = screen.queryAllByRole('heading', { name: /demo lab/i })
    expect(demolabHeadings).toHaveLength(0)
  })

  // ── 4 panels ────────────────────────────────────────────────────────────

  it('renders the System Diagram panel', () => {
    render(<ExplainersHubPage />)
    expect(screen.getByRole('button', { name: /expand system diagram/i })).toBeTruthy()
  })

  it('renders the House View panel', () => {
    render(<ExplainersHubPage />)
    expect(screen.getByRole('button', { name: /expand house view/i })).toBeTruthy()
  })

  it('renders the Draw-Off Status panel', () => {
    render(<ExplainersHubPage />)
    expect(screen.getByRole('button', { name: /expand draw-off status/i })).toBeTruthy()
  })

  it('renders the Efficiency panel', () => {
    render(<ExplainersHubPage />)
    expect(screen.getByRole('button', { name: /expand efficiency/i })).toBeTruthy()
  })

  // ── Old mode strip is gone ───────────────────────────────────────────────

  it('does not render the old House View mode button', () => {
    render(<ExplainersHubPage />)
    // The old LabModeStrip "🏠 House View" nav button should be absent
    const navEl = document.querySelector('.lab-mode-strip')
    expect(navEl).toBeNull()
  })

  it('does not render the old Advanced Builder mode button', () => {
    render(<ExplainersHubPage />)
    const advancedBtns = screen.queryAllByRole('button', { name: /advanced builder/i })
    expect(advancedBtns).toHaveLength(0)
  })

  // ── Panel expansion ─────────────────────────────────────────────────────

  it('clicking a panel opens an expanded modal', () => {
    render(<ExplainersHubPage />)
    const systemPanel = screen.getByRole('button', { name: /expand system diagram/i })
    fireEvent.click(systemPanel)
    expect(screen.getByRole('dialog', { name: /system diagram expanded view/i })).toBeTruthy()
  })

  it('modal has a close button that dismisses it', () => {
    render(<ExplainersHubPage />)
    fireEvent.click(screen.getByRole('button', { name: /expand system diagram/i }))
    const closeBtn = screen.getByRole('button', { name: /close expanded view/i })
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // ── Back button ─────────────────────────────────────────────────────────

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
