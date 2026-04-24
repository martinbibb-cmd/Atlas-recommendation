/**
 * HandoffPreviewBanner.tsx — PR23 handoff preview readiness banner.
 *
 * Shown inside the floor plan builder when the surveyor enters handoff
 * preview mode.  Replaces the static PR22 banner with an actionable
 * pre-submit check:
 *
 *   • Overall readiness status (ready / needs verification / spatial data incomplete)
 *   • Grouped checklist (missing essentials / to-check or assumed / complete)
 *   • Quick-fix action per checklist item (open library, select object/route)
 *   • "Back to edit" button that exits preview while preserving all state
 *
 * Rules
 * ─────
 * - No hard blocking — informs without preventing submission.
 * - No new data contracts — uses existing PlanReadinessResult / PropertyPlan.
 * - No export / send logic.
 * - Engineer-readiness copy only (operational language).
 */

import type { PlanReadinessResult, PlanChecklistItem, PlanOverallStatus } from '../../../features/floorplan/planReadinessValidator';
import type { FloorObjectType, PropertyPlan, SelectionTarget } from '../propertyPlan.types';
import { usingDefaultDimensions } from '../../../features/floorplan/objectTemplates';

// ─── Quick-fix helpers ────────────────────────────────────────────────────────

/**
 * Derives the quick-fix action for a checklist item.
 *
 * Returns either:
 *   { kind: 'library', objectType }   — open object library pre-filtered to this type
 *   { kind: 'select', target }        — select an existing object or route on the canvas
 *   null                              — no quick-fix available; show a plain hint
 */
export type QuickFixAction =
  | { kind: 'library'; objectType: FloorObjectType }
  | { kind: 'select'; target: SelectionTarget };

function quickFixForItem(
  item: PlanChecklistItem,
  plan: PropertyPlan,
): QuickFixAction | null {
  // Missing / assumed items with a library placement quick-fix
  if (item.key === 'heat_source_recorded' && item.status === 'missing') {
    return { kind: 'library', objectType: 'boiler' };
  }
  if (item.key === 'flue_recorded' && item.status === 'missing') {
    return { kind: 'library', objectType: 'flue' };
  }
  if (item.key === 'cylinder_recorded' && item.status === 'missing') {
    return { kind: 'library', objectType: 'cylinder' };
  }

  // Assumed route — select the first assumed route of the relevant type
  if (item.key === 'discharge_route' && item.status === 'assumed') {
    const route = plan.floors
      .flatMap((f) => f.floorRoutes ?? [])
      .find((r) => r.type === 'discharge' && r.status === 'assumed');
    if (route) return { kind: 'select', target: { kind: 'floor_route', id: route.id } };
  }
  if (item.key === 'key_routes' && item.status === 'assumed') {
    const route = plan.floors
      .flatMap((f) => f.floorRoutes ?? [])
      .find((r) => r.status === 'assumed');
    if (route) return { kind: 'select', target: { kind: 'floor_route', id: route.id } };
  }

  // Default dimensions — select the first object that needs verification
  if (item.key === 'default_dimensions' && item.status === 'needs_checking') {
    const obj = plan.floors
      .flatMap((f) => f.floorObjects ?? [])
      .find(usingDefaultDimensions);
    if (obj) return { kind: 'select', target: { kind: 'floor_object', id: obj.id } };
  }

  return null;
}

// ─── Label / copy helpers ─────────────────────────────────────────────────────

const OVERALL_LABEL: Record<PlanOverallStatus, string> = {
  ready:          'Ready for engineer review',
  needs_checking: 'Needs route verification',
  incomplete:     'Spatial data incomplete',
};

const OVERALL_CONFIG: Record<
  PlanOverallStatus,
  { colour: string; bg: string; border: string; icon: string }
> = {
  ready:          { colour: '#14532d', bg: '#f0fdf4', border: '#86efac', icon: '✓' },
  needs_checking: { colour: '#78350f', bg: '#fffbeb', border: '#fcd34d', icon: '⚠' },
  incomplete:     { colour: '#7f1d1d', bg: '#fef2f2', border: '#fca5a5', icon: '✗' },
};

