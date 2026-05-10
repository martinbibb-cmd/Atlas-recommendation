import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import type {
  AccessibilityApprovalMode,
  EducationalAssetAccessibilityAuditV1,
} from './EducationalAssetAccessibilityAuditV1';
import { educationalAssetAccessibilityAudits } from './educationalAssetAccessibilityAudits';

const auditByAssetId = new Map(
  educationalAssetAccessibilityAudits.map((audit) => [audit.assetId, audit]),
);

/** Returns the audit record for the given assetId, or undefined if none exists. */
export function getAuditForAsset(
  assetId: string,
): EducationalAssetAccessibilityAuditV1 | undefined {
  return auditByAssetId.get(assetId);
}

/** Returns all audits that have status "passed". */
export function getPassedAudits(): EducationalAssetAccessibilityAuditV1[] {
  return educationalAssetAccessibilityAudits.filter((audit) => audit.status === 'passed');
}

/** Returns all audits approved for the given delivery mode. */
export function getAssetsApprovedFor(
  mode: AccessibilityApprovalMode,
): EducationalAssetAccessibilityAuditV1[] {
  return educationalAssetAccessibilityAudits.filter((audit) => audit.approvedFor.includes(mode));
}

/** Returns all audits with status "needs_changes". */
export function getAssetsNeedingChanges(): EducationalAssetAccessibilityAuditV1[] {
  return educationalAssetAccessibilityAudits.filter(
    (audit) => audit.status === 'needs_changes',
  );
}

/**
 * Given a list of assets, returns those that have no matching audit record in the registry.
 */
export function getAssetsWithoutAudit(
  assets: EducationalAssetV1[],
): EducationalAssetV1[] {
  return assets.filter((asset) => !auditByAssetId.has(asset.id));
}
