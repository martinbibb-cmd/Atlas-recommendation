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

const pressureContent = getRequiredContent('HYD-02');
const zoningContent = getRequiredContent('CON-02');
const sizingContent = getRequiredContent('SIZ-01');

const pressureAnalogy = getPrimaryAnalogy(pressureContent);

export interface WaterConstraintJourneyProps {
  motionMode?: EducationalMotionMode;
}

export function WaterConstraintJourney({
  motionMode = 'system',
}: WaterConstraintJourneyProps) {
  const motionAttribute = getMotionAttribute(motionMode);

  return (
    <section
      className="atlas-edu-ui atlas-edu-demo"
      aria-labelledby="water-constraint-journey-title"
      data-motion={motionAttribute}
    >
      <h2 id="water-constraint-journey-title" className="atlas-edu-demo__heading">
        Water constraints and hydraulic reality journey
      </h2>
      <p className="atlas-edu-demo__intro">
        This expectation-management journey explains where mains limitations and flow constraints set hard boundaries that no installer promise can bypass.
      </p>

      <CalmSection
        title="Calm summary and misconception correction"
        intro="Separate what Atlas can optimise from what supply physics still limits."
        headingLevel={3}
      >
        <EducationalCard
          title="Atlas can optimise design, but cannot break supply limits"
          summary="Pressure source, pipework restrictions, and simultaneous demand all shape outcomes, so clear limits protect trust and reduce blame."
          ariaLabel="Water constraint calm summary"
          eyebrow="Calm summary"
          headingLevel={4}
          misconceptionWarning={{
            misconception: 'Common misconception: any equipment upgrade can fully overcome weak incoming supply conditions.',
            reality:
              'Reality: improvements can help, but flow-limited and supply-limited constraints remain governing factors.',
          }}
          whatYouMayNotice={{
            notice: extractNotice(pressureContent.customerExplanation),
            normalBecause: extractMeaning(pressureContent.customerExplanation),
          }}
        />
      </CalmSection>

      <ConceptDivider label="Daily experience" />

      <CalmSection
        title="What you may notice and living guidance"
        intro="Set realistic expectations for overlap use and peak demand windows."
        headingLevel={3}
      >
        <WhatToExpectCard
          title="What customers may notice under constraints"
          notice="Outlet strength can drop when multiple points run together or when upstream restrictions reduce available flow."
          normalBecause="Hydraulic constraints are shared across the property, so peak overlap can exceed practical available supply."
          ariaLabel="Water constraint what to expect"
          headingLevel={4}
        />
        <AnalogyCard
          title={pressureAnalogy.title}
          analogy={pressureAnalogy.explanation}
          whereItWorks={pressureAnalogy.whereItWorks}
          whereItBreaks={pressureAnalogy.whereItBreaks}
          ariaLabel="Water constraint analogy"
          headingLevel={4}
        />
      </CalmSection>

      <ConceptDivider label="Safety and trust" />

      <CalmSection
        title="Safety notice and trust recovery"
        intro="Use calm language that protects installer trust while still naming real limits."
        headingLevel={3}
      >
        <SafetyNoticeCard
          title="Pressure top-up and stability safety"
          message={pressureContent.safetyNotice ?? pressureContent.printSummary}
          whatToDoNext="Do not keep topping up pressure repeatedly. If loss repeats, request a fault check."
          ariaLabel="Water constraint safety"
          headingLevel={4}
        />
        <TrustRecoveryCard
          title="If users worry the install has failed"
          thisCanHappen="A customer may compare a single high-demand moment against a best-case expectation from sales language."
          whatItMeans="The observed drop can reflect supply boundary conditions, not installer error."
          whatToDoNext="Revisit measured supply evidence, explain the limit calmly, and agree practical usage patterns for peak periods."
          ariaLabel="Water constraint trust recovery"
          headingLevel={4}
        />
      </CalmSection>

      <ConceptDivider label="Print and deeper detail" />

      <CalmSection
        title="Print-safe handover and deeper detail"
        intro="Give short, non-defensive wording that clarifies what can and cannot be solved."
        headingLevel={3}
      >
        <PrintSafePanel
          title="Constraint communication summary"
          intro={sizingContent.printSummary}
          ariaLabel="Water constraint print-safe"
          headingLevel={4}
        >
          <EducationalCard
            title="QR and deeper-detail follow-up"
            summary="These deep dives help customers validate boundaries without feeling dismissed."
            ariaLabel="Water constraint QR details"
            eyebrow="Deeper detail"
            headingLevel={5}
            footer={(
              <ul>
                <li>{pressureContent.qrDeepDiveTitle}</li>
                <li>{zoningContent.qrDeepDiveTitle}</li>
                <li>{sizingContent.qrDeepDiveTitle}</li>
              </ul>
            )}
          />
        </PrintSafePanel>
      </CalmSection>

      <ConceptDivider label="Confusion risks and accessibility" />

      <CalmSection
        title="Customer confusion checklist"
        intro="Use this checklist before close-out to prevent expectation drift."
        headingLevel={3}
      >
        <CustomerConfusionChecklist
          journeyLabel="Water constraints"
          confusionRisks={[
            'Any upgraded appliance can guarantee full overlap performance at every outlet.',
            'Constraint messaging means the installer is avoiding responsibility.',
          ]}
          assumptions={[
            'Measured mains and internal flow evidence was shared clearly with the customer.',
            'Users understand peak-demand trade-offs for their home pattern.',
          ]}
          reinforcements={[
            'Atlas clarifies limits early so outcomes remain realistic and trusted.',
            'Calm expectation setting protects both customer confidence and installer credibility.',
          ]}
          headingLevel={4}
        />
        <JourneyComparisonPanel headingLevel={4} />
      </CalmSection>
    </section>
  );
}

