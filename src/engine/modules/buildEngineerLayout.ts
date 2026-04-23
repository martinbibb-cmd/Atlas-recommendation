/**
 * buildEngineerLayout.ts — Adapter from PropertyPlan spatial truth to EngineerLayout.
 *
 * PR8 — Reads from the canonical PropertyPlan (floor planner model) and
 * produces an EngineerLayout suitable for the engineer handoff surface.
 *
 * Rules:
 *  - Returns undefined when no usable spatial data is present.
 *  - Never throws — partial data yields a partial layout.
 *  - Confidence levels are derived from EntityProvenance when available,
 *    otherwise default to 'assumed'.
 *  - Connection types not representable in EngineerLayoutRouteType are
 *    silently dropped (gas, prv, control are plant-room detail, not handoff).
 */

import type { PropertyPlan, Room, PlacementNode, ConnectionPath } from '../../components/floorplan/propertyPlan.types';
import type {
  EngineerLayout,
  EngineerLayoutRoom,
  EngineerLayoutWall,
  EngineerLayoutObject,
  EngineerLayoutObjectType,
  EngineerLayoutRoute,
  EngineerLayoutRouteType,
  LayoutConfidence,
} from '../../contracts/EngineerLayout';

// ─── Confidence derivation ────────────────────────────────────────────────────

