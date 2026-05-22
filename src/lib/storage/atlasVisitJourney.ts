export type AtlasVisitJourneyState =
  | 'draft_started'
  | 'survey_in_progress'
  | 'survey_ready'
  | 'recommendation_ready'
  | 'presentation_ready'
  | 'handoff_ready'
  | 'exported'
  | 'archived';

export const DEFAULT_ATLAS_VISIT_JOURNEY_STATE: AtlasVisitJourneyState = 'draft_started';

export type AtlasVisitJourneyEvent =
  | { readonly type: 'draft_saved' }
  | { readonly type: 'survey_completed' }
  | { readonly type: 'recommendation_generated' }
  | { readonly type: 'presentation_generated' }
  | { readonly type: 'handoff_prepared' }
  | { readonly type: 'visit_exported' }
  | { readonly type: 'visit_archived' };

export interface AtlasVisitJourneyTransitionResult {
  readonly state: AtlasVisitJourneyState;
  readonly accepted: boolean;
}

type LegacyAtlasVisitJourneyState =
  | 'survey_in_progress'
  | 'recommendation_ready'
  | 'outputs_generated'
  | 'review_in_progress'
  | 'handover_ready';

const ATLAS_VISIT_JOURNEY_ORDER: readonly AtlasVisitJourneyState[] = [
  'draft_started',
  'survey_in_progress',
  'survey_ready',
  'recommendation_ready',
  'presentation_ready',
  'handoff_ready',
  'exported',
  'archived',
];

const LEGACY_ATLAS_VISIT_JOURNEY_STATE_MAP: Record<LegacyAtlasVisitJourneyState, AtlasVisitJourneyState> = {
  survey_in_progress: 'survey_in_progress',
  recommendation_ready: 'recommendation_ready',
  outputs_generated: 'presentation_ready',
  review_in_progress: 'presentation_ready',
  handover_ready: 'handoff_ready',
};

export function isAtlasVisitJourneyState(value: unknown): value is AtlasVisitJourneyState {
  return (
    typeof value === 'string' &&
    ATLAS_VISIT_JOURNEY_ORDER.includes(value as AtlasVisitJourneyState)
  );
}

export function normaliseAtlasVisitJourneyState(
  value: unknown,
): AtlasVisitJourneyState | undefined {
  if (isAtlasVisitJourneyState(value)) return value;
  if (typeof value !== 'string') return undefined;
  return LEGACY_ATLAS_VISIT_JOURNEY_STATE_MAP[value as LegacyAtlasVisitJourneyState];
}

export function isAtlasVisitJourneyAtLeast(
  state: AtlasVisitJourneyState,
  threshold: AtlasVisitJourneyState,
): boolean {
  return ATLAS_VISIT_JOURNEY_ORDER.indexOf(state) >= ATLAS_VISIT_JOURNEY_ORDER.indexOf(threshold);
}

function accept(state: AtlasVisitJourneyState): AtlasVisitJourneyTransitionResult {
  return { state, accepted: true };
}

function reject(state: AtlasVisitJourneyState): AtlasVisitJourneyTransitionResult {
  return { state, accepted: false };
}

export function transitionAtlasVisitJourney(
  state: AtlasVisitJourneyState,
  event: AtlasVisitJourneyEvent,
): AtlasVisitJourneyTransitionResult {
  if (state === 'archived' && event.type !== 'visit_archived') {
    return reject(state);
  }

  switch (event.type) {
    case 'draft_saved':
      if (state === 'draft_started') return accept('survey_in_progress');
      if (state === 'survey_ready') return accept('survey_in_progress');
      if (state === 'survey_in_progress') return accept(state);
      return accept(state);

    case 'survey_completed':
      if (state === 'draft_started' || state === 'survey_in_progress') {
        return accept('survey_ready');
      }
      if (isAtlasVisitJourneyAtLeast(state, 'survey_ready')) return accept(state);
      return reject(state);

    case 'recommendation_generated':
      if (
        state === 'draft_started'
        || state === 'survey_in_progress'
        || state === 'survey_ready'
      ) {
        return accept('recommendation_ready');
      }
      if (isAtlasVisitJourneyAtLeast(state, 'recommendation_ready')) return accept(state);
      return reject(state);

    case 'presentation_generated':
      if (state === 'recommendation_ready') return accept('presentation_ready');
      if (isAtlasVisitJourneyAtLeast(state, 'presentation_ready')) return accept(state);
      return reject(state);

    case 'handoff_prepared':
      if (state === 'recommendation_ready' || state === 'presentation_ready') {
        return accept('handoff_ready');
      }
      if (isAtlasVisitJourneyAtLeast(state, 'handoff_ready')) return accept(state);
      return reject(state);

    case 'visit_exported':
      if (state === 'archived') return reject(state);
      return accept('exported');

    case 'visit_archived':
      return state === 'archived' ? accept(state) : accept('archived');
  }
}
