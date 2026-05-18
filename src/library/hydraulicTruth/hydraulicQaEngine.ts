import type { VisualTopologyId } from '../visualTopologies/visualTopologyRegistry';
import { HYDRAULIC_TRUTH_MODELS, TOPOLOGY_TEMPLATE_MAP } from './canonicalHydraulicTemplates';
import { HYDRAULIC_CONSTRAINTS } from './hydraulicConstraints';
import type { HydraulicQaIssue, HydraulicQaResult, TopologyHydraulicTruthModel } from './types';

const ISSUE_WEIGHTS: Record<HydraulicQaIssue['category'], number> = {
  hydraulically_implausible: 24,
  visually_confusing: 10,
  regulation_violation: 28,
  stratification_error: 18,
  potable_primary_mixing_error: 22,
  decorative_pipework: 12,
  unsafe_component_position: 18,
};

function getTruthModel(topologyId: VisualTopologyId): TopologyHydraulicTruthModel {
  const model = HYDRAULIC_TRUTH_MODELS.find((entry) => entry.topologyId === topologyId);
  if (model == null) {
    throw new Error(`Missing hydraulic truth model for topology: ${topologyId}`);
  }
  return model;
}

function evaluateConstraints(model: TopologyHydraulicTruthModel): HydraulicQaIssue[] {
  const enabled = new Set(model.featureFlags);
  const issues: HydraulicQaIssue[] = [];

  for (const constraint of HYDRAULIC_CONSTRAINTS) {
    if (!constraint.templates.includes(model.templateId)) continue;
    if (constraint.topologyIds != null && !constraint.topologyIds.includes(model.topologyId)) continue;

    const hasFeature = enabled.has(constraint.requiredFeatureFlag);
    const broken = constraint.kind === 'must_show' ? !hasFeature : hasFeature;
    if (!broken) continue;

    issues.push({
      category: constraint.issueCategory,
      severity: constraint.issueCategory === 'visually_confusing' ? 'warn' : 'error',
      message: constraint.description,
      constraintId: constraint.id,
    });
  }

  return issues;
}

function computeAccessibilityIssues(model: TopologyHydraulicTruthModel): HydraulicQaIssue[] {
  const issues: HydraulicQaIssue[] = [];
  if (!model.accessibilityCompatibility.noLabelMode) {
    issues.push({
      category: 'visually_confusing',
      severity: 'warn',
      message: 'No-label mode support is required for topology truth QA.',
      constraintId: 'accessibility_no_label',
    });
  }
  if (!model.accessibilityCompatibility.monochromePrintSafeMode) {
    issues.push({
      category: 'visually_confusing',
      severity: 'warn',
      message: 'Monochrome print-safe support is required for topology truth QA.',
      constraintId: 'accessibility_print_safe',
    });
  }
  if (!model.accessibilityCompatibility.reducedMotionMode) {
    issues.push({
      category: 'visually_confusing',
      severity: 'warn',
      message: 'Reduced-motion compatibility must be preserved.',
      constraintId: 'accessibility_reduced_motion',
    });
  }
  if (!model.accessibilityCompatibility.analogyOverlays) {
    issues.push({
      category: 'visually_confusing',
      severity: 'warn',
      message: 'Analogy overlay compatibility is required by the visual architecture.',
      constraintId: 'accessibility_analogy_overlays',
    });
  }
  return issues;
}

function scoreFromIssues(issues: HydraulicQaIssue[]): number {
  const penalty = issues.reduce((total, issue) => total + ISSUE_WEIGHTS[issue.category], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function runHydraulicTopologyQa(topologyId: VisualTopologyId): HydraulicQaResult {
  const model = getTruthModel(topologyId);
  const issues = [...evaluateConstraints(model), ...computeAccessibilityIssues(model)];
  const plausibilityScore = scoreFromIssues(issues);

  return {
    topologyId,
    templateId: model.templateId,
    passed: issues.length === 0,
    plausibilityScore,
    issues,
  };
}

export function getHydraulicTruthModel(topologyId: VisualTopologyId): TopologyHydraulicTruthModel {
  return getTruthModel(topologyId);
}

export function listCanonicalHydraulicTemplates() {
  return Object.entries(TOPOLOGY_TEMPLATE_MAP).map(([topologyId, templateId]) => ({
    topologyId: topologyId as VisualTopologyId,
    templateId,
  }));
}
