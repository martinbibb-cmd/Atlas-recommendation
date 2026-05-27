/**
 * explainers/index.ts — Re-export shim for educational explainer content.
 *
 * This file makes the content from src/legacy/educationalExplainersPrototype/ accessible
 * through the canonical src/library/content/ path, as part of the Phase 3
 * educational-content consolidation.
 *
 * Migration status: SHIM — new consumers should import from here.
 * Original location: src/legacy/educationalExplainersPrototype/content.ts
 * Target location: src/library/content/explainers/ (when migration is complete)
 *
 * See docs/CONSOLIDATION_FREEZE.md for the migration plan.
 */

export {
  EDUCATIONAL_EXPLAINERS,
} from '../../../legacy/educationalExplainersPrototype/content';

export type {
  EducationalExplainer,
  ExplainerCategory,
} from '../../../legacy/educationalExplainersPrototype/types';
