/**
 * RouteInspectorPanel — inspector for FloorRoutes (pipe/service routes).
 *
 * Shows type, status, notes, optional object references, and provenance.
 * All editable fields delegate to `onUpdate`.
 *
 * PR16: heading now shows type + status badge; raw object IDs are shown
 * as read-only references rather than editable text inputs.
 */

import type { FloorRoute, FloorRouteType, FloorRouteStatus } from '../propertyPlan.types';
import {
  FLOOR_ROUTE_TYPE_LABELS,
  FLOOR_ROUTE_TYPE_COLORS,
  FLOOR_ROUTE_STATUS_LABELS,
} from '../propertyPlan.types';
import {
  routeProvenanceToLayoutConfidence,
  LAYOUT_CONFIDENCE_LABELS,
} from '../../../features/floorplan/provenanceToLayoutConfidence';

interface Props {
  route: FloorRoute;
  onUpdate: (patch: Partial<Omit<FloorRoute, 'id' | 'floorId' | 'provenance'>>) => void;
  onDelete: () => void;
}

const ROUTE_TYPES: FloorRouteType[] = ['flow', 'return', 'hot', 'cold', 'condensate', 'discharge'];
const ROUTE_STATUSES: FloorRouteStatus[] = ['existing', 'proposed', 'assumed'];

const STATUS_BADGE_STYLE: Record<FloorRouteStatus, React.CSSProperties> = {
  existing: { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
  proposed: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd' },
  assumed:  { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' },
};

/** Build a human-readable link summary from optional from/to object IDs. */
function formatLinkSummary(fromId?: string, toId?: string): string {
  const parts: string[] = [];
  if (fromId) parts.push('From: linked');
  if (toId) parts.push('To: linked');
  return parts.join(' · ');
}

export default function RouteInspectorPanel({ route, onUpdate, onDelete }: Props) {
  const typeColor = FLOOR_ROUTE_TYPE_COLORS[route.type];
  const confidence = route.provenance
    ? routeProvenanceToLayoutConfidence(route.status, route.provenance)
    : null;

  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span className="fpb__inspector-heading-main">
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 2,
              background: typeColor,
              flexShrink: 0,
            }}
          />
          <span className="fpb__inspector-type">{FLOOR_ROUTE_TYPE_LABELS[route.type]} Route</span>
          <span
            className="fpb__confidence-badge fpb__confidence-badge--inline"
            style={STATUS_BADGE_STYLE[route.status]}
          >
            {FLOOR_ROUTE_STATUS_LABELS[route.status]}
          </span>
          {confidence && (
            <span className="fpb__confidence-badge fpb__confidence-badge--inline">
              {LAYOUT_CONFIDENCE_LABELS[confidence]}
            </span>
          )}
        </span>
        <button className="fpb__delete-btn" onClick={onDelete} title="Delete route">✕</button>
      </div>

      {/* Assumed warning banner */}
      {route.status === 'assumed' && (
        <div style={{
          margin: '0 0 0.5rem',
          padding: '0.35rem 0.55rem',
          background: '#fffff0',
          border: '1px solid #f6e05e',
          borderRadius: 4,
          fontSize: '0.75rem',
          color: '#744210',
        }}>
          ⚠️ Assumed route — confirm path on arrival before cutting or drilling.
        </div>
      )}

      {/* Route type */}
      <label className="fpb__field">
        <span>Type</span>
        <select
          value={route.type}
          onChange={(e) => onUpdate({ type: e.target.value as FloorRouteType })}
        >
          {ROUTE_TYPES.map((t) => (
            <option key={t} value={t}>{FLOOR_ROUTE_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </label>

      {/* Route status */}
      <label className="fpb__field">
        <span>Status</span>
        <select
          value={route.status}
          onChange={(e) => onUpdate({ status: e.target.value as FloorRouteStatus })}
        >
          {ROUTE_STATUSES.map((s) => (
            <option key={s} value={s}>{FLOOR_ROUTE_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </label>

      {/* Notes */}
      <label className="fpb__field">
        <span>Notes</span>
        <input
          type="text"
          placeholder="e.g. via floor void"
          value={route.notes ?? ''}
          onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
        />
      </label>

      {/* From / To object references — read-only since IDs are internal */}
      {(route.fromObjectId || route.toObjectId) && (
        <div className="fpb__field fpb__field--static">
          <span>Links</span>
          <span style={{ fontSize: 12, color: '#475569' }}>
            {formatLinkSummary(route.fromObjectId, route.toObjectId)}
          </span>
        </div>
      )}

      {/* Point count */}
      <div className="fpb__field fpb__field--static">
        <span>Waypoints</span>
        <span className="fpb__provenance-badge">{route.points.length}</span>
      </div>
    </div>
  );
}
