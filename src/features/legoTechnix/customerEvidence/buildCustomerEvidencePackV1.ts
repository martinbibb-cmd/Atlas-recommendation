import type { HydraulicConfidenceReportV1, HydraulicDiagnosticV1 } from '../hydraulicConfidenceReport';
import type { DhwRecoveryMetricsV1 } from '../simulation/buildDhwRecoveryMetricsV1';
import type { LegoTechnixExplainabilityReportV1 } from '../simulation/LegoTechnixExplainabilityReportV1';
import type { ScenarioResultV1 } from '../simulation/runLegoTechnixScenarioV1';
import type { CustomerEvidenceCardV1 } from './CustomerEvidenceCardV1';
import type { CustomerEvidenceMetricV1 } from './CustomerEvidenceMetricV1';
import type { CustomerEvidencePackV1 } from './CustomerEvidencePackV1';
import type { CustomerEvidenceSectionV1 } from './CustomerEvidenceSectionV1';
import type { CustomerEvidenceTimelineV1 } from './CustomerEvidenceTimelineV1';
import type {
  CustomerEvidenceWarningCategoryV1,
  CustomerEvidenceWarningSeverityV1,
  CustomerEvidenceWarningV1,
} from './CustomerEvidenceWarningV1';
import { getCustomerConfidenceWording } from './customerEvidenceConfidenceWording';

/**
 * Minimal locked recommendation summary consumed by the evidence bridge.
 * The recommendation engine remains authoritative for selection;
 * this bridge only reads the locked label and system type — it does NOT
 * regenerate or reinterpret selection logic.
 */
export interface CustomerEvidenceLockedRecommendationSummaryV1 {
  readonly systemLabel: string;
  readonly systemType: string;
  readonly recommendationSummary: string;
}

export interface BuildCustomerEvidencePackV1Input {
  readonly lockedRecommendation: CustomerEvidenceLockedRecommendationSummaryV1;
  readonly explainabilityReport: LegoTechnixExplainabilityReportV1;
  readonly hydraulicConfidenceReport: HydraulicConfidenceReportV1;
  readonly dhwRecoveryMetrics?: DhwRecoveryMetricsV1;
  readonly scenarioResult?: ScenarioResultV1;
}

// ─── Warning mapping ─────────────────────────────────────────────────────────

interface WarningMappingEntry {
  readonly category: CustomerEvidenceWarningCategoryV1;
  readonly severity: CustomerEvidenceWarningSeverityV1;
  readonly message: string;
}

const ENGINEERING_CODE_TO_CUSTOMER_WARNING: Readonly<
  Record<string, WarningMappingEntry>
> = {
  unknown_static_head: {
    category: 'hydraulic_risk',
    severity: 'attention',
    message: 'Your system pressure details could not be fully confirmed — an engineer can verify this during installation.',
  },
  unknown_safety_markers: {
    category: 'hydraulic_risk',
    severity: 'important',
    message: 'Some safety components could not be fully confirmed and will need engineer verification before commissioning.',
  },
  missing_pipe_geometry_assumption: {
    category: 'uncertainty',
    severity: 'info',
    message: 'Some pipe dimensions were estimated rather than measured — this is common at survey stage.',
  },
  missing_pipe_geometry_unknown: {
    category: 'uncertainty',
    severity: 'attention',
    message: 'Pipe layout details require confirmation by the installing engineer.',
  },
  unknown_heat_source_modulation_range: {
    category: 'uncertainty',
    severity: 'attention',
    message: 'The heat source output range could not be fully confirmed and will be checked on the installation visit.',
  },
  low_confidence_condensing_estimate: {
    category: 'efficiency',
    severity: 'info',
    message: 'Efficiency estimates are based on system layout — actual performance may vary during the first heating season.',
  },
  missing_manufacturer_pump_head_data: {
    category: 'hydraulic_risk',
    severity: 'info',
    message: 'Circulation flow estimates use standard assumptions — your engineer can confirm flow balance during commissioning.',
  },
  scenario_velocity_warning: {
    category: 'hydraulic_risk',
    severity: 'attention',
    message: 'Flow conditions in part of your pipework may need review during commissioning checks.',
  },
  scenario_pipe_heat_loss_warning: {
    category: 'efficiency',
    severity: 'info',
    message: 'Some heat is lost through exposed pipework — insulating accessible runs can improve efficiency.',
  },
  low_temperature_emitter_shortfall: {
    category: 'comfort',
    severity: 'attention',
    message: 'Some rooms may take longer to reach full temperature — your engineer can assess radiator sizing during the visit.',
  },
  low_confidence_dhw_recovery_result: {
    category: 'hot_water',
    severity: 'attention',
    message: 'Hot water recovery estimates are based on the system layout — actual recovery times will be confirmed after installation.',
  },
  unknown_cylinder_coil_rating: {
    category: 'hot_water',
    severity: 'attention',
    message: 'The hot water coil rating was not fully confirmed — your engineer will check cylinder compatibility during the visit.',
  },
  low_temperature_emitter_output_shortfall: {
    category: 'comfort',
    severity: 'attention',
    message: 'Some emitters may produce slightly less heat at lower flow temperatures and may need adjustment during commissioning.',
  },
};

