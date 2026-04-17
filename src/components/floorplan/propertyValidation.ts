/**
 * propertyValidation.ts
 *
 * Validation engine for the three-layer property plan.
 * Checks geometry, placement, and connection layers independently.
 * Returns an array of ValidationIssue instances ordered by severity.
 */

import type {
  PropertyPlan,
  Room,
  Wall,
  ValidationIssue,
} from './propertyPlan.types';
import {
  BOILER_VALID_ROOM_TYPES,
  CYLINDER_VALID_ROOM_TYPES,
} from './propertyPlan.types';

let _issueSeq = 0;
function issueId() {
  return `issue_${++_issueSeq}`;
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function roomsOverlap(a: Room, b: Room): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function wallLengthPx(wall: Wall): number {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Geometry layer checks ────────────────────────────────────────────────────

function checkGeometry(plan: PropertyPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const floor of plan.floors) {
    // Overlapping rooms on the same floor
    for (let i = 0; i < floor.rooms.length; i++) {
      for (let j = i + 1; j < floor.rooms.length; j++) {
        if (roomsOverlap(floor.rooms[i], floor.rooms[j])) {
          issues.push({
            id: issueId(),
            severity: 'error',
            layer: 'geometry',
            objectId: floor.rooms[i].id,
            objectType: 'room',
            message: `"${floor.rooms[i].name}" overlaps with "${floor.rooms[j].name}" on ${floor.name}.`,
          });
        }
      }
    }

    // Duplicate room names on the same floor
    const nameCounts = new Map<string, number>();
    for (const room of floor.rooms) {
      nameCounts.set(room.name, (nameCounts.get(room.name) ?? 0) + 1);
    }
    for (const [name, count] of nameCounts) {
      if (count > 1) {
        issues.push({
          id: issueId(),
          severity: 'warning',
          layer: 'geometry',
          objectType: 'floor',
          objectId: floor.id,
          message: `Room name "${name}" is used ${count} times on ${floor.name}.`,
        });
      }
    }

    // Zero-length walls
    for (const wall of floor.walls) {
      if (wallLengthPx(wall) < 4) {
        issues.push({
          id: issueId(),
          severity: 'warning',
          layer: 'geometry',
          objectId: wall.id,
          objectType: 'wall',
          message: 'Wall is too short (< 4 px). It may be orphaned.',
        });
      }
    }

    // Openings that reference non-existent walls
    const wallIds = new Set(floor.walls.map((w) => w.id));
    for (const opening of floor.openings) {
      if (!wallIds.has(opening.wallId)) {
        issues.push({
          id: issueId(),
          severity: 'warning',
          layer: 'geometry',
          objectId: opening.id,
          objectType: 'opening',
          message: `Opening references a wall that no longer exists on ${floor.name}.`,
        });
      }
    }
  }

  // No floors at all
  if (plan.floors.length === 0) {
    issues.push({
      id: issueId(),
      severity: 'error',
      layer: 'geometry',
      objectType: 'property',
      message: 'Property has no floors defined.',
    });
  }

  return issues;
}

// ─── Placement layer checks ───────────────────────────────────────────────────

function checkPlacement(plan: PropertyPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Build a quick lookup from roomId → Room
  const roomById = new Map<string, Room>();
  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      roomById.set(room.id, room);
    }
  }

  const heatSourceKinds = [
    'heat_source_combi',
    'heat_source_system_boiler',
    'heat_source_regular_boiler',
    'heat_source_heat_pump',
  ] as const;
  const cylinderKinds = [
    'dhw_unvented_cylinder',
    'dhw_mixergy',
    'dhw_vented_cylinder',
  ] as const;

  const isHeatSource = (kind: string) =>
    heatSourceKinds.includes(kind as (typeof heatSourceKinds)[number]);
  const isCylinder = (kind: string) =>
    cylinderKinds.includes(kind as (typeof cylinderKinds)[number]);
  const isHeatPump = (kind: string) => kind === 'heat_source_heat_pump';

  for (const node of plan.placementNodes) {
    const room = node.roomId ? roomById.get(node.roomId) : undefined;

    // Boiler / heat source placed in invalid room type
    if (isHeatSource(node.type) && !isHeatPump(node.type) && room) {
      if (!BOILER_VALID_ROOM_TYPES.includes(room.roomType)) {
        issues.push({
          id: issueId(),
          severity: 'warning',
          layer: 'placement',
          objectId: node.id,
          objectType: 'node',
          message: `Boiler/heat-source placed in "${room.name}" (${room.roomType}). Preferred: kitchen, utility, garage, cupboard, plant room.`,
        });
      }
    }

    // Cylinder placed in invalid room type
    if (isCylinder(node.type) && room) {
      if (!CYLINDER_VALID_ROOM_TYPES.includes(room.roomType)) {
        issues.push({
          id: issueId(),
          severity: 'warning',
          layer: 'placement',
          objectId: node.id,
          objectType: 'node',
          message: `Cylinder placed in "${room.name}" (${room.roomType}). Preferred: cupboard, plant room, utility.`,
        });
      }
    }

    // Heat pump should be outside
    if (isHeatPump(node.type) && room && room.roomType !== 'outside') {
      issues.push({
        id: issueId(),
        severity: 'error',
        layer: 'placement',
        objectId: node.id,
        objectType: 'node',
        message: `Heat pump outdoor unit must be placed outside the building envelope.`,
      });
    }

    // Node placed with no floor
    const floorExists = plan.floors.some((f) => f.id === node.floorId);
    if (!floorExists) {
      issues.push({
        id: issueId(),
        severity: 'error',
        layer: 'placement',
        objectId: node.id,
        objectType: 'node',
        message: 'Placement node references a floor that no longer exists.',
      });
    }
  }

  // No heat source at all
  const hasHeatSource = plan.placementNodes.some((n) => isHeatSource(n.type));
  if (!hasHeatSource && plan.placementNodes.length > 0) {
    issues.push({
      id: issueId(),
      severity: 'warning',
      layer: 'placement',
      objectType: 'property',
      message: 'No heat source placed. Add a boiler or heat pump to complete the system.',
    });
  }

  return issues;
}