export function getWaterConstraintJourneyParagraphs(): string[] {
  return [
    'This expectation-management journey explains where mains limitations and flow constraints set hard boundaries that no installer promise can bypass.',
    'Separate what Atlas can optimise from what supply physics still limits.',
    'Pressure source, pipework restrictions, and simultaneous demand all shape outcomes, so clear limits protect trust and reduce blame.',
    'Common misconception: any equipment upgrade can fully overcome weak incoming supply conditions.',
    'Reality: improvements can help, but flow-limited and supply-limited constraints remain governing factors.',
    extractNotice(pressureContent.customerExplanation),
    extractMeaning(pressureContent.customerExplanation),
    'Set realistic expectations for overlap use and peak demand windows.',
    'Outlet strength can drop when multiple points run together or when upstream restrictions reduce available flow.',
    'Hydraulic constraints are shared across the property, so peak overlap can exceed practical available supply.',
    'Use calm language that protects installer trust while still naming real limits.',
    pressureContent.safetyNotice ?? pressureContent.printSummary,
    'Do not keep topping up pressure repeatedly. If loss repeats, request a fault check.',
    'A customer may compare a single high-demand moment against a best-case expectation from sales language.',
    'The observed drop can reflect supply boundary conditions, not installer error.',
    'Revisit measured supply evidence, explain the limit calmly, and agree practical usage patterns for peak periods.',
    'Give short, non-defensive wording that clarifies what can and cannot be solved.',
    sizingContent.printSummary,
    'These deep dives help customers validate boundaries without feeling dismissed.',
    'Use this checklist before close-out to prevent expectation drift.',
  ];
}

/**
 * Returns the sequencing plan for this journey.
 * Shows how the engine orders concepts, which are deferred, and any pacing warnings.
 */
export function getWaterConstraintJourneySequencingPlan() {
  return buildEducationalSequence({
    selectedConceptIds: [
      'system_fit_explanation',
      'flow_restriction',
      'pipework_constraint',
      'operating_behaviour',
      'load_matching',
      'scope_clarity',
    ],
    sequenceRules: educationalSequenceRules,
    archetypeId: 'water_constraint_reality',
  });
}
