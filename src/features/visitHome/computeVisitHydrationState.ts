/**
 * computeVisitHydrationState.ts
 *
 * Pure helper that derives the current visit hydration state from the props
 * available on Visit Home. Used to drive the hydration status banner and
 * the empty-state entry panel.
 *
 * States (ordered from least to most hydrated):
 *   no-visit            — no visitId present; no data at all
 *   survey-in-progress  — visit loaded but recommendation not generated yet
 *   recommendation-ready — has engine output or recommendation summary
 *   review-in-progress  — has accepted scenario AND survey model
 *   handover-ready      — delivery outputs are available
 */

export type VisitHydrationState =
  | 'no-visit'
  | 'survey-in-progress'
  | 'recommendation-ready'
  | 'review-in-progress'
  | 'handover-ready';

export interface ComputeVisitHydrationStateInput {
  readonly hasVisit: boolean;
  readonly hasRecommendation: boolean;
  readonly hasAcceptedScenario: boolean;
  readonly hasSurveyModel: boolean;
  readonly hasHandoffReview: boolean;
  readonly hasExportPackage: boolean;
}

export function computeVisitHydrationState(
  input: ComputeVisitHydrationStateInput,
): VisitHydrationState {
  if (!input.hasVisit) return 'no-visit';
  if (input.hasAcceptedScenario && input.hasSurveyModel) {
    if (input.hasHandoffReview || input.hasExportPackage) return 'handover-ready';
    return 'review-in-progress';
  }
  if (input.hasRecommendation) return 'recommendation-ready';
  return 'survey-in-progress';
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
  'survey-in-progress': {
    label: 'Survey in progress',
    description:
      'Continue survey capture, resume Atlas Scan import, or run recommendation to hydrate review surfaces.',
    tone: 'info',
  },
  'recommendation-ready': {
    label: 'Recommendation ready',
    description:
      'Engine output is available. Continue review and prepare customer and delivery outputs.',
    tone: 'success',
  },
  'review-in-progress': {
    label: 'Review in progress',
    description:
      'Accepted scenario and survey model are loaded. All review surfaces are available.',
    tone: 'active',
  },
  'handover-ready': {
    label: 'Handover ready',
    description:
      'Delivery outputs are available. Proceed with handover review and package export.',
    tone: 'active',
  },
};
