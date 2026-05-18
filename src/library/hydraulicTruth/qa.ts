import type { VisualTopologyId } from '../visualTopologies/visualTopologyRegistry';
import { HYDRAULIC_CONSTRAINTS } from './constraints';
import { CANONICAL_HYDRAULIC_TEMPLATES } from './templates';
import { TOPOLOGY_HYDRAULIC_PROFILES } from './topologyProfiles';
import type { HydraulicQaFlag, HydraulicQaIssue, InstallerHydraulicReview } from './types';

const QA_FLAGS: readonly HydraulicQaFlag[] = [
  'hydraulically_implausible',
  'visually_confusing',
  'regulation_violation',
  'stratification_error',
  'potable_primary_mixing_error',
  'decorative_pipework',
  'unsafe_component_position',
] as const;

function buildFlags(issues: HydraulicQaIssue[]): Record<HydraulicQaFlag, boolean> {
  const flags: Record<HydraulicQaFlag, boolean> = {
    hydraulically_implausible: false,
    visually_confusing: false,
    regulation_violation: false,
    stratification_error: false,
    potable_primary_mixing_error: false,
    decorative_pipework: false,
    unsafe_component_position: false,
  };
  for (const issue of issues) flags[issue.flag] = true;
  return flags;
}

function buildPlausibilityScore(issues: HydraulicQaIssue[]): number {
  const severityWeight: Record<HydraulicQaFlag, number> = {
    hydraulically_implausible: 10,
    visually_confusing: 6,
    regulation_violation: 14,
    stratification_error: 8,
    potable_primary_mixing_error: 12,
    decorative_pipework: 6,
    unsafe_component_position: 12,
  };

  const penalty = issues.reduce((sum, issue) => sum + severityWeight[issue.flag], 0);
  return Math.max(0, 100 - penalty);
}

export function assessTopologyHydraulicTruth(topologyId: VisualTopologyId): InstallerHydraulicReview {
  const profile = TOPOLOGY_HYDRAULIC_PROFILES[topologyId];
  const template = CANONICAL_HYDRAULIC_TEMPLATES.find((entry) => entry.id === profile.templateId);
  if (template == null) {
    throw new Error(`Missing canonical hydraulic template for topology: ${topologyId}`);
  }

  const issues: HydraulicQaIssue[] = HYDRAULIC_CONSTRAINTS
    .filter((constraint) => constraint.appliesTo.includes(profile.templateId))
    .flatMap((constraint) => {
      const value = profile.signals[constraint.signal];
      const passes = constraint.type === 'must_show' ? value : !value;
      if (passes) return [];
      return [{
        constraintId: constraint.id,
        message: constraint.description,
        flag: constraint.failureFlag,
      }];
    });

  const flags = buildFlags(issues);
  const plausibilityScore = buildPlausibilityScore(issues);

  return {
    topologyId,
    templateId: profile.templateId,
    hydraulicIntentSummary: profile.summary,
    safetyNotes: template.safetyNotes,
    regulatoryNotes: template.regulatoryNotes,
    knownSimplifications: [...profile.knownSimplifications, ...template.nonNegotiableSimplifications],
    plausibilityScore,
    flags,
    issues,
  };
}

export function buildHydraulicInstallerReviewMatrix(): InstallerHydraulicReview[] {
  return (Object.keys(TOPOLOGY_HYDRAULIC_PROFILES) as VisualTopologyId[]).map((id) =>
    assessTopologyHydraulicTruth(id),
  );
}

export function hasHydraulicQaFailure(topologyId: VisualTopologyId): boolean {
  const result = assessTopologyHydraulicTruth(topologyId);
  return QA_FLAGS.some((flag) => result.flags[flag]);
}
