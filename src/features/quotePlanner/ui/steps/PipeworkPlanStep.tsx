/**
 * PipeworkPlanStep.tsx
 *
 * Step 7 of the Quote Planner: "Pipework plan".
 *
 * Lets the engineer draw proposed pipework routes on the floor plan and
 * review calculated lengths, bends, penetrations, and complexity.
 *
 * Orchestrates:
 *   1. Route list by type — shows all drawn routes via RouteSummaryCard.
 *   2. Route editor — add a new route or edit an existing one:
 *      a. RouteTypePicker — select the service type.
 *      b. RouteDrawingCanvas — draw the polyline on the floor plan.
 *      c. Status / install method / diameter / penetration inputs.
 *      d. Scale input — converts pixel coordinates to metres.
 *      e. Manual length override.
 *   3. Calculation summary per route (inside RouteSummaryCard).
 *
 * UI copy:
 *   Heading:    "Pipework plan"
 *   Subheading: "Draw proposed pipe routes and review lengths, bends, and complexity."
 *
 * Design rules:
 *   - Does not output customer-facing copy.
 *   - Does not alter recommendation logic.
 *   - No pricing — installation-planning data only.
 *   - No fake lengths when a scale factor is unavailable.
 *   - `onRoutesChange` is called with the updated routes array after every
 *     engineer action — the parent is responsible for storing it.
 */

import { useState } from 'react';
import { RouteTypePicker, PIPEWORK_ROUTE_KIND_LABELS } from '../routes/RouteTypePicker';
import { RouteDrawingCanvas } from '../routes/RouteDrawingCanvas';
import { RouteSummaryCard, CONFIDENCE_LABELS, COMPLEXITY_LABELS } from '../routes/RouteSummaryCard';
import {
  buildPipeworkRouteDraft,
  addRoutePoint,
  removeRoutePoint,
  updateRouteStatus,
  updateRouteInstallMethod,
  updateRouteDiameter,
  updateRouteCoordinateSpace,
  updateRoutePenetrations,
  applyManualLengthOverride,
} from '../../model/routeActions';
import type {
  QuotePlanPipeworkRouteV1,
  PipeworkRouteKind,
  PipeworkRouteStatus,
  PipeworkInstallMethod,
} from '../../model/QuoteInstallationPlanV1';
import type { QuotePointCoordinateSpace } from '../../calculators/quotePlannerTypes';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PipeworkPlanStepProps {
  /** Current list of engineer-drawn pipework routes. */
  pipeworkRoutes: QuotePlanPipeworkRouteV1[];
  /** Called whenever the engineer adds, removes, or edits a route. */
  onRoutesChange: (routes: QuotePlanPipeworkRouteV1[]) => void;
  /**
   * Optional floor-plan image URI from the scan session.
   * When provided, RouteDrawingCanvas shows the floor plan as the drawing
   * surface.
   */
  floorPlanUri?: string;
}

// ─── Status options ───────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: PipeworkRouteStatus; label: string }[] = [
  { value: 'proposed',        label: 'Proposed (new pipe)' },
  { value: 'reused_existing', label: 'Reused existing' },
  { value: 'assumed',         label: 'Assumed (not verified)' },
];

const INSTALL_METHOD_OPTIONS: { value: PipeworkInstallMethod; label: string }[] = [
  { value: 'surface',    label: 'Surface' },
  { value: 'boxed',      label: 'Boxed' },
  { value: 'concealed',  label: 'Concealed' },
  { value: 'underfloor', label: 'Underfloor' },
  { value: 'loft',       label: 'Loft' },
  { value: 'external',   label: 'External' },
  { value: 'unknown',    label: 'Unknown' },
];

// ─── Route colour map ─────────────────────────────────────────────────────────

