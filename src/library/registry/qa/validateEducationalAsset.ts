import type { EducationalAssetV1 } from '../../contracts/EducationalAssetV1';
import type { EducationalConceptTaxonomyV1 } from '../../taxonomy/EducationalConceptTaxonomyV1';
import type { EducationalComponentMap } from '../educationalComponentRegistry';
import type { EducationalAssetQaV1 } from './EducationalAssetQaV1';

interface AddFindingInput {
  list: EducationalAssetQaV1[];
  assetId: string;
  severity: EducationalAssetQaV1['severity'];
  ruleId: string;
  message: string;
  field: string;
  suggestedAction?: string;
}

function addFinding(input: AddFindingInput): void {
  input.list.push({
    assetId: input.assetId,
    severity: input.severity,
    ruleId: input.ruleId,
    message: input.message,
    field: input.field,
    suggestedAction: input.suggestedAction,
  });
}

export function validateEducationalAsset(
  asset: EducationalAssetV1,
  taxonomy: EducationalConceptTaxonomyV1[],
  componentRegistry: EducationalComponentMap,
): EducationalAssetQaV1[] {
  const findings: EducationalAssetQaV1[] = [];
  const { id: assetId } = asset;

  // asset has conceptIds
  if (!asset.conceptIds || asset.conceptIds.length === 0) {
    addFinding({
      list: findings,
      assetId,
      severity: 'error',
      ruleId: 'missing_concept_ids',
      message: 'Asset must declare at least one conceptId.',
      field: 'conceptIds',
      suggestedAction: 'Add one or more conceptIds that this asset teaches.',
    });
  }

  // every asset conceptId exists in taxonomy
  const taxonomyIds = new Set(taxonomy.map((t) => t.conceptId));
  for (const conceptId of asset.conceptIds ?? []) {
    if (!taxonomyIds.has(conceptId)) {
      addFinding({
        list: findings,
        assetId,
        severity: 'error',
        ruleId: 'unknown_concept_id',
        message: `conceptId "${conceptId}" does not exist in the educational concept taxonomy.`,
        field: 'conceptIds',
        suggestedAction: `Register "${conceptId}" in the taxonomy or correct the conceptId.`,
      });
    }
  }

  // asset has assetType
  if (!asset.assetType) {
    addFinding({
      list: findings,
      assetId,
      severity: 'error',
      ruleId: 'missing_asset_type',
      message: 'Asset must declare an assetType.',
      field: 'assetType',
      suggestedAction: 'Set assetType to one of the supported values.',
    });
  }

  // asset has audience
  if (!asset.audience) {
    addFinding({
      list: findings,
      assetId,
      severity: 'error',
      ruleId: 'missing_audience',
      message: 'Asset must declare an audience.',
      field: 'audience',
      suggestedAction: 'Set audience to customer, surveyor, engineer, or all.',
    });
  }

  // asset has cognitiveLoad
  if (!asset.cognitiveLoad) {
    addFinding({
      list: findings,
      assetId,
      severity: 'error',
      ruleId: 'missing_cognitive_load',
      message: 'Asset must declare a cognitiveLoad.',
      field: 'cognitiveLoad',
      suggestedAction: 'Set cognitiveLoad to low, medium, or high.',
    });
  }

  // asset has textDensity
  if (!asset.textDensity) {
    addFinding({
      list: findings,
      assetId,
      severity: 'error',
      ruleId: 'missing_text_density',
      message: 'Asset must declare a textDensity.',
      field: 'textDensity',
      suggestedAction: 'Set textDensity to low, medium, or high.',
    });
  }

  // asset has motionIntensity
  if (!asset.motionIntensity) {
    addFinding({
      list: findings,
      assetId,
      severity: 'error',
      ruleId: 'missing_motion_intensity',
      message: 'Asset must declare a motionIntensity.',
      field: 'motionIntensity',
      suggestedAction: 'Set motionIntensity to none, low, medium, or high.',
    });
  }

  // animation assets must declare supportsReducedMotion
  if (asset.assetType === 'animation' && !asset.supportsReducedMotion) {
    addFinding({
      list: findings,
      assetId,
      severity: 'error',
      ruleId: 'animation_missing_reduced_motion_support',
      message: 'Animation assets must declare supportsReducedMotion: true.',
      field: 'supportsReducedMotion',
      suggestedAction: 'Add a reduced-motion variant or static equivalent and set supportsReducedMotion to true.',
    });
  }

  // animation assets must declare hasStaticFallback
  if (asset.assetType === 'animation' && !asset.hasStaticFallback) {
    addFinding({
      list: findings,
      assetId,
      severity: 'error',
      ruleId: 'animation_missing_static_fallback',
      message: 'Animation assets must declare hasStaticFallback: true.',
      field: 'hasStaticFallback',
      suggestedAction: 'Provide a static fallback rendering for contexts where animation is unavailable.',
    });
  }

  // print-ready assets must declare hasPrintEquivalent
  if (asset.printStatus === 'print_ready' && !asset.hasPrintEquivalent) {
    addFinding({
      list: findings,
      assetId,
      severity: 'error',
      ruleId: 'print_ready_missing_print_equivalent',
      message: 'Assets with printStatus "print_ready" must declare hasPrintEquivalent: true.',
      field: 'hasPrintEquivalent',
      suggestedAction: 'Set hasPrintEquivalent to true or correct printStatus.',
    });
  }

  // assets marked library_ready must have accessibilityAuditStatus='passed'
  if (asset.lifecycleStatus === 'library_ready' && asset.accessibilityAuditStatus !== 'passed') {
    addFinding({
      list: findings,
      assetId,
      severity: 'error',
      ruleId: 'library_ready_audit_not_passed',
      message: 'Assets marked library_ready must have accessibilityAuditStatus set to "passed".',
      field: 'accessibilityAuditStatus',
      suggestedAction: 'Complete accessibility audit before marking asset as library_ready.',
    });
  }

  // assets marked library_ready must not have printStatus='needs_static_equivalent'
  if (asset.lifecycleStatus === 'library_ready' && asset.printStatus === 'needs_static_equivalent') {
    addFinding({
      list: findings,
      assetId,
      severity: 'error',
      ruleId: 'library_ready_needs_static_equivalent',
      message: 'Assets marked library_ready must not have printStatus "needs_static_equivalent".',
      field: 'printStatus',
      suggestedAction: 'Provide a print equivalent or change lifecycleStatus from library_ready.',
    });
  }

  // currentComponentPath exists for existing/wrapped components
  if (
    (asset.migrationStatus === 'wrapped' || asset.migrationStatus === 'moved')
    && !asset.currentComponentPath
  ) {
    addFinding({
      list: findings,
      assetId,
      severity: 'warning',
      ruleId: 'wrapped_missing_component_path',
      message: 'Wrapped or moved assets should declare currentComponentPath.',
      field: 'currentComponentPath',
      suggestedAction: 'Set currentComponentPath to the location of the registered component.',
    });
  }

  // component mapping exists for registered visual assets
  if (!(assetId in componentRegistry)) {
    addFinding({
      list: findings,
      assetId,
      severity: 'warning',
      ruleId: 'missing_component_mapping',
      message: 'Asset has no entry in the component registry.',
      field: 'id',
      suggestedAction: 'Add the asset component to educationalComponentRegistry.tsx.',
    });
  }

  // warning for missing print equivalent (non-print-ready assets that still lack one)
  if (!asset.hasPrintEquivalent && asset.printStatus !== 'print_ready') {
    addFinding({
      list: findings,
      assetId,
      severity: 'warning',
      ruleId: 'missing_print_equivalent',
      message: 'Asset does not have a print equivalent.',
      field: 'hasPrintEquivalent',
      suggestedAction: 'Consider adding a print-compatible version for print-first accessibility contexts.',
    });
  }

  return findings;
}
