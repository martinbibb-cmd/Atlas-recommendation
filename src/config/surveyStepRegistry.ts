/**
 * surveyStepRegistry.ts — Single source of truth for the canonical survey journey.
 *
 * Every consumer (stepper, breadcrumbs, progress bar, analytics, tests) must
 * derive step metadata from this registry.  Hardcoded heading / progress
 * literals in individual step components are no longer canonical.
 *
 * Canonical journey order:
 *   system_builder → usage → services → building_fabric → heat_loss → solar_assessment → priorities → insight
 */

// ─── Step ID enum ─────────────────────────────────────────────────────────────

export type SurveyStepId =
  | 'system_builder'
  | 'usage'
  | 'services'
  | 'building_fabric'
  | 'heat_loss'
  | 'solar_assessment'
  | 'priorities'
  | 'insight';

// ─── Per-step metadata ────────────────────────────────────────────────────────

export interface SurveyStepMeta {
  /** Machine-readable identifier — matches the route / stepper state. */
  id: SurveyStepId;
  /** 1-based display index (Step 1, Step 2, …). */
  displayIndex: number;
  /** Heading text rendered as the step's h2. */
  heading: string;
  /** Short label for breadcrumbs and compact progress indicators. */
  shortLabel: string;
  /** Stable data-testid on the step wrapper div. */
  testId: string;
  /** Analytics event name emitted on step entry. */
  analyticsEvent: string;
}

// ─── Canonical ordered registry ───────────────────────────────────────────────

export const SURVEY_STEP_REGISTRY: readonly SurveyStepMeta[] = [
  {
    id: 'system_builder',
    displayIndex: 1,
    heading: '🔧 System Architecture',
    shortLabel: 'System',
    testId: 'system-builder-step',
    analyticsEvent: 'survey_step_system_builder',
  },
  {
    id: 'usage',
    displayIndex: 2,
    heading: '🏠 Home & Household',
    shortLabel: 'Home',
    testId: 'usage-step',
    analyticsEvent: 'survey_step_usage',
  },
  {
    id: 'services',
    displayIndex: 3,
    heading: '🔧 Services',
    shortLabel: 'Services',
    testId: 'services-step',
    analyticsEvent: 'survey_step_services',
  },
  {
    id: 'building_fabric',
    displayIndex: 4,
    heading: '🏠 Building & Fabric',
    shortLabel: 'Fabric',
    testId: 'building-fabric-step',
    analyticsEvent: 'survey_step_building_fabric',
  },
  {
    id: 'heat_loss',
    displayIndex: 5,
    heading: '🏗️ House & Heat Loss',
    shortLabel: 'Heat Loss',
    testId: 'heat-loss-step',
    analyticsEvent: 'survey_step_heat_loss',
  },
  {
    id: 'solar_assessment',
    displayIndex: 6,
    heading: '☀️ Solar & Roof',
    shortLabel: 'Solar',
    testId: 'solar-assessment-step',
    analyticsEvent: 'survey_step_solar_assessment',
  },
  {
    id: 'priorities',
    displayIndex: 7,
    heading: '🎯 Priorities',
    shortLabel: 'Priorities',
    testId: 'priorities-step',
    analyticsEvent: 'survey_step_priorities',
  },
  {
    id: 'insight',
    displayIndex: 8,
    heading: '🧠 What we need to keep in mind',
    shortLabel: 'Insight',
    testId: 'insight-layer-page',
    analyticsEvent: 'survey_step_insight',
  },
] as const;

// ─── Derived helpers ──────────────────────────────────────────────────────────

/** Ordered list of step IDs — the canonical journey sequence. */
export const SURVEY_STEP_IDS: readonly SurveyStepId[] =
  SURVEY_STEP_REGISTRY.map(s => s.id);

/** Total number of survey steps. */
export const SURVEY_STEP_COUNT = SURVEY_STEP_REGISTRY.length;

/** Look up a step's metadata by its ID.  Throws if the ID is unknown. */
export function getStepMeta(id: SurveyStepId): SurveyStepMeta {
  const meta = SURVEY_STEP_REGISTRY.find(s => s.id === id);
  if (!meta) throw new Error(`Unknown survey step id: ${id}`);
  return meta;
}

/** Build a progress label like "Step 3 of 6". */
export function progressLabel(id: SurveyStepId): string {
  const meta = getStepMeta(id);
  return `Step ${meta.displayIndex} of ${SURVEY_STEP_COUNT}`;
}

/** Return the next step ID, or null if this is the last step. */
export function nextStepId(id: SurveyStepId): SurveyStepId | null {
  const idx = SURVEY_STEP_IDS.indexOf(id);
  return idx < SURVEY_STEP_IDS.length - 1 ? SURVEY_STEP_IDS[idx + 1] : null;
}

/** Return the previous step ID, or null if this is the first step. */
export function prevStepId(id: SurveyStepId): SurveyStepId | null {
  const idx = SURVEY_STEP_IDS.indexOf(id);
  return idx > 0 ? SURVEY_STEP_IDS[idx - 1] : null;
}