function mapEngineeringWarningToCustomer(
  diagnostic: HydraulicDiagnosticV1,
): CustomerEvidenceWarningV1 {
  const known = ENGINEERING_CODE_TO_CUSTOMER_WARNING[diagnostic.code];
  if (known) {
    return known;
  }
  return {
    category: 'uncertainty',
    severity: 'info',
    message: 'Some details require confirmation — your installer will clarify during the visit.',
  };
}

// ─── Timeline helpers ─────────────────────────────────────────────────────────

const TIMELINE_SAMPLE_INTERVAL_SECONDS = 300;

function buildTimelineSummaries(
  scenarioResult: ScenarioResultV1 | undefined,
  dhwRecoveryMetrics: DhwRecoveryMetricsV1 | undefined,
): readonly CustomerEvidenceTimelineV1[] {
  if (!scenarioResult) {
    return [];
  }

  const entries: CustomerEvidenceTimelineV1[] = [];
  let lastLabelOffsetSeconds = -1;

  for (const sample of scenarioResult.timelineSamples) {
    if (sample.offsetSeconds - lastLabelOffsetSeconds < TIMELINE_SAMPLE_INTERVAL_SECONDS) {
      continue;
    }

    const hasDrawOff =
      typeof sample.dhwDrawOffFlowLpm === 'number' && sample.dhwDrawOffFlowLpm > 0;
    const hasDhwRecovery =
      typeof sample.storedDhwRecoveryKw === 'number' && sample.storedDhwRecoveryKw > 0;
    const hasHeatingDemand =
      typeof sample.roomTemperatureC === 'number' && sample.roomTemperatureC < 20;
    const hasCondensing =
      typeof sample.sourceReturnTemperatureC === 'number' &&
      sample.sourceReturnTemperatureC < 55;

    let label: string;
    let description: string;

    if (hasDrawOff) {
      label = 'Hot water in use';
      description = 'Hot water is being drawn off from the cylinder.';
    } else if (hasDhwRecovery) {
      label = 'Cylinder recovering';
      description = 'Cylinder recovering after hot water usage.';
    } else if (hasHeatingDemand) {
      label = 'Heating stabilising';
      description = 'Heating stabilising after thermostat demand.';
    } else if (hasCondensing) {
      label = 'Efficient operation';
      description = 'Lower return temperatures improving condensing operation.';
    } else {
      label = 'System running';
      description = 'System operating normally.';
    }

    entries.push({ offsetSeconds: sample.offsetSeconds, label, description });
    lastLabelOffsetSeconds = sample.offsetSeconds;
  }

  if (dhwRecoveryMetrics?.exhaustionPoint !== undefined) {
    const exhaustionEntry = dhwRecoveryMetrics.usableHotWaterTimeline.find(
      (point) => point.exhausted,
    );
    if (exhaustionEntry) {
      entries.push({
        offsetSeconds: exhaustionEntry.offsetSeconds,
        label: 'Hot water depleted',
        description: 'Usable hot water temporarily exhausted — cylinder will recover automatically.',
      });
    }
  }

  return entries.sort((a, b) => a.offsetSeconds - b.offsetSeconds);
}

// ─── Card builders ────────────────────────────────────────────────────────────

