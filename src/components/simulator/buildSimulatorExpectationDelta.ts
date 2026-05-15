import type { SimulatorSystemChoice } from '../../explainers/lego/simulator/useSystemDiagramPlayback';
import { buildExpectationDeltas, getContentByConceptId } from '../../library/content';
import type { LivingExperiencePatternV1 } from '../../library/content/LivingExperiencePatternV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';

type SimulatorExpectationTarget = SimulatorSystemChoice | 'stored_water';

export interface SimulatorExpectationDelta {
  mode: 'stored_hot_water' | 'heat_pump' | 'water_constraint';
  eyebrow: string;
  heading: string;
  currentExperience: string;
  futureExperience: string;
  whatChanges: string;
  whatStaysFamiliar: string;
  reassurance: string;
}

const MIN_DYNAMIC_MAINS_PRESSURE_BAR = 1.5;
const MIN_DYNAMIC_MAINS_FLOW_LPM = 10;
const MIN_PRIMARY_PIPE_DIAMETER_MM = 22;

const BOILER_BURST_PATTERN: LivingExperiencePatternV1 = {
  whatYouMayNotice: 'Radiators can feel very hot for shorter bursts.',
  whatThisMeans: 'High-temperature boiler operation often works in short on-off cycles.',
  whatStaysFamiliar: 'Your comfort target in each room remains the same.',
  whatChanges: 'Heat is delivered in peaks rather than steady low-temperature periods.',
  reassurance: 'This is a common boiler pattern and not automatically a fault.',
  commonMisunderstanding: 'Very hot radiators are always needed for comfort.',
  dailyLifeEffect: 'Rooms can swing more between heating peaks and off periods.',
  analogyOptions: [{ title: 'Boiler burst pattern', explanation: 'Short hotter bursts can still heat the home.' }],
  printSummary: 'Boiler comfort is often delivered through shorter hotter bursts.',
};

function buildBaseDelta(
  category: 'hot_water' | 'radiators',
  currentSystem: string,
  recommendedSystem: string,
  current?: LivingExperiencePatternV1,
  future?: LivingExperiencePatternV1,
) {
  return buildExpectationDeltas({
    currentSystem,
    recommendedSystem,
    livingExperiencePatterns: {
      [category]: {
        current,
        future,
      },
    },
  })[0];
}

function isStoredHotWaterChoice(systemChoice: SimulatorExpectationTarget): boolean {
  return systemChoice === 'stored_water'
    || systemChoice === 'unvented'
    || systemChoice === 'open_vented'
    || systemChoice === 'mixergy';
}

function isWaterConstraintJourney(surveyData: FullSurveyModelV1): boolean {
  return (surveyData.dynamicMainsPressure ?? Number.POSITIVE_INFINITY) < MIN_DYNAMIC_MAINS_PRESSURE_BAR
    || (surveyData.mainsDynamicFlowLpm ?? Number.POSITIVE_INFINITY) < MIN_DYNAMIC_MAINS_FLOW_LPM
    || (surveyData.primaryPipeDiameter ?? Number.POSITIVE_INFINITY) <= MIN_PRIMARY_PIPE_DIAMETER_MM;
}

export function buildSimulatorExpectationDelta(
  currentSystemChoice: SimulatorSystemChoice,
  activeSystemChoice: SimulatorExpectationTarget,
  surveyData: FullSurveyModelV1,
): SimulatorExpectationDelta | null {
  if (activeSystemChoice === 'heat_pump') {
    const radiatorPattern = getContentByConceptId('hot_radiator_expectation')?.livingExperiencePattern;
    const routinePattern = getContentByConceptId('flow_temperature_living_with_it')?.livingExperiencePattern;
    const delta = buildBaseDelta(
      'radiators',
      'boiler_high_temperature',
      'heat_pump_low_temperature',
      BOILER_BURST_PATTERN,
      radiatorPattern,
    );
    if (!delta || !radiatorPattern || !routinePattern) {
      return null;
    }
    return {
      mode: 'heat_pump',
      eyebrow: 'Radiators and daily routine',
      heading: 'What changes in day-to-day heating',
      currentExperience: delta.currentExperience,
      futureExperience: delta.futureExperience,
      whatChanges: routinePattern.whatChanges ?? delta.adaptationGuidance,
      whatStaysFamiliar: routinePattern.whatStaysFamiliar ?? delta.reassurance,
      reassurance: radiatorPattern.reassurance ?? routinePattern.reassurance ?? delta.reassurance,
    };
  }

  if (!isStoredHotWaterChoice(activeSystemChoice) || currentSystemChoice !== 'combi') {
    return null;
  }

  const currentPattern = getContentByConceptId('why_not_combi')?.livingExperiencePattern;
  const futurePattern = isWaterConstraintJourney(surveyData)
    ? getContentByConceptId('pressure_vs_storage')?.livingExperiencePattern
    : getContentByConceptId('premium_hot_water_performance')?.livingExperiencePattern;
  const delta = buildBaseDelta(
    'hot_water',
    'combi_on_demand',
    isWaterConstraintJourney(surveyData) ? 'stored_or_constraint_aware_path' : 'stored_hot_water',
    currentPattern,
    futurePattern,
  );
  if (!delta || !futurePattern) {
    return null;
  }

  return {
    mode: isWaterConstraintJourney(surveyData) ? 'water_constraint' : 'stored_hot_water',
    eyebrow: isWaterConstraintJourney(surveyData) ? 'Hot water pressure and flow' : 'Hot water and recovery',
    heading: isWaterConstraintJourney(surveyData)
      ? 'What pressure and flow mean in daily use'
      : 'What changes in daily hot-water use',
    currentExperience: delta.currentExperience,
    futureExperience: delta.futureExperience,
    whatChanges: futurePattern.whatChanges ?? delta.adaptationGuidance,
    whatStaysFamiliar: futurePattern.whatStaysFamiliar ?? delta.reassurance,
    reassurance: futurePattern.reassurance ?? delta.reassurance,
  };
}