const ROUTE_COLORS: Record<PipeworkRouteKind, string> = {
  gas:             '#f59e0b',
  heating_flow:    '#ef4444',
  heating_return:  '#3b82f6',
  condensate:      '#8b5cf6',
  hot_water:       '#f97316',
  cold_main:       '#06b6d4',
  discharge:       '#64748b',
  controls:        '#10b981',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PipeworkPlanStep({
  pipeworkRoutes,
  onRoutesChange,
  floorPlanUri,
}: PipeworkPlanStepProps) {
  /** The route currently being edited, or null when the list view is active. */
  const [editingRoute, setEditingRoute] = useState<QuotePlanPipeworkRouteV1 | null>(null);
  /** Whether the "new route" type picker is open. */
  const [addingNew, setAddingNew] = useState(false);
  /** Manual override input value. */
  const [manualLengthInput, setManualLengthInput] = useState('');
  const [manualLengthError, setManualLengthError] = useState('');
  /** Whether the manual override panel is expanded. */
  const [manualOverrideOpen, setManualOverrideOpen] = useState(false);
  /** Scale input value (metres per pixel) for pixel-space routes. */
  const [scaleInput, setScaleInput] = useState('');
  const [scaleError, setScaleError] = useState('');

  // ── Route list mutations ────────────────────────────────────────────────────

  function upsertRoute(updated: QuotePlanPipeworkRouteV1) {
    const idx = pipeworkRoutes.findIndex(
      (r) => r.pipeworkRouteId === updated.pipeworkRouteId,
    );
    if (idx >= 0) {
      const next = pipeworkRoutes.map((r, i) => (i === idx ? updated : r));
      onRoutesChange(next);
    } else {
      onRoutesChange([...pipeworkRoutes, updated]);
    }
    setEditingRoute(updated);
  }

  function removeRoute(routeId: string) {
    onRoutesChange(pipeworkRoutes.filter((r) => r.pipeworkRouteId !== routeId));
    if (editingRoute?.pipeworkRouteId === routeId) {
      setEditingRoute(null);
    }
  }

  // ── Starting a new route ───────────────────────────────────────────────────

  function handleSelectNewKind(kind: PipeworkRouteKind) {
    const draft = buildPipeworkRouteDraft(kind);
    setAddingNew(false);
    setManualOverrideOpen(false);
    setManualLengthInput('');
    setManualLengthError('');
    setScaleInput('');
    setScaleError('');
    setEditingRoute(draft);
    // Do not add to list until the first point is drawn or the user saves.
  }

  // ── Editing an existing route ──────────────────────────────────────────────

  function handleEditExisting(route: QuotePlanPipeworkRouteV1) {
    setAddingNew(false);
    setManualOverrideOpen(false);
    setManualLengthInput('');
    setManualLengthError('');
    setScaleInput(
      route.scale ? String(route.scale.metresPerPixel) : '',
    );
    setScaleError('');
    setEditingRoute(route);
  }

  // ── Canvas interactions ────────────────────────────────────────────────────

  function handleAddPoint(point: { x: number; y: number }) {
    if (!editingRoute) return;
    const updated = addRoutePoint(editingRoute, point);
    upsertRoute(updated);
  }

  function handleRemoveLastPoint() {
    if (!editingRoute || editingRoute.points.length === 0) return;
    const lastIdx = editingRoute.points.length - 1;
    const updated = removeRoutePoint(editingRoute, lastIdx);
    upsertRoute(updated);
  }

  // ── Property updates ───────────────────────────────────────────────────────

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!editingRoute) return;
    upsertRoute(updateRouteStatus(editingRoute, e.target.value as PipeworkRouteStatus));
  }

  function handleInstallMethodChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!editingRoute) return;
    upsertRoute(updateRouteInstallMethod(editingRoute, e.target.value as PipeworkInstallMethod));
  }

  function handleDiameterChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editingRoute) return;
    upsertRoute(updateRouteDiameter(editingRoute, e.target.value || undefined));
  }

  function handleWallPenChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editingRoute) return;
    const val = parseInt(e.target.value, 10);
    upsertRoute(
      updateRoutePenetrations(
        editingRoute,
        isNaN(val) ? 0 : Math.max(0, val),
        editingRoute.floorPenetrationCount,
      ),
    );
  }

  function handleFloorPenChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editingRoute) return;
    const val = parseInt(e.target.value, 10);
    upsertRoute(
      updateRoutePenetrations(
        editingRoute,
        editingRoute.wallPenetrationCount,
        isNaN(val) ? 0 : Math.max(0, val),
      ),
    );
  }

  // ── Scale input ────────────────────────────────────────────────────────────

  function handleApplyScale() {
    if (!editingRoute) return;
    const parsed = parseFloat(scaleInput);
    if (isNaN(parsed) || parsed <= 0) {
      setScaleError('Enter a positive number (e.g. 0.02 for 1 px = 2 cm).');
      return;
    }
    setScaleError('');
    upsertRoute(
      updateRouteCoordinateSpace(editingRoute, 'pixels', { metresPerPixel: parsed }),
    );
  }

  function handleClearScale() {
    if (!editingRoute) return;
    setScaleInput('');
    setScaleError('');
    upsertRoute(updateRouteCoordinateSpace(editingRoute, 'pixels', undefined));
  }

  function handleCoordinateSpaceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!editingRoute) return;
    const space = e.target.value as QuotePointCoordinateSpace;
    if (space === 'metres') {
      setScaleInput('');
      setScaleError('');
      upsertRoute(updateRouteCoordinateSpace(editingRoute, 'metres'));
    } else {
      upsertRoute(updateRouteCoordinateSpace(editingRoute, 'pixels', undefined));
    }
  }

  // ── Manual override ────────────────────────────────────────────────────────

  function handleApplyManualOverride() {
    if (!editingRoute) return;
    const parsed = parseFloat(manualLengthInput);
    if (isNaN(parsed) || parsed < 0) {
      setManualLengthError('Enter a non-negative length in metres (e.g. 4.5).');
      return;
    }
    setManualLengthError('');
    upsertRoute(applyManualLengthOverride(editingRoute, parsed));
  }

  // ── Save / close editor ────────────────────────────────────────────────────

  function handleSaveAndClose() {
    setEditingRoute(null);
    setManualOverrideOpen(false);
    setManualLengthInput('');
    setManualLengthError('');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const calc = editingRoute?.calculation;
  const isEditing = editingRoute !== null;

  return (
    <>
      <h2 className="qp-step-heading">Pipework plan</h2>

      <p className="qp-step-subheading">
        Draw proposed pipe routes and review lengths, bends, and complexity.
      </p>

      {/* ── Route editor (when a route is being drawn/edited) ── */}
      {isEditing && editingRoute && (
        <section
          className="pw-editor"
          aria-labelledby="pw-editor-heading"
          data-testid="pipework-route-editor"
        >
          <h3 id="pw-editor-heading" className="pw-section-heading">
            Editing: {PIPEWORK_ROUTE_KIND_LABELS[editingRoute.routeKind] ?? editingRoute.routeKind}
          </h3>

          {/* Drawing canvas */}
          <div className="pw-canvas-wrapper">
            <RouteDrawingCanvas
              points={editingRoute.points}
              onAddPoint={handleAddPoint}
              onRemoveLastPoint={handleRemoveLastPoint}
              floorPlanUri={floorPlanUri}
              color={ROUTE_COLORS[editingRoute.routeKind]}
            />
          </div>

          {/* Scale / coordinate-space settings */}
          <section className="pw-section" aria-labelledby="pw-scale-heading">
            <h4 id="pw-scale-heading" className="pw-field-label">
              Coordinate space
            </h4>

            <div className="pw-field-row">
              <label htmlFor="pw-coord-space" className="pw-field-label">
                Points measured in
              </label>
              <select
                id="pw-coord-space"
                className="pw-select"
                value={editingRoute.coordinateSpace}
                onChange={handleCoordinateSpaceChange}
                aria-label="Coordinate space"
              >
                <option value="pixels">Pixels (floor plan image)</option>
                <option value="metres">Metres (pre-measured)</option>
              </select>
            </div>

            {editingRoute.coordinateSpace === 'pixels' && (
              <div className="pw-scale-row">
                <label htmlFor="pw-scale-input" className="pw-field-label">
                  Scale: metres per pixel
                </label>
                <div className="pw-scale-controls">
                  <input
                    id="pw-scale-input"
                    type="number"
                    className="pw-input pw-input--short"
                    min="0.0001"
                    step="0.001"
                    value={scaleInput}
                    onChange={(e) => {
                      setScaleInput(e.target.value);
                      setScaleError('');
                    }}
                    aria-label="Scale: metres per pixel"
                    placeholder="e.g. 0.02"
                  />
                  <button
                    type="button"
                    className="pw-btn pw-btn--primary"
                    onClick={handleApplyScale}
                  >
                    Apply
                  </button>
                  {editingRoute.scale && (
                    <button
                      type="button"
                      className="pw-btn pw-btn--secondary"
                      onClick={handleClearScale}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {scaleError && (
                  <p className="pw-field-error" role="alert">{scaleError}</p>
                )}
                {!editingRoute.scale && calc?.lengthConfidence === 'needs_scale' && (
                  <p className="pw-scale-hint" role="note">
                    Length needs scale — set a metres-per-pixel scale to calculate
                    physical length, or use the manual override below.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Properties */}
          <section className="pw-section" aria-labelledby="pw-props-heading">
            <h4 id="pw-props-heading" className="pw-section-heading">
              Route properties
            </h4>

            <div className="pw-field-row">
              <label htmlFor="pw-status" className="pw-field-label">Status</label>
              <select
                id="pw-status"
                className="pw-select"
                value={editingRoute.status}
                onChange={handleStatusChange}
                aria-label="Route status"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="pw-field-row">
              <label htmlFor="pw-install-method" className="pw-field-label">
                Install method
              </label>
              <select
                id="pw-install-method"
                className="pw-select"
                value={editingRoute.installMethod}
                onChange={handleInstallMethodChange}
                aria-label="Install method"
              >
                {INSTALL_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="pw-field-row">
              <label htmlFor="pw-diameter" className="pw-field-label">Diameter</label>
              <input
                id="pw-diameter"
                type="text"
                className="pw-input"
                value={editingRoute.diameter ?? ''}
                onChange={handleDiameterChange}
                placeholder="e.g. 22mm, 15mm"
                aria-label="Pipe diameter"
              />
            </div>

            <div className="pw-field-row">
              <label htmlFor="pw-wall-pen" className="pw-field-label">
                Wall penetrations
              </label>
              <input
                id="pw-wall-pen"
                type="number"
                className="pw-input pw-input--short"
                min="0"
                step="1"
                value={editingRoute.wallPenetrationCount}
                onChange={handleWallPenChange}
                aria-label="Wall penetration count"
              />
            </div>

            <div className="pw-field-row">
              <label htmlFor="pw-floor-pen" className="pw-field-label">
                Floor penetrations
              </label>
              <input
                id="pw-floor-pen"
                type="number"
                className="pw-input pw-input--short"
                min="0"
                step="1"
                value={editingRoute.floorPenetrationCount}
                onChange={handleFloorPenChange}
                aria-label="Floor penetration count"
              />
            </div>
          </section>

          {/* Manual length override */}
          <section className="pw-section" aria-labelledby="pw-manual-heading">
            <button
              type="button"
              className="pw-toggle-btn"
              aria-expanded={manualOverrideOpen}
              onClick={() => setManualOverrideOpen((v) => !v)}
            >
              {manualOverrideOpen ? '▲ Hide manual override' : '▼ Manual length override'}
            </button>

            {manualOverrideOpen && (
              <div className="pw-manual-override" data-testid="manual-override-panel">
                <p className="pw-manual-hint" id="pw-manual-heading">
                  Enter a measured or estimated length to override the drawn-route
                  calculation.  Confidence is set to &ldquo;manual&rdquo;.
                </p>
                <div className="pw-scale-controls">
                  <input
                    type="number"
                    className="pw-input pw-input--short"
                    min="0"
                    step="0.1"
                    value={manualLengthInput}
                    onChange={(e) => {
                      setManualLengthInput(e.target.value);
                      setManualLengthError('');
                    }}
                    aria-label="Manual length in metres"
                    placeholder="e.g. 4.5"
                  />
                  <span className="pw-unit-label">m</span>
                  <button
                    type="button"
                    className="pw-btn pw-btn--primary"
                    onClick={handleApplyManualOverride}
                  >
                    Apply
                  </button>
                </div>
                {manualLengthError && (
                  <p className="pw-field-error" role="alert">{manualLengthError}</p>
                )}
              </div>
            )}
          </section>

          {/* Calculation summary */}
          {calc && (
            <section className="pw-section" aria-labelledby="pw-calc-heading">
              <h4 id="pw-calc-heading" className="pw-section-heading">
                Calculation summary
              </h4>
              <dl className="pw-calc-list">
                <div className="pw-calc-row">
                  <dt>Length</dt>
                  <dd data-testid="pw-calc-length">
                    {calc.lengthM !== null
                      ? `${calc.lengthM.toFixed(1)} m`
                      : 'Length needs scale'}
                  </dd>
                </div>
                <div className="pw-calc-row">
                  <dt>Confidence</dt>
                  <dd>{CONFIDENCE_LABELS[calc.lengthConfidence]}</dd>
                </div>
                <div className="pw-calc-row">
                  <dt>Bends</dt>
                  <dd>{calc.bendCount}</dd>
                </div>
                <div className="pw-calc-row">
                  <dt>Wall penetrations</dt>
                  <dd>{calc.wallPenetrationCount}</dd>
                </div>
                <div className="pw-calc-row">
                  <dt>Floor penetrations</dt>
                  <dd>{calc.floorPenetrationCount}</dd>
                </div>
                <div className="pw-calc-row">
                  <dt>Complexity</dt>
                  <dd className={`pw-complexity pw-complexity--${calc.complexity}`}>
                    {COMPLEXITY_LABELS[calc.complexity]}
                  </dd>
                </div>
              </dl>
              {calc.complexityRationale && (
                <p className="pw-rationale">{calc.complexityRationale}</p>
              )}
            </section>
          )}

          {/* Done button */}
          <button
            type="button"
            className="pw-done-btn"
            onClick={handleSaveAndClose}
          >
            ✓ Done
          </button>
        </section>
      )}

      {/* ── Route list ── */}
      {pipeworkRoutes.length > 0 && (
        <section className="pw-route-list" aria-labelledby="pw-list-heading">
          <h3 id="pw-list-heading" className="pw-section-heading">
            Routes ({pipeworkRoutes.length})
          </h3>
          {pipeworkRoutes.map((route) => (
            <RouteSummaryCard
              key={route.pipeworkRouteId}
              route={route}
              onEdit={() => handleEditExisting(route)}
              onRemove={() => removeRoute(route.pipeworkRouteId)}
            />
          ))}
        </section>
      )}

      {/* ── Add route bar ── */}
      {!isEditing && (
        <div className="pw-add-bar">
          {addingNew ? (
            <>
              <p className="pw-add-hint">Select the route type to draw:</p>
              <RouteTypePicker selected={null} onSelect={handleSelectNewKind} />
              <button
                type="button"
                className="pw-btn pw-btn--secondary"
                onClick={() => setAddingNew(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="pw-btn pw-btn--add"
              onClick={() => setAddingNew(true)}
              aria-label="Add a new pipe route"
            >
              + Add route
            </button>
          )}
        </div>
      )}

      {/* Empty hint */}
      {pipeworkRoutes.length === 0 && !isEditing && !addingNew && (
        <p className="qp-context-hint">
          No routes drawn yet. Tap &ldquo;Add route&rdquo; to begin drawing a pipe
          route on the floor plan.
        </p>
      )}
    </>
  );
}
