/**
 * PlanReviewPanel.tsx — PR20 surveyor-facing plan readiness checklist.
 *
 * Displays a flat checklist derived from validatePlanReadiness() so surveyors
 * can see at a glance whether the floor plan is usable for handoff before
 * relying on it.
 *
 * Status categories shown:
 *   ✓ Complete        — green
 *   ⚠ Needs checking  — amber
 *   ✗ Missing         — red
 *   ? Assumed         — blue-grey
 *
 * Rules:
 *   - Does NOT block rendering.
 *   - No recommendation logic.
 *   - Receives a pre-computed PlanReadinessResult (keeps component thin).
 */

import type { PlanReadinessResult, PlanChecklistItem, PlanChecklistStatus } from '../../../features/floorplan/planReadinessValidator';
import { planHandoffSummaryLabel } from '../../../features/floorplan/planReadinessValidator';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  PlanChecklistStatus,
  { icon: string; colour: string; bg: string; border: string }
> = {
  complete:       { icon: '✓', colour: '#15803d', bg: '#f0fdf4', border: '#86efac' },
  needs_checking: { icon: '⚠', colour: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  missing:        { icon: '✗', colour: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
  assumed:        { icon: '?', colour: '#475569', bg: '#f8fafc', border: '#cbd5e1' },
};

// ─── Overall banner config ────────────────────────────────────────────────────

const OVERALL_CONFIG = {
  ready:          { colour: '#15803d', bg: '#f0fdf4', border: '#86efac', icon: '✓' },
  needs_checking: { colour: '#92400e', bg: '#fffbeb', border: '#fcd34d', icon: '⚠' },
  incomplete:     { colour: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', icon: '✗' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function OverallBanner({ result }: { result: PlanReadinessResult }) {
  const cfg = OVERALL_CONFIG[result.overallStatus];
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 8,
      padding: '10px 14px',
      marginBottom: 12,
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: cfg.colour }}>
        {cfg.icon} {planHandoffSummaryLabel(result.overallStatus)}
      </span>
      <span style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 10 }}>
        {result.completeCount > 0 && (
          <span style={{ color: '#15803d' }}>✓ {result.completeCount}</span>
        )}
        {result.needsCheckingCount > 0 && (
          <span style={{ color: '#92400e' }}>⚠ {result.needsCheckingCount}</span>
        )}
        {result.assumedCount > 0 && (
          <span style={{ color: '#475569' }}>? {result.assumedCount}</span>
        )}
        {result.missingCount > 0 && (
          <span style={{ color: '#b91c1c' }}>✗ {result.missingCount}</span>
        )}
      </span>
    </div>
  );
}

function ChecklistItemRow({ item }: { item: PlanChecklistItem }) {
  const cfg = STATUS_CONFIG[item.status];
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '9px 10px',
      borderRadius: 6,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      marginBottom: 5,
      minHeight: 44,
    }}>
      <span style={{
        flexShrink: 0,
        fontSize: 13,
        fontWeight: 700,
        color: cfg.colour,
        width: 16,
        textAlign: 'center',
        marginTop: 1,
      }}>
        {cfg.icon}
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
          {item.label}
        </p>
        {item.detail && (
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>
            {item.detail}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlanReviewPanelProps {
  result: PlanReadinessResult;
  /** Optional heading override. Defaults to "Plan review". */
  heading?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlanReviewPanel({ result, heading = 'Plan review' }: PlanReviewPanelProps) {
  // Group items by status for ordered display
  const missing        = result.items.filter((i) => i.status === 'missing');
  const needsChecking  = result.items.filter((i) => i.status === 'needs_checking');
  const assumed        = result.items.filter((i) => i.status === 'assumed');
  const complete       = result.items.filter((i) => i.status === 'complete');

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
        {heading}
      </h3>

      {/* Status banner is sticky so it stays visible when scrolling the checklist */}
      <div className="fpb__review-banner">
        <OverallBanner result={result} />
      </div>

      {missing.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <p className="fpb__review-group-heading" style={{ color: '#b91c1c' }}>
            Missing
          </p>
          {missing.map((item) => <ChecklistItemRow key={item.key} item={item} />)}
        </div>
      )}

      {needsChecking.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <p className="fpb__review-group-heading" style={{ color: '#92400e' }}>
            Needs checking
          </p>
          {needsChecking.map((item) => <ChecklistItemRow key={item.key} item={item} />)}
        </div>
      )}

      {assumed.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <p className="fpb__review-group-heading" style={{ color: '#475569' }}>
            Assumed
          </p>
          {assumed.map((item) => <ChecklistItemRow key={item.key} item={item} />)}
        </div>
      )}

      {complete.length > 0 && (
        <div>
          <p className="fpb__review-group-heading" style={{ color: '#15803d' }}>
            Complete
          </p>
          {complete.map((item) => <ChecklistItemRow key={item.key} item={item} />)}
        </div>
      )}
    </div>
  );
}
