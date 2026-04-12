/**
 * engineerDisplay.types.ts
 *
 * PR11 — Engineer-facing display model types.
 *
 * EngineerDisplayModel is the single data contract for all engineer route panels.
 * Components must consume this model — never raw payload shapes.
 * Build it with buildEngineerDisplayModel() in selectors/buildEngineerDisplayModel.ts.
 */

// ─── Knowledge / confidence status ───────────────────────────────────────────

export type KnowledgeStatus = 'confirmed' | 'review' | 'missing';

// ─── Capture summary ──────────────────────────────────────────────────────────

/**
 * High-level counts of evidence captured during the site visit.
 */
export interface EngineerCaptureSummary {
  roomCount: number;
  objectCount: number;
  photoCount: number;
  voiceNoteCount: number;
  extractedFactCount: number;
}

// ─── Key component ────────────────────────────────────────────────────────────

/**
 * A critical installed component identified in the property capture.
 */
export interface EngineerKeyComponent {
  id: string;
  label: string;
  type: string;
  roomLabel?: string;
  evidenceCount?: number;
}

// ─── Knowledge summary ────────────────────────────────────────────────────────

/**
 * Per-domain readiness status derived from canonical property fields.
 */
export interface EngineerKnowledgeSummary {
  household: KnowledgeStatus;
  usage: KnowledgeStatus;
  currentSystem: KnowledgeStatus;
  priorities: KnowledgeStatus;
  constraints: KnowledgeStatus;
}

// ─── Required work item ───────────────────────────────────────────────────────

/**
 * A single item of work required or recommended for this installation.
 * Derived from recommendation outputs, decision synthesis, and canonical
 * property constraints.
 */
export interface EngineerRequiredWorkItem {
  title: string;
  reason: string;
  severity: 'required' | 'recommended' | 'review';
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

/**
 * Pre-install review warnings grouped by type.
 */
export interface EngineerWarnings {
  missingCritical: string[];
  missingRecommended: string[];
  confidenceWarnings: string[];
}

// ─── Evidence summary ─────────────────────────────────────────────────────────

/**
 * Counts of available evidence pieces for the engineer evidence panel.
 */
export interface EngineerEvidenceSummary {
  photos: number;
  voiceNotes: number;
  textNotes: number;
  qaFlags: number;
  timelineEvents: number;
}

// ─── Main display model ───────────────────────────────────────────────────────

/**
 * The engineer-facing display model derived from canonical property and engine truth.
 *
 * All engineer route panels read from this model.
 * Build with buildEngineerDisplayModel() — never traverse raw payloads in components.
 */
export interface EngineerDisplayModel {
  /** Visit identifier. */
  visitId: string;

  /** Page title, derived from address or visit reference. */
  title: string;

  /** Address string if available. */
  address?: string;

  /** Engineer / job reference if set on the visit. */
  visitReference?: string;

  /** Human-readable visit status label. */
  statusLabel?: string;

  /** Human-readable label for the currently installed system. */
  currentSystem?: string;

  /** Human-readable label for the Atlas-recommended system. */
  recommendedSystem?: string;

  /** High-level capture summary (rooms, objects, evidence counts). */
  captureSummary: EngineerCaptureSummary;

  /** Critical installed components that the engineer should locate and inspect. */
  keyComponents: EngineerKeyComponent[];

  /** Per-domain knowledge / confidence status. */
  knowledgeSummary: EngineerKnowledgeSummary;

  /** Ordered list of required and recommended work items. */
  requiredWork: EngineerRequiredWorkItem[];

  /** Pre-install warnings grouped by severity. */
  warnings: EngineerWarnings;

  /** Aggregated evidence counts for the evidence panel. */
  evidence: EngineerEvidenceSummary;
}
