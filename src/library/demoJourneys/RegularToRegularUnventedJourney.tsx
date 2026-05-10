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

const storageContent = getRequiredContent('STR-01');
const pressureContent = getRequiredContent('HYD-02');
const maintenanceContent = getRequiredContent('MNT-01');
const safetyContent = getRequiredContent('SAF-01');

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
          title="Why preserving good architecture builds trust"
          summary="When the existing heating circuit is sound, keeping it can reduce disruption while still delivering stronger stored hot-water performance."
          ariaLabel="Regular journey calm summary"
          eyebrow="Calm summary"
          headingLevel={4}
          misconceptionWarning={{
            misconception: 'Common misconception: if the boiler is regular, the only modern option is conversion to a combi.',
            reality:
              'Reality: a regular boiler with an unvented cylinder can provide strong overlap demand and stable long-term operation.',
          }}
          whatYouMayNotice={{
            notice: extractNotice(storageContent.customerExplanation),
            normalBecause: extractMeaning(storageContent.customerExplanation),
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
          title="What this usually feels like"
          notice="Daily heating behaviour stays familiar, while hot-water overlap and bathroom consistency improve for family routines."
          normalBecause="The heating topology remains proven, and the stored mains-fed hot water side is upgraded for stronger draw-off resilience."
          ariaLabel="Regular journey what to expect"
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
          title={safetyContent.title}
          message={safetyContent.safetyNotice ?? safetyContent.printSummary}
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
          intro={maintenanceContent.printSummary}
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
                <li>{storageContent.qrDeepDiveTitle}</li>
                <li>{pressureContent.qrDeepDiveTitle}</li>
                <li>{maintenanceContent.qrDeepDiveTitle}</li>
              </ul>
            )}
          />
        </PrintSafePanel>
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
    'When the existing heating circuit is sound, keeping it can reduce disruption while still delivering stronger stored hot-water performance.',
    'Common misconception: if the boiler is regular, the only modern option is conversion to a combi.',
    'Reality: a regular boiler with an unvented cylinder can provide strong overlap demand and stable long-term operation.',
    extractNotice(storageContent.customerExplanation),
    extractMeaning(storageContent.customerExplanation),
    'Show how reliability, familiarity, and lower disruption can coexist with modern hot-water outcomes.',
    'Daily heating behaviour stays familiar, while hot-water overlap and bathroom consistency improve for family routines.',
    'The heating topology remains proven, and the stored mains-fed hot water side is upgraded for stronger draw-off resilience.',
    'Pair compliance-critical facts with plain reassurance and one practical action.',
    safetyContent.safetyNotice ?? safetyContent.printSummary,
    'Keep discharge routes unobstructed and request a check if any visible discharge repeats after settling.',
    'The first week can include small comfort timing changes while controls and user habits settle.',
    'This usually reflects commissioning fine-tuning, not a failed design decision.',
    'Record one clear example of concern and ask for an evidence-led adjustment, not repeated ad-hoc setpoint changes.',
    'Give concise paper actions first, then optional deeper explanations for customers who want extra depth.',
    maintenanceContent.printSummary,
    'Offer targeted deep dives without forcing everyone through technical appendix material.',
    'Validate these assumptions during handover to preserve premium trust.',
  ];
}
