/**
 * buildFirstTesterSessionScript.ts
 *
 * Produces a guided first-tester session script from a LimitedTrialPlanV1 and
 * TrialReadinessSummaryV1 so that the first trial session is repeatable.
 *
 * Dev-only — not used in production.
 */

import type { LimitedTrialPlanV1 } from '../buildLimitedTrialPlan';
import type { TrialReadinessSummaryV1 } from '../buildTrialReadinessSummary';
import type { TrialFeedbackTesterTypeV1 } from '../feedback/TrialFeedbackEntryV1';
import type {
  FirstTesterSessionScriptV1,
  TesterSessionScriptV1,
} from './FirstTesterSessionScriptV1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

// ─── Pre-session setup ────────────────────────────────────────────────────────

function buildPreSessionSetup(plan: LimitedTrialPlanV1): readonly string[] {
  return unique([
    ...plan.requiredPreTrialChecks,
    'Confirm recording or note-taking approach before the session starts.',
    'Have the stop signals list accessible during the session.',
  ]);
}

// ─── Tester intros ────────────────────────────────────────────────────────────

function buildTesterIntro(testerType: TrialFeedbackTesterTypeV1): readonly string[] {
  if (testerType === 'internal') {
    return [
      'You are running an internal trial of the Atlas recommendation engine.',
      'Your goal is to verify that the end-to-end flow (portal → recommendation → PDF → handoff) works correctly.',
      'You have full context and may explore any area of the system.',
      'Log any issues, confusion, or missing pieces as structured feedback entries after the session.',
    ];
  }

  if (testerType === 'friendly_installer') {
    return [
      'Thank you for helping us test the Atlas recommendation tool.',
      'You will be looking at the installer-facing workflow: reviewing a property, seeing the recommendation, and following the implementation steps.',
      'Please use the tool as you would on a real job — we want to know if anything is unclear or missing.',
      "There are no wrong answers — your honest first impression is what we're looking for.",
    ];
  }

  // friendly_customer
  return [
    'Thank you for helping us test the Atlas home-improvement recommendation tool.',
    'You will see how the tool presents recommendations for your property.',
    "Please explore the experience as you would if you found this tool online — we want to know if anything is confusing or unclear.",
    "There are no wrong answers — your honest first impression is what we're looking for.",
  ];
}

// ─── Scenario to run ─────────────────────────────────────────────────────────

function buildScenarioToRun(
  plan: LimitedTrialPlanV1,
  testerType: TrialFeedbackTesterTypeV1,
): readonly string[] {
  if (plan.eligibleScenarios.length === 0) {
    return ['No eligible scenarios available for this trial.'];
  }

  // Internal testers run all eligible scenarios.
  if (testerType === 'internal') {
    return [...plan.eligibleScenarios];
  }

  // Friendly testers run the first eligible scenario only to keep sessions short.
  const firstScenario = plan.eligibleScenarios[0];
  return firstScenario ? [firstScenario] : ['No eligible scenarios available for this trial.'];
}

// ─── Observation checklist ────────────────────────────────────────────────────

function buildObservationChecklist(testerType: TrialFeedbackTesterTypeV1): readonly string[] {
  const common: string[] = [
    'Note any moment where the tester pauses, hesitates, or re-reads content.',
    'Note any point where the tester asks a question unprompted.',
    'Note whether the tester reaches the intended end-point of the scenario.',
  ];

  if (testerType === 'internal') {
    return unique([
      ...common,
      'Check that all release-gate areas (portal, PDF, workflow) complete without errors.',
      'Verify that ownership and brand integrity are intact in exported artifacts.',
      'Note any console errors, unexpected state, or data inconsistencies.',
    ]);
  }

  if (testerType === 'friendly_installer') {
    return unique([
      ...common,
      'Note whether the implementation workflow steps are clear and actionable.',
      'Check whether the installer can follow the handoff steps without additional guidance.',
      'Note if any technical specification is missing or ambiguous.',
    ]);
  }

  // friendly_customer
  return unique([
    ...common,
    'Check whether the recommendation is presented in plain, understandable language.',
    'Note if the customer appears to trust or doubt the recommendation.',
    'Note whether next-step guidance is clear without engineering context.',
  ]);
}

// ─── Tasks for tester ─────────────────────────────────────────────────────────

function buildTasksForTester(
  plan: LimitedTrialPlanV1,
  testerType: TrialFeedbackTesterTypeV1,
): readonly string[] {
  const scenarioTasks = plan.eligibleScenarios.length > 0
    ? [`Run the following scenario: ${buildScenarioToRun(plan, testerType).join(', ')}`]
    : [];

  if (testerType === 'internal') {
    return unique([
      ...scenarioTasks,
      'Export the recommendation PDF and verify it looks correct.',
      'Export the implementation workflow package and check for completeness.',
      'Verify the workspace ownership and brand fields are present.',
      'Attempt to trigger each stop-criteria condition and confirm the system behaves predictably.',
    ]);
  }

  if (testerType === 'friendly_installer') {
    return unique([
      ...scenarioTasks,
      'Follow the implementation workflow steps as if preparing for a real job.',
      'Note any step in the workflow that is unclear, missing, or requires outside information.',
      'Review the exported PDF as if handing it to a customer.',
    ]);
  }

  // friendly_customer
  return unique([
    ...scenarioTasks,
    'Review the recommendation as if you received it for your home.',
    'Note whether you understand what is being recommended and why.',
    'Note whether you know what to do next after reading the recommendation.',
  ]);
}

