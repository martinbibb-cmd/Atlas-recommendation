/**
 * GeneratedScopeStep.tsx
 *
 * Step 8 of the Quote Planner: "Generated scope".
 *
 * Displays the structured scope items generated from the installation plan.
 * Provides "Edit source" links back to earlier steps so the engineer can
 * correct assumptions before quoting.
 *
 * UI copy:
 *   Heading:     "Generated scope"
 *   Subheading:  "Included from your plan"
 *
 * Design rules:
 *   - Does not output customer-facing copy.
 *   - Does not alter recommendation logic.
 *   - No pricing — scope items only.
 *   - Scope is regenerated from the plan every render; no stale cache.
 */

import { useMemo } from 'react';
import { buildQuoteScopeFromInstallationPlan } from '../../scope/buildQuoteScopeFromInstallationPlan';
import { GeneratedScopeList } from '../scope/GeneratedScopeList';
import type { QuoteInstallationPlanV1, QuoteScopeItemV1 } from '../../model/QuoteInstallationPlanV1';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GeneratedScopeStepProps {
  /**
   * The current installation plan.
   * Scope items are derived from this plan each time the step renders.
   */
  plan: QuoteInstallationPlanV1;
  /**
   * Called when the engineer taps an "Edit source" link.
   * Receives the source step ID so the stepper can navigate back to it.
   */
  onNavigateToStep?: (stepId: NonNullable<QuoteScopeItemV1['sourceStepId']>) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GeneratedScopeStep({ plan, onNavigateToStep }: GeneratedScopeStepProps) {
  // Derive scope items from the plan.  Memoized so it only recomputes when
  // plan reference changes.
  const scopeItems = useMemo(
    () => buildQuoteScopeFromInstallationPlan(plan),
    [plan],
  );

  const verificationCount = scopeItems.filter((i) => i.needsVerification).length;

  return (
    <>
      <h2 className="qp-step-heading">Generated scope</h2>
      <p className="qp-step-subheading">Included from your plan</p>

      {verificationCount > 0 && (
        <div className="scope-verify-banner" role="alert" aria-live="assertive">
          <span className="scope-verify-banner__icon" aria-hidden="true">⚠</span>
          <span className="scope-verify-banner__text">
            {verificationCount} item{verificationCount !== 1 ? 's' : ''} need
            {verificationCount === 1 ? 's' : ''} on-site verification before quoting.
          </span>
        </div>
      )}

      <GeneratedScopeList
        items={scopeItems}
        onEditSource={onNavigateToStep}
      />

      {scopeItems.length > 0 && (
        <p className="qp-context-hint">
          This is structured scope for planning purposes only — not customer-facing output.
          Pricing and customer copy are added in a later step.
        </p>
      )}
    </>
  );
}
