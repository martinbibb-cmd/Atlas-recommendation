import type { EducationalSequenceRuleV1 } from './EducationalSequenceRuleV1';

/**
 * Canonical sequencing rules for educational concepts.
 *
 * Each entry controls *when* and *how* a concept is introduced in an
 * educational journey — not which content to render, but at what stage,
 * with what emotional pacing, and with what adjacency constraints.
 */
export const educationalSequenceRules: EducationalSequenceRuleV1[] = [
  // ─── Reassurance layer ────────────────────────────────────────────────────

  {
    ruleId: 'seq_system_fit_reassurance',
    conceptId: 'system_fit_explanation',
    sequenceStage: 'reassurance',
    emotionalWeight: 'calming',
    maxSimultaneousConcepts: 2,
    cooldownAfter: 1,
    idealCardTypes: ['WhatToExpectCard', 'EducationalCard'],
    suppressIfAlreadyExplained: false,
  },

  {
    ruleId: 'seq_safety_reassurance',
    conceptId: 'HYD-02',
    sequenceStage: 'reassurance',
    emotionalWeight: 'calming',
    maxSimultaneousConcepts: 2,
    idealCardTypes: ['SafetyNoticeCard'],
    avoidAdjacentConceptIds: ['SIZ-02', 'boiler_cycling'],
  },

  // ─── Expectation layer ────────────────────────────────────────────────────

  {
    ruleId: 'seq_emitter_sizing_expectation',
    conceptId: 'emitter_sizing',
    sequenceStage: 'expectation',
    prerequisites: ['system_fit_explanation'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 2,
    idealCardTypes: ['EducationalCard', 'WhatToExpectCard'],
  },

  {
    ruleId: 'seq_flow_temperature_expectation',
    conceptId: 'flow_temperature',
    sequenceStage: 'expectation',
    prerequisites: ['system_fit_explanation', 'emitter_sizing'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 2,
    cooldownAfter: 1,
    avoidAdjacentConceptIds: ['weather_compensation', 'load_matching'],
  },

  {
    ruleId: 'seq_stored_hot_water_expectation',
    conceptId: 'stored_hot_water_efficiency',
    sequenceStage: 'expectation',
    prerequisites: ['system_fit_explanation'],
    emotionalWeight: 'calming',
    maxSimultaneousConcepts: 2,
    idealCardTypes: ['WhatToExpectCard', 'EducationalCard'],
  },

  // ─── Lived experience layer ───────────────────────────────────────────────

  {
    ruleId: 'seq_operating_behaviour_lived',
    conceptId: 'operating_behaviour',
    sequenceStage: 'lived_experience',
    prerequisites: ['system_fit_explanation'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 3,
    idealCardTypes: ['WhatToExpectCard', 'AnalogyCard'],
    suppressIfAlreadyExplained: true,
  },

  {
    ruleId: 'seq_driving_style_lived',
    conceptId: 'driving_style',
    sequenceStage: 'lived_experience',
    prerequisites: ['operating_behaviour'],
    emotionalWeight: 'calming',
    maxSimultaneousConcepts: 3,
    idealCardTypes: ['AnalogyCard'],
    suppressIfAlreadyExplained: true,
  },

  {
    ruleId: 'seq_control_strategy_lived',
    conceptId: 'control_strategy',
    sequenceStage: 'lived_experience',
    prerequisites: ['operating_behaviour'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 2,
    avoidAdjacentConceptIds: ['weather_compensation'],
    idealCardTypes: ['EducationalCard'],
  },

  {
    ruleId: 'seq_hp_cylinder_temperature_lived',
    conceptId: 'hp_cylinder_temperature',
    sequenceStage: 'lived_experience',
    prerequisites: ['system_fit_explanation', 'flow_temperature'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 2,
    idealCardTypes: ['WhatToExpectCard'],
  },

  // ─── Misconception layer ──────────────────────────────────────────────────

  {
    ruleId: 'seq_boiler_cycling_misconception',
    conceptId: 'boiler_cycling',
    sequenceStage: 'misconception',
    prerequisites: ['system_fit_explanation', 'operating_behaviour'],
    emotionalWeight: 'cautionary',
    maxSimultaneousConcepts: 1,
    cooldownAfter: 2,
    avoidAdjacentConceptIds: ['SIZ-02', 'load_matching', 'weather_compensation'],
    idealCardTypes: ['TrustRecoveryCard'],
    suppressIfAlreadyExplained: true,
  },

  {
    ruleId: 'seq_load_matching_misconception',
    conceptId: 'load_matching',
    sequenceStage: 'misconception',
    prerequisites: ['system_fit_explanation'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 2,
    avoidAdjacentConceptIds: ['boiler_cycling'],
    idealCardTypes: ['EducationalCard'],
  },

  {
    ruleId: 'seq_flow_restriction_misconception',
    conceptId: 'flow_restriction',
    sequenceStage: 'misconception',
    prerequisites: ['system_fit_explanation'],
    emotionalWeight: 'cautionary',
    maxSimultaneousConcepts: 1,
    cooldownAfter: 1,
    avoidAdjacentConceptIds: ['pipework_constraint'],
    idealCardTypes: ['SafetyNoticeCard', 'TrustRecoveryCard'],
  },

  // ─── Deeper understanding layer ───────────────────────────────────────────

  {
    ruleId: 'seq_weather_compensation_deeper',
    conceptId: 'weather_compensation',
    sequenceStage: 'deeper_understanding',
    prerequisites: ['flow_temperature', 'operating_behaviour'],
    deferUntilSeen: ['emitter_sizing'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 2,
    cooldownAfter: 1,
    avoidAdjacentConceptIds: ['load_matching', 'control_strategy'],
    idealCardTypes: ['EducationalCard', 'AnalogyCard'],
  },

  {
    ruleId: 'seq_legionella_deeper',
    conceptId: 'legionella_pasteurisation',
    sequenceStage: 'deeper_understanding',
    prerequisites: ['hp_cylinder_temperature', 'system_fit_explanation'],
    emotionalWeight: 'cautionary',
    maxSimultaneousConcepts: 1,
    cooldownAfter: 2,
    avoidAdjacentConceptIds: ['boiler_cycling', 'flow_restriction'],
    idealCardTypes: ['SafetyNoticeCard'],
    suppressIfAlreadyExplained: true,
  },

  {
    ruleId: 'seq_scope_clarity_deeper',
    conceptId: 'scope_clarity',
    sequenceStage: 'deeper_understanding',
    prerequisites: ['system_fit_explanation'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 2,
    idealCardTypes: ['EducationalCard', 'PrintSafePanel'],
    suppressIfAlreadyExplained: true,
  },

  // ─── Technical detail layer ───────────────────────────────────────────────

  {
    ruleId: 'seq_sizing_technical',
    conceptId: 'SIZ-01',
    sequenceStage: 'technical_detail',
    prerequisites: ['system_fit_explanation', 'emitter_sizing'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 2,
    idealCardTypes: ['EducationalCard'],
  },

  {
    ruleId: 'seq_sizing_cycling_technical',
    conceptId: 'SIZ-02',
    sequenceStage: 'technical_detail',
    prerequisites: ['SIZ-01', 'operating_behaviour'],
    emotionalWeight: 'cautionary',
    maxSimultaneousConcepts: 1,
    cooldownAfter: 2,
    avoidAdjacentConceptIds: ['boiler_cycling', 'load_matching'],
    idealCardTypes: ['EducationalCard'],
    suppressIfAlreadyExplained: true,
  },

  {
    ruleId: 'seq_hydraulic_technical',
    conceptId: 'HYD-01',
    sequenceStage: 'technical_detail',
    prerequisites: ['system_fit_explanation'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 2,
    avoidAdjacentConceptIds: ['HYD-02', 'pipework_constraint'],
    idealCardTypes: ['EducationalCard'],
  },

  {
    ruleId: 'seq_pipework_constraint_technical',
    conceptId: 'pipework_constraint',
    sequenceStage: 'technical_detail',
    prerequisites: ['flow_restriction'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 2,
    avoidAdjacentConceptIds: ['HYD-01'],
    idealCardTypes: ['EducationalCard'],
  },

  // ─── Appendix-only layer ──────────────────────────────────────────────────

  {
    ruleId: 'seq_future_ready_appendix',
    conceptId: 'future_ready_pathways',
    sequenceStage: 'appendix_only',
    prerequisites: ['system_fit_explanation'],
    emotionalWeight: 'calming',
    maxSimultaneousConcepts: 3,
    idealCardTypes: ['EducationalCard', 'PrintSafePanel'],
    suppressIfAlreadyExplained: false,
  },

  {
    ruleId: 'seq_system_work_explainer_appendix',
    conceptId: 'system_work_explainer',
    sequenceStage: 'appendix_only',
    prerequisites: ['system_fit_explanation'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 2,
    idealCardTypes: ['EducationalCard'],
    suppressIfAlreadyExplained: true,
  },

  {
    ruleId: 'seq_CON_01_appendix',
    conceptId: 'CON-01',
    sequenceStage: 'appendix_only',
    prerequisites: ['control_strategy'],
    emotionalWeight: 'neutral',
    maxSimultaneousConcepts: 2,
    idealCardTypes: ['EducationalCard'],
    suppressIfAlreadyExplained: true,
  },
];
