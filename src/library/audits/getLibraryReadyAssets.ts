import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import type { EducationalAssetQaV1 } from '../registry/qa/EducationalAssetQaV1';
import type {
  AccessibilityApprovalMode,
  EducationalAssetAccessibilityAuditV1,
} from './EducationalAssetAccessibilityAuditV1';
import { getAuditForAsset } from './auditLookup';

/** All check keys that must be true for an audit to count as fully passing. */
const REQUIRED_CHECK_KEYS: Array<keyof EducationalAssetAccessibilityAuditV1['checks']> = [
  'semanticStructure',
  'keyboardSafe',
  'reducedMotionSafe',
  'staticFallbackAvailable',
  'printEquivalentAvailable',
  'colourNotSoleIndicator',
  'screenReaderSummaryAvailable',
  'cognitiveLoadAcceptable',
  'noDecorativeMotion',
  'noUnsupportedClaims',
];

export interface AssetReadinessResult {
  assetId: string;
  ready: boolean;
  blockedReasons: string[];
  auditStatus: EducationalAssetAccessibilityAuditV1['status'] | 'no_audit';
  approvedFor: AccessibilityApprovalMode[];
}

export interface LibraryReadinessReport {
  readyAssets: AssetReadinessResult[];
  blockedAssets: AssetReadinessResult[];
}

/**
 * Evaluates each asset against the library-ready promotion gate.
 *
 * An asset is library-ready only if ALL of the following hold:
 * - An audit record exists
 * - Audit status is "passed"
 * - All required checks are true
 * - Asset QA has no errors
 * - Print assets have a print equivalent
 * - Motion assets have a reduced-motion or static fallback
 * - Digital assets have a component mapping
 */
export function getLibraryReadyAssets(
  assets: EducationalAssetV1[],
  assetQaFindings: EducationalAssetQaV1[],
  componentRegistry: Record<string, unknown>,
): LibraryReadinessReport {
  const readyAssets: AssetReadinessResult[] = [];
  const blockedAssets: AssetReadinessResult[] = [];

  for (const asset of assets) {
    const blockedReasons: string[] = [];
    const audit = getAuditForAsset(asset.id);

    if (!audit) {
      blockedReasons.push('No accessibility audit record exists for this asset.');
    } else {
      if (audit.status !== 'passed') {
        blockedReasons.push(`Audit status is "${audit.status}" — must be "passed" to promote.`);
      }

      const failingChecks = REQUIRED_CHECK_KEYS.filter((key) => !audit.checks[key]);
      if (failingChecks.length > 0) {
        blockedReasons.push(
          `The following audit checks are not satisfied: ${failingChecks.join(', ')}.`,
        );
      }
    }

    const qaErrors = assetQaFindings.filter(
      (f) => f.assetId === asset.id && f.severity === 'error',
    );
    if (qaErrors.length > 0) {
      blockedReasons.push(
        `Asset has ${qaErrors.length} QA error(s) that must be resolved.`,
      );
    }

    if (asset.printStatus === 'print_ready' && !asset.hasPrintEquivalent) {
      blockedReasons.push('Print-ready asset is missing a print equivalent.');
    }

    if (
      (asset.assetType === 'animation' || asset.motionIntensity !== 'none') &&
      !asset.supportsReducedMotion &&
      !asset.hasStaticFallback
    ) {
      blockedReasons.push(
        'Motion asset must provide a reduced-motion variant or static fallback.',
      );
    }

    if (asset.migrationStatus !== 'registered_only' && !(asset.id in componentRegistry)) {
      blockedReasons.push('Digital asset has no component mapping in the component registry.');
    }

    const result: AssetReadinessResult = {
      assetId: asset.id,
      ready: blockedReasons.length === 0,
      blockedReasons,
      auditStatus: audit ? audit.status : 'no_audit',
      approvedFor: audit ? audit.approvedFor : [],
    };

    if (result.ready) {
      readyAssets.push(result);
    } else {
      blockedAssets.push(result);
    }
  }

  return { readyAssets, blockedAssets };
}
