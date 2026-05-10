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

const storageContent = getRequiredContent('STR-01');

// Golden journey authored content
const sealedConversionContent = getRequiredContent('sealed_system_conversion');
const unventedSafetyContent = getRequiredContent('unvented_safety_reassurance');
const pressureVsStorageContent = getRequiredContent('pressure_vs_storage');
const openVentedUpgradeContent = getRequiredContent('open_vented_to_unvented_upgrade');

const storageAnalogy = getPrimaryAnalogy(storageContent);

export interface OpenVentedToSealedUnventedJourneyProps {
  motionMode?: EducationalMotionMode;
}

export function OpenVentedToSealedUnventedJourney({
  motionMode = 'system',
}: OpenVentedToSealedUnventedJourneyProps) {
  const motionAttribute = getMotionAttribute(motionMode);

  return (
    <section
      className="atlas-edu-ui atlas-edu-demo"
      aria-labelledby="open-vented-unvented-journey-title"
      data-motion={motionAttribute}
    >
      <h2 id="open-vented-unvented-journey-title" className="atlas-edu-demo__heading">
        Open-vented to sealed + unvented journey
      </h2>
      <p className="atlas-edu-demo__intro">
        This flagship premium-comfort journey explains why a stored hot water upgrade can improve outcomes without forcing a combi swap narrative.
      </p>

      <CalmSection
        title="Calm summary and misconception correction"
        intro="Start with what changes in daily life, then separate pressure-source facts from storage-capacity facts."
        headingLevel={3}
      >
        <EducationalCard
          title="Why this path can feel like a major uplift"
          summary="The journey keeps proven heating strength, modernises the pressure side, and improves simultaneous demand resilience for family use."
          ariaLabel="Open-vented calm summary"
          eyebrow="Calm summary"
          headingLevel={4}
          misconceptionWarning={{
            misconception: 'Common misconception: a combi is always the only modern upgrade path.',
            reality:
              'Reality: stored hot water supplied at mains pressure can deliver strong overlap performance and stable comfort when correctly sized.',
          }}
          whatYouMayNotice={{
            notice: extractNotice(storageContent.customerExplanation),
            normalBecause: extractMeaning(storageContent.customerExplanation),
          }}
        />
      </CalmSection>

      <ConceptDivider label="Daily experience" />

      <CalmSection
        title="What you may notice and living-with-system guidance"
        intro="Translate technical architecture into lived outcomes and stable daily habits."
        headingLevel={3}
      >
        <WhatToExpectCard
          title={openVentedUpgradeContent.title}
          notice={extractNotice(openVentedUpgradeContent.customerExplanation)}
          normalBecause={extractMeaning(openVentedUpgradeContent.customerExplanation)}
          ariaLabel="Open-vented to unvented upgrade expectation"
          headingLevel={4}
        />
        <WhatToExpectCard
          title={pressureVsStorageContent.title}
          notice={extractNotice(pressureVsStorageContent.customerExplanation)}
          normalBecause={extractMeaning(pressureVsStorageContent.customerExplanation)}
          ariaLabel="Pressure vs storage expectation"
          headingLevel={4}
        />
        <AnalogyCard
          title={storageAnalogy.title}
          analogy={storageAnalogy.explanation}
          whereItWorks={storageAnalogy.whereItWorks}
          whereItBreaks={storageAnalogy.whereItBreaks}
          ariaLabel="Open-vented analogy"
          headingLevel={4}
        />
      </CalmSection>

      <ConceptDivider label="Safety and trust" />

      <CalmSection
        title="Safety notice and trust recovery"
        intro="Name routine wobbles early so customers do not misread normal settling behaviour as system failure."
        headingLevel={3}
      >
        <SafetyNoticeCard
          title={unventedSafetyContent.title}
          message={unventedSafetyContent.safetyNotice ?? unventedSafetyContent.printSummary}
          whatToDoNext="If discharge remains visible after a cycle settles, request a qualified safety check rather than ignoring it."
          ariaLabel="Open-vented safety card"
          headingLevel={4}
        />
        <TrustRecoveryCard
          title="If pressure feel changes after upgrade"
          thisCanHappen="The first days can feel different if your previous tank-fed supply had lower outlet pressure."
          whatItMeans="The system is now operating with a different pressure-source profile and may need minor user habit adjustment."
          whatToDoNext="Keep core settings stable and request one evidence-led review if comfort still feels off after a full day."
          ariaLabel="Open-vented trust recovery"
          headingLevel={4}
        />
      </CalmSection>

      <ConceptDivider label="Print and deeper detail" />

      <CalmSection
        title="Print-safe handover and QR deep dives"
        intro="Keep practical handover actions printable while still offering deeper follow-up for curious customers."
        headingLevel={3}
      >
        <PrintSafePanel
          title="Handover action summary"
          intro={sealedConversionContent.printSummary}
          ariaLabel="Open-vented print-safe panel"
          headingLevel={4}
        >
          <EducationalCard
            title="QR and deeper-detail follow-up"
            summary="Use these optional follow-ups when customers want more confidence without reading dense manuals."
            ariaLabel="Open-vented QR detail"
            eyebrow="Deeper detail"
            headingLevel={5}
            footer={(
              <ul>
                <li>{sealedConversionContent.qrDeepDiveTitle}</li>
                <li>{unventedSafetyContent.qrDeepDiveTitle}</li>
                <li>{pressureVsStorageContent.qrDeepDiveTitle}</li>
                <li>{openVentedUpgradeContent.qrDeepDiveTitle}</li>
              </ul>
            )}
          />
        </PrintSafePanel>
      </CalmSection>

      <ConceptDivider label="Confusion risks and accessibility" />

      <CalmSection
        title="Customer confusion checklist"
        intro="Use this checklist to catch unresolved assumptions before they become complaints."
        headingLevel={3}
      >
        <CustomerConfusionChecklist
          journeyLabel="Open-vented to sealed + unvented"
          confusionRisks={[
            'Pressure improvement means stored capacity has no practical limit.',
            'Open vented and open-vented hot water describe the same thing as sealed heating.',
          ]}
          assumptions={[
            'Mains-fed supply performance is sufficient for expected overlap demand.',
            'Customers understand that storage and pressure are separate design dimensions.',
          ]}
          reinforcements={[
            'Stored volume still has recovery time under long heavy use.',
            'Qualified safety design and discharge compliance remain non-negotiable.',
          ]}
          headingLevel={4}
        />
        <JourneyComparisonPanel headingLevel={4} />
      </CalmSection>
    </section>
  );
}

