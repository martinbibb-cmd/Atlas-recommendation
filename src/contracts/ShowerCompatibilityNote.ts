/**
 * ShowerCompatibilityNote.ts — Canonical contract for the shower compatibility note.
 *
 * PR26 — Produced by buildShowerCompatibilityNotes and carried on AtlasDecisionV1
 * so that all output surfaces (visual blocks, portal, engineer handoff) can project
 * it without re-deriving logic.
 *
 * Severity guide:
 *   info      — no action required (electric shower, independent of DHW circuit)
 *   advisory  — something to check / verify (mixer balanced supply)
 *   important — work required before new system can be commissioned (pumped shower)
 */

/** Machine-readable key identifying the compatibility scenario. */
export type ShowerCompatibilityWarningKey =
  | 'electric_unaffected'
  | 'pumped_gravity_unvented'
  | 'mixer_balanced_supply';

/**
 * ShowerCompatibilityNote
 *
 * Structured note carried through the decision to all output surfaces.
 * Separates customer copy from engineer copy so neither surface uses
 * language intended for the other audience.
 */
export interface ShowerCompatibilityNote {
  /** Machine-readable key for downstream consumers. */
  warningKey: ShowerCompatibilityWarningKey;
  /** Short customer-facing summary — one sentence. */
  customerSummary: string;
  /** Actionable engineer-facing install note — one or two sentences. */
  engineerNote: string;
  /** Severity drives block styling and placement on all surfaces. */
  severity: 'info' | 'advisory' | 'important';
}
