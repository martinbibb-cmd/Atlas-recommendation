import { atlasMvpContentMapRegistry } from '../../content/atlasMvpContentMapRegistry';
import {
  PortalHeroCard,
  PortalMisconceptionBlock,
  QRDeepDiveCard,
  ReassurancePanel,
  WhatYouMayNoticePanel,
} from '../ui/PortalPrimitives';
import './unventedSafetyPortalSection.css';

const _con_c01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_C01');

if (!_con_c01) {
  throw new Error('CON_C01 entry missing from atlasMvpContentMapRegistry');
}

const CON_C01_ONE_LINE_SUMMARY: string = _con_c01.oneLineSummary;
const CON_C01_CUSTOMER_WORDING: string = _con_c01.customerWording;
const CON_C01_WHAT_YOU_MAY_NOTICE: string = _con_c01.whatYouMayNotice;
const CON_C01_WHAT_STAYS_FAMILIAR: string = _con_c01.whatStaysFamiliar;
const CON_C01_WHAT_NOT_TO_WORRY: string = _con_c01.whatNotToWorryAbout;
const CON_C01_MISCONCEPTION: string = _con_c01.misconception;
const CON_C01_REALITY: string = _con_c01.reality;
const CON_C01_QR_NOTE = 'Scan to explore what each safety device on an unvented cylinder does — diagram-guided walkthrough available.';

export function UnventedSafetyPortalSection() {
  return (
    <section
      className="uvsp-section"
      aria-labelledby="uvsp-heading"
      data-testid="uvsp-section"
    >
      <PortalHeroCard
        eyebrow="Unvented cylinder safety"
        heading="Safety devices are standard — not a sign of a fault"
        summary={CON_C01_ONE_LINE_SUMMARY}
      />

      <p className="portal-info-card__body" data-testid="uvsp-customer-wording">
        {CON_C01_CUSTOMER_WORDING}
      </p>

      <WhatYouMayNoticePanel
        blocks={[
          {
            label: 'What you may notice',
            body: CON_C01_WHAT_YOU_MAY_NOTICE,
            testId: 'uvsp-what-you-may-notice',
          },
          {
            label: 'What stays familiar',
            body: CON_C01_WHAT_STAYS_FAMILIAR,
            testId: 'uvsp-what-stays-familiar',
          },
        ]}
      />

      <ReassurancePanel
        eyebrow="What not to worry about"
        heading="Seeing safety hardware is reassuring, not alarming"
        body={CON_C01_WHAT_NOT_TO_WORRY}
        data-testid="uvsp-reassurance"
      />

      <PortalMisconceptionBlock
        label="Common misunderstanding"
        misconception={CON_C01_MISCONCEPTION}
        reality={CON_C01_REALITY}
        data-testid="uvsp-misconception"
      />

      <QRDeepDiveCard
        heading="Go deeper"
        note={CON_C01_QR_NOTE}
        data-testid="uvsp-qr"
      />
    </section>
  );
}
