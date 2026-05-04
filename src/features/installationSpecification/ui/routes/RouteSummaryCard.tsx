/**
 * RouteSummaryCard.tsx
 *
 * Summary card for a single pipework route.
 *
 * Shows:
 *   - Route kind label and status badge.
 *   - Length with confidence badge ("measured on plan", "estimated",
 *     "manual", or "length needs scale").
 *   - Bend count, wall penetrations, floor penetrations.
 *   - Complexity band.
 *   - Install method and optional diameter.
 *   - A calculation rationale line.
 *
 * Design rules:
 *   - Pure presentational — receives the route from the parent.
 *   - Never shows a fake length when scale is missing.
 *   - Does not output customer-facing copy.
 */

import type { QuotePlanPipeworkRouteV1, PipeworkRouteStatus } from '../../model/QuoteInstallationPlanV1';
import type { QuoteRouteComplexity, PipeworkLengthConfidence } from '../../calculators/quotePlannerTypes';
import { PIPEWORK_ROUTE_KIND_LABELS } from './RouteTypePicker';

// ─── Display helpers ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PipeworkRouteStatus, string> = {
  proposed:        'Proposed',
  reused_existing: 'Reused existing',
  assumed:         'Assumed',
};

const STATUS_MODIFIERS: Record<PipeworkRouteStatus, string> = {
  proposed:        'rsc-badge--proposed',
  reused_existing: 'rsc-badge--reused',
  assumed:         'rsc-badge--assumed',
};

export const COMPLEXITY_LABELS: Record<QuoteRouteComplexity, string> = {
  low:          'Low',
  medium:       'Medium',
  high:         'High',
  needs_review: 'Needs review',
};

const COMPLEXITY_MODIFIERS: Record<QuoteRouteComplexity, string> = {
  low:          'rsc-complexity--low',
  medium:       'rsc-complexity--medium',
  high:         'rsc-complexity--high',
  needs_review: 'rsc-complexity--review',
};

export const CONFIDENCE_LABELS: Record<PipeworkLengthConfidence, string> = {
  measured_on_plan: 'Measured on plan',
  estimated:        'Estimated',
  manual:           'Manual override',
  needs_scale:      'Length needs scale',
};

const CONFIDENCE_MODIFIERS: Record<PipeworkLengthConfidence, string> = {
  measured_on_plan: 'rsc-conf--measured',
  estimated:        'rsc-conf--estimated',
  manual:           'rsc-conf--manual',
  needs_scale:      'rsc-conf--needs-scale',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RouteSummaryCardProps {
  /** The pipework route to summarise. */
  route: QuotePlanPipeworkRouteV1;
  /** Called when the engineer taps "Edit" on this route. */
  onEdit?: () => void;
  /** Called when the engineer taps "Remove" on this route. */
  onRemove?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RouteSummaryCard({ route, onEdit, onRemove }: RouteSummaryCardProps) {
  const { routeKind, status, installMethod, diameter, calculation } = route;
  const {
    lengthM,
    lengthConfidence,
    bendCount,
    wallPenetrationCount,
    floorPenetrationCount,
    complexity,
    complexityRationale,
  } = calculation;

  const kindLabel = PIPEWORK_ROUTE_KIND_LABELS[routeKind] ?? routeKind;

  return (
    <div
      className="rsc-card"
      data-testid={`route-summary-${route.pipeworkRouteId}`}
    >
      {/* Header */}
      <div className="rsc-header">
        <span className="rsc-kind">{kindLabel}</span>
        <span className={`rsc-badge ${STATUS_MODIFIERS[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* Length */}
      <div className="rsc-length-row">
        {lengthM !== null ? (
          <span className="rsc-length-value" data-testid="route-length">
            {lengthM.toFixed(1)} m
          </span>
        ) : (
          <span className="rsc-length-unknown" data-testid="route-length-unknown">
            — m
          </span>
        )}
        <span
          className={`rsc-conf-badge ${CONFIDENCE_MODIFIERS[lengthConfidence]}`}
          data-testid="route-length-confidence"
        >
          {CONFIDENCE_LABELS[lengthConfidence]}
        </span>
      </div>

      {/* Detail row */}
      <dl className="rsc-detail-list">
        <div className="rsc-detail-row">
          <dt>Bends</dt>
          <dd data-testid="route-bend-count">{bendCount}</dd>
        </div>
        <div className="rsc-detail-row">
          <dt>Wall penetrations</dt>
          <dd data-testid="route-wall-pen">{wallPenetrationCount}</dd>
        </div>
        <div className="rsc-detail-row">
          <dt>Floor penetrations</dt>
          <dd data-testid="route-floor-pen">{floorPenetrationCount}</dd>
        </div>
        <div className="rsc-detail-row">
          <dt>Install</dt>
          <dd>{installMethod}</dd>
        </div>
        {diameter && (
          <div className="rsc-detail-row">
            <dt>Diameter</dt>
            <dd>{diameter}</dd>
          </div>
        )}
        <div className="rsc-detail-row">
          <dt>Complexity</dt>
          <dd>
            <span className={`rsc-complexity ${COMPLEXITY_MODIFIERS[complexity]}`}>
              {COMPLEXITY_LABELS[complexity]}
            </span>
          </dd>
        </div>
      </dl>

      {/* Rationale */}
      {complexityRationale && (
        <p className="rsc-rationale" data-testid="route-rationale">
          {complexityRationale}
        </p>
      )}

      {/* Actions */}
      {(onEdit || onRemove) && (
        <div className="rsc-actions">
          {onEdit && (
            <button
              type="button"
              className="rsc-action-btn rsc-action-btn--edit"
              onClick={onEdit}
              aria-label={`Edit ${kindLabel} route`}
            >
              Edit
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className="rsc-action-btn rsc-action-btn--remove"
              onClick={onRemove}
              aria-label={`Remove ${kindLabel} route`}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
