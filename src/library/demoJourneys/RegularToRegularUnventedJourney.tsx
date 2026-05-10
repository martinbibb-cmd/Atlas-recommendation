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
import { PressureVsStorageDiagram } from '../diagrams';

const storageContent = getRequiredContent('STR-01');

// Golden journey authored content
const preservedSystemContent = getRequiredContent('preserved_system_strength');
const premiumHotWaterContent = getRequiredContent('premium_hot_water_performance');
const regularRetainedContent = getRequiredContent('regular_retained_unvented_upgrade');
const unventedSafetyContent = getRequiredContent('unvented_safety_reassurance');

const storageAnalogy = getPrimaryAnalogy(storageContent);

export interface RegularToRegularUnventedJourneyProps {
  motionMode?: EducationalMotionMode;
}

export function RegularToRegularUnventedJourney({
  motionMode = 'system',
}: RegularToRegularUnventedJourneyProps) {
  const motionAttribute = getMotionAttribute(motionMode);

  return (
    <section
      className="atlas-edu-ui atlas-edu-demo"
      aria-labelledby="regular-unvented-journey-title"
      data-motion={motionAttribute}
    >
      <h2 id="regular-unvented-journey-title" className="atlas-edu-demo__heading">
        Regular to regular + unvented journey
      </h2>
      <p className="atlas-edu-demo__intro">
        This smart-engineering path keeps a system topology that already suits the home while modernising hot-water delivery and controls.
      </p>

      <CalmSection
        title="Calm summary and misconception correction"
        intro="Frame this journey as evidence-first improvement, not fashion-first replacement."
        headingLevel={3}
      >
        <EducationalCard
          title={preservedSystemContent.title}
          summary={preservedSystemContent.plainEnglishSummary}
          ariaLabel="Regular journey calm summary"
          eyebrow="Calm summary"
          headingLevel={4}
          misconceptionWarning={{
            misconception: preservedSystemContent.commonMisunderstanding,
            reality: 'Reality: a regular boiler with an unvented cylinder can provide strong overlap demand and stable long-term operation.',
          }}
          whatYouMayNotice={{
            notice: extractNotice(preservedSystemContent.customerExplanation),
            normalBecause: extractMeaning(preservedSystemContent.customerExplanation),
          }}
        />
      </CalmSection>

      <ConceptDivider label="Daily experience" />

      <CalmSection
        title="What you may notice and living guidance"
        intro="Show how reliability, familiarity, and lower disruption can coexist with modern hot-water outcomes."
        headingLevel={3}
      >
        <WhatToExpectCard
          title={regularRetainedContent.title}
          notice={extractNotice(regularRetainedContent.customerExplanation)}
          normalBecause={extractMeaning(regularRetainedContent.customerExplanation)}
          ariaLabel="Regular journey what to expect"
          headingLevel={4}
        />
        <WhatToExpectCard
          title={premiumHotWaterContent.title}
          notice={extractNotice(premiumHotWaterContent.customerExplanation)}
          normalBecause={extractMeaning(premiumHotWaterContent.customerExplanation)}
          ariaLabel="Premium hot water expectation"
          headingLevel={4}
        />
        <AnalogyCard
          title={storageAnalogy.title}
          analogy={storageAnalogy.explanation}
          whereItWorks={storageAnalogy.whereItWorks}
          whereItBreaks={storageAnalogy.whereItBreaks}
          ariaLabel="Regular journey analogy"
          headingLevel={4}
        />
      </CalmSection>

      <ConceptDivider label="Safety and trust" />

      <CalmSection
        title="Safety notice and trust recovery"
        intro="Pair compliance-critical facts with plain reassurance and one practical action."
        headingLevel={3}
      >
        <SafetyNoticeCard
          title={unventedSafetyContent.title}
          message={unventedSafetyContent.safetyNotice ?? unventedSafetyContent.printSummary}
          whatToDoNext="Keep discharge routes unobstructed and request a check if any visible discharge repeats after settling."
          ariaLabel="Regular journey safety"
          headingLevel={4}
        />
        <TrustRecoveryCard
          title="If performance feels different after commissioning"
          thisCanHappen="The first week can include small comfort timing changes while controls and user habits settle."
          whatItMeans="This usually reflects commissioning fine-tuning, not a failed design decision."
          whatToDoNext="Record one clear example of concern and ask for an evidence-led adjustment, not repeated ad-hoc setpoint changes."
          ariaLabel="Regular journey trust recovery"
          headingLevel={4}
        />
      </CalmSection>

      <ConceptDivider label="Print and deeper detail" />

      <CalmSection
        title="Print-safe handover and deeper detail"
        intro="Give concise paper actions first, then optional deeper explanations for customers who want extra depth."
        headingLevel={3}
      >
        <PrintSafePanel
          title="Handover action summary"
          intro={regularRetainedContent.printSummary}
          ariaLabel="Regular journey print-safe"
          headingLevel={4}
        >
          <EducationalCard
            title="QR and deeper-detail follow-up"
            summary="Offer targeted deep dives without forcing everyone through technical appendix material."
            ariaLabel="Regular journey QR details"
            eyebrow="Deeper detail"
            headingLevel={5}
            footer={(
              <ul>
                <li>{preservedSystemContent.qrDeepDiveTitle}</li>
                <li>{premiumHotWaterContent.qrDeepDiveTitle}</li>
                <li>{regularRetainedContent.qrDeepDiveTitle}</li>
                <li>{unventedSafetyContent.qrDeepDiveTitle}</li>
              </ul>
            )}
          />
        </PrintSafePanel>
      </CalmSection>

      <ConceptDivider label="Visual explanations" />

      <CalmSection
        title="Visual explanations"
        intro="This diagram shows how mains-fed storage preserves pressure to multiple outlets."
        headingLevel={3}
      >
        <PressureVsStorageDiagram />
      </CalmSection>

      <ConceptDivider label="Confusion risks and accessibility" />

      <CalmSection
        title="Customer confusion checklist"
        intro="Validate these assumptions during handover to preserve premium trust."
        headingLevel={3}
      >
        <CustomerConfusionChecklist
          journeyLabel="Regular to regular + unvented"
          confusionRisks={[
            'Keeping a regular topology means no meaningful upgrade happened.',
            'Mains-fed stored hot water is automatically unlimited.',
          ]}
          assumptions={[
            'The home benefits from preserving existing heating architecture.',
            'Users understand recovery time and capacity boundaries.',
          ]}
          reinforcements={[
            'This path improves outcomes without unnecessary conversion risk.',
            'Future readiness comes from good hydraulics and controls, not only topology change.',
          ]}
          headingLevel={4}
        />
        <JourneyComparisonPanel headingLevel={4} />
      </CalmSection>
    </section>
  );
}

