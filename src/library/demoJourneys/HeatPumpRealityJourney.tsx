import {
  AnalogyCard,
  CalmSection,
  ConceptDivider,
  EducationalCard,
  PrintSafePanel,
  SafetyNoticeCard,
  TrustRecoveryCard,
  WhatToExpectCard,
  type EducationalMotionMode,
} from '../ui';
import { CustomerConfusionChecklist } from './CustomerConfusionChecklist';
import { JourneyComparisonPanel } from './JourneyComparisonPanel';
import {
  extractMeaning,
  extractNotice,
  getMotionAttribute,
  getPrimaryAnalogy,
  getRequiredContent,
} from './journeyHelpers';
import { buildEducationalSequence, educationalSequenceRules } from '../sequencing';

const controlContent = getRequiredContent('CON-01');
const safetyContent = getRequiredContent('HYD-02');

// Golden journey authored content
const hotRadiatorContent = getRequiredContent('hot_radiator_expectation');
const flowTempLivingContent = getRequiredContent('flow_temperature_living_with_it');
const defrostContent = getRequiredContent('heat_pump_defrost_expectation');
const outdoorUnitContent = getRequiredContent('outdoor_unit_winter_care');
const radiatorClearanceContent = getRequiredContent('radiator_clearance_and_convection');

const controlAnalogy = getPrimaryAnalogy(controlContent);

export interface HeatPumpRealityJourneyProps {
  motionMode?: EducationalMotionMode;
}

export function HeatPumpRealityJourney({
  motionMode = 'system',
}: HeatPumpRealityJourneyProps) {
  const motionAttribute = getMotionAttribute(motionMode);

  return (
    <section
      className="atlas-edu-ui atlas-edu-demo"
      aria-labelledby="heat-pump-reality-journey-title"
      data-motion={motionAttribute}
    >
      <h2 id="heat-pump-reality-journey-title" className="atlas-edu-demo__heading">
        Heat pump reality journey
      </h2>
      <p className="atlas-edu-demo__intro">
        This journey builds trust by explaining how low-temperature comfort feels in daily life, including normal sounds, defrost periods, and steady control behaviour.
      </p>

      <CalmSection
        title="Calm summary and misconception correction"
        intro="Lead with comfort stability and daily feel before discussing technical detail."
        headingLevel={3}
      >
        <EducationalCard
          title={hotRadiatorContent.title}
          summary={hotRadiatorContent.plainEnglishSummary}
          ariaLabel="Heat pump calm summary"
          eyebrow="Calm summary"
          headingLevel={4}
          misconceptionWarning={{
            misconception: hotRadiatorContent.commonMisunderstanding,
            reality: 'Reality: stable low-temperature running can match heat loss and improve comfort consistency over the day.',
          }}
          whatYouMayNotice={{
            notice: extractNotice(hotRadiatorContent.customerExplanation),
            normalBecause: extractMeaning(hotRadiatorContent.customerExplanation),
          }}
        />
      </CalmSection>

      <ConceptDivider label="Daily experience" />

      <CalmSection
        title="What you may notice and living guidance"
        intro="Explain continuous running, weather compensation, and why frequent manual tweaking can reduce performance."
        headingLevel={3}
      >
        <WhatToExpectCard
          title={defrostContent.title}
          notice={extractNotice(defrostContent.customerExplanation)}
          normalBecause={extractMeaning(defrostContent.customerExplanation)}
          ariaLabel="Heat pump defrost expectation"
          headingLevel={4}
        />
        <WhatToExpectCard
          title={flowTempLivingContent.title}
          notice={extractNotice(flowTempLivingContent.customerExplanation)}
          normalBecause={extractMeaning(flowTempLivingContent.customerExplanation)}
          ariaLabel="Heat pump flow temperature living guidance"
          headingLevel={4}
        />
        <AnalogyCard
          title={controlAnalogy.title}
          analogy={controlAnalogy.explanation}
          whereItWorks={controlAnalogy.whereItWorks}
          whereItBreaks={controlAnalogy.whereItBreaks}
          ariaLabel="Heat pump analogy"
          headingLevel={4}
        />
      </CalmSection>

      <ConceptDivider label="Safety and trust" />

      <CalmSection
        title="Safety notice and trust recovery"
        intro="Use trust-recovery copy to prevent normal commissioning behaviour being misread as failure."
        headingLevel={3}
      >
        <SafetyNoticeCard
          title="Pressure and stability checks during early operation"
          message={safetyContent.printSummary}
          whatToDoNext="Avoid repeated manual pressure top-ups. If pressure loss repeats, request a system check."
          ariaLabel="Heat pump safety"
          headingLevel={4}
        />
        <TrustRecoveryCard
          title="If comfort feels odd after a weather change"
          thisCanHappen="A sudden weather shift can make yesterday’s indoor feel different while controls adapt."
          whatItMeans="The system is adjusting flow temperature to outdoor conditions, not ignoring your comfort target."
          whatToDoNext="Hold settings steady for one full day, then request one small evidence-led control adjustment if needed."
          ariaLabel="Heat pump trust recovery"
          headingLevel={4}
        />
      </CalmSection>

      <ConceptDivider label="Print and deeper detail" />

      <CalmSection
        title="Print-safe handover and deeper detail"
        intro="Provide concise print actions first, then offer optional depth for customers who want to understand more."
        headingLevel={3}
      >
        <PrintSafePanel
          title="Living-with-system summary"
          intro={hotRadiatorContent.printSummary}
          ariaLabel="Heat pump print-safe"
          headingLevel={4}
        >
          <EducationalCard
            title="QR and deeper-detail follow-up"
            summary="Use these optional deep dives to support learning without overwhelming day-one handover."
            ariaLabel="Heat pump QR details"
            eyebrow="Deeper detail"
            headingLevel={5}
            footer={(
              <ul>
                <li>{hotRadiatorContent.qrDeepDiveTitle}</li>
                <li>{defrostContent.qrDeepDiveTitle}</li>
                <li>{flowTempLivingContent.qrDeepDiveTitle}</li>
                <li>{outdoorUnitContent.qrDeepDiveTitle}</li>
                <li>{radiatorClearanceContent.qrDeepDiveTitle}</li>
              </ul>
            )}
          />
        </PrintSafePanel>
      </CalmSection>

      <ConceptDivider label="Confusion risks and accessibility" />

      <CalmSection
        title="Customer confusion checklist"
        intro="Check these assumptions before sign-off so expectation gaps do not become trust failures."
        headingLevel={3}
      >
        <CustomerConfusionChecklist
          journeyLabel="Heat pump reality"
          confusionRisks={[
            'Warm radiators mean poor heating performance.',
            'Changing settings repeatedly speeds up comfort correction.',
          ]}
          assumptions={[
            'Users understand that steady operation is intentional.',
            'Customers can distinguish normal defrost events from faults.',
          ]}
          reinforcements={[
            'Continuous low-temperature running is often the efficient comfort path.',
            'One measured adjustment beats frequent manual intervention.',
          ]}
          headingLevel={4}
        />
        <JourneyComparisonPanel headingLevel={4} />
      </CalmSection>
    </section>
  );
}