// ─── Connection layer checks ──────────────────────────────────────────────────

function checkConnections(plan: PropertyPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const nodeIds = new Set(plan.placementNodes.map((n) => n.id));

  for (const conn of plan.connections) {
    if (!nodeIds.has(conn.fromNodeId)) {
      issues.push({
        id: issueId(),
        severity: 'error',
        layer: 'connection',
        objectId: conn.id,
        objectType: 'connection',
        message: 'Connection references a source node that no longer exists.',
      });
    }
    if (!nodeIds.has(conn.toNodeId)) {
      issues.push({
        id: issueId(),
        severity: 'error',
        layer: 'connection',
        objectId: conn.id,
        objectType: 'connection',
        message: 'Connection references a target node that no longer exists.',
      });
    }
    if (conn.route.length < 2) {
      issues.push({
        id: issueId(),
        severity: 'warning',
        layer: 'connection',
        objectId: conn.id,
        objectType: 'connection',
        message: 'Connection route has fewer than 2 points — no path defined.',
      });
    }
  }

  return issues;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  /** Whether the property is fully valid (no errors) */
  isValid: boolean;
}

export function validatePropertyPlan(plan: PropertyPlan): ValidationResult {
  const issues = [
    ...checkGeometry(plan),
    ...checkPlacement(plan),
    ...checkConnections(plan),
  ];

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    issues,
    errorCount,
    warningCount,
    isValid: errorCount === 0,
  };
}

/** Get all issues for a specific object (room/wall/node/connection) by its id. */
export function issuesForObject(
  result: ValidationResult,
  objectId: string,
): ValidationIssue[] {
  return result.issues.filter((i) => i.objectId === objectId);
}

/** Derive a severity badge state for a single object. */
export function badgeForObject(
  result: ValidationResult,
  objectId: string,
): 'error' | 'warning' | 'ok' {
  const obj = issuesForObject(result, objectId);
  if (obj.some((i) => i.severity === 'error')) return 'error';
  if (obj.some((i) => i.severity === 'warning')) return 'warning';
  return 'ok';
}
