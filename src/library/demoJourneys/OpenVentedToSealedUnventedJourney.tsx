import {
  AnalogyCard,
  CalmSection,
  ConceptDivider,
  EducationalCard,
  PrintSafePanel,
  SafetyNoticeCard,
  SystemFactCard,
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
import { OpenVentedToUnventedDiagram, PressureVsStorageDiagram } from '../diagrams';

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

      <ConceptDivider label="Changes in your home" />

      <CalmSection
        title="What changes in your home"
        intro="Name the physical and operational changes so nothing comes as a surprise on installation day."
        headingLevel={3}
      >
        <SystemFactCard
          title="Loft tanks are removed"
          fact="Cold water storage tanks and the header tank in the loft are removed. The loft space clears and the frost risk from exposed tanks goes away."
          ariaLabel="Loft tanks removed"
          headingLevel={4}
        />
        <SystemFactCard
          title="The heating circuit becomes a sealed loop"
          fact="Heating water circulates in a closed pressurised circuit. Pressure is set at commissioning and checked occasionally at the filling loop."
          ariaLabel="Sealed heating circuit"
          headingLevel={4}
        />
        <SystemFactCard
          title="Hot water runs at mains pressure"
          fact="The unvented cylinder stores hot water at mains pressure rather than the limited head of a loft tank. All hot water outlets now match your cold supply pressure."
          ariaLabel="Mains pressure hot water"
          headingLevel={4}
        />
        <SystemFactCard
          title="Shower overlap improves where mains supply allows"
          fact="Simultaneous use from more than one hot water outlet depends on the available mains flow rate. Where mains flow is sufficient, overlap performance is noticeably better."
          ariaLabel="Shower overlap improvement"
          headingLevel={4}
        />
        <SystemFactCard
          title="The safety discharge becomes visible"
          fact="The tundish is a standard fitting that shows when relief valves have operated. Your installer will position it where it can be seen and checked."
          ariaLabel="Safety discharge tundish"
          headingLevel={4}
        />
      </CalmSection>

      <ConceptDivider label="What stays familiar" />

      <CalmSection
        title="What stays familiar"
        intro="Reassure customers that the heating side of the home is unchanged — only the hot water supply is upgraded."
        headingLevel={3}
      >
        <SystemFactCard
          title="Radiators still heat every room"
          fact="Your radiators, pipework, and any zone valves are unchanged. The heating distribution works exactly as it did before."
          ariaLabel="Radiators unchanged"
          headingLevel={4}
        />
        <SystemFactCard
          title="Your programmer or thermostat still controls heating"
          fact="Existing scheduling and temperature controls carry over. No new heating control interface is introduced on the heating side."
          ariaLabel="Programmer unchanged"
          headingLevel={4}
        />
        <SystemFactCard
          title="The boiler still heats your home"
          fact="The boiler fires to heat radiators and to charge the stored cylinder, as a system boiler always has. Nothing changes in how the boiler heats your home."
          ariaLabel="Boiler role unchanged"
          headingLevel={4}
        />
        <SystemFactCard
          title="Your installer will explain the pressure gauge"
          fact="A pressure gauge and filling loop are standard fittings your installer will walk you through. Topping up pressure occasionally is a one-minute routine."
          ariaLabel="Pressure gauge explained"
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

      <ConceptDivider label="What not to worry about" />

      <CalmSection
        title="What not to worry about"
        intro="Address common concerns directly so customers do not misread normal system features as problems."
        headingLevel={3}
      >
        <TrustRecoveryCard
          title="The cylinder is not old-fashioned"
          thisCanHappen="Some customers expect a modern upgrade to remove all storage in favour of on-demand flow."
          whatItMeans="An unvented cylinder is modern sealed storage that delivers mains pressure without a pump."
          whatToDoNext="No change is needed — the cylinder is correctly sized and specified for your home."
          ariaLabel="Cylinder not old-fashioned"
          headingLevel={4}
        />
        <TrustRecoveryCard
          title="Unvented does not mean uncontrolled"
          thisCanHappen="The term 'unvented' can suggest the cylinder lacks safety controls or proper venting."
          whatItMeans="Unvented means sealed from the atmosphere, not unprotected. Multiple independent relief devices are fitted."
          whatToDoNext="Your installer will confirm all pressure and temperature safety devices are commissioned before handover."
          ariaLabel="Unvented not uncontrolled"
          headingLevel={4}
        />
        <TrustRecoveryCard
          title="The tundish is a safety indicator, not a fault"
          thisCanHappen="A small occasional drip from the tundish during a heating cycle can look like a leak."
          whatItMeans="The tundish shows that the pressure relief system operated correctly. An occasional discharge is normal."
          whatToDoNext="If discharge continues after the system settles, request a qualified safety check rather than ignoring it."
          ariaLabel="Tundish safety indicator"
          headingLevel={4}
        />
        <TrustRecoveryCard
          title="Pressure is managed automatically"
          thisCanHappen="A pressure gauge and expansion vessel can feel unfamiliar on the first encounter."
          whatItMeans="System pressure is managed by the expansion vessel and relief valves. Routine management is not required."
          whatToDoNext="Check the gauge occasionally and top up at the filling loop only if pressure falls below the set range."
          ariaLabel="Pressure managed automatically"
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

      <ConceptDivider label="Visual explanations" />

      <CalmSection
        title="Visual explanations"
        intro="These diagrams show how pressure, storage, and system topology work together."
        headingLevel={3}
      >
        <PressureVsStorageDiagram />
        <OpenVentedToUnventedDiagram />
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
    'These diagrams show how pressure, storage, and system topology work together.',
    'Use this checklist to catch unresolved assumptions before they become complaints.',
    // What changes in your home
    'Name the physical and operational changes so nothing comes as a surprise on installation day.',
    'Cold water storage tanks and the header tank in the loft are removed. The loft space clears and the frost risk from exposed tanks goes away.',
    'Heating water circulates in a closed pressurised circuit. Pressure is set at commissioning and checked occasionally at the filling loop.',
    'The unvented cylinder stores hot water at mains pressure rather than the limited head of a loft tank. All hot water outlets now match your cold supply pressure.',
    'Simultaneous use from more than one hot water outlet depends on the available mains flow rate. Where mains flow is sufficient, overlap performance is noticeably better.',
    'The tundish is a standard fitting that shows when relief valves have operated. Your installer will position it where it can be seen and checked.',
    // What stays familiar
    'Reassure customers that the heating side of the home is unchanged — only the hot water supply is upgraded.',
    'Your radiators, pipework, and any zone valves are unchanged. The heating distribution works exactly as it did before.',
    'Existing scheduling and temperature controls carry over. No new heating control interface is introduced on the heating side.',
    'The boiler fires to heat radiators and to charge the stored cylinder, as a system boiler always has. Nothing changes in how the boiler heats your home.',
    'A pressure gauge and filling loop are standard fittings your installer will walk you through. Topping up pressure occasionally is a one-minute routine.',
    // What not to worry about
    'Address common concerns directly so customers do not misread normal system features as problems.',
    'Some customers expect a modern upgrade to remove all storage in favour of on-demand flow.',
    'An unvented cylinder is modern sealed storage that delivers mains pressure without a pump.',
    'No change is needed — the cylinder is correctly sized and specified for your home.',
    "The term 'unvented' can suggest the cylinder lacks safety controls or proper venting.",
    'Unvented means sealed from the atmosphere, not unprotected. Multiple independent relief devices are fitted.',
    'Your installer will confirm all pressure and temperature safety devices are commissioned before handover.',
    'A small occasional drip from the tundish during a heating cycle can look like a leak.',
    'The tundish shows that the pressure relief system operated correctly. An occasional discharge is normal.',
    'If discharge continues after the system settles, request a qualified safety check rather than ignoring it.',
    'A pressure gauge and expansion vessel can feel unfamiliar on the first encounter.',
    'System pressure is managed by the expansion vessel and relief valves. Routine management is not required.',
    'Check the gauge occasionally and top up at the filling loop only if pressure falls below the set range.',
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
