/**
 * buildFirstTesterSessionScript.test.ts
 *
 * Coverage:
 *   1. not_ready produces no live tester script (all scripts are null)
 *   2. friendly installer script includes implementation workflow prompts
 *   3. friendly customer script excludes engineer/specification details
 *   4. stop signals included in every non-null script
 *   5. feedback capture reminder included in every non-null script
 *   6. ready_for_limited_trial produces all three tester scripts
 *   7. ready_with_known_risks produces all three tester scripts
 */

import { describe, expect, it } from 'vitest';
import type { LimitedTrialPlanV1 } from '../../buildLimitedTrialPlan';
import type { TrialReadinessSummaryV1 } from '../../buildTrialReadinessSummary';
import { buildFirstTesterSessionScript } from '../buildFirstTesterSessionScript';

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function makePlan(overrides: Partial<LimitedTrialPlanV1> = {}): LimitedTrialPlanV1 {
  return {
    trialRecommendation: 'ready_for_limited_trial',
    suggestedTesterCount: '3-5',
    eligibleScenarios: ['Workspace-owned visit', 'Open-vented conversion'],
    excludedScenarios: [],
    requiredPreTrialChecks: ['verify workspace create/join flow'],
    duringTrialChecklist: ['Use a controlled cohort of 3-5 testers.'],
    rollbackPlan: ['Pause new trial sessions immediately when stop criteria are triggered.'],
    feedbackQuestions: ['Was the recommendation understandable and trustworthy end-to-end?'],
    successCriteria: ['No stop criteria were triggered during the trial window.'],
    stopCriteria: [
      'Any release-gate blocker appears in trial usage.',
      'Any exported artifact fails ownership or brand integrity checks.',
    ],
    ...overrides,
  };
}

function makeSummary(overrides: Partial<TrialReadinessSummaryV1> = {}): TrialReadinessSummaryV1 {
  return {
    overallRecommendation: 'ready_for_limited_trial',
    plainEnglishSummary: 'Ready for limited trial.',
    blockers: [],
    acceptedRisks: [],
    recommendedBeforeTrial: ['verify workspace create/join flow'],
    recommendedDuringTrial: ['Monitor accepted risk: pdf output quality'],
    doNotTestYet: [],
    evidenceLinks: ['release-gate-report.json'],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildFirstTesterSessionScript', () => {
  it('not_ready produces no live tester script', () => {
    const script = buildFirstTesterSessionScript(
      makePlan({ trialRecommendation: 'not_ready', suggestedTesterCount: 0 }),
      makeSummary({ overallRecommendation: 'not_ready' }),
    );

    expect(script.trialRecommendation).toBe('not_ready');
    expect(script.scripts.internal).toBeNull();
    expect(script.scripts.friendly_installer).toBeNull();
    expect(script.scripts.friendly_customer).toBeNull();
  });

  it('ready_for_limited_trial produces all three tester scripts', () => {
    const script = buildFirstTesterSessionScript(makePlan(), makeSummary());

    expect(script.scripts.internal).not.toBeNull();
    expect(script.scripts.friendly_installer).not.toBeNull();
    expect(script.scripts.friendly_customer).not.toBeNull();
  });

  it('ready_with_known_risks produces all three tester scripts', () => {
    const script = buildFirstTesterSessionScript(
      makePlan({ trialRecommendation: 'ready_with_known_risks', suggestedTesterCount: '1-2' }),
      makeSummary({ overallRecommendation: 'ready_with_known_risks' }),
    );

    expect(script.scripts.internal).not.toBeNull();
    expect(script.scripts.friendly_installer).not.toBeNull();
    expect(script.scripts.friendly_customer).not.toBeNull();
  });

  it('friendly installer script includes implementation workflow prompts', () => {
    const script = buildFirstTesterSessionScript(makePlan(), makeSummary());
    const installer = script.scripts.friendly_installer;

    expect(installer).not.toBeNull();

    const allText = [
      ...(installer?.tasksForTester ?? []),
      ...(installer?.promptsToAsk ?? []),
      ...(installer?.observationChecklist ?? []),
    ].join(' ').toLowerCase();

    expect(allText).toMatch(/implementation workflow/i);
  });

  it('friendly customer script excludes engineer/specification details', () => {
    const script = buildFirstTesterSessionScript(makePlan(), makeSummary());
    const customer = script.scripts.friendly_customer;

    expect(customer).not.toBeNull();

    const allText = [
      ...(customer?.tasksForTester ?? []),
      ...(customer?.promptsToAsk ?? []),
      ...(customer?.observationChecklist ?? []),
    ].join(' ').toLowerCase();

    // Customer script must not include implementation-workflow or specification text
    expect(allText).not.toMatch(/implementation workflow/i);
    expect(allText).not.toMatch(/specification/i);
    expect(allText).not.toMatch(/export.*artifact/i);
  });

  it('stop signals are included in each non-null script', () => {
    const plan = makePlan();
    const script = buildFirstTesterSessionScript(plan, makeSummary());

    for (const testerScript of [
      script.scripts.internal,
      script.scripts.friendly_installer,
      script.scripts.friendly_customer,
    ]) {
      expect(testerScript).not.toBeNull();
      expect(testerScript!.stopSignals.length).toBeGreaterThan(0);
      // Plan stop criteria must be present
      for (const criterion of plan.stopCriteria) {
        expect(testerScript!.stopSignals).toContain(criterion);
      }
    }
  });

  it('feedback capture reminder is included in each non-null script', () => {
    const plan = makePlan();
    const script = buildFirstTesterSessionScript(plan, makeSummary());

    for (const testerScript of [
      script.scripts.internal,
      script.scripts.friendly_installer,
      script.scripts.friendly_customer,
    ]) {
      expect(testerScript).not.toBeNull();
      expect(testerScript!.feedbackCaptureReminder.length).toBeGreaterThan(0);
      const joined = testerScript!.feedbackCaptureReminder.join(' ').toLowerCase();
      expect(joined).toMatch(/feedback/i);
    }
  });

  it('generatedAt is embedded in the output', () => {
    const ts = '2026-05-14T07:00:00.000Z';
    const script = buildFirstTesterSessionScript(makePlan(), makeSummary(), ts);

    expect(script.generatedAt).toBe(ts);
  });

  it('pre-session setup includes required pre-trial checks from the plan', () => {
    const plan = makePlan({ requiredPreTrialChecks: ['verify workspace create/join flow', 'confirm rollback owner'] });
    const script = buildFirstTesterSessionScript(plan, makeSummary());

    for (const testerScript of [
      script.scripts.internal,
      script.scripts.friendly_installer,
      script.scripts.friendly_customer,
    ]) {
      expect(testerScript!.preSessionSetup).toContain('verify workspace create/join flow');
      expect(testerScript!.preSessionSetup).toContain('confirm rollback owner');
    }
  });
});
