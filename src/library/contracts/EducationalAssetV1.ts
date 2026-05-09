import type { EducationalAnalogyFamily } from './EducationalAnalogyV1';

export type AssetLifecycleStatus = 'existing' | 'needs_review' | 'library_ready' | 'deprecated';
export type AssetMigrationStatus = 'registered_only' | 'wrapped' | 'moved';
export type AssetAccessibilityAuditStatus = 'not_started' | 'partial' | 'passed' | 'failed';
export type AssetPrintStatus = 'none' | 'needs_static_equivalent' | 'print_ready';

export type EducationalAssetType =
  | 'animation'
  | 'diagram'
  | 'explainer'
  | 'print_sheet'
  | 'analogy'
  | 'topology'
  | 'checklist';

export type EducationalAudience = 'customer' | 'surveyor' | 'engineer' | 'all';
export type EducationalDepth = 'plain' | 'visual' | 'functional' | 'technical' | 'engineer';
export type EducationalLoad = 'low' | 'medium' | 'high';
export type EducationalMotionIntensity = 'none' | 'low' | 'medium' | 'high';
export type EducationalTranslationRisk = 'low' | 'medium' | 'high';
export type EducationalAccessibilityProfile =
  | 'reduced_motion'
  | 'high_contrast'
  | 'screen_reader'
  | 'print_first'
  | 'plain_language'
  | 'none';

export interface EducationalAssetV1 {
  id: string;
  conceptIds: string[];
  title: string;
  assetType: EducationalAssetType;
  audience: EducationalAudience;
  depth: EducationalDepth;
  cognitiveLoad: EducationalLoad;
  textDensity: EducationalLoad;
  motionIntensity: EducationalMotionIntensity;
  hasStaticFallback: boolean;
  hasPrintEquivalent: boolean;
  supportsReducedMotion: boolean;
  analogyFamilies: EducationalAnalogyFamily[];
  accessibilityProfiles: EducationalAccessibilityProfile[];
  translationRisk: EducationalTranslationRisk;
  requiredEngineFacts: string[];
  triggerTags: string[];
  currentComponentPath?: string;
  printComponentPath?: string;
  lifecycleStatus?: AssetLifecycleStatus;
  migrationStatus?: AssetMigrationStatus;
  accessibilityAuditStatus?: AssetAccessibilityAuditStatus;
  printStatus?: AssetPrintStatus;
  notes?: string;
}
