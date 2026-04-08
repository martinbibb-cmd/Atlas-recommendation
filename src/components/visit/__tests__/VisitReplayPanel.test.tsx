/**
 * VisitReplayPanel.test.tsx
 *
 * Unit tests for VisitReplayPanel — the engineer portal visit replay surface.
 *
 * Coverage:
 *   - Panel is collapsed by default (body not visible)
 *   - Expanding shows all three sections (survey snapshot, voice notes, decision trail)
 *   - Header badge counts voice notes and applied suggestions
 *   - Active influences badge appears when there are accepted note suggestions
 *   - Survey snapshot shows property fields when survey data is available
 *   - Survey snapshot shows empty state when survey is null
 *   - Voice notes section lists note cards with accepted/rejected counts
 *   - Voice notes section shows empty state when no notes
 *   - Note decision trail renders NoteInfluencePanel when there are applied suggestions
 *   - Note decision trail shows empty state when no applied suggestions
 *   - Guardrail: only accepted_atlas_suggestion provenance is surfaced
 *   - Overridden items appear in the decision trail with accessible labels
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisitReplayPanel } from '../VisitReplayPanel';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import type { VoiceNote, AppliedNoteSuggestion } from '../../../features/voiceNotes/voiceNoteTypes';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeNote(overrides: Partial<VoiceNote> = {}): VoiceNote {
  return {
    id:         'note-1',
    visitId:    'visit-1',
    transcript: 'Customer mentioned they want a combi and no cylinder.',
    createdAt:  '2024-06-01T10:00:00.000Z',
    suggestions: [],
    ...overrides,
  };
}

function makeApplied(
  targetField: string,
  overrides: Partial<AppliedNoteSuggestion> = {},
): AppliedNoteSuggestion {
  return {
    sourceSuggestionId: `sg-${targetField}`,
    sourceNoteId:       'note-1',
    targetField,
    label:              'Customer prefers to avoid a cylinder',
    appliedValue:       'true',
    confidence:         'high',
    provenance:         'accepted_atlas_suggestion',
    category:           'preferences',
    sourceSnippet:      'no cylinder please',
    ...overrides,
  };
}

function makeSurvey(overrides: Partial<FullSurveyModelV1> = {}): FullSurveyModelV1 {
  return {
    postcode:       'SW1A 1AA',
    bathroomCount:  1,
    occupancyCount: 3,
    bedrooms:       3,
    ...overrides,
  } as FullSurveyModelV1;
}

// ─── Collapse / expand ────────────────────────────────────────────────────────

describe('VisitReplayPanel — default state', () => {
  it('is collapsed by default (body not visible)', () => {
    render(<VisitReplayPanel survey={null} voiceNotes={[]} />);
    expect(screen.getByTestId('visit-replay-panel')).toBeInTheDocument();
    // The three inner sections should not be present when collapsed
    expect(screen.queryByTestId('visit-replay-survey-snapshot')).not.toBeInTheDocument();
    expect(screen.queryByTestId('visit-replay-voice-notes')).not.toBeInTheDocument();
    expect(screen.queryByTestId('visit-replay-decision-trail')).not.toBeInTheDocument();
  });

  it('toggle button has aria-expanded=false when collapsed', () => {
    render(<VisitReplayPanel survey={null} voiceNotes={[]} />);
    const toggle = screen.getByRole('button', { name: /visit replay/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('expanding the panel shows all three sections', () => {
    render(<VisitReplayPanel survey={null} voiceNotes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    expect(screen.getByTestId('visit-replay-survey-snapshot')).toBeInTheDocument();
    expect(screen.getByTestId('visit-replay-voice-notes')).toBeInTheDocument();
    expect(screen.getByTestId('visit-replay-decision-trail')).toBeInTheDocument();
  });

  it('toggle button has aria-expanded=true when expanded', () => {
    render(<VisitReplayPanel survey={null} voiceNotes={[]} />);
    const toggle = screen.getByRole('button', { name: /visit replay/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});

// ─── Header badges ────────────────────────────────────────────────────────────

describe('VisitReplayPanel — header badges', () => {
  it('shows voice note count in header when notes are present', () => {
    const notes = [makeNote({ id: 'n1' }), makeNote({ id: 'n2' })];
    render(<VisitReplayPanel survey={null} voiceNotes={notes} />);
    expect(screen.getByText('2 notes')).toBeInTheDocument();
  });

  it('shows singular "1 note" badge correctly', () => {
    render(<VisitReplayPanel survey={null} voiceNotes={[makeNote()]} />);
    expect(screen.getByText('1 note')).toBeInTheDocument();
  });

  it('shows active influence count when there are applied suggestions', () => {
    const survey = makeSurvey({
      fullSurvey: {
        appliedNoteSuggestions: [makeApplied('preferCombi')],
      },
    });
    render(<VisitReplayPanel survey={survey} voiceNotes={[]} />);
    expect(screen.getByText('1 active influence')).toBeInTheDocument();
  });

  it('uses plural "active influences" for multiple influences', () => {
    const survey = makeSurvey({
      fullSurvey: {
        appliedNoteSuggestions: [
          makeApplied('preferCombi'),
          makeApplied('risk.microbore_pipework', { category: 'risks' }),
        ],
      },
    });
    render(<VisitReplayPanel survey={survey} voiceNotes={[]} />);
    expect(screen.getByText('2 active influences')).toBeInTheDocument();
  });
});

// ─── Survey snapshot section ──────────────────────────────────────────────────

describe('VisitReplayPanel — survey snapshot', () => {
  it('shows property fields when survey data is present', () => {
    const survey = makeSurvey({ postcode: 'E1 6AN', bedrooms: 2, bathroomCount: 1 });
    render(<VisitReplayPanel survey={survey} voiceNotes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    expect(screen.getByText('E1 6AN')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows empty-state message when survey is null', () => {
    render(<VisitReplayPanel survey={null} voiceNotes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    expect(screen.getByText(/no survey data available/i)).toBeInTheDocument();
  });
});

// ─── Voice notes section ──────────────────────────────────────────────────────

describe('VisitReplayPanel — voice notes section', () => {
  it('shows empty state when no notes are present', () => {
    render(<VisitReplayPanel survey={null} voiceNotes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    expect(screen.getByText(/no voice notes captured/i)).toBeInTheDocument();
  });

  it('renders a card for each note', () => {
    const notes = [
      makeNote({ id: 'note-a', createdAt: '2024-01-01T09:00:00.000Z' }),
      makeNote({ id: 'note-b', createdAt: '2024-01-02T10:00:00.000Z' }),
    ];
    render(<VisitReplayPanel survey={null} voiceNotes={notes} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    expect(screen.getByTestId('visit-replay-note-note-a')).toBeInTheDocument();
    expect(screen.getByTestId('visit-replay-note-note-b')).toBeInTheDocument();
  });

  it('note card shows accepted/rejected/pending counts', () => {
    const note = makeNote({
      suggestions: [
        { id: 's1', key: 'k', label: 'L', suggestedValue: 'v', confidence: 'high',
          sourceNoteId: 'note-1', sourceSnippet: 'x', provenance: 'inferred_from_voice_note',
          status: 'accepted', category: 'preferences' },
        { id: 's2', key: 'k2', label: 'L2', suggestedValue: 'v2', confidence: 'medium',
          sourceNoteId: 'note-1', sourceSnippet: 'y', provenance: 'inferred_from_voice_note',
          status: 'rejected', category: 'constraints' },
      ],
    });
    render(<VisitReplayPanel survey={null} voiceNotes={[note]} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    expect(screen.getByText(/✓ 1 accepted/)).toBeInTheDocument();
    expect(screen.getByText(/1 rejected/)).toBeInTheDocument();
  });
});

// ─── Note decision trail section ──────────────────────────────────────────────

describe('VisitReplayPanel — note decision trail', () => {
  it('shows empty-state when no applied suggestions', () => {
    render(<VisitReplayPanel survey={makeSurvey()} voiceNotes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    expect(screen.getByText(/no accepted note suggestions have influenced/i)).toBeInTheDocument();
  });

  it('renders NoteInfluencePanel when there are active applied suggestions', () => {
    const survey = makeSurvey({
      fullSurvey: {
        appliedNoteSuggestions: [makeApplied('preferCombi')],
      },
    });
    render(<VisitReplayPanel survey={survey} voiceNotes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    expect(screen.getByTestId('note-influence-panel')).toBeInTheDocument();
  });

  it('guardrail: suggestions without accepted_atlas_suggestion provenance are excluded', () => {
    // Build an applied record with wrong provenance by casting (should never happen in
    // production, but we verify the guardrail holds).
    const badApplied = {
      ...makeApplied('preferCombi'),
      provenance: 'entered_manually' as unknown as 'accepted_atlas_suggestion',
    };
    const survey = makeSurvey({
      fullSurvey: { appliedNoteSuggestions: [badApplied] },
    });
    render(<VisitReplayPanel survey={survey} voiceNotes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    // The panel should show the empty state (no active influence from bad provenance)
    expect(screen.getByText(/no accepted note suggestions have influenced/i)).toBeInTheDocument();
    expect(screen.queryByTestId('note-influence-panel')).not.toBeInTheDocument();
  });

  it('overridden items still cause NoteInfluencePanel to render (audit trail)', () => {
    const overriddenApplied = makeApplied('preferCombi', { overriddenByManual: true });
    const survey = makeSurvey({
      fullSurvey: { appliedNoteSuggestions: [overriddenApplied] },
    });
    render(<VisitReplayPanel survey={survey} voiceNotes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    expect(screen.getByTestId('note-influence-panel')).toBeInTheDocument();
  });

  it('overridden item is labelled accessibly', () => {
    const overriddenApplied = makeApplied('preferCombi', { overriddenByManual: true });
    const survey = makeSurvey({
      fullSurvey: { appliedNoteSuggestions: [overriddenApplied] },
    });
    render(<VisitReplayPanel survey={survey} voiceNotes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    expect(
      screen.getByLabelText(/overridden by a manually-entered value/i),
    ).toBeInTheDocument();
  });

  it('decision trail output matches explanation from buildNoteInfluenceSummary directly', () => {
    const survey = makeSurvey({
      fullSurvey: {
        appliedNoteSuggestions: [makeApplied('preferCombi')],
      },
    });
    render(<VisitReplayPanel survey={survey} voiceNotes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    // The explanation string is defined in buildNoteInfluenceSummary — if it renders,
    // we know the shared builder (not a duplicate) is being used.
    expect(
      screen.getByText(/combi preference strengthened/i),
    ).toBeInTheDocument();
  });

  it('source snippet is visible in the decision trail when present', () => {
    const survey = makeSurvey({
      fullSurvey: {
        appliedNoteSuggestions: [
          makeApplied('preferCombi', { sourceSnippet: 'no cylinder please' }),
        ],
      },
    });
    render(<VisitReplayPanel survey={survey} voiceNotes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /visit replay/i }));
    expect(screen.getByText(/no cylinder please/i)).toBeInTheDocument();
  });
});
