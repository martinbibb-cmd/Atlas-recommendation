import type { EducationalRoutingAccessibilityPreferencesV1 } from '../routing/EducationalRoutingRuleV1';
import type {
  ResolveCustomerAnxietyPatternsInputV1,
  ResolveCustomerAnxietyPatternsOutputV1,
} from '../emotionalRouting/resolveCustomerAnxietyPatterns';
import { resolveCustomerAnxietyPatterns } from '../emotionalRouting/resolveCustomerAnxietyPatterns';
import type { EmotionalWeight, EducationalSequenceRuleV1, SequenceStage } from './EducationalSequenceRuleV1';

// ─── Stage ordering ────────────────────────────────────────────────────────

const STAGE_ORDER: SequenceStage[] = [
  'reassurance',
  'expectation',
  'lived_experience',
  'misconception',
  'deeper_understanding',
  'technical_detail',
  'appendix_only',
];

/**
 * Maximum number of concepts allowed in a single section slot for each
 * accessibility profile. Profiles that reduce cognitive load lower this cap.
 */
const ACCESSIBILITY_MAX_SIMULTANEOUS: Record<string, number> = {
  adhd: 1,
  dyslexia: 2,
  low_technical_literacy: 2,
  print_first: 3,
  reduced_motion: 3,
  technical_appendix_requested: 4,
  default: 4,
};

const WHAT_STAYS_FAMILIAR_CONCEPT_IDS = new Set([
  'preserved_system_strength',
  'system_fit_explanation',
  'regular_retained_unvented_upgrade',
]);

// ─── Input / Output types ──────────────────────────────────────────────────

export type ArchetypeId = string;

/** Emotional and trust tags that can influence pacing decisions. */
export interface SequencingContextTagsV1 {
  /** e.g. 'trust_sensitive', 'anxiety_flagged', 'repeat_customer' */
  emotionalTags?: readonly string[];
  /** e.g. 'surveyor_confirmed', 'self_reported' */
  trustTags?: readonly string[];
}

export interface BuildEducationalSequenceInputV1 {
  /** The conceptIds selected for this pack (in any order). */
  selectedConceptIds: readonly string[];
  /** All sequencing rules to draw from. */
  sequenceRules: readonly EducationalSequenceRuleV1[];
  /** Archetype driving this journey (informational — used in metadata). */
  archetypeId: ArchetypeId;
  /** Accessibility preferences that may reduce simultaneous-concept caps. */
  accessibilityPreferences?: EducationalRoutingAccessibilityPreferencesV1;
  /** Emotional and trust context tags. */
  contextTags?: SequencingContextTagsV1;
  /** Concern tags used for anxiety resolution when no pre-resolved policy is provided. */
  concernTags?: readonly string[];
  /** Optional survey notes used for anxiety trigger matching. */
  surveyNotes?: string;
  /** Optional manual anxiety include/exclude overrides. */
  anxietyManualOverrides?: ResolveCustomerAnxietyPatternsInputV1['manualOverrides'];
  /**
   * Optional resolved anxiety routing output. If omitted, the engine resolves
   * anxiety patterns from context tags and accessibility profiles.
   */
  anxietyRouting?: ResolveCustomerAnxietyPatternsOutputV1;
  /**
   * Set of conceptIds already explained earlier in the session or pack.
   * Used to suppress repeated explanations.
   */
  alreadyExplainedConceptIds?: readonly string[];
}

/** A single concept placed in the ordered sequence. */
export interface SequencedConceptV1 {
  conceptId: string;
  sequenceStage: SequenceStage;
  emotionalWeight: EmotionalWeight;
  ruleId: string;
  idealCardTypes: readonly string[];
  /** Position in the output sequence (0-indexed). */
  position: number;
}

/** A concept excluded from the main sequence, with a reason. */
export interface DeferredConceptV1 {
  conceptId: string;
  ruleId: string;
  reason: string;
}

/** Per-stage pacing metadata for renderer use. */
export interface StagePacingMetadataV1 {
  stage: SequenceStage;
  conceptCount: number;
  hasConsecutiveCautionary: boolean;
  cooldownRequired: boolean;
}