/** Short action label for a quick-fix button. */
function quickFixLabel(action: QuickFixAction): string {
  if (action.kind === 'library') {
    const labels: Record<FloorObjectType, string> = {
      boiler:   'Place boiler',
      flue:     'Place flue',
      cylinder: 'Place cylinder',
      radiator: 'Place radiator',
      sink:     'Place sink',
      bath:     'Place bath',
      shower:   'Place shower',
      other:    'Place object',
    };
    return labels[action.objectType] ?? 'Open object library';
  }
  if (action.target.kind === 'floor_route') return 'Select route';
  if (action.target.kind === 'floor_object') return 'Select object';
  return 'Go to item';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ChecklistRowProps {
  item: PlanChecklistItem;
  action: QuickFixAction | null;
  onAction: (action: QuickFixAction) => void;
}

function ChecklistRow({ item, action, onAction }: ChecklistRowProps) {
  const isMissing = item.status === 'missing';
  const isNeeds   = item.status === 'needs_checking';
  const isAssumed = item.status === 'assumed';
  const isComplete = item.status === 'complete';

  const rowColour  = isMissing ? '#7f1d1d' : isNeeds ? '#78350f' : isAssumed ? '#374151' : '#14532d';
  const rowBg      = isMissing ? '#fef2f2' : isNeeds ? '#fffbeb' : isAssumed ? '#f8fafc' : '#f0fdf4';
  const rowBorder  = isMissing ? '#fca5a5' : isNeeds ? '#fcd34d' : isAssumed ? '#cbd5e1' : '#86efac';
  const rowIcon    = isMissing ? '✗' : isNeeds ? '⚠' : isAssumed ? '?' : '✓';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '8px 10px',
      borderRadius: 6,
      background: rowBg,
      border: `1px solid ${rowBorder}`,
      marginBottom: 4,
    }}>
      <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: rowColour, width: 14, textAlign: 'center', marginTop: 1 }}>
        {rowIcon}
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1e293b', lineHeight: '1.4' }}>
          {item.label}
        </p>
        {item.detail && (
          <p style={{ margin: '1px 0 0', fontSize: 11, color: '#64748b', lineHeight: '1.4' }}>
            {item.detail}
          </p>
        )}
      </div>
      {action && !isComplete && (
        <button
          className="fpb__preview-quickfix-btn"
          onClick={() => onAction(action)}
          title={quickFixLabel(action)}
        >
          {quickFixLabel(action)}
        </button>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface HandoffPreviewBannerProps {
  /** Pre-computed readiness result for the current plan. */
  result: PlanReadinessResult;
  /** The current PropertyPlan — used to find quick-fix targets (route/object IDs). */
  plan: PropertyPlan;
  /** Exit preview mode and return to the editor. All state (selection, layers, zoom) is preserved. */
  onExitPreview: () => void;
  /** Open the object library and visually highlight the given type. */
  onOpenObjectLibrary: (highlightType: FloorObjectType) => void;
  /** Select an existing item on the canvas (route or object). */
  onSelectItem: (target: SelectionTarget) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HandoffPreviewBanner({
  result,
  plan,
  onExitPreview,
  onOpenObjectLibrary,
  onSelectItem,
}: HandoffPreviewBannerProps) {
  const cfg = OVERALL_CONFIG[result.overallStatus];

  // Group items by severity for ordered display
  const missing       = result.items.filter((i) => i.status === 'missing');
  const toCheck       = result.items.filter((i) => i.status === 'needs_checking' || i.status === 'assumed');
  const complete      = result.items.filter((i) => i.status === 'complete');

  function handleAction(action: QuickFixAction) {
    if (action.kind === 'library') {
      onOpenObjectLibrary(action.objectType);
    } else {
      onExitPreview();
      // Defer selection slightly so the canvas unmounts preview mode first
      setTimeout(() => onSelectItem(action.target), 0);
    }
  }

  return (
    <div className="fpb__preview-banner fpb__preview-banner--readiness" role="status">
      {/* ── Top bar: overall status + back-to-edit ── */}
      <div className="fpb__preview-banner-topbar">
        <div
          className="fpb__preview-readiness-badge"
          style={{ color: cfg.colour, background: cfg.bg, border: `1px solid ${cfg.border}` }}
        >
          <span className="fpb__preview-readiness-icon">{cfg.icon}</span>
          <span className="fpb__preview-readiness-label">
            {OVERALL_LABEL[result.overallStatus]}
          </span>
          <span className="fpb__preview-readiness-counts">
            {result.missingCount > 0 && (
              <span style={{ color: '#b91c1c' }}>✗ {result.missingCount} missing</span>
            )}
            {(result.needsCheckingCount > 0 || result.assumedCount > 0) && (
              <span style={{ color: '#92400e' }}>⚠ {result.needsCheckingCount + result.assumedCount} to verify</span>
            )}
            {result.overallStatus === 'ready' && (
              <span style={{ color: '#15803d' }}>All {result.completeCount} checks passed</span>
            )}
          </span>
        </div>
        <button className="fpb__preview-banner-close" onClick={onExitPreview}>
          ← Back to edit
        </button>
      </div>

      {/* ── Checklist sections ── */}
      {(missing.length > 0 || toCheck.length > 0 || complete.length > 0) && (
        <div className="fpb__preview-checklist">
          {missing.length > 0 && (
            <div className="fpb__preview-checklist-group">
              <p className="fpb__preview-checklist-heading" style={{ color: '#7f1d1d' }}>
                Missing essentials
              </p>
              {missing.map((item) => (
                <ChecklistRow
                  key={item.key}
                  item={item}
                  action={quickFixForItem(item, plan)}
                  onAction={handleAction}
                />
              ))}
            </div>
          )}

          {toCheck.length > 0 && (
            <div className="fpb__preview-checklist-group">
              <p className="fpb__preview-checklist-heading" style={{ color: '#78350f' }}>
                Assumed / to verify on site
              </p>
              {toCheck.map((item) => (
                <ChecklistRow
                  key={item.key}
                  item={item}
                  action={quickFixForItem(item, plan)}
                  onAction={handleAction}
                />
              ))}
            </div>
          )}

          {complete.length > 0 && result.overallStatus !== 'ready' && (
            <div className="fpb__preview-checklist-group">
              <p className="fpb__preview-checklist-heading" style={{ color: '#14532d' }}>
                Complete
              </p>
              {complete.map((item) => (
                <ChecklistRow
                  key={item.key}
                  item={item}
                  action={null}
                  onAction={handleAction}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