export function getHeatPumpRealityJourneyParagraphs(): string[] {
  return [
    'This journey builds trust by explaining how low-temperature comfort feels in daily life, including normal sounds, defrost periods, and steady control behaviour.',
    'Lead with comfort stability and daily feel before discussing technical detail.',
    hotRadiatorContent.plainEnglishSummary,
    hotRadiatorContent.commonMisunderstanding,
    extractNotice(hotRadiatorContent.customerExplanation),
    extractMeaning(hotRadiatorContent.customerExplanation),
    extractNotice(defrostContent.customerExplanation),
    extractMeaning(defrostContent.customerExplanation),
    extractNotice(flowTempLivingContent.customerExplanation),
    extractMeaning(flowTempLivingContent.customerExplanation),
    safetyContent.printSummary,
    'Avoid repeated manual pressure top-ups. If pressure loss repeats, request a system check.',
    hotRadiatorContent.printSummary,
    defrostContent.printSummary,
    outdoorUnitContent.printSummary,
    'Check these assumptions before sign-off so expectation gaps do not become trust failures.',
  ];
}

/**
 * Returns the sequencing plan for this journey.
 * Shows how the engine orders concepts, which are deferred, and any pacing warnings.
 */
export function getHeatPumpRealityJourneySequencingPlan() {
  return buildEducationalSequence({
    selectedConceptIds: [
      'system_fit_explanation',
      'hot_radiator_expectation',
      'heat_pump_defrost_expectation',
      'flow_temperature_living_with_it',
      'outdoor_unit_winter_care',
      'radiator_clearance_and_convection',
      'emitter_sizing',
      'flow_temperature',
      'operating_behaviour',
      'driving_style',
      'control_strategy',
      'boiler_cycling',
      'weather_compensation',
      'hp_cylinder_temperature',
    ],
    sequenceRules: educationalSequenceRules,
    archetypeId: 'heat_pump_reality',
  });
}
