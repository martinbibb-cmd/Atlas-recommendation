/**
 * PersistedImplementationWorkflowV1.ts
 *
 * Data model for a saved implementation workflow state.
 *
 * Atlas is a composer, renderer, and workflow brain — NOT a storage owner.
 * This model describes what gets written to whichever storage layer the user
 * or workspace has chosen (local browser, Google Drive, etc.).
 *
 * Schema versioning:
 *   schemaVersion is checked on load. Incompatible versions are rejected and
 *   the caller should treat the record as "not found / needs migration".
 *
 * Non-goals:
 *   - No pricing data
 *   - No customer PII beyond a visit reference opaque string
 *   - No supplier catalogue data
 */

import type { ScopePackReviewStatus } from '../../specification/scopePacks/InstallationScopePackV1';
import type { SpecificationLineStatus } from '../../specification/specLines/SpecificationLineV1';
import type { AtlasVisitOwnershipV1 } from '../../auth/profile/AtlasVisitOwnershipV1';

// ─── Schema version ───────────────────────────────────────────────────────────

/**
 * Current schema version.  Increment when the shape of
 * PersistedImplementationWorkflowV1 changes in a breaking way.
 */
export const WORKFLOW_SCHEMA_VERSION = '1.0' as const;
export type WorkflowSchemaVersion = typeof WORKFLOW_SCHEMA_VERSION;

// ─── Change log ───────────────────────────────────────────────────────────────

/**
 * Transient event type for the readiness change log.
 * Stored alongside the workflow so it can be exported and reviewed.
 */
export type ReadinessChangeLogEventType =
  | 'task_resolved'
  | 'task_reopened'
  | 'evidence_captured'
  | 'evidence_uncaptured'
  | 'dependency_resolved'
  | 'dependency_reopened'
  | 'readiness_changed';

export interface ReadinessChangeLogEventV1 {
  /** Unique identifier for this event (opaque string). */
  readonly eventId: string;
  /** ISO 8601 timestamp. */
  readonly timestamp: string;
  /** What kind of workflow change happened. */
  readonly eventType: ReadinessChangeLogEventType;
  /** Human-readable summary, e.g. task title or readiness gate label. */
  readonly label: string;
  /** IDs of tasks / evidence items / dependencies directly affected. */
  readonly affectedIds: readonly string[];
  /** Readiness snapshot immediately before this event (gates only). */
  readonly previousState?: ReadinessGateSnapshot;
  /** Readiness snapshot immediately after this event (gates only). */
  readonly nextState?: ReadinessGateSnapshot;
}

/** Compact snapshot of the three readiness gates. */
export interface ReadinessGateSnapshot {
  readonly readyForOfficeReview: boolean;
  readonly readyForInstallerHandover: boolean;
  readonly readyForMaterialsOrdering: boolean;
}

// ─── Materials review state ───────────────────────────────────────────────────

export interface MaterialsReviewState {
  /** Material IDs that the reviewer has confirmed as needed. */
  readonly confirmedIds: readonly string[];
  /** Material IDs that the reviewer has rejected (not required for this job). */
  readonly rejectedIds: readonly string[];
  /** Material IDs flagged for further confirmation before ordering. */
  readonly flaggedIds: readonly string[];
}

// ─── Pack snapshot metadata ───────────────────────────────────────────────────

/**
 * Lightweight snapshot of the implementation pack identity.
 * Used to detect if a saved state was generated from a different pack
 * (e.g. after a re-survey changes the recommendation).
 */
export interface ImplementationPackSnapshotMetadataV1 {
  /** Recommended scenario ID at the time the workflow was saved. */
  readonly recommendedScenarioId: string;
  /** Fixture ID if created from a dev fixture, undefined in production. */
  readonly fixtureId?: string;
}

// ─── Persisted workflow ───────────────────────────────────────────────────────

/**
 * PersistedImplementationWorkflowV1
 *
 * Full serialisable state for one implementation workflow session.
 * Written to the user's chosen storage target; never to an Atlas-owned backend.
 *
 * One record per visit reference.
 */
export interface PersistedImplementationWorkflowV1 {
  /** Schema version — must equal WORKFLOW_SCHEMA_VERSION to be loadable. */
  readonly schemaVersion: WorkflowSchemaVersion;

  /**
   * Opaque reference identifying which visit / job this workflow belongs to.
   * In dev/fixture mode this is the fixture ID prefixed with 'fixture:'.
   */
  readonly visitReference: string;

  /** ISO 8601 timestamp of when this record was first created. */
  readonly createdAt: string;

  /** ISO 8601 timestamp of the most recent save. */
  readonly updatedAt: string;

  /** Lightweight snapshot of the implementation pack identity. */
  readonly packSnapshot: ImplementationPackSnapshotMetadataV1;

  /**
   * Transient resolution simulation state.
   *
   * resolvedTaskIds      — follow-up tasks marked as complete by the user
   * capturedEvidenceIds  — scan evidence items marked as captured
   * resolvedDependencyIds — qualification / customer dependencies confirmed
   * changeLog            — ordered audit trail of workflow events (newest last)
   */
  readonly resolutionSimulation: {
    readonly resolvedTaskIds: readonly string[];
    readonly capturedEvidenceIds: readonly string[];
    readonly resolvedDependencyIds: readonly string[];
    readonly changeLog: readonly ReadinessChangeLogEventV1[];
  };

  /**
   * Reviewer-applied status overrides for each scope pack.
   * Key = packId, value = ScopePackReviewStatus.
   * Packs not present in the map retain their generated default ('suggested').
   */
  readonly scopePackStatuses: Readonly<Record<string, ScopePackReviewStatus>>;

  /**
   * Reviewer-applied status overrides for each specification line.
   * Key = lineId, value = SpecificationLineStatus.
   * Lines not present in the map retain their generated default ('suggested').
   */
  readonly specLineStatuses: Readonly<Record<string, SpecificationLineStatus>>;

  /** Reviewer-driven materials confirmation state. */
  readonly materialsReviewState: MaterialsReviewState;

  /**
   * Workspace ownership context at the time this workflow was saved.
   * Absent for unowned / session-only visits (demo mode).
   * When present, the workspaceId and createdByUserId constrain which
   * workspace members can load, modify, or export this record.
   */
  readonly ownership?: AtlasVisitOwnershipV1;
}
