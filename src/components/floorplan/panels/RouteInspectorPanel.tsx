/**
 * RouteInspectorPanel — inspector for FloorRoutes (pipe/service routes).
 *
 * Shows type, status, notes, optional object references, and provenance.
 * All editable fields delegate to `onUpdate`.
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

export default function RouteInspectorPanel({ route, onUpdate, onDelete }: Props) {
  const typeColor = FLOOR_ROUTE_TYPE_COLORS[route.type];

  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 2,
              background: typeColor,
              marginRight: 6,
              verticalAlign: 'middle',
            }}
          />
          {FLOOR_ROUTE_TYPE_LABELS[route.type]} Route
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

      {/* From object */}
      <label className="fpb__field">
        <span>From object ID</span>
        <input
          type="text"
          placeholder="optional"
          value={route.fromObjectId ?? ''}
          onChange={(e) => onUpdate({ fromObjectId: e.target.value || undefined })}
        />
      </label>

      {/* To object */}
      <label className="fpb__field">
        <span>To object ID</span>
        <input
          type="text"
          placeholder="optional"
          value={route.toObjectId ?? ''}
          onChange={(e) => onUpdate({ toObjectId: e.target.value || undefined })}
        />
      </label>

      {/* Point count */}
      <div className="fpb__field fpb__field--static">
        <span>Points</span>
        <span className="fpb__provenance-badge">{route.points.length} waypoints</span>
      </div>

      {/* Provenance */}
      {route.provenance && (
        <div className="fpb__field fpb__field--static">
          <span>Confidence</span>
          <span className="fpb__provenance-badge">
            {LAYOUT_CONFIDENCE_LABELS[routeProvenanceToLayoutConfidence(route.status, route.provenance)]}
          </span>
        </div>
      )}
    </div>
  );
}
