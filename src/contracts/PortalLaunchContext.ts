/**
 * PortalLaunchContext.ts — Minimal handoff contract for navigating into the portal.
 *
 * Carries the recommended scenario and an optional initial tab so the portal
 * surface opens in the right context when launched from the deck CTA.
 *
 * Design rules:
 *  - This is a routing/presentation contract only. No engine logic lives here.
 *  - initialTab is optional — callers that do not need a specific tab can omit it
 *    and the portal will default to 'recommended'.
 *  - recommendedScenarioId must match the scenarioId of one of the evaluated
 *    ScenarioResult entries (same value as AtlasDecisionV1.recommendedScenarioId).
 */

import type { PortalTabId } from '../engine/modules/buildPortalViewModel';

export type PortalLaunchContext = {
  /** The scenarioId of the recommended ScenarioResult. */
  recommendedScenarioId: string;
  /** Tab to activate on launch. Defaults to 'recommended' when absent. */
  initialTab?: PortalTabId;
};
