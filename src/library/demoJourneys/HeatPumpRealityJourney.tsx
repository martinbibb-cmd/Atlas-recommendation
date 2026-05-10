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

const controlContent = getRequiredContent('CON-01');
const cyclingContent = getRequiredContent('SIZ-02');
const hydraulicContent = getRequiredContent('HYD-01');
const safetyContent = getRequiredContent('HYD-02');

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
          title="Warm-not-hot emitters can still deliver comfort"
          summary="Heat pumps usually run for longer, calmer periods with lower emitter temperatures, so comfort comes from steady delivery rather than short high peaks."
          ariaLabel="Heat pump calm summary"
          eyebrow="Calm summary"
          headingLevel={4}
          misconceptionWarning={{
            misconception: 'Common misconception: if radiators are not very hot, the system is failing.',
            reality:
              'Reality: stable low-temperature running can match heat loss and improve comfort consistency over the day.',
          }}
          whatYouMayNotice={{
            notice: extractNotice(controlContent.customerExplanation),
            normalBecause: extractMeaning(controlContent.customerExplanation),
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
          title="What you may notice in daily operation"
          notice="Outdoor unit sound can vary, short defrost phases can appear in colder conditions, and comfort can feel more even across rooms."
          normalBecause="Compensation and steady modulation prioritise stable room conditions over dramatic temperature swings."
          ariaLabel="Heat pump what to expect"
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
          intro={cyclingContent.printSummary}
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
                <li>{controlContent.qrDeepDiveTitle}</li>
                <li>{cyclingContent.qrDeepDiveTitle}</li>
                <li>{hydraulicContent.qrDeepDiveTitle}</li>
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
    'Heat pumps usually run for longer, calmer periods with lower emitter temperatures, so comfort comes from steady delivery rather than short high peaks.',
    'Common misconception: if radiators are not very hot, the system is failing.',
    'Reality: stable low-temperature running can match heat loss and improve comfort consistency over the day.',
    extractNotice(controlContent.customerExplanation),
    extractMeaning(controlContent.customerExplanation),
    'Explain continuous running, weather compensation, and why frequent manual tweaking can reduce performance.',
    'Outdoor unit sound can vary, short defrost phases can appear in colder conditions, and comfort can feel more even across rooms.',
    'Compensation and steady modulation prioritise stable room conditions over dramatic temperature swings.',
    'Use trust-recovery copy to prevent normal commissioning behaviour being misread as failure.',
    safetyContent.printSummary,
    'Avoid repeated manual pressure top-ups. If pressure loss repeats, request a system check.',
    'A sudden weather shift can make yesterday’s indoor feel different while controls adapt.',
    'The system is adjusting flow temperature to outdoor conditions, not ignoring your comfort target.',
    'Hold settings steady for one full day, then request one small evidence-led control adjustment if needed.',
    'Provide concise print actions first, then offer optional depth for customers who want to understand more.',
    cyclingContent.printSummary,
    'Use these optional deep dives to support learning without overwhelming day-one handover.',
    'Check these assumptions before sign-off so expectation gaps do not become trust failures.',
  ];
}
