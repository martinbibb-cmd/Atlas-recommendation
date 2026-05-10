import type { ScenarioResult, ScenarioSystemType } from '../../../contracts/ScenarioResult';
import type { EducationalPackSectionId } from '../../contracts/EducationalPackV1';
import type { WelcomePackComposerInputV1 } from '../WelcomePackComposerV1';
import type { WelcomePackArchetypeV1 } from './WelcomePackArchetypeV1';

type ArchetypeDefinition = Omit<WelcomePackArchetypeV1, 'archetypeId'>;

function createArchetype(
  archetypeId: string,
  definition: ArchetypeDefinition,
): WelcomePackArchetypeV1 {
  return { archetypeId, ...definition };
}

const DEFAULT_SECTIONS: EducationalPackSectionId[] = [
  'calm_summary',
  'why_this_fits',
  'living_with_the_system',
  'relevant_explainers',
  'optional_technical_appendix',
  'next_steps',
];

export const welcomePackArchetypes: WelcomePackArchetypeV1[] = [
  createArchetype('combi_replacement', {
    label: 'Combi replacement',
    description: 'Small pack for a like-for-like on-demand hot-water boiler journey.',
    appliesToScenarioTypes: ['combi', 'combi_like_for_like'],
    appliesToSystemTypes: ['combi'],
    requiredConceptIds: ['system_fit_explanation', 'SIZ-01'],
    recommendedConceptIds: ['load_matching', 'boiler_cycling', 'weather_compensation', 'control_strategy'],
    optionalConceptIds: ['system_work_explainer', 'scope_clarity', 'operating_behaviour'],
    excludedByDefaultConceptIds: ['hp_cylinder_temperature', 'legionella_pasteurisation', 'stored_hot_water_efficiency'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 4,
    maxCoreConcepts: 6,
    maxAppendixConcepts: 2,
    cognitiveLoadBudget: 8,
    preferredAssetTypes: ['print_sheet', 'diagram', 'explainer'],
    printStrategy: 'compact',
    qrStrategy: 'minimal',
    calmFramingNotes: ['Keep the core explanation focused on fit, controls, and day-to-day use.'],
    trustRecoveryConceptIds: ['system_fit_explanation', 'scope_clarity'],
    livingWithSystemConceptIds: ['operating_behaviour', 'driving_style', 'control_strategy'],
  }),
  createArchetype('combi_to_stored_hot_water', {
    label: 'Combi to stored hot water',
    description: 'Pack for customers moving from on-demand hot water to stored hot water.',
    appliesToScenarioTypes: ['system_unvented', 'regular_unvented', 'stored_hot_water'],
    appliesToSystemTypes: ['system', 'regular'],
    requiredConceptIds: ['system_fit_explanation', 'stored_hot_water_efficiency', 'short_draw_losses'],
    recommendedConceptIds: ['cylinder_sizing', 'standing_losses', 'system_work_explainer'],
    optionalConceptIds: ['scope_clarity', 'driving_style', 'operating_behaviour'],
    excludedByDefaultConceptIds: ['hp_cylinder_temperature'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 4,
    maxCoreConcepts: 7,
    maxAppendixConcepts: 2,
    cognitiveLoadBudget: 9,
    preferredAssetTypes: ['diagram', 'print_sheet', 'explainer'],
    printStrategy: 'balanced',
    qrStrategy: 'standard',
    calmFramingNotes: ['Explain stored hot water as a service-fit choice rather than extra complexity.'],
    trustRecoveryConceptIds: ['system_fit_explanation', 'scope_clarity'],
    livingWithSystemConceptIds: ['stored_hot_water_efficiency', 'operating_behaviour', 'driving_style'],
  }),
  createArchetype('regular_or_system_boiler_upgrade', {
    label: 'Regular or system boiler upgrade',
    description: 'Pack for boiler upgrades that keep stored hot water and core distribution strategy.',
    appliesToScenarioTypes: ['system', 'system_unvented', 'regular', 'regular_unvented'],
    appliesToSystemTypes: ['system', 'regular'],
    requiredConceptIds: ['system_fit_explanation', 'system_work_explainer', 'scope_clarity'],
    recommendedConceptIds: ['weather_compensation', 'control_strategy', 'load_matching'],
    optionalConceptIds: ['stored_hot_water_efficiency', 'operating_behaviour', 'driving_style'],
    excludedByDefaultConceptIds: ['hp_cylinder_temperature'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 4,
    maxCoreConcepts: 7,
    maxAppendixConcepts: 2,
    cognitiveLoadBudget: 9,
    preferredAssetTypes: ['print_sheet', 'diagram', 'explainer'],
    printStrategy: 'balanced',
    qrStrategy: 'standard',
    calmFramingNotes: ['Keep the pack anchored to what changes now and what stays familiar.'],
    trustRecoveryConceptIds: ['system_fit_explanation', 'scope_clarity', 'system_work_explainer'],
    livingWithSystemConceptIds: ['control_strategy', 'weather_compensation', 'operating_behaviour'],
  }),
  createArchetype('heat_pump_install', {
    label: 'Heat pump install',
    description: 'Pack for a first heat-pump install with low-temperature and hot-water guidance.',
    appliesToScenarioTypes: ['ashp', 'ashp_standard'],
    appliesToSystemTypes: ['ashp'],
    requiredConceptIds: ['system_fit_explanation', 'emitter_sizing', 'flow_temperature'],
    recommendedConceptIds: ['hp_cylinder_temperature', 'legionella_pasteurisation', 'weather_compensation'],
    optionalConceptIds: ['driving_style', 'operating_behaviour', 'future_ready_pathways'],
    excludedByDefaultConceptIds: ['boiler_cycling'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 5,
    maxCoreConcepts: 8,
    maxAppendixConcepts: 3,
    cognitiveLoadBudget: 10,
    preferredAssetTypes: ['diagram', 'print_sheet', 'checklist'],
    printStrategy: 'balanced',
    qrStrategy: 'standard',
    calmFramingNotes: ['Keep low-temperature expectations calm and practical.', 'Use QR only for deeper technical context.'],
    trustRecoveryConceptIds: ['system_fit_explanation', 'scope_clarity'],
    livingWithSystemConceptIds: ['emitter_sizing', 'flow_temperature', 'hp_cylinder_temperature', 'operating_behaviour', 'driving_style'],
  }),
  createArchetype('heat_pump_ready_boiler_install', {
    label: 'Heat-pump-ready boiler install',
    description: 'Pack for boiler installs that deliberately prepare for a later low-temperature upgrade.',
    appliesToScenarioTypes: ['combi', 'system', 'regular'],
    appliesToSystemTypes: ['combi', 'system', 'regular'],
    requiredConceptIds: ['system_fit_explanation', 'weather_compensation', 'control_strategy'],
    recommendedConceptIds: ['future_ready_pathways', 'emitter_sizing', 'flow_temperature'],
    optionalConceptIds: ['system_work_explainer', 'scope_clarity'],
    excludedByDefaultConceptIds: ['hp_cylinder_temperature', 'legionella_pasteurisation'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 4,
    maxCoreConcepts: 7,
    maxAppendixConcepts: 2,
    cognitiveLoadBudget: 8,
    preferredAssetTypes: ['print_sheet', 'diagram', 'explainer'],
    printStrategy: 'balanced',
    qrStrategy: 'standard',
    calmFramingNotes: ['Focus on today’s install while showing limited future-ready choices clearly.'],
    trustRecoveryConceptIds: ['system_fit_explanation', 'future_ready_pathways'],
    livingWithSystemConceptIds: ['control_strategy', 'weather_compensation', 'operating_behaviour'],
  }),
  createArchetype('cylinder_upgrade', {
    label: 'Cylinder upgrade',
    description: 'Pack for changing cylinder strategy, sizing, or efficiency behaviour.',
    appliesToScenarioTypes: ['system_unvented', 'regular_unvented', 'ashp'],
    appliesToSystemTypes: ['system', 'regular', 'ashp'],
    requiredConceptIds: ['stored_hot_water_efficiency', 'cylinder_sizing'],
    recommendedConceptIds: ['standing_losses', 'system_work_explainer', 'scope_clarity'],
    optionalConceptIds: ['legionella_pasteurisation', 'operating_behaviour'],
    excludedByDefaultConceptIds: ['boiler_cycling'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 4,
    maxCoreConcepts: 6,
    maxAppendixConcepts: 2,
    cognitiveLoadBudget: 8,
    preferredAssetTypes: ['diagram', 'print_sheet', 'checklist'],
    printStrategy: 'compact',
    qrStrategy: 'standard',
    calmFramingNotes: ['Keep the pack practical: usable hot water, storage losses, and safety.'],
    trustRecoveryConceptIds: ['scope_clarity'],
    livingWithSystemConceptIds: ['stored_hot_water_efficiency', 'cylinder_sizing', 'operating_behaviour'],
  }),
  createArchetype('controls_upgrade', {
    label: 'Controls upgrade',
    description: 'Pack for controls-led comfort and efficiency improvements.',
    appliesToScenarioTypes: ['combi', 'system', 'regular', 'ashp'],
    appliesToSystemTypes: ['combi', 'system', 'regular', 'ashp'],
    requiredConceptIds: ['weather_compensation', 'control_strategy'],
    recommendedConceptIds: ['CON-01', 'CON-03', 'driving_style'],
    optionalConceptIds: ['operating_behaviour', 'scope_clarity'],
    excludedByDefaultConceptIds: ['hp_cylinder_temperature'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 3,
    maxCoreConcepts: 5,
    maxAppendixConcepts: 1,
    cognitiveLoadBudget: 6,
    preferredAssetTypes: ['diagram', 'print_sheet', 'explainer'],
    printStrategy: 'compact',
    qrStrategy: 'minimal',
    calmFramingNotes: ['Use one clear controls explainer and keep the rest for QR if needed.'],
    trustRecoveryConceptIds: ['scope_clarity'],
    livingWithSystemConceptIds: ['weather_compensation', 'control_strategy', 'driving_style'],
  }),
  createArchetype('water_supply_constraint', {
    label: 'Water supply constraint',
    description: 'Pack for flow, pressure, and hydraulic-limitation journeys.',
    appliesToScenarioTypes: ['combi', 'system', 'regular', 'ashp'],
    appliesToSystemTypes: ['combi', 'system', 'regular', 'ashp'],
    requiredConceptIds: ['pipework_constraint', 'flow_restriction'],
    recommendedConceptIds: ['primary_pipework_sizing', 'hydraulic_constraint', 'flow_velocity', 'pipe_bore_sizing'],
    optionalConceptIds: ['HYD-01', 'scope_clarity'],
    excludedByDefaultConceptIds: ['hp_cylinder_temperature'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 4,
    maxCoreConcepts: 6,
    maxAppendixConcepts: 2,
    cognitiveLoadBudget: 7,
    preferredAssetTypes: ['diagram', 'topology', 'animation'],
    printStrategy: 'balanced',
    qrStrategy: 'deep_dive',
    calmFramingNotes: ['Keep the core pack to pressure, flow, and what this means for comfort.'],
    trustRecoveryConceptIds: ['hydraulic_constraint', 'scope_clarity'],
    livingWithSystemConceptIds: ['flow_restriction', 'pipework_constraint'],
  }),
  createArchetype('low_temperature_radiator_upgrade', {
    label: 'Low-temperature radiator upgrade',
    description: 'Pack for emitter upgrades needed for lower flow-temperature operation.',
    appliesToScenarioTypes: ['ashp', 'system', 'regular'],
    appliesToSystemTypes: ['ashp', 'system', 'regular'],
    requiredConceptIds: ['emitter_sizing', 'flow_temperature'],
    recommendedConceptIds: ['weather_compensation', 'driving_style'],
    optionalConceptIds: ['CON-04', 'operating_behaviour'],
    excludedByDefaultConceptIds: ['stored_hot_water_efficiency'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 4,
    maxCoreConcepts: 6,
    maxAppendixConcepts: 1,
    cognitiveLoadBudget: 7,
    preferredAssetTypes: ['diagram', 'animation', 'checklist'],
    printStrategy: 'balanced',
    qrStrategy: 'standard',
    calmFramingNotes: ['Focus on comfort delivery and practical emitter changes.'],
    trustRecoveryConceptIds: ['system_fit_explanation'],
    livingWithSystemConceptIds: ['emitter_sizing', 'flow_temperature', 'driving_style'],
  }),
  createArchetype('smart_cylinder_tariff_ready', {
    label: 'Smart cylinder tariff-ready',
    description: 'Pack for storage journeys that benefit from time-of-use charging.',
    appliesToScenarioTypes: ['system_unvented', 'regular_unvented', 'ashp'],
    appliesToSystemTypes: ['system', 'regular', 'ashp'],
    requiredConceptIds: ['STR-03', 'stored_hot_water_efficiency'],
    recommendedConceptIds: ['future_ready_pathways', 'cylinder_sizing', 'operating_behaviour'],
    optionalConceptIds: ['standing_losses', 'scope_clarity'],
    excludedByDefaultConceptIds: ['boiler_cycling'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 4,
    maxCoreConcepts: 6,
    maxAppendixConcepts: 2,
    cognitiveLoadBudget: 8,
    preferredAssetTypes: ['diagram', 'explainer', 'checklist'],
    printStrategy: 'balanced',
    qrStrategy: 'deep_dive',
    calmFramingNotes: ['Treat tariffs as an optional optimisation layer, not the whole story.'],
    trustRecoveryConceptIds: ['future_ready_pathways', 'scope_clarity'],
    livingWithSystemConceptIds: ['STR-03', 'stored_hot_water_efficiency', 'operating_behaviour'],
  }),

  // ─── Golden journey archetypes ─────────────────────────────────────────────
  // These archetypes are promoted from authored golden-journey demonstrators.
  // goldenJourneyId links to the demonstrator for preview/navigation only —
  // it has no influence on recommendations or scoring.

  createArchetype('open_vented_to_sealed_unvented', {
    goldenJourneyId: 'open_vented_to_sealed_unvented',
    label: 'Tank-fed to sealed + unvented upgrade',
    description:
      'Flagship premium-comfort upgrade from tank-fed hot water to a mains-fed sealed system with unvented cylinder. Covers pressure-source vs stored-capacity differences, misconception correction, trust recovery, and safety framing.',
    appliesToScenarioTypes: ['system_unvented', 'regular_unvented'],
    appliesToSystemTypes: ['system', 'regular'],
    requiredConceptIds: ['system_fit_explanation', 'stored_hot_water_efficiency', 'short_draw_losses', 'system_work_explainer'],
    recommendedConceptIds: ['cylinder_sizing', 'standing_losses', 'scope_clarity'],
    optionalConceptIds: ['operating_behaviour', 'driving_style'],
    excludedByDefaultConceptIds: ['hp_cylinder_temperature', 'boiler_cycling'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 5,
    maxCoreConcepts: 8,
    maxAppendixConcepts: 3,
    cognitiveLoadBudget: 10,
    preferredAssetTypes: ['diagram', 'print_sheet', 'explainer'],
    printStrategy: 'balanced',
    qrStrategy: 'standard',
    calmFramingNotes: [
      'Frame the conversion as a service-fit upgrade, not extra complexity.',
      'Lead with pressure-source vs stored-capacity to defuse misconceptions early.',
      'Keep safety framing calm and factual — unvented is standard, not alarming.',
    ],
    trustRecoveryConceptIds: ['system_fit_explanation', 'scope_clarity'],
    livingWithSystemConceptIds: ['stored_hot_water_efficiency', 'operating_behaviour', 'driving_style'],
  }),

  createArchetype('regular_to_regular_unvented', {
    goldenJourneyId: 'regular_to_regular_unvented',
    label: 'Regular boiler + unvented cylinder upgrade',
    description:
      'Flagship smart-engineering path retaining the regular boiler architecture while upgrading to an unvented cylinder. Emphasises preserved system strength, realistic hot-water expectations, and low-disruption messaging.',
    appliesToScenarioTypes: ['regular_unvented'],
    appliesToSystemTypes: ['regular'],
    requiredConceptIds: ['system_fit_explanation', 'system_work_explainer', 'stored_hot_water_efficiency'],
    recommendedConceptIds: ['cylinder_sizing', 'scope_clarity', 'standing_losses'],
    optionalConceptIds: ['operating_behaviour', 'driving_style'],
    excludedByDefaultConceptIds: ['hp_cylinder_temperature', 'boiler_cycling'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 4,
    maxCoreConcepts: 7,
    maxAppendixConcepts: 2,
    cognitiveLoadBudget: 9,
    preferredAssetTypes: ['print_sheet', 'diagram', 'explainer'],
    printStrategy: 'balanced',
    qrStrategy: 'standard',
    calmFramingNotes: [
      'Keep the pack anchored to what stays the same — the familiar boiler architecture.',
      'Frame the cylinder upgrade as a targeted improvement, not a whole-system change.',
      'Set realistic hot-water expectations early to prevent day-one disappointment.',
    ],
    trustRecoveryConceptIds: ['system_fit_explanation', 'system_work_explainer'],
    livingWithSystemConceptIds: ['stored_hot_water_efficiency', 'operating_behaviour', 'driving_style'],
  }),

  createArchetype('heat_pump_reality', {
    goldenJourneyId: 'heat_pump_reality',
    label: 'Heat pump reality — trust and expectation journey',
    description:
      'Flagship educational and trust path for heat pump installs. Covers warm-not-hot emitters, steady running behaviour, compensation controls, and trust recovery for customers with prior high-temperature expectations.',
    appliesToScenarioTypes: ['ashp', 'ashp_standard'],
    appliesToSystemTypes: ['ashp'],
    requiredConceptIds: ['system_fit_explanation', 'emitter_sizing', 'flow_temperature'],
    recommendedConceptIds: ['hp_cylinder_temperature', 'legionella_pasteurisation', 'weather_compensation'],
    optionalConceptIds: ['driving_style', 'operating_behaviour', 'future_ready_pathways'],
    excludedByDefaultConceptIds: ['boiler_cycling'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 5,
    maxCoreConcepts: 8,
    maxAppendixConcepts: 3,
    cognitiveLoadBudget: 10,
    preferredAssetTypes: ['diagram', 'print_sheet', 'checklist'],
    printStrategy: 'balanced',
    qrStrategy: 'standard',
    calmFramingNotes: [
      'Open with warm-not-hot framing before any technical detail.',
      'Steady running is a feature, not a fault — establish this early.',
      'Use QR for deeper compensation and legionella context rather than front-loading.',
    ],
    trustRecoveryConceptIds: ['system_fit_explanation', 'emitter_sizing'],
    livingWithSystemConceptIds: ['emitter_sizing', 'flow_temperature', 'driving_style', 'operating_behaviour'],
  }),

  createArchetype('water_constraint_reality', {
    goldenJourneyId: 'water_constraint_reality',
    label: 'Water mains constraint — expectation management journey',
    description:
      'Flagship expectation-management path for homes where the water main limits performance, not the boiler. Covers supply boundaries, realistic simultaneous-use expectations, and calm constraint communication.',
    appliesToScenarioTypes: ['combi', 'system_unvented', 'regular_unvented'],
    appliesToSystemTypes: ['combi', 'system', 'regular'],
    requiredConceptIds: ['pipework_constraint', 'flow_restriction', 'system_fit_explanation'],
    recommendedConceptIds: ['hydraulic_constraint', 'pipe_bore_sizing', 'scope_clarity'],
    optionalConceptIds: ['primary_pipework_sizing', 'flow_velocity'],
    excludedByDefaultConceptIds: ['hp_cylinder_temperature'],
    defaultSections: DEFAULT_SECTIONS,
    maxPrintPages: 4,
    maxCoreConcepts: 7,
    maxAppendixConcepts: 2,
    cognitiveLoadBudget: 8,
    preferredAssetTypes: ['diagram', 'topology', 'animation'],
    printStrategy: 'balanced',
    qrStrategy: 'deep_dive',
    calmFramingNotes: [
      'Lead with "the mains sets the ceiling" — the boiler is not at fault.',
      'Keep overlap-expectation framing concrete and practical.',
      'QR is the right place for hydraulic deep-dives — keep the print pack calm.',
    ],
    trustRecoveryConceptIds: ['system_fit_explanation', 'hydraulic_constraint'],
    livingWithSystemConceptIds: ['flow_restriction', 'pipework_constraint', 'operating_behaviour'],
  }),
];

function includesAny(source: string[], matches: string[]): boolean {
  const sourceSet = new Set(source.map((value) => value.trim().toLowerCase()));
  return matches.some((value) => sourceSet.has(value.trim().toLowerCase()));
}

function getRecommendedScenario(input: WelcomePackComposerInputV1): ScenarioResult | undefined {
  return input.scenarios.find((scenario) => scenario.scenarioId === input.atlasDecision.recommendedScenarioId);
}

function chooseFallbackArchetype(systemType: ScenarioSystemType | undefined): WelcomePackArchetypeV1 {
  if (systemType === 'ashp') {
    return getArchetypeById('heat_pump_install');
  }
  if (systemType === 'system' || systemType === 'regular') {
    return getArchetypeById('regular_or_system_boiler_upgrade');
  }
  return getArchetypeById('combi_replacement');
}

function getArchetypeById(archetypeId: string): WelcomePackArchetypeV1 {
  const archetype = welcomePackArchetypes.find((item) => item.archetypeId === archetypeId);
  if (!archetype) {
    throw new Error(`Unknown welcome-pack archetype "${archetypeId}".`);
  }
  return archetype;
}

export function detectWelcomePackArchetype(input: WelcomePackComposerInputV1): WelcomePackArchetypeV1 {
  const scenario = getRecommendedScenario(input);
  const scenarioId = scenario?.scenarioId ?? input.atlasDecision.recommendedScenarioId;
  const systemType = scenario?.system.type;
  const concernTags = input.userConcernTags ?? [];
  const constraintTags = input.propertyConstraintTags ?? [];
  const futureUpgradeText = input.atlasDecision.futureUpgradePaths.join(' ');
  const combinedSummaryText = [
    input.customerSummary.recommendedSystemLabel,
    input.customerSummary.fitNarrative,
    input.customerSummary.hardConstraints.join(' '),
    input.customerSummary.whatThisAvoids.join(' '),
  ].join(' ').toLowerCase();

  // ─── Golden journey archetypes (checked before their generic counterparts) ──

  // heat_pump_reality beats heat_pump_install when expectation/trust tags are present
  if (
    systemType === 'ashp'
    && includesAny(concernTags, ['hot_radiator_expectation', 'heat_pump_trust', 'expectation_management'])
  ) {
    return getArchetypeById('heat_pump_reality');
  }

  // water_constraint_reality beats water_supply_constraint and combi_replacement when
  // expectation-management tags are present alongside pressure/flow constraints or a combi scenario
  if (
    includesAny(concernTags, ['water_main_limit_not_boiler_limit', 'why_not_combi', 'pressure_vs_storage'])
    && (
      includesAny(constraintTags, ['pressure', 'flow', 'hydraulic'])
      || systemType === 'combi'
      || Boolean(scenario?.physicsFlags.hydraulicLimit || scenario?.physicsFlags.pressureConstraint)
    )
  ) {
    return getArchetypeById('water_constraint_reality');
  }

  // ─── Standard hydraulic/pressure check ──────────────────────────────────────

  if (
    includesAny(constraintTags, ['pressure', 'flow', 'hydraulic'])
    || Boolean(scenario?.physicsFlags.hydraulicLimit || scenario?.physicsFlags.pressureConstraint)
  ) {
    return getArchetypeById('water_supply_constraint');
  }

  if (
    includesAny(concernTags, ['smart_tariff', 'tariff', 'time_of_use', 'storage'])
    && (systemType === 'system' || systemType === 'regular' || systemType === 'ashp')
  ) {
    return getArchetypeById('smart_cylinder_tariff_ready');
  }

  if (includesAny(concernTags, ['controls', 'weather_compensation', 'zoning', 'smart_controls'])) {
    return getArchetypeById('controls_upgrade');
  }

  // open_vented_to_sealed_unvented beats cylinder_upgrade AND combi_to_stored_hot_water
  // when open-vented/sealed conversion tags are present
  if (
    (systemType === 'system' || systemType === 'regular')
    && includesAny(concernTags, ['open_vented', 'sealed_system_conversion', 'unvented_safety_reassurance'])
  ) {
    return getArchetypeById('open_vented_to_sealed_unvented');
  }

  // regular_to_regular_unvented beats regular_or_system_boiler_upgrade AND combi_to_stored_hot_water
  // when preserved-system tags are present
  if (
    (systemType === 'system' || systemType === 'regular')
    && includesAny(concernTags, ['preserved_system_strength', 'premium_hot_water_performance', 'regular_retained'])
  ) {
    return getArchetypeById('regular_to_regular_unvented');
  }

  if (
    includesAny(concernTags, ['radiator', 'emitters', 'flow_temperature'])
    || Boolean(scenario?.physicsFlags.highTempRequired)
  ) {
    return systemType === 'ashp'
      ? getArchetypeById('heat_pump_install')
      : getArchetypeById('low_temperature_radiator_upgrade');
  }

  if (systemType === 'ashp') {
    return getArchetypeById('heat_pump_install');
  }

  if (
    systemType !== 'combi'
    && (
    includesAny(concernTags, ['cylinder', 'stored', 'hot_water'])
    || /stored hot water|cylinder|short draw|on-demand hot water option fails/.test(combinedSummaryText)
    )
  ) {
    return getArchetypeById('combi_to_stored_hot_water');
  }

  if (
    includesAny(concernTags, ['future_ready', 'heat_pump_ready'])
    || /heat pump/i.test(futureUpgradeText)
  ) {
    return getArchetypeById('heat_pump_ready_boiler_install');
  }

  if (includesAny(concernTags, ['cylinder_sizing', 'standing_losses', 'legionella'])) {
    return getArchetypeById('cylinder_upgrade');
  }

  const exactScenarioMatch = welcomePackArchetypes.find(
    (item) => item.appliesToScenarioTypes.includes(scenarioId),
  );
  if (exactScenarioMatch) {
    return exactScenarioMatch;
  }

  const systemTypeMatch = welcomePackArchetypes.find(
    (item) => systemType !== undefined && item.appliesToSystemTypes.includes(systemType),
  );
  return systemTypeMatch ?? chooseFallbackArchetype(systemType);
}