function buildSystemBehaviourCard(
  explainabilityReport: LegoTechnixExplainabilityReportV1,
): CustomerEvidenceCardV1 {
  const systemPoints = explainabilityReport.systemSummary.points;
  const circuitPoints = explainabilityReport.activeCircuitSummary.points;

  const summary =
    systemPoints.length > 0
      ? systemPoints[0]
      : 'Your heating system has been surveyed and assessed.';

  return {
    type: 'system_behaviour_story',
    heading: 'How your current heating is set up',
    summary,
    metrics: circuitPoints.slice(0, 3).map(
      (point): CustomerEvidenceMetricV1 => ({
        label: 'Heating circuit evidence',
        value: point,
        confidenceWording: getCustomerConfidenceWording('derived'),
      }),
    ),
    warnings: [],
    confidenceWording: getCustomerConfidenceWording('derived'),
  };
}

function buildWhatAtlasFoundCard(
  explainabilityReport: LegoTechnixExplainabilityReportV1,
): CustomerEvidenceCardV1 {
  const controlPoints = explainabilityReport.controlDecisionSummary.points;
  const heatSourcePoints = explainabilityReport.heatSourceSummary.points;

  const summary =
    controlPoints.length > 0
      ? controlPoints[0]
      : 'Atlas reviewed your controls and heating setup from the survey evidence.';

  return {
    type: 'system_behaviour_story',
    heading: 'What Atlas found from your survey',
    summary,
    metrics: heatSourcePoints.slice(0, 2).map(
      (point): CustomerEvidenceMetricV1 => ({
        label: 'Heat source evidence',
        value: point,
        confidenceWording: getCustomerConfidenceWording('derived'),
      }),
    ),
    warnings: [],
    confidenceWording: getCustomerConfidenceWording('derived'),
  };
}

function buildThermalStoryCard(
  explainabilityReport: LegoTechnixExplainabilityReportV1,
  hydraulicConfidenceReport: HydraulicConfidenceReportV1,
): CustomerEvidenceCardV1 {
  const roomPoints = explainabilityReport.roomHeatingSummary.points;
  const returnPoints = explainabilityReport.returnTemperatureSummary.points;
  const condensingPoints = explainabilityReport.condensingSummary.points;

  const summary =
    roomPoints.length > 0
      ? roomPoints[0]
      : 'We modelled how your heating circuits respond through a typical day.';

  const metrics: CustomerEvidenceMetricV1[] = [];

  for (const point of returnPoints.slice(0, 2)) {
    metrics.push({
      label: 'Return temperature evidence',
      value: point,
      confidenceWording: getCustomerConfidenceWording(hydraulicConfidenceReport.overallConfidence),
    });
  }

  for (const point of condensingPoints.slice(0, 1)) {
    metrics.push({
      label: 'Condensing efficiency evidence',
      value: point,
      confidenceWording: getCustomerConfidenceWording(hydraulicConfidenceReport.overallConfidence),
    });
  }

  return {
    type: 'thermal_story',
    heading: 'How your heating performs day to day',
    summary,
    metrics,
    warnings: [],
    confidenceWording: getCustomerConfidenceWording(hydraulicConfidenceReport.overallConfidence),
  };
}

function buildHotWaterStoryCard(
  explainabilityReport: LegoTechnixExplainabilityReportV1,
  dhwRecoveryMetrics: DhwRecoveryMetricsV1 | undefined,
  hydraulicConfidenceReport: HydraulicConfidenceReportV1,
): CustomerEvidenceCardV1 {
  const dhwPoints = explainabilityReport.dhwSummary.points;

  const summary =
    dhwPoints.length > 0
      ? dhwPoints[0]
      : 'We modelled your hot water usage and recovery over time.';

  const metrics: CustomerEvidenceMetricV1[] = [];
  const confidenceWording = getCustomerConfidenceWording(
    dhwRecoveryMetrics?.recoveryConfidence ?? hydraulicConfidenceReport.overallConfidence,
  );

  if (dhwRecoveryMetrics) {
    if (typeof dhwRecoveryMetrics.showerMinutesAvailable === 'number') {
      metrics.push({
        label: 'Shower availability',
        value: dhwRecoveryMetrics.showerMinutesAvailable,
        unit: 'minutes',
        confidenceWording,
      });
    }

    if (typeof dhwRecoveryMetrics.bathFillCapacity === 'number') {
      metrics.push({
        label: 'Bath fill capacity',
        value: dhwRecoveryMetrics.bathFillCapacity,
        unit: 'litres at 40°C',
        confidenceWording,
      });
    }

    if (typeof dhwRecoveryMetrics.timeToRecoverAfterDrawOff === 'number') {
      metrics.push({
        label: 'Recovery after use',
        value: Math.round(dhwRecoveryMetrics.timeToRecoverAfterDrawOff / 60),
        unit: 'minutes',
        confidenceWording,
      });
    }

    if (typeof dhwRecoveryMetrics.recoveryRateKw === 'number') {
      metrics.push({
        label: 'Recovery rate',
        value: dhwRecoveryMetrics.recoveryRateKw.toFixed(1),
        unit: 'kW',
        confidenceWording,
      });
    }
  }

  return {
    type: 'hot_water_story',
    heading: 'How your hot water performs',
    summary,
    metrics,
    warnings: [],
    confidenceWording,
  };
}

