/**
 * CondensateSpecificationStep.tsx
 *
 * Step 6 of the Installation Specification: "Condensate specification".
 *
 * Lets the engineer choose the condensate discharge method and record
 * route details (length, freeze-risk notes, verification flag).
 *
 * UI copy:
 *   Heading:    "Condensate specification"
 *   Subheading: "Select the discharge method and confirm the route."
 *
 * Design rules:
 *   - Does not output customer-facing copy.
 *   - Does not alter recommendation logic.
 *   - No fake lengths — pipeRunM stays null until explicitly entered.
 *   - External routes always show a freeze-risk notice.
 *   - `onCondensateRouteChange` is called with the updated route after every
 *     engineer action — the parent is responsible for storing it.
 */

import { useState } from 'react';
import { CondensateDischargeCards, CONDENSATE_DISCHARGE_LABELS } from '../condensate/CondensateDischargeCards';
import {
  buildCondensateRouteDraft,
  updateCondensateDischargeKind,
  updateCondensatePipeRun,
  toggleCondensateNeedsVerification,
  updateCondensateNotes,
} from '../../model/condensateActions';
import type { QuotePlanCondensateRouteV1, CondensateDischargeKind } from '../../model/QuoteInstallationPlanV1';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CondensateSpecificationStepProps {
  /**
   * Current condensate route from the plan.
   * `null` when no route has been started yet.
   */
  condensateRoute: QuotePlanCondensateRouteV1 | null;
  /** Called whenever the engineer changes the condensate route. */
  onCondensateRouteChange: (route: QuotePlanCondensateRouteV1) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CondensateSpecificationStep({
  condensateRoute,
  onCondensateRouteChange,
}: CondensateSpecificationStepProps) {
  // Keep a local draft — initialised when the engineer selects the first discharge kind.
  const [localRoute, setLocalRoute] = useState<QuotePlanCondensateRouteV1 | null>(
    condensateRoute,
  );

  function update(updated: QuotePlanCondensateRouteV1) {
    setLocalRoute(updated);
    onCondensateRouteChange(updated);
  }

  // ── Discharge kind selection ─────────────────────────────────────────────────

  function handleDischargeSelect(kind: CondensateDischargeKind) {
    if (localRoute == null) {
      // First selection: create a new draft.
      update(buildCondensateRouteDraft(kind));
    } else {
      update(updateCondensateDischargeKind(localRoute, kind));
    }
  }

  // ── Pipe run length ──────────────────────────────────────────────────────────

  function handlePipeRunChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (localRoute == null) return;
    const raw = e.target.value.trim();
    const parsed = parseFloat(raw);
    const pipeRunM = raw === '' || isNaN(parsed) || parsed < 0 ? null : parsed;
    update(updateCondensatePipeRun(localRoute, pipeRunM));
  }

  // ── Needs verification ───────────────────────────────────────────────────────

  function handleNeedsVerificationToggle() {
    if (localRoute == null) return;
    update(toggleCondensateNeedsVerification(localRoute));
  }

  // ── Notes ────────────────────────────────────────────────────────────────────

  function handleNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (localRoute == null) return;
    update(updateCondensateNotes(localRoute, e.target.value));
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const selectedKind = localRoute?.dischargeKind ?? null;

  return (
    <>
      <h2 className="qp-step-heading">Condensate specification</h2>

      <p className="qp-step-subheading">
        Select the discharge method and confirm the route.
      </p>

      {/* 1. Discharge method tiles */}
      <section
        className="condensate-plan-section"
        aria-labelledby="condensate-discharge-heading"
      >
        <h3 id="condensate-discharge-heading" className="condensate-plan-section__heading">
          Discharge method
        </h3>
        <CondensateDischargeCards
          selected={selectedKind}
          onSelect={handleDischargeSelect}
        />
      </section>

      {/* 2. Route details — shown once a discharge kind is selected */}
      {localRoute != null && (
        <section
          className="condensate-plan-section"
          aria-labelledby="condensate-route-heading"
          data-testid="condensate-route-details"
        >
          <h3 id="condensate-route-heading" className="condensate-plan-section__heading">
            Route details
          </h3>

          {/* Freeze-risk notice for external routes */}
          {localRoute.isExternal && (
            <div
              className="condensate-freeze-notice"
              role="alert"
              data-testid="condensate-freeze-notice"
            >
              <span className="condensate-freeze-notice__icon" aria-hidden="true">❄️</span>
              <span className="condensate-freeze-notice__text">
                External condensate runs are at risk of freezing. Ensure adequate fall
                and consider trace heating or insulation where required.
              </span>
            </div>
          )}

          {/* Route summary card */}
          <div className="condensate-route-card" data-testid="condensate-route-card">
            <dl className="condensate-route-card__details">
              <div className="condensate-route-card__row">
                <dt>Discharge method</dt>
                <dd>{CONDENSATE_DISCHARGE_LABELS[localRoute.dischargeKind]}</dd>
              </div>

              <div className="condensate-route-card__row">
                <dt>Route type</dt>
                <dd>{localRoute.isExternal ? 'External' : 'Internal'}</dd>
              </div>

              <div className="condensate-route-card__row">
                <dt>Approximate pipe run</dt>
                <dd>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    aria-label="Approximate pipe run in metres"
                    className="condensate-route-card__length-input"
                    value={localRoute.pipeRunM ?? ''}
                    placeholder="— not yet measured"
                    onChange={handlePipeRunChange}
                  />
                  {localRoute.pipeRunM !== null && (
                    <span className="condensate-route-card__unit"> m</span>
                  )}
                </dd>
              </div>
            </dl>

            {/* Needs verification toggle */}
            <label className="condensate-route-card__verify-row">
              <input
                type="checkbox"
                className="condensate-route-card__verify-checkbox"
                checked={localRoute.needsVerification}
                onChange={handleNeedsVerificationToggle}
                aria-label="Mark condensate route as needs on-site verification"
              />
              <span className="condensate-route-card__verify-label">
                Needs on-site verification
              </span>
            </label>

            {/* Verification badge when flagged */}
            {localRoute.needsVerification && (
              <p
                className="condensate-route-card__verify-warning"
                role="status"
                data-testid="condensate-verify-warning"
              >
                This route is based on assumed data — verify on site before quoting.
              </p>
            )}

            {/* Notes */}
            <div className="condensate-route-card__notes-row">
              <label
                htmlFor="condensate-notes"
                className="condensate-route-card__notes-label"
              >
                Notes (optional)
              </label>
              <textarea
                id="condensate-notes"
                className="condensate-route-card__notes-input"
                value={localRoute.notes ?? ''}
                onChange={handleNotesChange}
                rows={2}
                aria-label="Condensate route notes"
                placeholder="e.g. route via utility room, 1.5 m to kitchen waste"
              />
            </div>
          </div>
        </section>
      )}

      {/* Nudge when no discharge kind selected yet */}
      {localRoute == null && (
        <p className="qp-context-hint">
          Select a discharge method above to start recording the condensate route.
        </p>
      )}
    </>
  );
}
