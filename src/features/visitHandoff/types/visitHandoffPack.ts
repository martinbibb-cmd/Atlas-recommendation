/**
 * visitHandoffPack.ts
 *
 * PR11 — Web-side types for the completed-visit handoff pack boundary.
 *
 * These types represent the contract between Atlas Scan (iOS) and the web
 * review surfaces.  The web layer consumes the pack as-is; it does not
 * reconstruct raw session state.
 *
 * Design rules
 * ────────────
 * - Import the pack, do not reconstruct the visit.
 * - Views are read-only; these types carry no mutation helpers.
 * - Keep isolated from the legacy Insight/report pipeline.
 * - If these types are later shared via @atlas/contracts they must remain
 *   structurally identical so any migration is a simple re-export swap.
 *
 * Terminology (docs/atlas-terminology.md)
 * ────────────────────────────────────────
 * - Use "tank-fed hot water" / "mains-fed supply" / "on-demand hot water"
 *   in any user-facing copy.  Internal identifiers are not subject to this rule.
 */

// ─── Supporting types ─────────────────────────────────────────────────────────

/**
 * A single room captured during the survey.
 * Used in the engineer review surface.
 */
export interface HandoffRoom {
  /** Stable identifier for the room (e.g. "room_01"). */
  id: string;
  /** Display name (e.g. "Living Room", "Main Bedroom"). */
  name: string;
  /** Approximate floor area in square metres (optional). */
  areaM2?: number;
  /** Free-text notes recorded in the field. */
  notes?: string;
}

/**
 * A key object observed during the survey (e.g. boiler, cylinder, radiator).
 */
export interface HandoffKeyObject {
  /** Object category / type label (e.g. "Boiler", "Hot water cylinder"). */
  type: string;
  /** Make / model if identified (e.g. "Worcester Bosch Greenstar 30i"). */
  make?: string;
  /** Installation year if visible. */
  installYear?: number;
  /** Condition description (e.g. "Operational", "End of life"). */
  condition?: string;
  /** Free-text field notes. */
  notes?: string;
}

/**
 * A proposed emitter (radiator / UFH zone / towel rail) from the design.
 */
export interface HandoffProposedEmitter {
  /** Room this emitter belongs to. */
  roomId: string;
  /** Human-readable room name for display without joining to the rooms array. */
  roomName: string;
  /** Emitter type (e.g. "Radiator", "Underfloor heating zone", "Towel rail"). */
  emitterType: string;
  /** Output in watts at design conditions (optional). */
  outputWatts?: number;
  /** Additional specification notes. */
  notes?: string;
}

/**
 * A single access note recorded during the survey.
 */
export interface HandoffAccessNote {
  /** Location description (e.g. "Loft hatch", "Boiler cupboard"). */
  location: string;
  /** Note content. */
  note: string;
}

// ─── Customer summary ─────────────────────────────────────────────────────────

/**
 * Customer-facing visit summary.
 *
 * Language must be simple, factual, and calm — no engineering jargon.
 * Terminology rules from docs/atlas-terminology.md apply to all string fields
 * that will be rendered in the customer view.
 */
export interface CustomerVisitSummary {
  /**
   * One-line address string (e.g. "14 Acacia Road, London, SW1A 1AA").
   * Used as the page title on the customer surface.
   */
  address: string;

  /**
   * Short factual description of the current heating and hot water setup,
   * written for a non-technical customer.
   * Example: "You currently have a combination boiler providing central heating
   * and on-demand hot water."
   */
  currentSystemDescription?: string;

  /**
   * Summary of key findings from the survey.
   * Each item is a short plain-English sentence.
   * Example: ["The boiler is over 15 years old.", "One radiator in the kitchen is not heating correctly."]
   */
  findings: string[];

  /**
   * Planned work items from the survey result.
   * Written as brief action phrases for a customer to understand.
   * Example: ["Replace existing boiler with a new high-efficiency model.", "Balance radiators throughout."]
   */
  plannedWork: string[];

  /**
   * Next-steps copy for the customer.
   * Example: "Your engineer will be in touch to confirm the installation date."
   */
  nextSteps?: string;
}

// ─── Engineer summary ─────────────────────────────────────────────────────────

/**
 * Engineer-facing visit summary.
 *
 * Dense, structured, scannable.  Used as a technical handoff check.
 */
export interface EngineerVisitSummary {
  /** Rooms captured during the survey. */
  rooms: HandoffRoom[];

  /** Key objects observed (boiler, cylinder, radiators, etc.). */
  keyObjects: HandoffKeyObject[];

  /** Proposed emitters from the design. */
  proposedEmitters: HandoffProposedEmitter[];

  /** Access notes for installation team. */
  accessNotes: HandoffAccessNote[];

  /**
   * Room plan or layout notes recorded during the survey
   * (e.g. measurements, constraints, obstructions).
   */
  roomPlanNotes?: string;

  /**
   * Specification notes (e.g. pipe sizing decisions, cylinder spec rationale).
   */
  specNotes?: string;

  /**
   * Free-text field notes summary from the surveyor.
   * Typically the last thing recorded before completing the visit.
   */
  fieldNotesSummary?: string;
}

// ─── Top-level pack ───────────────────────────────────────────────────────────

/**
 * VisitHandoffPack — the contract boundary between Atlas Scan and the web
 * review surfaces.
 *
 * This is the single import unit.  The web layer should consume it as-is.
 * Missing optional arrays are normalised to [] by parseVisitHandoffPack().
 */
export interface VisitHandoffPack {
  /**
   * Schema version for forward-compatibility detection.
   * Current version: "1.0".
   */
  schemaVersion: '1.0';

  /**
   * Stable visit identifier from Atlas Scan.
   * Used for correlation and de-duplication.
   */
  visitId: string;

  /**
   * ISO 8601 timestamp of when the visit was completed and the pack was built.
   * Example: "2025-10-14T14:32:00Z"
   */
  completedAt: string;

  /**
   * The engineer who completed the visit (display name).
   */
  engineerName?: string;

  /** Customer-facing visit summary. */
  customerSummary: CustomerVisitSummary;

  /** Engineer-facing visit summary. */
  engineerSummary: EngineerVisitSummary;
}