function buildStratifiedOrMixedCard(
  dhwRecoveryMetrics: DhwRecoveryMetricsV1 | undefined,
): CustomerEvidenceCardV1 | null {
  if (!dhwRecoveryMetrics) {
    return null;
  }

  if (dhwRecoveryMetrics.stratifiedCylinderApproximation) {
    return {
      type: 'hot_water_story',
      heading: 'How your cylinder stores hot water',
      summary:
        'Your cylinder stores hot water in layers — the top section stays hottest and is used first. This means you can start a shower sooner, even while the cylinder is still recovering.',
      metrics: [],
      warnings: [],
      confidenceWording: getCustomerConfidenceWording(
        dhwRecoveryMetrics.recoveryConfidence,
      ),
    };
  }

  return {
    type: 'hot_water_story',
    heading: 'How your cylinder stores hot water',
    summary:
        'Your cylinder mixes hot water throughout its volume. Estimates for shower availability and recovery time reflect this whole-cylinder behaviour.',
    metrics: [],
    warnings: [],
    confidenceWording: getCustomerConfidenceWording(
      dhwRecoveryMetrics.recoveryConfidence,
    ),
  };
}

function buildComfortCard(
  explainabilityReport: LegoTechnixExplainabilityReportV1,
  hydraulicConfidenceReport: HydraulicConfidenceReportV1,
): CustomerEvidenceCardV1 {
  const roomPoints = explainabilityReport.roomHeatingSummary.points;

  const summary =
    roomPoints.length > 0
      ? roomPoints[0]
      : 'Room comfort levels have been estimated from your system layout.';

  const hasEmitterShortfall = hydraulicConfidenceReport.warnings.some(
    (warning) =>
      warning.code === 'low_temperature_emitter_shortfall' ||
      warning.code === 'low_temperature_emitter_output_shortfall',
  );

  const warnings: CustomerEvidenceWarningV1[] = hasEmitterShortfall
    ? [
        {
          category: 'comfort',
          severity: 'attention',
          message:
            'Some rooms may take longer to reach full temperature — your engineer can assess radiator sizing during the visit.',
        },
      ]
    : [];

  return {
    type: 'comfort_story',
    heading: 'What comfort to expect',
    summary,
    metrics: roomPoints.slice(1, 3).map(
      (point): CustomerEvidenceMetricV1 => ({
        label: 'Room comfort evidence',
        value: point,
        confidenceWording: getCustomerConfidenceWording(hydraulicConfidenceReport.overallConfidence),
      }),
    ),
    warnings,
    confidenceWording: getCustomerConfidenceWording(hydraulicConfidenceReport.overallConfidence),
  };
}

function buildEfficiencyCard(
  explainabilityReport: LegoTechnixExplainabilityReportV1,
  hydraulicConfidenceReport: HydraulicConfidenceReportV1,
): CustomerEvidenceCardV1 {
  const heatSourcePoints = explainabilityReport.heatSourceSummary.points;
  const condensingPoints = explainabilityReport.condensingSummary.points;

  const summary =
    heatSourcePoints.length > 0
      ? heatSourcePoints[0]
      : 'Efficiency observations have been derived from your system assessment.';

  return {
    type: 'efficiency_story',
    heading: 'How efficiently your system can run',
    summary,
    metrics: condensingPoints.slice(0, 2).map(
      (point): CustomerEvidenceMetricV1 => ({
        label: 'Efficiency evidence',
        value: point,
        confidenceWording: getCustomerConfidenceWording(hydraulicConfidenceReport.overallConfidence),
      }),
    ),
    warnings: [],
    confidenceWording: getCustomerConfidenceWording(hydraulicConfidenceReport.overallConfidence),
  };
}

