/**
 * PortalLaunchPayloadV1.ts — Versioned portal launch contract.
 *
 * Carries everything the portal needs to open from a canonical PDF package.
 * Built by buildPortalLaunchPayload from a CanonicalVisitPackageV1.
 *
 * Design rules:
 *  - The portal MUST use customerJourneyPack as the canonical journey content
 *    when present. It must not invent a different customer journey.
 *  - When hasCustomerJourneyPack is false, rebuildRequired is true and
 *    rebuildWarning explains what is needed. The portal should surface this
 *    to the surveyor before proceeding.
 *  - portalVisitContext carries only safe display metadata (address/mode).
 *    No PII routing is performed in this payload.
 *  - generatedOutputMetadata exposes artifact availability flags so callers
 *    can choose the best launch path without re-reading the full package.
 */

import type { CustomerJourneyPackV1 } from '../../library/portal/pdf/buildPortalJourneyPrintModel';
import type { PortalVisitContextV1 } from '../../contracts/PortalVisitContextV1';

export const PORTAL_LAUNCH_PAYLOAD_SCHEMA = 'atlas.portal-launch-payload' as const;
export const PORTAL_LAUNCH_PAYLOAD_VERSION = '1.0' as const;

export interface PortalLaunchVisitIdentityV1 {
  readonly visitId?: string;
  readonly visitReference?: string;
}

export interface PortalLaunchGeneratedOutputMetadataV1 {
  /** Package-carried portal URLs are intentionally not trusted during import. */
  readonly hasPortalUrl: boolean;
  /** Reserved for already-validated portal URLs; package imports leave this undefined. */
  readonly portalUrl?: string;
  /** Whether a supporting PDF artifact is present in the package. */
  readonly hasSupportingPdf: boolean;
  /** The lifecycle state captured in the source package. */
  readonly lifecycleState?: string;
  /** Active recommendation snapshot identity from the source package. */
  readonly activeRecommendationSnapshotId?: string;
  /** Snapshot id carried by the packaged customer journey artifact. */
  readonly customerJourneyPackSnapshotId?: string;
  /** True when packaged journey artifact is from a stale snapshot. */
  readonly staleSnapshotBlocked: boolean;
}

/**
 * PortalLaunchPayloadV1
 *
 * The portal launch contract built from a canonical PDF package.
 * Callers should validate this payload before routing to the portal surface.
 *
 * Portal rule: the portal must consume this payload's customerJourneyPack as the
 * authoritative journey source. Portal enhancement (animations, deep-dives) is
 * allowed; inventing a different customer journey is not.
 */
export interface PortalLaunchPayloadV1 {
  readonly schema: typeof PORTAL_LAUNCH_PAYLOAD_SCHEMA;
  readonly version: typeof PORTAL_LAUNCH_PAYLOAD_VERSION;
  /** Visit identity sourced from the canonical package. */
  readonly visitIdentity: PortalLaunchVisitIdentityV1;
  /**
   * Packaged customer journey content. Present when the canonical package has a
   * generated customerJourneyPack artifact. The portal must use this as-is.
   */
  readonly customerJourneyPack?: CustomerJourneyPackV1;
  /** True when customerJourneyPack is present and valid. */
  readonly hasCustomerJourneyPack: boolean;
  /** True when no customerJourneyPack is packaged and the portal must rebuild content. */
  readonly rebuildRequired: boolean;
  /** Human-readable guidance when rebuildRequired is true. */
  readonly rebuildWarning?: string;
  /** Selected/recommended scenario ID from the canonical package. */
  readonly selectedScenarioId?: string;
  /** Portal visit context for address and personal-data-mode rendering. */
  readonly portalVisitContext?: Pick<PortalVisitContextV1, 'addressSummary' | 'personalDataMode'>;
  /** Generated output availability metadata sourced from the canonical package. */
  readonly generatedOutputMetadata: PortalLaunchGeneratedOutputMetadataV1;
  /** ISO timestamp when this payload was constructed. */
  readonly builtAt: string;
  /** ISO timestamp of the source package's exportedAt field. */
  readonly sourcePackageExportedAt: string;
}
