import { atlasMvpContentMapRegistry } from '../../content/atlasMvpContentMapRegistry';
import { OpenVentedToUnventedDiagram } from '../../diagrams/OpenVentedToUnventedDiagram';
import {
  ComparisonTriptych,
  PortalDiagramFrame,
  PortalHeroCard,
  PortalMisconceptionBlock,
  QRDeepDiveCard,
  ReassurancePanel,
  WhatYouMayNoticePanel,
} from '../ui/PortalPrimitives';
import './openVentedToSealedPortalSection.css';

const _con_a01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_A01');

if (!_con_a01) {
  throw new Error('CON_A01 entry missing from atlasMvpContentMapRegistry');
}

const CON_A01_ONE_LINE_SUMMARY: string = _con_a01.oneLineSummary;
const CON_A01_WHAT_YOU_MAY_NOTICE: string = _con_a01.whatYouMayNotice;
const CON_A01_WHAT_STAYS_FAMILIAR: string = _con_a01.whatStaysFamiliar;
const CON_A01_WHAT_NOT_TO_WORRY: string = _con_a01.whatNotToWorryAbout;
const CON_A01_MISCONCEPTION: string = _con_a01.misconception;
const CON_A01_REALITY: string = _con_a01.reality;
const CON_A01_CUSTOMER_WORDING: string = _con_a01.customerWording;
const CON_A01_QR_TITLE = 'Go deeper — sealed system and unvented cylinder walkthrough';

export function OpenVentedToSealedPortalSection() {
  return (
    <section
      className="ovsp-section"
      aria-labelledby="ovsp-heading"
      data-testid="ovsp-section"
    >
      <PortalHeroCard
        eyebrow="What changes with this upgrade"
        heading="Open-vented to sealed: what changes and what stays familiar"
        summary={CON_A01_ONE_LINE_SUMMARY}
      />

      <ComparisonTriptych
        cards={[
          {
            eyebrow: 'Before',
            heading: 'Tank-fed hot water',
            body: 'Cold water storage tank in the loft feeds a vented cylinder. Pressure depends on the height of the tank above the outlets.',
            testId: 'ovsp-before-card',
          },
          {
            eyebrow: 'After',
            heading: 'Mains-fed sealed circuit',
            body: CON_A01_CUSTOMER_WORDING,
            testId: 'ovsp-after-card',
          },
          {
            eyebrow: 'Your home',
            heading: 'What this means for you',
            body: 'The loft tanks are removed. Hot water is now supplied at mains pressure from the unvented cylinder. The heating circuit and radiators are unchanged.',
            highlight: true,
            testId: 'ovsp-your-home-card',
          },
        ]}
      />

      <WhatYouMayNoticePanel
        blocks={[
          {
            label: 'What you may notice',
            body: CON_A01_WHAT_YOU_MAY_NOTICE,
            testId: 'ovsp-what-you-may-notice',
          },
          {
            label: 'What stays familiar',
            body: CON_A01_WHAT_STAYS_FAMILIAR,
            testId: 'ovsp-what-stays-familiar',
          },
        ]}
      />

      <ReassurancePanel
        eyebrow="What not to worry about"
        heading="Hardware change is part of the plan"
        body={CON_A01_WHAT_NOT_TO_WORRY}
        data-testid="ovsp-reassurance"
      />

      <PortalDiagramFrame
        caption="Open-vented to sealed and unvented — what is removed and what replaces it"
        data-testid="ovsp-diagram-frame"
      >
        <OpenVentedToUnventedDiagram />
      </PortalDiagramFrame>

      <PortalMisconceptionBlock
        label="Common misunderstanding"
        misconception={CON_A01_MISCONCEPTION}
        reality={CON_A01_REALITY}
        data-testid="ovsp-misconception"
      />

      <QRDeepDiveCard
        heading="Go deeper"
        note={CON_A01_QR_TITLE}
        data-testid="ovsp-qr"
      />
    </section>
  );
}
