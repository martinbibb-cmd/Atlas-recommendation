/**
 * buildCustomerSummary.ts — Locked projection of AtlasDecisionV1 into CustomerSummaryV1.
 *
 * Purpose:
 *   Customer summary must not re-run recommendation logic, interpret ranked
 *   options, or infer advice. It is a deterministic projection of
 *   AtlasDecisionV1 + the selected ScenarioResult only.
 *
 * Rules:
 *  1. recommendedScenarioId must equal decision.recommendedScenarioId.
 *  2. Selected scenario must be scenarios.find(s => s.scenarioId === decision.recommendedScenarioId).
 *  3. If selected scenario is missing, throw.
 *  4. headline comes from decision.headline.
 *  5. plainEnglishDecision comes from decision.summary.
 *  6. whyThisWins comes from decision.keyReasons only.
 *  7. whatThisAvoids comes from decision.avoidedRisks only.
 *  8. includedNow comes from quoteScope status === 'included', excluding verification items.
 *  9. requiredChecks comes from compatibilityWarnings + verification quoteScope items.
 * 10. optionalUpgrades comes from quoteScope status === 'recommended' or 'optional'.
 * 11. futureReady comes from decision.futureUpgradePaths or future quoteScope items.
 * 12. Never read ranked options to decide recommendation.
 * 13. Never use current system type as recommendation.
 * 14. Never turn checks into benefits.
 * 15. Never mention non-selected systems except inside whatThisAvoids.
 */

import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import { isVerificationItem } from './buildQuoteScope';

// ─── System label map ─────────────────────────────────────────────────────────

const SYSTEM_LABEL: Record<ScenarioResult['system']['type'], string> = {
  combi:   'Combi boiler',
  system:  'System boiler',
  regular: 'Regular (heat-only) boiler',
  ashp:    'Air source heat pump',
};

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * buildCustomerSummary
 *
 * Produces a CustomerSummaryV1 that is a locked, deterministic projection of
 * AtlasDecisionV1. The selected scenario is resolved solely by
 * decision.recommendedScenarioId — no scoring, no ranking, no re-interpretation.
 *
 * @throws {Error} when the recommended scenario cannot be found in the array.
 */
export function buildCustomerSummary(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
): CustomerSummaryV1 {
  // Rule 2 & 3 — resolve selected scenario strictly by recommendedScenarioId
  const selected = scenarios.find(
    (s) => s.scenarioId === decision.recommendedScenarioId,
  );
  if (!selected) {
    throw new Error(
      `buildCustomerSummary: scenario "${decision.recommendedScenarioId}" not found in scenarios array`,
    );
  }

  // Rule 8 — includedNow: quoteScope status === 'included', excluding verification items
  const includedNow = decision.quoteScope
    .filter(
      (item) =>
        item.status === 'included' &&
        item.category !== 'compliance' &&
        !isVerificationItem(item.label),
    )
    .map((item) => item.label);

  // Rule 9 — requiredChecks: compatibilityWarnings + compliance/required quoteScope items
  const requiredChecksSet = new Set<string>(decision.compatibilityWarnings);
  for (const item of decision.quoteScope) {
    if (
      item.status === 'required' ||
      (item.status === 'included' && item.category === 'compliance') ||
      isVerificationItem(item.label)
    ) {
      requiredChecksSet.add(item.label);
    }
  }
  const requiredChecks = Array.from(requiredChecksSet);

  // Rule 10 — optionalUpgrades: quoteScope status === 'recommended' or 'optional'
  // (excluding future-path items which go into futureReady)
  const optionalUpgrades = decision.quoteScope
    .filter(
      (item) =>
        (item.status === 'recommended' || item.status === 'optional') &&
        item.category !== 'future',
    )
    .map((item) => item.label);

  // Rule 11 — futureReady: futureUpgradePaths + quoteScope items where category === 'future'
  const futureSet = new Set<string>(decision.futureUpgradePaths);
  for (const item of decision.quoteScope) {
    if (item.category === 'future') {
      futureSet.add(item.label);
    }
  }
  const futureReady = Array.from(futureSet);

  // confidenceNotes: lifecycle urgency + any remaining compatibility warnings
  // not already in requiredChecks
  const confidenceNotes: string[] = [];
  const lifecycle = decision.lifecycle;
  if (lifecycle.currentSystem.condition === 'at_risk') {
    confidenceNotes.push(
      'Current system is beyond typical lifespan — elevated risk of failure',
    );
  } else if (lifecycle.currentSystem.condition === 'worn') {
    confidenceNotes.push(
      'Current system is approaching end of typical lifespan — reliability may decline',
    );
  }

  return {
    // Rule 1 — must equal decision.recommendedScenarioId
    recommendedScenarioId: decision.recommendedScenarioId,

    // Rules 4, 5, 6, 7
    recommendedSystemLabel: SYSTEM_LABEL[selected.system.type],
    headline:               decision.headline,
    plainEnglishDecision:   decision.summary,
    whyThisWins:            [...decision.keyReasons],
    whatThisAvoids:         [...decision.avoidedRisks],

    includedNow,
    requiredChecks,
    optionalUpgrades,
    futureReady,
    confidenceNotes,
  };
}
