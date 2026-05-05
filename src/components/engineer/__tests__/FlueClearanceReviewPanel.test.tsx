/**
 * FlueClearanceReviewPanel.test.tsx
 *
 * Tests for the FlueClearanceReviewPanel component.
 *
 * Coverage:
 *   - Returns null when no scenes are provided
 *   - Renders the panel with scenes
 *   - Default review status is needs_review
 *   - No pass/fail wording appears
 *   - Engineer can change review status
 *   - Engineer can add notes
 *   - customerDetailEnabled toggle defaults to false (summary-only notice shown)
 *   - Toggling customerDetailEnabled hides the summary-only notice
 *   - Multiple scenes each get their own review form
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlueClearanceReviewPanel } from '../FlueClearanceReviewPanel';
import type { ExternalClearanceSceneV1 } from '../../../contracts/spatial3dEvidence';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeScene(overrides: Partial<ExternalClearanceSceneV1> = {}): ExternalClearanceSceneV1 {
  return {
    id:              'scene-1',
    propertyId:      'prop-1',
    sourceSessionId: 'session-1',
    kind:            'external_flue_clearance',
    evidence:        {},
    nearbyFeatures:  [],
    measurements:    [],
    ...overrides,
  };
}

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('FlueClearanceReviewPanel — empty state', () => {
  it('returns null when no scenes provided', () => {
    const { container } = render(<FlueClearanceReviewPanel scenes={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

// ─── Render with scenes ───────────────────────────────────────────────────────

describe('FlueClearanceReviewPanel — with scenes', () => {
  it('renders the panel', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene()]} />);
    expect(screen.getByTestId('flue-clearance-review-panel')).toBeInTheDocument();
  });

  it('renders a scene review form for each scene', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-a' }), makeScene({ id: 'scene-b' })]} />);
    expect(screen.getByTestId('flue-clearance-review-scene-scene-a')).toBeInTheDocument();
    expect(screen.getByTestId('flue-clearance-review-scene-scene-b')).toBeInTheDocument();
  });

  it('shows scene count in header', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene(), makeScene({ id: 'scene-2' })]} />);
    expect(screen.getByText(/2 scenes/i)).toBeInTheDocument();
  });

  it('shows singular label for one scene', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene()]} />);
    expect(screen.getByText(/1 scene$/i)).toBeInTheDocument();
  });
});

// ─── Default status ───────────────────────────────────────────────────────────

describe('FlueClearanceReviewPanel — default status', () => {
  it('defaults to needs_review status for each scene', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-1' })]} />);
    const select = screen.getByTestId('review-status-select-scene-1') as HTMLSelectElement;
    expect(select.value).toBe('needs_review');
  });

  it('shows "Needs review" badge by default', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-1' })]} />);
    const scene = screen.getByTestId('flue-clearance-review-scene-scene-1');
    // The badge renders the status label as a <span> — use getAllByText to avoid
    // false failure when the text also appears in an <option>.
    const matches = Array.from(scene.querySelectorAll('span')).filter(
      (el) => el.textContent === 'Needs review',
    );
    expect(matches.length).toBeGreaterThan(0);
  });
});

// ─── No pass/fail wording ─────────────────────────────────────────────────────

describe('FlueClearanceReviewPanel — no pass/fail wording', () => {
  it('does not contain the word "pass"', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene()]} />);
    const text = screen.getByTestId('flue-clearance-review-panel').textContent ?? '';
    expect(text.toLowerCase()).not.toMatch(/\bpass\b/);
  });

  it('does not contain the word "fail"', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene()]} />);
    const text = screen.getByTestId('flue-clearance-review-panel').textContent ?? '';
    expect(text.toLowerCase()).not.toMatch(/\bfail\b/);
  });

  it('does not contain "compliance" wording in status labels', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene()]} />);
    const text = screen.getByTestId('flue-clearance-review-panel').textContent ?? '';
    expect(text.toLowerCase()).not.toMatch(/\bcompliance\b/);
  });
});

// ─── Status change ────────────────────────────────────────────────────────────

describe('FlueClearanceReviewPanel — status change', () => {
  it('engineer can change status to acceptable', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-1' })]} />);
    const select = screen.getByTestId('review-status-select-scene-1') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'acceptable' } });
    expect(select.value).toBe('acceptable');
    // The badge <span> should show the new label — use within the scene wrapper.
    const scene = screen.getByTestId('flue-clearance-review-scene-scene-1');
    const badge = Array.from(scene.querySelectorAll('span')).find(
      (el) => el.textContent === 'Acceptable',
    );
    expect(badge).toBeTruthy();
  });

  it('engineer can change status to blocked', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-1' })]} />);
    const select = screen.getByTestId('review-status-select-scene-1') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'blocked' } });
    expect(select.value).toBe('blocked');
    const scene = screen.getByTestId('flue-clearance-review-scene-scene-1');
    const badge = Array.from(scene.querySelectorAll('span')).find(
      (el) => el.textContent === 'Blocked',
    );
    expect(badge).toBeTruthy();
  });

  it('engineer can change status to concern', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-1' })]} />);
    const select = screen.getByTestId('review-status-select-scene-1') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'concern' } });
    expect(select.value).toBe('concern');
  });

  it('all five status options are available in the selector', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-1' })]} />);
    const select = screen.getByTestId('review-status-select-scene-1');
    const options = select.querySelectorAll('option');
    const values = Array.from(options).map((o) => (o as HTMLOptionElement).value);
    expect(values).toContain('not_reviewed');
    expect(values).toContain('needs_review');
    expect(values).toContain('acceptable');
    expect(values).toContain('concern');
    expect(values).toContain('blocked');
  });
});

// ─── Notes ────────────────────────────────────────────────────────────────────

describe('FlueClearanceReviewPanel — notes', () => {
  it('notes textarea starts empty', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-1' })]} />);
    const textarea = screen.getByTestId('review-notes-scene-1') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('engineer can type notes', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-1' })]} />);
    const textarea = screen.getByTestId('review-notes-scene-1') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Clearance looks tight near the window.' } });
    expect(textarea.value).toBe('Clearance looks tight near the window.');
  });
});

// ─── Customer detail toggle ───────────────────────────────────────────────────

describe('FlueClearanceReviewPanel — customerDetailEnabled', () => {
  it('customer detail toggle is unchecked by default', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-1' })]} />);
    const toggle = screen.getByTestId('customer-detail-toggle-scene-1') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });

  it('shows summary-only notice when customerDetailEnabled is false', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-1' })]} />);
    expect(screen.getByTestId('customer-summary-notice-scene-1')).toBeInTheDocument();
    expect(screen.getByText(/summary only/i)).toBeInTheDocument();
  });

  it('hides summary-only notice when customerDetailEnabled is toggled on', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-1' })]} />);
    const toggle = screen.getByTestId('customer-detail-toggle-scene-1');
    fireEvent.click(toggle);
    expect(screen.queryByTestId('customer-summary-notice-scene-1')).toBeNull();
  });

  it('engineer can toggle customerDetailEnabled on and off', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-1' })]} />);
    const toggle = screen.getByTestId('customer-detail-toggle-scene-1') as HTMLInputElement;
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
  });
});

// ─── Multiple scenes ──────────────────────────────────────────────────────────

describe('FlueClearanceReviewPanel — multiple scenes independence', () => {
  it('changing status on one scene does not affect the other', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-a' }), makeScene({ id: 'scene-b' })]} />);
    const selectA = screen.getByTestId('review-status-select-scene-a') as HTMLSelectElement;
    const selectB = screen.getByTestId('review-status-select-scene-b') as HTMLSelectElement;
    fireEvent.change(selectA, { target: { value: 'acceptable' } });
    expect(selectA.value).toBe('acceptable');
    expect(selectB.value).toBe('needs_review');
  });

  it('notes are independent between scenes', () => {
    render(<FlueClearanceReviewPanel scenes={[makeScene({ id: 'scene-a' }), makeScene({ id: 'scene-b' })]} />);
    const notesA = screen.getByTestId('review-notes-scene-a') as HTMLTextAreaElement;
    const notesB = screen.getByTestId('review-notes-scene-b') as HTMLTextAreaElement;
    fireEvent.change(notesA, { target: { value: 'Note for A' } });
    expect(notesA.value).toBe('Note for A');
    expect(notesB.value).toBe('');
  });
});
