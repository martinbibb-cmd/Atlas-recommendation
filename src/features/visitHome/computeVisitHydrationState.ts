/**
 * computeVisitHydrationState.ts
 *
 * Pure helper that derives the current visit hydration state from the props
 * available on Visit Home. Used to drive the hydration status banner and
 * the empty-state entry panel.
 *
 * States (ordered from least to most hydrated):
 *   no-visit            — no visitId present; no data at all
 *   visit-loaded        — visitId set but no recommendation output yet
 *   recommendation-ready — has engine output or recommendation summary
 *   review-in-progress  — has accepted scenario AND survey model
 */

export type VisitHydrationState =
  | 'no-visit'
  | 'visit-loaded'
  | 'recommendation-ready'
  | 'review-in-progress';

export interface ComputeVisitHydrationStateInput {
  readonly hasVisit: boolean;
  readonly hasRecommendation: boolean;
  readonly hasAcceptedScenario: boolean;
  readonly hasSurveyModel: boolean;
}

export function computeVisitHydrationState(
  input: ComputeVisitHydrationStateInput,
): VisitHydrationState {
  if (!input.hasVisit) return 'no-visit';
  if (input.hasAcceptedScenario && input.hasSurveyModel) return 'review-in-progress';
  if (input.hasRecommendation) return 'recommendation-ready';
  return 'visit-loaded';
}

// ── Display metadata per state ────────────────────────────────────────────────

export interface HydrationStateDisplay {
  readonly label: string;
  readonly description: string;
  readonly tone: 'neutral' | 'info' | 'success' | 'active';
}

export const HYDRATION_STATE_DISPLAY: Record<VisitHydrationState, HydrationStateDisplay> = {
  'no-visit': {
    label: 'No visit loaded',
    description:
      'Import a scan package, open an existing visit, or start with a demo fixture to begin review.',
    tone: 'neutral',
  },
  'visit-loaded': {
    label: 'Visit loaded — recommendation pending',
    description:
      'Visit data is present. Complete the survey or import a recommendation to unlock review surfaces.',
    tone: 'info',
  },
  'recommendation-ready': {
    label: 'Recommendation ready',
    description:
      'Engine output is available. Accept a scenario to unlock the full review workspace.',
    tone: 'success',
  },
  'review-in-progress': {
    label: 'Review in progress',
    description:
      'Accepted scenario and survey model are loaded. All review surfaces are available.',
    tone: 'active',
  },
};
