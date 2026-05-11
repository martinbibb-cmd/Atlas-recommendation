import type { EducationalRoutingAccessibilityProfile } from '../routing/EducationalRoutingRuleV1';
import type {
  CustomerAnxietyPatternV1,
  CustomerAnxietyQrDepthPreferenceV1,
  CustomerAnxietySequencingBiasV1,
} from './CustomerAnxietyPatternV1';
import { customerAnxietyPatterns } from './customerAnxietyPatterns';

export interface ResolveCustomerAnxietyPatternsInputV1 {
  concernTags?: readonly string[];
  accessibilityProfiles?: readonly EducationalRoutingAccessibilityProfile[];
  archetypeId?: string;
  surveyNotes?: string;
  manualOverrides?: {
    includeAnxietyIds?: readonly string[];
    excludeAnxietyIds?: readonly string[];
  };
}

export interface ResolvedAnxietySequencingPolicyV1 {
  reassuranceStagePriorityBoost: number;
  simultaneousConceptReduction: number;
  preferWhatToExpectCard: boolean;
  suppressTechnicalContent: boolean;
  boostWhatStaysFamiliar: boolean;
  avoidConcepts: string[];
}

export interface ResolveCustomerAnxietyPatternsOutputV1 {
  activePatterns: CustomerAnxietyPatternV1[];
  activePatternIds: string[];
  sequencingPolicy: ResolvedAnxietySequencingPolicyV1;
  preferredCardTypes: string[];
  qrDepthPreference: CustomerAnxietyQrDepthPreferenceV1;
  printPreferenceWeight: number;
}

const QR_DEPTH_PRIORITY: Record<CustomerAnxietyQrDepthPreferenceV1, number> = {
  brief: 0,
  standard: 1,
  deep: 2,
};

function hasTriggerMatch(
  pattern: CustomerAnxietyPatternV1,
  concernTags: readonly string[],
  archetypeId?: string,
  surveyNotes?: string,
): boolean {
  const loweredTags = concernTags.map((tag) => tag.toLowerCase());
  const loweredArchetype = (archetypeId ?? '').toLowerCase();
  const loweredSurveyNotes = (surveyNotes ?? '').toLowerCase();

  return pattern.triggers.some((trigger) => {
    const needle = trigger.toLowerCase();
    return loweredTags.some((tag) => tag.includes(needle))
      || loweredArchetype.includes(needle)
      || loweredSurveyNotes.includes(needle);
  });
}

export function resolveCustomerAnxietyPatterns(
  input: ResolveCustomerAnxietyPatternsInputV1,
): ResolveCustomerAnxietyPatternsOutputV1 {
  const concernTags = input.concernTags ?? [];
  const includeIds = new Set(input.manualOverrides?.includeAnxietyIds ?? []);
  const excludeIds = new Set(input.manualOverrides?.excludeAnxietyIds ?? []);
  const active = customerAnxietyPatterns.filter((pattern) => (
    (includeIds.has(pattern.anxietyId) || hasTriggerMatch(pattern, concernTags, input.archetypeId, input.surveyNotes))
    && !excludeIds.has(pattern.anxietyId)
  ));

  if (
    input.accessibilityProfiles?.includes('adhd')
    && active.length > 0
    && !active.some((pattern) => pattern.category === 'competence')
  ) {
    const competencePattern = customerAnxietyPatterns.find((pattern) => pattern.anxietyId === 'worried_about_complex_controls');
    if (competencePattern) {
      active.push(competencePattern);
    }
  }

  const sequencingPolicy: ResolvedAnxietySequencingPolicyV1 = {
    reassuranceStagePriorityBoost: 0,
    simultaneousConceptReduction: 0,
    preferWhatToExpectCard: false,
    suppressTechnicalContent: false,
    boostWhatStaysFamiliar: false,
    avoidConcepts: [],
  };

  const preferredCardTypeSet = new Set<string>();
  let maxQrPreference: CustomerAnxietyQrDepthPreferenceV1 = 'brief';
  let printPreferenceWeight = 0;

  for (const pattern of active) {
    const bias: CustomerAnxietySequencingBiasV1 = pattern.sequencingBias;

    sequencingPolicy.reassuranceStagePriorityBoost = Math.max(
      sequencingPolicy.reassuranceStagePriorityBoost,
      bias.reassuranceStagePriorityBoost ?? 0,
    );
    sequencingPolicy.simultaneousConceptReduction = Math.max(
      sequencingPolicy.simultaneousConceptReduction,
      bias.simultaneousConceptReduction ?? 0,
    );
    sequencingPolicy.preferWhatToExpectCard =
      sequencingPolicy.preferWhatToExpectCard || Boolean(bias.preferWhatToExpectCard);
    sequencingPolicy.suppressTechnicalContent =
      sequencingPolicy.suppressTechnicalContent || Boolean(bias.suppressTechnicalContent);
    sequencingPolicy.boostWhatStaysFamiliar =
      sequencingPolicy.boostWhatStaysFamiliar || Boolean(bias.boostWhatStaysFamiliar);

    for (const conceptId of pattern.avoidConcepts) {
      sequencingPolicy.avoidConcepts.push(conceptId);
    }

    for (const cardType of pattern.preferredCardTypes) {
      preferredCardTypeSet.add(cardType);
    }

    if (QR_DEPTH_PRIORITY[pattern.qrDepthPreference] > QR_DEPTH_PRIORITY[maxQrPreference]) {
      maxQrPreference = pattern.qrDepthPreference;
    }

    printPreferenceWeight += pattern.printPreferenceWeight;
  }

  sequencingPolicy.avoidConcepts = [...new Set(sequencingPolicy.avoidConcepts)];

  return {
    activePatterns: active,
    activePatternIds: active.map((pattern) => pattern.anxietyId),
    sequencingPolicy,
    preferredCardTypes: [...preferredCardTypeSet],
    qrDepthPreference: maxQrPreference,
    printPreferenceWeight,
  };
}