function buildConfidenceCard(
  hydraulicConfidenceReport: HydraulicConfidenceReportV1,
): CustomerEvidenceCardV1 {
  const overallWording = getCustomerConfidenceWording(
    hydraulicConfidenceReport.overallConfidence,
  );

  const metrics: CustomerEvidenceMetricV1[] = hydraulicConfidenceReport.measuredInputs
    .slice(0, 3)
    .map(
      (input): CustomerEvidenceMetricV1 => ({
        label: input.field,
        value: 'Confirmed',
        confidenceWording: getCustomerConfidenceWording(input.confidence),
      }),
    );

  for (const input of hydraulicConfidenceReport.manufacturerInputs.slice(0, 2)) {
    metrics.push({
      label: input.field,
      value: 'Manufacturer data',
      confidenceWording: getCustomerConfidenceWording(input.confidence),
    });
  }

  return {
    type: 'confidence_story',
    heading: 'What we measured',
    summary: 'These details were measured on site or taken from confirmed manufacturer records.',
    metrics,
    warnings: [],
    confidenceWording: overallWording,
  };
}

function buildAssumptionCard(
  hydraulicConfidenceReport: HydraulicConfidenceReportV1,
): CustomerEvidenceCardV1 {
  const assumptions = hydraulicConfidenceReport.assumptions;

  const summary =
    assumptions.length === 0
      ? 'No key assumptions were needed for this home.'
      : `${assumptions.length} assumption${assumptions.length > 1 ? 's were' : ' was'} used where full access or data was not available.`;

  const metrics: CustomerEvidenceMetricV1[] = assumptions.slice(0, 4).map(
    (assumption): CustomerEvidenceMetricV1 => ({
      label: 'Assumption',
      value: getCustomerConfidenceWording(assumption.confidence),
      confidenceWording: getCustomerConfidenceWording(assumption.confidence),
    }),
  );

  return {
    type: 'assumption_story',
    heading: 'What we estimated',
    summary,
    metrics,
    warnings: [],
    confidenceWording:
      assumptions.length > 0
        ? getCustomerConfidenceWording('assumed')
        : getCustomerConfidenceWording(hydraulicConfidenceReport.overallConfidence),
  };
}

function buildEngineerConfirmationCard(
  hydraulicConfidenceReport: HydraulicConfidenceReportV1,
): CustomerEvidenceCardV1 {
  const unknowns = hydraulicConfidenceReport.unknowns;

  const summary =
    unknowns.length === 0
      ? 'No items require specific engineer confirmation beyond standard commissioning checks.'
      : `${unknowns.length} item${unknowns.length > 1 ? 's' : ''} will need confirmation from your engineer before or during installation.`;

  const metrics: CustomerEvidenceMetricV1[] = unknowns.slice(0, 4).map(
    (unknown): CustomerEvidenceMetricV1 => ({
      label: 'Needs confirmation',
      value: getCustomerConfidenceWording(unknown.confidence),
      confidenceWording: getCustomerConfidenceWording('unknown'),
    }),
  );

  return {
    type: 'assumption_story',
    heading: 'What the installer will confirm',
    summary,
    metrics,
    warnings: unknowns.length > 0
      ? [
        {
          category: 'uncertainty',
          severity: 'info',
          message: 'These are routine checks to finalise settings and confirm fit on site.',
        },
      ]
      : [],
    confidenceWording: getCustomerConfidenceWording('unknown'),
  };
}

function buildWarningCard(
  explainabilityReport: LegoTechnixExplainabilityReportV1,
  hydraulicConfidenceReport: HydraulicConfidenceReportV1,
): CustomerEvidenceCardV1 {
  const customerWarnings = hydraulicConfidenceReport.warnings.map(
    mapEngineeringWarningToCustomer,
  );

  const warningPoints = explainabilityReport.warningsSummary.points;

  const summary =
    customerWarnings.length === 0 && warningPoints.length === 0
      ? 'No specific observations require your attention at this stage.'
      : 'The following observations have been noted from the system assessment.';

  return {
    type: 'warning_story',
    heading: 'Points to keep in mind',
    summary,
    metrics: [],
    warnings: customerWarnings.slice(0, 6),
    confidenceWording:
      customerWarnings.length > 0 ? getCustomerConfidenceWording('estimated') : undefined,
  };
}