// ─── Prompts to ask ───────────────────────────────────────────────────────────

function buildPromptsToAsk(testerType: TrialFeedbackTesterTypeV1): readonly string[] {
  const common: string[] = [
    'What was the first thing you noticed when you opened the tool?',
    'Was there any point where you were unsure what to do next?',
    'Did the output match what you expected?',
  ];

  if (testerType === 'internal') {
    return unique([
      ...common,
      'Did any area produce unexpected data or state that you would flag in a real session?',
      'Were the exported artifacts (PDF, workflow package) complete and accurate?',
      'What would stop you from using this output in a real customer engagement?',
    ]);
  }

  if (testerType === 'friendly_installer') {
    return unique([
      ...common,
      'Would the implementation workflow steps give you everything you need to carry out the work?',
      'Is there any specification detail you would need that is missing from the output?',
      'How does this compare to the information you currently use on a job?',
    ]);
  }

  // friendly_customer
  return unique([
    ...common,
    'Did the recommendation feel trustworthy and relevant to your situation?',
    'Was there any technical language that was confusing or unnecessary?',
    'After reading the output, would you know who to contact or what step to take next?',
  ]);
}

// ─── Success signals ──────────────────────────────────────────────────────────

function buildSuccessSignals(plan: LimitedTrialPlanV1): readonly string[] {
  return unique(plan.successCriteria);
}

// ─── Stop signals ─────────────────────────────────────────────────────────────

function buildStopSignals(plan: LimitedTrialPlanV1): readonly string[] {
  return unique([
    ...plan.stopCriteria,
    'Tester expresses serious concern about data accuracy or trust.',
    'Any crash, error modal, or data-loss event occurs during the session.',
  ]);
}

// ─── Feedback capture reminder ────────────────────────────────────────────────

function buildFeedbackCaptureReminder(plan: LimitedTrialPlanV1): readonly string[] {
  return unique([
    'Capture all observations as structured feedback entries immediately after the session.',
    ...plan.feedbackQuestions.map((q) => `Ask / capture: ${q}`),
    'Record the tester type, scenario run, and session date with each feedback entry.',
  ]);
}

// ─── Post-session actions ─────────────────────────────────────────────────────

function buildPostSessionActions(
  plan: LimitedTrialPlanV1,
  summary: TrialReadinessSummaryV1,
): readonly string[] {
  return unique([
    ...plan.rollbackPlan,
    ...summary.recommendedDuringTrial.map((item) => `Continue monitoring: ${item}`),
    'Triage all new feedback entries before the next session.',
    'Update trial readiness review state if any actions have changed status.',
  ]);
}

// ─── Per-tester script builder ────────────────────────────────────────────────

function buildTesterScript(
  testerType: TrialFeedbackTesterTypeV1,
  plan: LimitedTrialPlanV1,
  summary: TrialReadinessSummaryV1,
): TesterSessionScriptV1 {
  return {
    testerType,
    preSessionSetup: buildPreSessionSetup(plan),
    testerIntro: buildTesterIntro(testerType),
    scenarioToRun: buildScenarioToRun(plan, testerType),
    observationChecklist: buildObservationChecklist(testerType),
    tasksForTester: buildTasksForTester(plan, testerType),
    promptsToAsk: buildPromptsToAsk(testerType),
    successSignals: buildSuccessSignals(plan),
    stopSignals: buildStopSignals(plan),
    feedbackCaptureReminder: buildFeedbackCaptureReminder(plan),
    postSessionActions: buildPostSessionActions(plan, summary),
  };
}

// ─── Public builder ───────────────────────────────────────────────────────────

export function buildFirstTesterSessionScript(
  limitedTrialPlan: LimitedTrialPlanV1,
  trialReadinessSummary: TrialReadinessSummaryV1,
  generatedAt: string = new Date().toISOString(),
): FirstTesterSessionScriptV1 {
  const recommendation = limitedTrialPlan.trialRecommendation;

  // When not_ready, no live tester scripts are produced.
  if (recommendation === 'not_ready') {
    return {
      generatedAt,
      trialRecommendation: recommendation,
      scripts: {
        internal: null,
        friendly_installer: null,
        friendly_customer: null,
      },
    };
  }

  return {
    generatedAt,
    trialRecommendation: recommendation,
    scripts: {
      internal: buildTesterScript('internal', limitedTrialPlan, trialReadinessSummary),
      friendly_installer: buildTesterScript('friendly_installer', limitedTrialPlan, trialReadinessSummary),
      friendly_customer: buildTesterScript('friendly_customer', limitedTrialPlan, trialReadinessSummary),
    },
  };
}
