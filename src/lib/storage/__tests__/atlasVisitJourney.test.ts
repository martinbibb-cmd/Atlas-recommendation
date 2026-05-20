import { describe, expect, it } from 'vitest';
import {
  normaliseAtlasVisitJourneyState,
  transitionAtlasVisitJourney,
} from '../atlasVisitJourney';

describe('atlasVisitJourney', () => {
  it('allows the canonical visit journey milestones in order', () => {
    let state = transitionAtlasVisitJourney('draft_started', { type: 'draft_saved' });
    expect(state).toEqual({ state: 'survey_in_progress', accepted: true });

    state = transitionAtlasVisitJourney(state.state, { type: 'survey_completed' });
    expect(state).toEqual({ state: 'survey_ready', accepted: true });

    state = transitionAtlasVisitJourney(state.state, { type: 'recommendation_generated' });
    expect(state).toEqual({ state: 'recommendation_ready', accepted: true });

    state = transitionAtlasVisitJourney(state.state, { type: 'presentation_generated' });
    expect(state).toEqual({ state: 'presentation_ready', accepted: true });

    state = transitionAtlasVisitJourney(state.state, { type: 'handoff_prepared' });
    expect(state).toEqual({ state: 'handoff_ready', accepted: true });

    state = transitionAtlasVisitJourney(state.state, { type: 'visit_exported' });
    expect(state).toEqual({ state: 'exported', accepted: true });

    state = transitionAtlasVisitJourney(state.state, { type: 'visit_archived' });
    expect(state).toEqual({ state: 'archived', accepted: true });
  });

  it('rejects unsupported forward jumps and archived mutations', () => {
    expect(
      transitionAtlasVisitJourney('draft_started', { type: 'presentation_generated' }),
    ).toEqual({ state: 'draft_started', accepted: false });

    expect(
      transitionAtlasVisitJourney('survey_in_progress', { type: 'handoff_prepared' }),
    ).toEqual({ state: 'survey_in_progress', accepted: false });

    expect(
      transitionAtlasVisitJourney('survey_ready', { type: 'visit_exported' }),
    ).toEqual({ state: 'survey_ready', accepted: false });

    expect(
      transitionAtlasVisitJourney('archived', { type: 'recommendation_generated' }),
    ).toEqual({ state: 'archived', accepted: false });
  });

  it('normalises legacy lifecycle states to canonical journey states', () => {
    expect(normaliseAtlasVisitJourneyState('outputs_generated')).toBe('presentation_ready');
    expect(normaliseAtlasVisitJourneyState('review_in_progress')).toBe('presentation_ready');
    expect(normaliseAtlasVisitJourneyState('handover_ready')).toBe('handoff_ready');
  });
});