function buildSafetyCard(
  hydraulicConfidenceReport: HydraulicConfidenceReportV1,
): CustomerEvidenceCardV1 {
  const safetyWarnings = hydraulicConfidenceReport.warnings
    .filter(
      (warning) =>
        warning.code === 'unknown_safety_markers' ||
        warning.code === 'unknown_static_head',
    )
    .map(mapEngineeringWarningToCustomer);

  const summary =
    safetyWarnings.length === 0
      ? 'No specific safety observations were noted during this assessment.'
      : 'Safety-related observations have been noted and will be reviewed by your engineer.';

  return {
    type: 'warning_story',
    heading: 'Safety and protection checks',
    summary,
    metrics: [],
    warnings: safetyWarnings,
    confidenceWording:
      safetyWarnings.length > 0 ? getCustomerConfidenceWording('unknown') : undefined,
  };
}

function buildFutureFlexibilityCard(
  explainabilityReport: LegoTechnixExplainabilityReportV1,
): CustomerEvidenceCardV1 {
  const systemPoints = explainabilityReport.systemSummary.points;

  return {
    type: 'system_behaviour_story',
    heading: 'Options for future upgrades',
    summary:
      'Your system has been assessed for compatibility with future upgrades. Specific upgrade readiness will be confirmed with your installer.',
    metrics: systemPoints.slice(0, 2).map(
      (point): CustomerEvidenceMetricV1 => ({
        label: 'System characteristic',
        value: point,
        confidenceWording: getCustomerConfidenceWording('derived'),
      }),
    ),
    warnings: [],
    confidenceWording: getCustomerConfidenceWording('derived'),
  };
}