export function getRegularToRegularUnventedJourneyParagraphs(): string[] {
  return [
    'This smart-engineering path keeps a system topology that already suits the home while modernising hot-water delivery and controls.',
    'Frame this journey as evidence-first improvement, not fashion-first replacement.',
    preservedSystemContent.plainEnglishSummary,
    preservedSystemContent.commonMisunderstanding,
    extractNotice(preservedSystemContent.customerExplanation),
    extractMeaning(preservedSystemContent.customerExplanation),
    extractNotice(regularRetainedContent.customerExplanation),
    extractMeaning(regularRetainedContent.customerExplanation),
    extractNotice(premiumHotWaterContent.customerExplanation),
    extractMeaning(premiumHotWaterContent.customerExplanation),
    unventedSafetyContent.safetyNotice ?? unventedSafetyContent.printSummary,
    'Keep discharge routes unobstructed and request a check if any visible discharge repeats after settling.',
    'The first week can include small comfort timing changes while controls and user habits settle.',
    regularRetainedContent.printSummary,
    preservedSystemContent.printSummary,
    'This diagram shows how mains-fed storage preserves pressure to multiple outlets.',
    'Validate these assumptions during handover to preserve premium trust.',
  ];
}

/**
 * Returns the sequencing plan for this journey.
 * Shows how the engine orders concepts, which are deferred, and any pacing warnings.
 */
export function getRegularToRegularUnventedJourneySequencingPlan() {
  return buildEducationalSequence({
    selectedConceptIds: [
      'system_fit_explanation',
      'preserved_system_strength',
      'premium_hot_water_performance',
      'regular_retained_unvented_upgrade',
      'unvented_safety_reassurance',
      'stored_hot_water_efficiency',
      'operating_behaviour',
      'driving_style',
      'scope_clarity',
      'load_matching',
    ],
    sequenceRules: educationalSequenceRules,
    archetypeId: 'regular_to_regular_unvented',
  });
}
