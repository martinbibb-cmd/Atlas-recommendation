import type { EducationalAssetV1 } from '../../contracts/EducationalAssetV1';
import type { EducationalAssetAccessibilityAuditV1 } from '../../audits/EducationalAssetAccessibilityAuditV1';
import type { EducationalAssetQaV1 } from '../../registry/qa/EducationalAssetQaV1';
import type { PrintEquivalentV1 } from '../../printEquivalents/PrintEquivalentV1';
import type { EligibilityDeliveryMode, WelcomePackEligibilityV1 } from './WelcomePackEligibilityV1';

export interface CheckWelcomePackAssetEligibilityInput {
  selectedAssetIds: string[];
  deliveryMode: EligibilityDeliveryMode;
  assets: EducationalAssetV1[];
  audits: EducationalAssetAccessibilityAuditV1[];
  qaFindings: EducationalAssetQaV1[];
  printEquivalents: PrintEquivalentV1[];
  componentRegistry: Record<string, unknown>;
}

function buildAuditMap(
  audits: EducationalAssetAccessibilityAuditV1[],
): Map<string, EducationalAssetAccessibilityAuditV1> {
  return new Map(audits.map((audit) => [audit.assetId, audit]));
}

function buildAssetMap(assets: EducationalAssetV1[]): Map<string, EducationalAssetV1> {
  return new Map(assets.map((asset) => [asset.id, asset]));
}

function buildPrintEquivalentSet(printEquivalents: PrintEquivalentV1[]): Set<string> {
  return new Set(printEquivalents.map((pe) => pe.assetId));
}

function hasQaErrors(assetId: string, qaFindings: EducationalAssetQaV1[]): boolean {
  return qaFindings.some((finding) => finding.assetId === assetId && finding.severity === 'error');
}

function hasPrintEquivalentOrStaticAsset(
  asset: EducationalAssetV1,
  printEquivalentSet: Set<string>,
): boolean {
  if (printEquivalentSet.has(asset.id)) {
    return true;
  }
  if (asset.printComponentPath) {
    return true;
  }
  if (asset.assetType === 'print_sheet') {
    return true;
  }
  return false;
}

function hasStaticFallbackForReducedMotion(asset: EducationalAssetV1): boolean {
  return asset.supportsReducedMotion || asset.hasStaticFallback || asset.motionIntensity === 'none';
}

function checkAssetEligibility(
  assetId: string,
  deliveryMode: EligibilityDeliveryMode,
  assetMap: Map<string, EducationalAssetV1>,
  auditMap: Map<string, EducationalAssetAccessibilityAuditV1>,
  qaFindings: EducationalAssetQaV1[],
  printEquivalentSet: Set<string>,
): WelcomePackEligibilityV1 {
  const asset = assetMap.get(assetId);
  const conceptIds = asset?.conceptIds ?? [];

  const reasons: string[] = [];

  // QA errors always block
  if (hasQaErrors(assetId, qaFindings)) {
    reasons.push('Asset has QA errors and cannot be used in any production mode.');
  }

  const audit = auditMap.get(assetId);

  if (!audit) {
    // Missing audit blocks all production modes
    reasons.push('No accessibility audit record exists for this asset.');
    return {
      assetId,
      conceptIds,
      eligible: false,
      mode: deliveryMode,
      reasons,
      severity: 'error',
      replacementHint: 'Use a QR deep-dive placeholder or defer until audit is completed.',
    };
  }

  if (reasons.length > 0) {
    // QA errors – audit exists but still blocked
    return {
      assetId,
      conceptIds,
      eligible: false,
      mode: deliveryMode,
      reasons,
      severity: 'error',
      replacementHint: 'Resolve QA errors before including in any delivery mode.',
    };
  }

  // Mode-specific rules
  if (deliveryMode === 'customer_pack') {
    if (!audit.approvedFor.includes('customer_pack')) {
      reasons.push('Audit does not include customer_pack in approvedFor.');
    }
    if (audit.status === 'needs_changes') {
      reasons.push('Audit status is needs_changes; required changes must be resolved.');
    }
    if (audit.status === 'failed') {
      reasons.push('Audit status is failed.');
    }
  }

  if (deliveryMode === 'print') {
    if (asset && !hasPrintEquivalentOrStaticAsset(asset, printEquivalentSet)) {
      reasons.push('No print equivalent or static print asset is available for this asset.');
    }
    if (!audit.approvedFor.includes('print') && !(asset && hasPrintEquivalentOrStaticAsset(asset, printEquivalentSet))) {
      reasons.push('Audit does not approve this asset for print delivery.');
    }
  }

  if (deliveryMode === 'reduced_motion') {
    if (asset && !hasStaticFallbackForReducedMotion(asset)) {
      reasons.push('Asset does not support reduced motion and has no static fallback.');
    }
    if (!audit.approvedFor.includes('reduced_motion') && !(asset && hasStaticFallbackForReducedMotion(asset))) {
      reasons.push('Audit does not approve this asset for reduced_motion delivery.');
    }
  }

  if (deliveryMode === 'technical_appendix') {
    // technical_appendix is more permissive — non-customer-pack assets are allowed if explicitly approved
    if (!audit.approvedFor.includes('technical_appendix') && !audit.approvedFor.includes('customer_pack')) {
      reasons.push('Audit does not include technical_appendix or customer_pack in approvedFor.');
    }
  }

  if (deliveryMode === 'digital') {
    if (audit.status === 'needs_changes' || audit.status === 'failed') {
      reasons.push(`Audit status is ${audit.status}; asset is not cleared for digital customer delivery.`);
    }
    if (!audit.approvedFor.includes('digital') && !audit.approvedFor.includes('customer_pack')) {
      reasons.push('Audit does not approve this asset for digital delivery.');
    }
  }

  const eligible = reasons.length === 0;

  return {
    assetId,
    conceptIds,
    eligible,
    mode: deliveryMode,
    reasons,
    severity: eligible ? 'info' : 'error',
    replacementHint: eligible
      ? undefined
      : 'Consider a QR deep-dive placeholder or deferred delivery until audit approval is completed.',
  };
}

export function checkWelcomePackAssetEligibility(
  input: CheckWelcomePackAssetEligibilityInput,
): WelcomePackEligibilityV1[] {
  const { selectedAssetIds, deliveryMode, assets, audits, qaFindings, printEquivalents } = input;
  const assetMap = buildAssetMap(assets);
  const auditMap = buildAuditMap(audits);
  const printEquivalentSet = buildPrintEquivalentSet(printEquivalents);

  return selectedAssetIds.map((assetId) =>
    checkAssetEligibility(assetId, deliveryMode, assetMap, auditMap, qaFindings, printEquivalentSet),
  );
}
