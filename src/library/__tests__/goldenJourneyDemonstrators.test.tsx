import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  EDUCATIONAL_MAX_PARAGRAPH_CHARACTERS,
  EDUCATIONAL_MAX_PARAGRAPH_SENTENCES,
} from '../ui';
import {
  HeatPumpRealityJourney,
  OpenVentedToSealedUnventedJourney,
  RegularToRegularUnventedJourney,
  WaterConstraintJourney,
  countSentences,
  getHeatPumpRealityJourneyParagraphs,
  getOpenVentedToSealedUnventedJourneyParagraphs,
  getRegularToRegularUnventedJourneyParagraphs,
  getWaterConstraintJourneyParagraphs,
} from '../demoJourneys';

type JourneySpec = {
  name: string;
  renderJourney: () => void;
  getParagraphs: () => string[];
  expectedHeading: string;
};

const journeySpecs: JourneySpec[] = [
  {
    name: 'open-vented to sealed + unvented',
    renderJourney: () => {
      render(<OpenVentedToSealedUnventedJourney />);
    },
    getParagraphs: getOpenVentedToSealedUnventedJourneyParagraphs,
    expectedHeading: 'Open-vented to sealed + unvented journey',
  },
  {
    name: 'regular to regular + unvented',
    renderJourney: () => {
      render(<RegularToRegularUnventedJourney />);
    },
    getParagraphs: getRegularToRegularUnventedJourneyParagraphs,
    expectedHeading: 'Regular to regular + unvented journey',
  },
  {
    name: 'heat pump reality',
    renderJourney: () => {
      render(<HeatPumpRealityJourney />);
    },
    getParagraphs: getHeatPumpRealityJourneyParagraphs,
    expectedHeading: 'Heat pump reality journey',
  },
  {
    name: 'water constraints',
    renderJourney: () => {
      render(<WaterConstraintJourney />);
    },
    getParagraphs: getWaterConstraintJourneyParagraphs,
    expectedHeading: 'Water constraints and hydraulic reality journey',
  },
];

function expectHeadingOrder(root: HTMLElement) {
  const headingNodes = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const levels = headingNodes.map((heading) => Number.parseInt(heading.tagName.slice(1), 10));

  expect(levels[0]).toBe(2);

  for (let index = 1; index < levels.length; index += 1) {
    expect(levels[index]).toBeLessThanOrEqual(levels[index - 1] + 1);
  }
}

describe('golden journey demonstrators', () => {
  it.each(journeySpecs)('keeps semantic heading order for %s', (spec) => {
    const { container } = render(
      <div>
        {spec.name === 'open-vented to sealed + unvented' ? <OpenVentedToSealedUnventedJourney /> : null}
        {spec.name === 'regular to regular + unvented' ? <RegularToRegularUnventedJourney /> : null}
        {spec.name === 'heat pump reality' ? <HeatPumpRealityJourney /> : null}
        {spec.name === 'water constraints' ? <WaterConstraintJourney /> : null}
      </div>,
    );

    expect(screen.getByRole('heading', { level: 2, name: spec.expectedHeading })).toBeInTheDocument();
    expectHeadingOrder(container);
  });

  it('keeps authored journey paragraphs within overload limits', () => {
    const paragraphs = [
      ...getOpenVentedToSealedUnventedJourneyParagraphs(),
      ...getRegularToRegularUnventedJourneyParagraphs(),
      ...getHeatPumpRealityJourneyParagraphs(),
      ...getWaterConstraintJourneyParagraphs(),
    ];

    for (const paragraph of paragraphs) {
      expect(paragraph.length).toBeLessThanOrEqual(EDUCATIONAL_MAX_PARAGRAPH_CHARACTERS);
      expect(countSentences(paragraph)).toBeLessThanOrEqual(EDUCATIONAL_MAX_PARAGRAPH_SENTENCES);
    }
  });

  it.each(journeySpecs)('does not leak dev diagnostics text in %s', (spec) => {
    const { container } = render(
      <div>
        {spec.name === 'open-vented to sealed + unvented' ? <OpenVentedToSealedUnventedJourney /> : null}
        {spec.name === 'regular to regular + unvented' ? <RegularToRegularUnventedJourney /> : null}
        {spec.name === 'heat pump reality' ? <HeatPumpRealityJourney /> : null}
        {spec.name === 'water constraints' ? <WaterConstraintJourney /> : null}
      </div>,
    );

    const content = container.textContent?.toLowerCase() ?? '';
    expect(content).not.toMatch(/\bdiagnostic\b|\bdebug\b|\bfixture\b|\btrace\b|\bqa\b/);
  });

  it.each(journeySpecs)('keeps cards accessible in reduced motion mode for %s', (spec) => {
    const { container } = render(
      <div>
        {spec.name === 'open-vented to sealed + unvented' ? <OpenVentedToSealedUnventedJourney motionMode="off" /> : null}
        {spec.name === 'regular to regular + unvented' ? <RegularToRegularUnventedJourney motionMode="off" /> : null}
        {spec.name === 'heat pump reality' ? <HeatPumpRealityJourney motionMode="off" /> : null}
        {spec.name === 'water constraints' ? <WaterConstraintJourney motionMode="off" /> : null}
      </div>,
    );

    const root = container.querySelector('.atlas-edu-demo');
    expect(root).toHaveAttribute('data-motion', 'off');
    expect(screen.getAllByRole('article').length).toBeGreaterThan(5);
    expect(screen.getByLabelText('Journey comparison panel')).toBeInTheDocument();
  });

  it.each(journeySpecs)('includes print-safe layout blocks for %s', (spec) => {
    const { container } = render(
      <div>
        {spec.name === 'open-vented to sealed + unvented' ? <OpenVentedToSealedUnventedJourney /> : null}
        {spec.name === 'regular to regular + unvented' ? <RegularToRegularUnventedJourney /> : null}
        {spec.name === 'heat pump reality' ? <HeatPumpRealityJourney /> : null}
        {spec.name === 'water constraints' ? <WaterConstraintJourney /> : null}
      </div>,
    );

    const printSafeBlocks = container.querySelectorAll('[data-print-safe="true"]');
    expect(printSafeBlocks.length).toBeGreaterThanOrEqual(2);
  });
});