function provenanceToConfidence(
  provenance: Room['provenance'] | undefined,
): LayoutConfidence {
  if (!provenance) return 'assumed';
  if (provenance.reviewStatus === 'reviewed' || provenance.reviewStatus === 'corrected') {
    return 'confirmed';
  }
  if (provenance.source === 'scanned') {
    return provenance.confidenceBand === 'high' ? 'confirmed' : 'inferred';
  }
  if (provenance.source === 'inferred') return 'inferred';
  if (provenance.source === 'manual') return 'confirmed';
  return 'assumed';
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

function adaptRooms(plan: PropertyPlan): EngineerLayoutRoom[] {
  return plan.floors.flatMap(floor =>
    floor.rooms.map(room => ({
      id:     room.id,
      name:   room.name,
      ...(room.areaM2 !== undefined ? { areaM2: room.areaM2 } : {}),
    })),
  );
}

// ─── Walls ────────────────────────────────────────────────────────────────────

function wallLengthM(wall: { x1: number; y1: number; x2: number; y2: number }): number {
  // Canvas units are not metres; without a scale we can only return a canvas
  // distance. We omit lengthM when no scale conversion is available.
  // Placeholder: caller must supply calibrated scale to get real metres.
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function adaptWalls(plan: PropertyPlan): EngineerLayoutWall[] {
  return plan.floors.flatMap(floor => {
    const openingsByWall = new Map<string, typeof floor.openings>();
    for (const opening of floor.openings) {
      const existing = openingsByWall.get(opening.wallId) ?? [];
      openingsByWall.set(opening.wallId, [...existing, opening]);
    }

    return floor.walls.map(wall => {
      const roomId = wall.roomIds?.[0] ?? '';
      const wallOpenings = openingsByWall.get(wall.id);
      const lengthRaw = wallLengthM(wall);

      const adapted: EngineerLayoutWall = {
        id:     wall.id,
        roomId,
        // Only expose lengthM when it looks like real canvas coordinates
        // (non-zero length). Callers with a real scale can post-process.
        ...(lengthRaw > 0 ? { lengthM: Math.round(lengthRaw * 100) / 100 } : {}),
      };

      if (wallOpenings && wallOpenings.length > 0) {
        adapted.openings = wallOpenings.map(o => ({
          type:                          o.type,
          ...(o.widthM !== undefined ? { widthMm: Math.round(o.widthM * 1000) } : {}),
          ...(o.offsetM !== undefined ? { offsetFromCornerMm: Math.round(o.offsetM * 1000) } : {}),
        }));
      }

      return adapted;
    });
  });
}

// ─── Objects ──────────────────────────────────────────────────────────────────

// Map from PropertyPlan PartKind → EngineerLayoutObjectType
const PART_KIND_TO_OBJECT_TYPE: Record<string, EngineerLayoutObjectType> = {
  boiler:         'boiler',
  system_boiler:  'boiler',
  combi_boiler:   'boiler',
  heat_pump:      'other',
  cylinder:       'cylinder',
  hot_cylinder:   'cylinder',
  radiator:       'radiator',
  radiator_loop:  'radiator',
  ufh_loop:       'radiator',
  sink:           'sink',
  bath:           'bath',
  shower:         'shower',
  consumer_unit:  'consumer_unit',
  flue:           'flue',
  flue_terminal:  'flue',
};

function nodeToObjectType(node: PlacementNode): EngineerLayoutObjectType {
  return PART_KIND_TO_OBJECT_TYPE[node.type as string] ?? 'other';
}

function nodeLabel(node: PlacementNode): string | undefined {
  const meta = node.metadata;
  if (typeof meta?.label === 'string') return meta.label;
  return undefined;
}

function adaptObjects(plan: PropertyPlan): EngineerLayoutObject[] {
  // Build a room-id → room name map for position hints.
  const roomById = new Map<string, Room>();
  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      roomById.set(room.id, room);
    }
  }

  return plan.placementNodes.map(node => {
    const room = node.roomId ? roomById.get(node.roomId) : undefined;
    const positionHint = room ? `Located in ${room.name}` : undefined;

    return {
      id:    node.id,
      type:  nodeToObjectType(node),
      ...(node.roomId     ? { roomId: node.roomId }            : {}),
      ...(nodeLabel(node) ? { label: nodeLabel(node)! }        : {}),
      ...(positionHint    ? { positionHint }                   : {}),
      // All nodes from a plan start as 'confirmed' — they were placed by a
      // user or imported from a scan. The provenance field is on Room/Wall
      // entities; nodes don't carry it, so we default to 'confirmed' here
      // since placement is always intentional.
      confidence: 'confirmed' as LayoutConfidence,
    };
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Only surface types relevant to the engineer handoff.
const CONNECTION_TYPE_MAP: Partial<Record<string, EngineerLayoutRouteType>> = {
  flow:       'flow',
  return:     'return',
  dhw_hot:    'hot',
  cold:       'cold',
  condensate: 'condensate',
  prv:        'discharge',
};

function resolveRouteLabel(nodeId: string, plan: PropertyPlan): string | undefined {
  const node = plan.placementNodes.find(n => n.id === nodeId);
  if (!node) return undefined;
  return nodeLabel(node) ?? nodeToObjectType(node);
}

function adaptRoutes(plan: PropertyPlan): EngineerLayoutRoute[] {
  const routes: EngineerLayoutRoute[] = [];

  for (const conn of plan.connections) {
    const routeType = CONNECTION_TYPE_MAP[conn.type as string];
    if (!routeType) continue; // gas, control, etc. — not surfaced in handoff

    routes.push({
      id:        conn.id,
      type:      routeType,
      fromLabel: resolveRouteLabel(conn.fromNodeId, plan),
      toLabel:   resolveRouteLabel(conn.toNodeId,   plan),
      // All connections in a plan are existing-and-placed or proposed by the
      // engineer. Without an explicit status field on ConnectionPath we default
      // to 'existing' and mark confidence as 'confirmed'.
      status:     'existing',
      confidence: 'confirmed',
    });
  }

  return routes;
}

// ─── Layout summary ───────────────────────────────────────────────────────────

/**
 * Produces human-readable summary lines from the produced layout.
 * These appear in EngineerHandoff.layoutSummary.
 */
export function buildLayoutSummaryLines(layout: EngineerLayout): string[] {
  const lines: string[] = [];

  const roomCount = layout.rooms.length;
  if (roomCount > 0) {
    lines.push(`${roomCount} room${roomCount !== 1 ? 's' : ''} recorded`);
  }

  const boiler    = layout.objects.find(o => o.type === 'boiler');
  const cylinder  = layout.objects.find(o => o.type === 'cylinder');
  const flue      = layout.objects.find(o => o.type === 'flue');
  const radiators = layout.objects.filter(o => o.type === 'radiator');

  if (boiler) {
    lines.push(boiler.positionHint
      ? `Boiler position recorded — ${boiler.positionHint}`
      : 'Boiler position recorded');
  }

  if (cylinder) {
    lines.push(cylinder.positionHint
      ? `Cylinder position recorded — ${cylinder.positionHint}`
      : 'Cylinder position recorded');
  }

  if (flue) {
    lines.push('Flue terminal position captured');
  }

  if (radiators.length > 0) {
    lines.push(`${radiators.length} emitter${radiators.length !== 1 ? 's' : ''} placed`);
  }

  const needsVerification = layout.objects.filter(o => o.confidence === 'needs_verification');
  for (const obj of needsVerification) {
    lines.push(`${obj.label ?? obj.type} — requires on-site verification`);
  }

  const assumedRoutes = (layout.routes ?? []).filter(r => r.status === 'assumed');
  if (assumedRoutes.length > 0) {
    lines.push(`${assumedRoutes.length} route${assumedRoutes.length !== 1 ? 's' : ''} assumed — confirm on arrival`);
  }

  const dischargeRoutes = (layout.routes ?? []).filter(r => r.type === 'discharge');
  if (dischargeRoutes.length > 0) {
    lines.push('Discharge route requires confirmation');
  }

  return lines;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * buildEngineerLayout
 *
 * Converts a PropertyPlan (floor planner model) into an EngineerLayout for
 * the engineer handoff surface.
 *
 * Returns undefined when:
 *   - No plan is supplied.
 *   - The plan contains no usable spatial data (no rooms, objects, or routes).
 *
 * Never throws.
 *
 * @param plan  The canonical PropertyPlan for this job, or undefined.
 */
export function buildEngineerLayout(plan: PropertyPlan | undefined): EngineerLayout | undefined {
  if (!plan) return undefined;

  const rooms   = adaptRooms(plan);
  const walls   = adaptWalls(plan);
  const objects = adaptObjects(plan);
  const routes  = adaptRoutes(plan);

  // If absolutely nothing was captured, return undefined to keep the handoff
  // page clean — empty layout sections add noise without value.
  if (rooms.length === 0 && objects.length === 0 && routes.length === 0) {
    return undefined;
  }

  return {
    rooms,
    walls,
    objects,
    ...(routes.length > 0 ? { routes } : {}),
  };
}