export function getOpenVentedToSealedUnventedJourneyParagraphs(): string[] {
  return [
    'This flagship premium-comfort journey explains why a stored hot water upgrade can improve outcomes without forcing a combi swap narrative.',
    'Start with what changes in daily life, then separate pressure-source facts from storage-capacity facts.',
    sealedConversionContent.plainEnglishSummary,
    sealedConversionContent.commonMisunderstanding,
    extractNotice(openVentedUpgradeContent.customerExplanation),
    extractMeaning(openVentedUpgradeContent.customerExplanation),
    extractNotice(pressureVsStorageContent.customerExplanation),
    extractMeaning(pressureVsStorageContent.customerExplanation),
    unventedSafetyContent.safetyNotice ?? unventedSafetyContent.printSummary,
    'If discharge remains visible after a cycle settles, request a qualified safety check rather than ignoring it.',
    'The first days can feel different if your previous tank-fed supply had lower outlet pressure.',
    'The system is now operating with a different pressure-source profile and may need minor user habit adjustment.',
    'Keep core settings stable and request one evidence-led review if comfort still feels off after a full day.',
    sealedConversionContent.printSummary,
    openVentedUpgradeContent.printSummary,
    'Use this checklist to catch unresolved assumptions before they become complaints.',
  ];
}

/**
 * Returns the sequencing plan for this journey.
 * Shows how the engine orders concepts, which are deferred, and any pacing warnings.
 */
export function getOpenVentedToSealedUnventedJourneySequencingPlan() {
  return buildEducationalSequence({
    selectedConceptIds: [
      'system_fit_explanation',
      'stored_hot_water_efficiency',
      'sealed_system_conversion',
      'unvented_safety_reassurance',
      'pressure_vs_storage',
      'open_vented_to_unvented_upgrade',
      'operating_behaviour',
      'driving_style',
      'load_matching',
      'flow_restriction',
      'scope_clarity',
    ],
    sequenceRules: educationalSequenceRules,
    archetypeId: 'open_vented_to_sealed_unvented',
  });
}
