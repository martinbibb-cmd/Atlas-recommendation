/**
 * EngineerLayout.ts — Spatial handoff contract for the engineer surface.
 *
 * PR8 — A lean spatial model that gives the engineer install-ready spatial
 * truth: where things are, what the routes look like, and what still needs
 * verification on site.
 *
 * Design rules:
 *  - Not a CAD model — enough to walk a job, not to draw one.
 *  - Every object and route carries a confidence level so assumed layout is
 *    never presented as confirmed fact.
 *  - Optional throughout — missing spatial data must not break the handoff page.
 */

// ─── Confidence ───────────────────────────────────────────────────────────────

/**
 * How certain Atlas is about a spatial fact.
 *
 * confirmed         — physically measured or engineer-tagged during survey.
 * inferred          — derived algorithmically from other measured data.
 * assumed           — default or heuristic value, not site-verified.
 * needs_verification — flagged as requiring on-site confirmation.
 */
export type LayoutConfidence = 'confirmed' | 'inferred' | 'assumed' | 'needs_verification';

// ─── Rooms ────────────────────────────────────────────────────────────────────

export interface EngineerLayoutRoom {
  id: string;
  name: string;
  areaM2?: number;
}

// ─── Walls ────────────────────────────────────────────────────────────────────

export interface EngineerLayoutOpening {
  type: 'door' | 'window';
  widthMm?: number;
  heightMm?: number;
  offsetFromCornerMm?: number;
}

export interface EngineerLayoutWall {
  id: string;
  roomId: string;
  lengthM?: number;
  openings?: EngineerLayoutOpening[];
}

// ─── Objects ──────────────────────────────────────────────────────────────────

export type EngineerLayoutObjectType =
  | 'boiler'
  | 'cylinder'
  | 'radiator'
  | 'sink'
  | 'bath'
  | 'shower'
  | 'consumer_unit'
  | 'flue'
  | 'other';

export interface EngineerLayoutObject {
  id: string;
  roomId?: string;
  type: EngineerLayoutObjectType;
  label?: string;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  /** Free-text spatial hint, e.g. "north-east corner of kitchen". */
  positionHint?: string;
  /** How confident Atlas is about the existence / position of this object. */
  confidence: LayoutConfidence;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export type EngineerLayoutRouteType =
  | 'flow'
  | 'return'
  | 'cold'
  | 'hot'
  | 'condensate'
  | 'discharge';

export interface EngineerLayoutRoute {
  id: string;
  type: EngineerLayoutRouteType;
  fromLabel?: string;
  toLabel?: string;
  /** Whether this route is already installed, proposed, or only assumed. */
  status: 'existing' | 'proposed' | 'assumed';
  /** How confident Atlas is about the route path. */
  confidence: LayoutConfidence;
}

// ─── Top-level contract ───────────────────────────────────────────────────────

/**
 * EngineerLayout
 *
 * Produced by buildEngineerLayout. Consumed by the layout sections of the
 * engineer handoff surface.
 *
 * All arrays may be empty — callers must handle gracefully.
 */
export type EngineerLayout = {
  rooms: EngineerLayoutRoom[];
  walls: EngineerLayoutWall[];
  objects: EngineerLayoutObject[];
  routes?: EngineerLayoutRoute[];
};