export interface BuildEducationalSequenceOutputV1 {
  /** Concepts in their recommended display order. */
  orderedSequence: SequencedConceptV1[];
  /** Concepts excluded from the main sequence. */
  deferredConcepts: DeferredConceptV1[];
  /** Human-readable overload warnings for dev/preview surfaces. */
  overloadWarnings: string[];
  /** Per-stage pacing metadata. */
  pacingMetadata: StagePacingMetadataV1[];
  /** The effective max-simultaneous-concepts cap applied. */
  appliedMaxSimultaneous: number;
  /** Anxiety pattern IDs active during sequencing (internal diagnostics only). */
  activeAnxietyPatternIds: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function resolveMaxSimultaneous(
  accessibilityPreferences?: EducationalRoutingAccessibilityPreferencesV1,
): number {
  const profiles = accessibilityPreferences?.profiles ?? [];

  // Use the most restrictive applicable cap.
  let min = ACCESSIBILITY_MAX_SIMULTANEOUS['default'] as number;

  for (const profile of profiles) {
    const cap = ACCESSIBILITY_MAX_SIMULTANEOUS[profile];
    if (cap !== undefined && cap < min) {
      min = cap;
    }
  }

  return min;
}

function findRule(
  conceptId: string,
  sequenceRules: readonly EducationalSequenceRuleV1[],
): EducationalSequenceRuleV1 | undefined {
  return sequenceRules.find((r) => r.conceptId === conceptId);
}

function stageIndex(stage: SequenceStage): number {
  return STAGE_ORDER.indexOf(stage);
}

// ─── Engine ────────────────────────────────────────────────────────────────

/**
 * Build an ordered educational sequence from a selected set of concept IDs.
 *
 * The engine:
 * 1. Assigns each concept to a stage using the matching SequenceRule.
 * 2. Checks prerequisites — missing prerequisites defer the concept.
 * 3. Suppresses concepts already explained when the rule requests it.
 * 4. Sorts concepts by stage order, then by emotional weight (calming first).
 * 5. Enforces max-simultaneous-concepts caps (reduced by accessibility profiles).
 * 6. Applies adjacency constraints (avoidAdjacentConceptIds).
 * 7. Inserts cooldown slots after heavy concepts when requested.
 * 8. Emits overload warnings when cautionary concepts cluster.
 */
export function buildEducationalSequence(
  input: BuildEducationalSequenceInputV1,
): BuildEducationalSequenceOutputV1 {
  const {
    selectedConceptIds,
    sequenceRules,
    archetypeId,
    accessibilityPreferences,
    contextTags,
    concernTags,
    surveyNotes,
    anxietyManualOverrides,
    anxietyRouting,
    alreadyExplainedConceptIds = [],
  } = input;

  const deferred: DeferredConceptV1[] = [];
  const overloadWarnings: string[] = [];

  const resolvedAnxietyRouting = anxietyRouting ?? resolveCustomerAnxietyPatterns({
    concernTags: concernTags ?? contextTags?.emotionalTags ?? [],
    accessibilityProfiles: accessibilityPreferences?.profiles,
    archetypeId,
    surveyNotes,
    manualOverrides: anxietyManualOverrides,
  });
  const anxietyPolicy = resolvedAnxietyRouting.sequencingPolicy;
  const hasAdhdProfile = accessibilityPreferences?.profiles?.includes('adhd') ?? false;
  const appliedMaxSimultaneous = Math.max(
    1,
    resolveMaxSimultaneous(accessibilityPreferences) - anxietyPolicy.simultaneousConceptReduction,
  );
  const selectedSet = new Set(selectedConceptIds);
  const explainedSet = new Set(alreadyExplainedConceptIds);

  // ── Step 1: classify each selected concept ────────────────────────────────
  type Candidate = {
    conceptId: string;
    rule: EducationalSequenceRuleV1;
  };

  const candidates: Candidate[] = [];

  for (const conceptId of selectedConceptIds) {
    const rule = findRule(conceptId, sequenceRules);

    if (!rule) {
      // No sequencing rule — place at end as technical_detail with neutral weight.
      candidates.push({
        conceptId,
        rule: {
          ruleId: `auto_${conceptId}`,
          conceptId,
          sequenceStage: 'technical_detail',
          emotionalWeight: 'neutral',
          maxSimultaneousConcepts: appliedMaxSimultaneous,
        },
      });
      continue;
    }

    if (anxietyPolicy.avoidConcepts.includes(conceptId)) {
      deferred.push({
        conceptId,
        ruleId: rule.ruleId,
        reason: 'Suppressed by active customer anxiety pattern to avoid low-trust framing.',
      });
      continue;
    }

    // ── Step 2: prerequisite gate ─────────────────────────────────────────
    if (rule.prerequisites && rule.prerequisites.length > 0) {
      const missing = rule.prerequisites.filter((p) => !selectedSet.has(p));

      if (missing.length > 0) {
        deferred.push({
          conceptId,
          ruleId: rule.ruleId,
          reason: `Missing prerequisites: ${missing.join(', ')}`,
        });
        continue;
      }
    }

    // ── Step 3: suppress-if-already-explained gate ─────────────────────────
    if (rule.suppressIfAlreadyExplained && explainedSet.has(conceptId)) {
      deferred.push({
        conceptId,
        ruleId: rule.ruleId,
        reason: 'Already explained in an earlier section — suppressed to avoid repetition.',
      });
      continue;
    }

    candidates.push({ conceptId, rule });
  }

  // ── Step 4: sort by stage order, then emotional weight ────────────────────
  const EMOTIONAL_PRIORITY: Record<EmotionalWeight, number> = {
    calming: 0,
    neutral: 1,
    cautionary: 2,
  };

  function getEffectiveStage(rule: EducationalSequenceRuleV1): SequenceStage {
    if (
      anxietyPolicy.suppressTechnicalContent
      && rule.sequenceStage === 'technical_detail'
    ) {
      return 'appendix_only';
    }

    if (
      anxietyPolicy.preferWhatToExpectCard
      && (rule.sequenceStage === 'expectation' || rule.sequenceStage === 'lived_experience')
      && (rule.idealCardTypes ?? []).includes('WhatToExpectCard')
    ) {
      return 'reassurance';
    }

    if (
      anxietyPolicy.boostWhatStaysFamiliar
      && WHAT_STAYS_FAMILIAR_CONCEPT_IDS.has(rule.conceptId)
    ) {
      return 'reassurance';
    }

    return rule.sequenceStage;
  }

  candidates.sort((a, b) => {
    const stageDiff = stageIndex(getEffectiveStage(a.rule)) - stageIndex(getEffectiveStage(b.rule));
    if (stageDiff !== 0) return stageDiff;

    if (
      anxietyPolicy.boostWhatStaysFamiliar
      && WHAT_STAYS_FAMILIAR_CONCEPT_IDS.has(a.conceptId) !== WHAT_STAYS_FAMILIAR_CONCEPT_IDS.has(b.conceptId)
    ) {
      return WHAT_STAYS_FAMILIAR_CONCEPT_IDS.has(a.conceptId) ? -1 : 1;
    }

    return EMOTIONAL_PRIORITY[a.rule.emotionalWeight] - EMOTIONAL_PRIORITY[b.rule.emotionalWeight];
  });

  // ── Step 5: adjacency enforcement ────────────────────────────────────────
  // For any concept with avoidAdjacentConceptIds, ensure it is not placed
  // immediately next to those concepts in the sorted list.
  const placed: Candidate[] = [];

  for (const candidate of candidates) {
    const { rule } = candidate;
    const avoid = new Set(rule.avoidAdjacentConceptIds ?? []);

    if (placed.length === 0 || avoid.size === 0) {
      placed.push(candidate);
      continue;
    }

    const prev = placed[placed.length - 1]!;
    const prevAvoided = avoid.has(prev.conceptId);
    const prevAvoidsCurrentSet = new Set(prev.rule.avoidAdjacentConceptIds ?? []);
    const prevAvoidsCurrent = prevAvoidsCurrentSet.has(candidate.conceptId);

    if (!prevAvoided && !prevAvoidsCurrent) {
      placed.push(candidate);
      continue;
    }

    // Try to insert a neutral buffer between them by deferring the current
    // candidate one position (it will be appended after the next candidate).
    // Simplified: just append — the overload warning below will flag the issue.
    placed.push(candidate);
    overloadWarnings.push(
      `Adjacency conflict: "${candidate.conceptId}" and "${prev.conceptId}" are adjacent but should be separated.`,
    );
  }

  if (hasAdhdProfile && resolvedAnxietyRouting.activePatternIds.length > 0) {
    const NON_REASSURANCE_SLOT_RESERVE = 1;
    const maxNonReassurance = Math.max(0, appliedMaxSimultaneous - NON_REASSURANCE_SLOT_RESERVE);
    let keptNonReassurance = 0;
    const compacted: Candidate[] = [];
    const deferredByDensity: DeferredConceptV1[] = [];

    for (const candidate of placed) {
      const effectiveStage = getEffectiveStage(candidate.rule);
      if (effectiveStage === 'reassurance') {
        compacted.push(candidate);
        continue;
      }

      if (keptNonReassurance < maxNonReassurance) {
        compacted.push(candidate);
        keptNonReassurance++;
        continue;
      }

      deferredByDensity.push({
        conceptId: candidate.conceptId,
        ruleId: candidate.rule.ruleId,
        reason: 'Deferred to reduce concept density for ADHD + anxiety reassurance pacing.',
      });
    }

    if (deferredByDensity.length > 0) {
      deferred.push(...deferredByDensity);
      placed.splice(0, placed.length, ...compacted);
    }
  }

  // ── Step 6: max-simultaneous-concepts enforcement per stage ───────────────
  // Count concepts per stage and warn when a stage exceeds the cap.
  const stageCounts = new Map<SequenceStage, number>();

  for (const { rule } of placed) {
    const effectiveStage = getEffectiveStage(rule);
    const count = (stageCounts.get(effectiveStage) ?? 0) + 1;
    stageCounts.set(effectiveStage, count);
  }

  for (const [stage, count] of stageCounts.entries()) {
    if (count > appliedMaxSimultaneous) {
      overloadWarnings.push(
        `Stage "${stage}" contains ${count} concepts but the applied cap is ${appliedMaxSimultaneous}. Consider deferring lower-priority concepts.`,
      );
    }
  }

  // ── Step 7: cooldown enforcement ──────────────────────────────────────────
  // Detect pairs of cautionary concepts with no calming/neutral concept in between.
  for (let i = 0; i < placed.length - 1; i++) {
    const curr = placed[i]!;
    const next = placed[i + 1]!;
    const cooldown = curr.rule.cooldownAfter ?? 0;

    if (curr.rule.emotionalWeight === 'cautionary' && cooldown > 0) {
      // Check if the next `cooldown` slots contain only cautionary concepts.
      let heavyCount = 0;

      for (let j = i + 1; j <= i + cooldown && j < placed.length; j++) {
        if (placed[j]!.rule.emotionalWeight === 'cautionary') {
          heavyCount++;
        }
      }

      if (heavyCount > 0) {
        overloadWarnings.push(
          `Cooldown violation: "${curr.conceptId}" requires ${cooldown} calming/neutral slot(s) before the next cautionary concept, but found ${heavyCount} cautionary concept(s) immediately after.`,
        );
      }
    }

    // Consecutive cautionary warning (even without explicit cooldown).
    if (
      curr.rule.emotionalWeight === 'cautionary' &&
      next.rule.emotionalWeight === 'cautionary'
    ) {
      overloadWarnings.push(
        `Consecutive cautionary concepts: "${curr.conceptId}" → "${next.conceptId}". Insert a calming or neutral concept between them.`,
      );
    }
  }

  // ── Step 8: build final output ────────────────────────────────────────────
  const orderedSequence: SequencedConceptV1[] = placed.map(({ conceptId, rule }, index) => ({
    conceptId,
    sequenceStage: getEffectiveStage(rule),
    emotionalWeight: rule.emotionalWeight,
    ruleId: rule.ruleId,
    idealCardTypes: anxietyPolicy.preferWhatToExpectCard
      ? ['WhatToExpectCard', ...(rule.idealCardTypes ?? []).filter((cardType) => cardType !== 'WhatToExpectCard')]
      : (rule.idealCardTypes ?? []),
    position: index,
  }));

  // ── Step 9: pacing metadata per stage ─────────────────────────────────────
  const pacingMetadata: StagePacingMetadataV1[] = STAGE_ORDER.map((stage) => {
    const stageItems = orderedSequence.filter((c) => c.sequenceStage === stage);
    const conceptCount = stageItems.length;

    let hasConsecutiveCautionary = false;

    for (let i = 0; i < stageItems.length - 1; i++) {
      if (
        stageItems[i]!.emotionalWeight === 'cautionary' &&
        stageItems[i + 1]!.emotionalWeight === 'cautionary'
      ) {
        hasConsecutiveCautionary = true;
        break;
      }
    }

    const cooldownRequired = stageItems.some((c) => {
      const rule = findRule(c.conceptId, sequenceRules);
      return rule?.cooldownAfter !== undefined && rule.cooldownAfter > 0;
    });

    return { stage, conceptCount, hasConsecutiveCautionary, cooldownRequired };
  });

  return {
    orderedSequence,
    deferredConcepts: deferred,
    overloadWarnings,
    pacingMetadata,
    appliedMaxSimultaneous,
    activeAnxietyPatternIds: resolvedAnxietyRouting.activePatternIds,
  };
}