function buildTimelineCard(
  heading: string,
  summary: string,
  timelineEntries: readonly CustomerEvidenceTimelineV1[],
  confidenceWording?: string,
): CustomerEvidenceCardV1 | null {
  if (timelineEntries.length === 0) {
    return null;
  }

  return {
    type: 'timeline_story',
    heading,
    summary,
    metrics: [],
    warnings: [],
    confidenceWording,
    timelineEntries,
  };
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildSection(
  id: CustomerEvidenceSectionV1['id'],
  heading: string,
  summary: string,
  cards: readonly CustomerEvidenceCardV1[],
  warnings: readonly CustomerEvidenceWarningV1[],
  timelineSummaries: readonly CustomerEvidenceTimelineV1[],
): CustomerEvidenceSectionV1 {
  return { id, heading, summary, cards, warnings, timelineSummaries };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Builds a CustomerEvidencePackV1 from LegoTechnix explainability/projection outputs.
 *
 * Authority chain:
 * - Recommendation engine owns system selection — only a locked summary is consumed here.
 * - LegoTechnix owns all physics/simulation/projection outputs.
 * - This builder only assembles customer-safe evidence payloads; it performs NO physics
 *   calculations and does NOT reinterpret recommendation logic.
 */
export function buildCustomerEvidencePackV1(
  input: BuildCustomerEvidencePackV1Input,
): CustomerEvidencePackV1 {
  const {
    lockedRecommendation,
    explainabilityReport,
    hydraulicConfidenceReport,
    dhwRecoveryMetrics,
    scenarioResult,
  } = input;

  const timelineSummaries = buildTimelineSummaries(scenarioResult, dhwRecoveryMetrics);

  const allCustomerWarnings: CustomerEvidenceWarningV1[] =
    hydraulicConfidenceReport.warnings.map(mapEngineeringWarningToCustomer);

  const importantWarnings = allCustomerWarnings.filter(
    (warning) => warning.severity === 'important',
  );

  const comfortWarnings = allCustomerWarnings.filter(
    (warning) => warning.category === 'comfort',
  );

  const hotWaterWarnings = allCustomerWarnings.filter(
    (warning) => warning.category === 'hot_water',
  );

  const efficiencyWarnings = allCustomerWarnings.filter(
    (warning) => warning.category === 'efficiency',
  );

  const hotWaterCards: CustomerEvidenceCardV1[] = [
    buildHotWaterStoryCard(explainabilityReport, dhwRecoveryMetrics, hydraulicConfidenceReport),
  ];

  const stratifiedCard = buildStratifiedOrMixedCard(dhwRecoveryMetrics);
  if (stratifiedCard) {
    hotWaterCards.push(stratifiedCard);
  }

  const heatingTimelineEntries = timelineSummaries.filter(
    (entry) =>
      entry.label === 'Heating stabilising' || entry.label === 'Efficient operation',
  );
  const hotWaterTimelineEntries = timelineSummaries.filter(
    (entry) =>
      entry.label === 'Hot water in use' ||
      entry.label === 'Cylinder recovering' ||
      entry.label === 'Hot water depleted',
  );

  const heatingTimelineCard = buildTimelineCard(
    'Heating timeline',
    'Key moments from the heating simulation.',
    heatingTimelineEntries,
    getCustomerConfidenceWording(hydraulicConfidenceReport.overallConfidence),
  );

  const hotWaterTimelineCard = buildTimelineCard(
    'Hot water timeline',
    'Key moments from the hot-water recovery timeline.',
    hotWaterTimelineEntries,
    getCustomerConfidenceWording(
      dhwRecoveryMetrics?.recoveryConfidence ?? hydraulicConfidenceReport.overallConfidence,
    ),
  );
  if (hotWaterTimelineCard) {
    hotWaterCards.push(hotWaterTimelineCard);
  }

  const heatingCards: CustomerEvidenceCardV1[] = [
    buildThermalStoryCard(explainabilityReport, hydraulicConfidenceReport),
  ];
  if (heatingTimelineCard) {
    heatingCards.push(heatingTimelineCard);
  }

  const sections: CustomerEvidenceSectionV1[] = [
    buildSection(
      'home_understanding',
      'Your home and current heating setup',
      'A clear overview of how your current system is configured and how it currently operates.',
      [buildSystemBehaviourCard(explainabilityReport)],
      [],
      [],
    ),
    buildSection(
      'what_atlas_found',
      'What Atlas found',
      'The main findings Atlas identified from your survey and system evidence.',
      [
        buildWhatAtlasFoundCard(explainabilityReport),
        buildWarningCard(explainabilityReport, hydraulicConfidenceReport),
      ],
      importantWarnings,
      [],
    ),
    buildSection(
      'heating_behaviour',
      'How your heating runs',
      'Evidence from Atlas simulations showing how your heating responds through the day.',
      heatingCards,
      [],
      heatingTimelineEntries,
    ),
    buildSection(
      'hot_water_behaviour',
      'How your hot water runs',
      'Evidence from Atlas simulations showing expected hot water use and recovery.',
      hotWaterCards,
      hotWaterWarnings,
      hotWaterTimelineEntries,
    ),
    buildSection(
      'comfort_expectations',
      'What comfort to expect',
      'What this setup means for warmth, heat-up speed, and day-to-day comfort in your rooms.',
      [buildComfortCard(explainabilityReport, hydraulicConfidenceReport)],
      comfortWarnings,
      [],
    ),
    buildSection(
      'energy_efficiency',
      'Energy use and efficiency',
      'Evidence on how efficiently your system can run based on layout and simulation outputs.',
      [buildEfficiencyCard(explainabilityReport, hydraulicConfidenceReport)],
      efficiencyWarnings,
      [],
    ),
    buildSection(
      'confidence_and_assumptions',
      'How certain each part is',
      'We separate what we measured, what we estimated, and what still needs installer confirmation.',
      [buildConfidenceCard(hydraulicConfidenceReport), buildAssumptionCard(hydraulicConfidenceReport)],
      [],
      [],
    ),
    buildSection(
      'engineer_confirmation',
      'What the installer will confirm',
      'Routine on-site checks that finalise settings and verify any remaining unknowns.',
      [buildEngineerConfirmationCard(hydraulicConfidenceReport)],
      [],
      [],
    ),
    buildSection(
      'future_flexibility',
      'Future options',
      'How this setup supports practical future upgrades when you decide to make changes.',
      [buildFutureFlexibilityCard(explainabilityReport)],
      [],
      [],
    ),
    buildSection(
      'safety_protection',
      'Safety and protection',
      'Safety-related checks identified from survey evidence and simulation context.',
      [buildSafetyCard(hydraulicConfidenceReport)],
      allCustomerWarnings.filter((warning) => warning.category === 'hydraulic_risk'),
      [],
    ),
  ];

  return {
    schemaVersion: '1.0',
    systemLabel: lockedRecommendation.systemLabel,
    systemType: lockedRecommendation.systemType,
    recommendationSummary: lockedRecommendation.recommendationSummary,
    sections,
  };
}
