import { atlasMvpContentMapRegistry } from '../../content/atlasMvpContentMapRegistry';
import { buildExpectationDeltas, getContentByConceptId } from '../../content';
import type { LivingExperiencePatternV1 } from '../../content/LivingExperiencePatternV1';
import { DiagramRenderer } from '../../diagrams/DiagramRenderer';
import {
  ComparisonTriptych,
  ExpectationDeltaCard,
  PortalDiagramFrame,
  PortalHeroCard,
  PortalMisconceptionBlock,
  QRDeepDiveCard,
  ReassurancePanel,
  WhatYouMayNoticePanel,
} from '../ui/PortalPrimitives';

const _con_e02 = atlasMvpContentMapRegistry.find((entry) => entry.id === 'CON_E02');
const _con_h01 = atlasMvpContentMapRegistry.find((entry) => entry.id === 'CON_H01');
const _con_h04 = atlasMvpContentMapRegistry.find((entry) => entry.id === 'CON_H04');
const _con_g01 = atlasMvpContentMapRegistry.find((entry) => entry.id === 'CON_G01');
const _con_i01DayToDay = atlasMvpContentMapRegistry.find((entry) => entry.id === 'CON_I01_DAY_TO_DAY');

if (!_con_e02 || !_con_h01 || !_con_h04 || !_con_g01 || !_con_i01DayToDay) {
  throw new Error('Heat-pump portal journey content entries are missing from atlasMvpContentMapRegistry');
}

const CON_E02_ONE_LINE_SUMMARY: string = _con_e02.oneLineSummary;
const CON_E02_WHAT_YOU_MAY_NOTICE: string = _con_e02.whatYouMayNotice;
const CON_E02_WHAT_NOT_TO_WORRY: string = _con_e02.whatNotToWorryAbout;
const CON_E02_MISCONCEPTION: string = _con_e02.misconception;
const CON_E02_REALITY: string = _con_e02.reality;

const CON_H01_WHAT_YOU_MAY_NOTICE: string = _con_h01.whatYouMayNotice;
const CON_H01_WHAT_NOT_TO_WORRY: string = _con_h01.whatNotToWorryAbout;

const CON_H04_ONE_LINE_SUMMARY: string = _con_h04.oneLineSummary;
const CON_H04_CUSTOMER_WORDING: string = _con_h04.customerWording;

const CON_G01_WHAT_YOU_MAY_NOTICE: string = _con_g01.whatYouMayNotice;
const CON_G01_WHAT_STAYS_FAMILIAR: string = _con_g01.whatStaysFamiliar;
const CON_G01_WHAT_NOT_TO_WORRY: string = _con_g01.whatNotToWorryAbout;

const CON_I01_DAY_TO_DAY_CUSTOMER_WORDING: string = _con_i01DayToDay.customerWording;
const CON_I01_DAY_TO_DAY_WHAT_NOT_TO_WORRY: string = _con_i01DayToDay.whatNotToWorryAbout;

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

const hotRadiatorPattern = getContentByConceptId('hot_radiator_expectation')?.livingExperiencePattern;
const flowPattern = getContentByConceptId('flow_temperature_living_with_it')?.livingExperiencePattern;
const expectationDeltas = buildExpectationDeltas({
  currentSystem: 'boiler_high_temperature',
  recommendedSystem: 'heat_pump_low_temperature',
  livingExperiencePatterns: {
    radiators: {
      current: BOILER_BURST_PATTERN,
      future: hotRadiatorPattern,
    },
    controls: {
      current: BOILER_BURST_PATTERN,
      future: flowPattern,
    },
  },
});

export function HeatPumpLivingJourneyPortalSection() {
  return (
    <section
      className="hplj-section"
      aria-labelledby="hplj-heading"
      data-testid="hplj-section"
      data-motion="safe"
    >
      <PortalHeroCard
        eyebrow="Living with your heat pump"
        heading="Heat pump comfort: what to expect day to day"
        summary={CON_E02_ONE_LINE_SUMMARY}
      />

      <ComparisonTriptych
        cards={[
          {
            eyebrow: 'Radiator feel',
            heading: 'Warm for longer, not short hot bursts',
            body: CON_E02_WHAT_YOU_MAY_NOTICE,
            testId: 'hplj-warm-vs-hot-card',
          },
          {
            eyebrow: 'Steady running',
            heading: 'Calm, continuous low-temperature operation',
            body: CON_H04_ONE_LINE_SUMMARY,
            testId: 'hplj-steady-running-card',
          },
          {
            eyebrow: 'Your home',
            heading: 'What this means for comfort',
            body: CON_I01_DAY_TO_DAY_CUSTOMER_WORDING,
            highlight: true,
            testId: 'hplj-your-home-card',
          },
        ]}
      />

      {expectationDeltas.length > 0 ? (
        <div className="hplj-expectation-deltas" data-testid="hplj-expectation-deltas">
          {expectationDeltas.map((delta, index) => (
            <ExpectationDeltaCard
              key={`${delta.category}-${index}`}
              delta={delta}
              heading={index === 0 ? 'Current → Future' : undefined}
            />
          ))}
        </div>
      ) : null}

      <PortalDiagramFrame
        caption="Warm radiators can still deliver full comfort when low-temperature operation is tuned correctly."
        data-testid="hplj-warm-diagram"
      >
        <DiagramRenderer
          diagramId="warm_vs_hot_radiators"
          reducedMotion
        />
      </PortalDiagramFrame>

      <WhatYouMayNoticePanel
        blocks={[
          {
            label: 'What you may notice',
            body: CON_H01_WHAT_YOU_MAY_NOTICE,
            testId: 'hplj-defrost-notice',
          },
          {
            label: 'Controls and compensation',
            body: CON_G01_WHAT_YOU_MAY_NOTICE,
            testId: 'hplj-controls-notice',
          },
        ]}
      />

      <ReassurancePanel
        eyebrow="What stays familiar"
        heading="Comfort targets stay familiar while the system runs differently"
        items={[
          CON_G01_WHAT_STAYS_FAMILIAR,
          CON_H04_CUSTOMER_WORDING,
          CON_I01_DAY_TO_DAY_WHAT_NOT_TO_WORRY,
        ]}
        data-testid="hplj-reassurance"
      />

      <ReassurancePanel
        eyebrow="What not to worry about"
        heading="Normal winter and control behaviour is expected"
        items={[
          CON_E02_WHAT_NOT_TO_WORRY,
          CON_H01_WHAT_NOT_TO_WORRY,
          CON_G01_WHAT_NOT_TO_WORRY,
        ]}
        data-testid="hplj-what-not-to-worry"
      />

      <PortalMisconceptionBlock
        label="Common misunderstanding"
        misconception={CON_E02_MISCONCEPTION}
        reality={CON_E02_REALITY}
        data-testid="hplj-misconception"
      />

      <QRDeepDiveCard
        heading="Go deeper"
        note="Scan for warm-radiator expectations, winter defrost reassurance, and weather compensation setup guidance."
        data-testid="hplj-qr"
      />
    </section>
  );
}
