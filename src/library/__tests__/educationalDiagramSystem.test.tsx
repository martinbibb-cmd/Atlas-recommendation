import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  OpenVentedToSealedUnventedJourney,
  RegularToRegularUnventedJourney,
} from '../demoJourneys';
import {
  OpenVentedToUnventedDiagram,
  PressureVsStorageDiagram,
  WarmVsHotRadiatorsDiagram,
  WaterMainLimitationDiagram,
  diagramExplanationRegistry,
} from '../diagrams';

const diagramsCss = readFileSync(
  `${process.cwd()}/src/library/diagrams/diagrams.css`,
  'utf8',
);

describe('educationalDiagramSystem', () => {
  describe('print-safe rendering', () => {
    it('PressureVsStorageDiagram renders data-print-safe when printSafe=true', () => {
      const { container } = render(<PressureVsStorageDiagram printSafe />);
      expect(container.querySelector('[data-print-safe="true"]')).toBeInTheDocument();
    });

    it('WarmVsHotRadiatorsDiagram renders data-print-safe when printSafe=true', () => {
      const { container } = render(<WarmVsHotRadiatorsDiagram printSafe />);
      expect(container.querySelector('[data-print-safe="true"]')).toBeInTheDocument();
    });

    it('WaterMainLimitationDiagram renders data-print-safe when printSafe=true', () => {
      const { container } = render(<WaterMainLimitationDiagram printSafe />);
      expect(container.querySelector('[data-print-safe="true"]')).toBeInTheDocument();
    });

    it('OpenVentedToUnventedDiagram renders data-print-safe when printSafe=true', () => {
      const { container } = render(<OpenVentedToUnventedDiagram printSafe />);
      expect(container.querySelector('[data-print-safe="true"]')).toBeInTheDocument();
    });

    it('diagrams do not render data-print-safe by default', () => {
      const { container } = render(<PressureVsStorageDiagram />);
      expect(container.querySelector('[data-print-safe="true"]')).not.toBeInTheDocument();
    });
  });

  describe('reduced-motion rendering', () => {
    it('diagrams.css contains data-motion=off reduced-motion rule', () => {
      expect(diagramsCss).toContain("[data-motion='off'] .atlas-edu-diagram-primitives *");
    });

    it('diagrams.css contains data-motion=reduce reduced-motion rule', () => {
      expect(diagramsCss).toContain("[data-motion='reduce'] .atlas-edu-diagram-primitives *");
    });

    it('diagrams.css contains prefers-reduced-motion media query', () => {
      expect(diagramsCss).toContain('@media (prefers-reduced-motion: reduce)');
    });

    it('diagrams.css suppresses animation in reduced motion', () => {
      expect(diagramsCss).toContain('animation: none !important');
      expect(diagramsCss).toContain('transition-duration: 0.01ms !important');
    });
  });

  describe('screen-reader summary exists', () => {
    it('PressureVsStorageDiagram has screen-reader summary', () => {
      const { container } = render(<PressureVsStorageDiagram />);
      expect(container.querySelector('.atlas-edu-diagram__screen-reader-summary')).toBeInTheDocument();
    });

    it('WarmVsHotRadiatorsDiagram has screen-reader summary', () => {
      const { container } = render(<WarmVsHotRadiatorsDiagram />);
      expect(container.querySelector('.atlas-edu-diagram__screen-reader-summary')).toBeInTheDocument();
    });

    it('WaterMainLimitationDiagram has screen-reader summary', () => {
      const { container } = render(<WaterMainLimitationDiagram />);
      expect(container.querySelector('.atlas-edu-diagram__screen-reader-summary')).toBeInTheDocument();
    });

    it('OpenVentedToUnventedDiagram has screen-reader summary', () => {
      const { container } = render(<OpenVentedToUnventedDiagram />);
      expect(container.querySelector('.atlas-edu-diagram__screen-reader-summary')).toBeInTheDocument();
    });

    it('each diagram has an aria-label', () => {
      const { container: c1 } = render(<PressureVsStorageDiagram />);
      expect(c1.querySelector('[aria-label]')).toBeInTheDocument();

      const { container: c2 } = render(<WarmVsHotRadiatorsDiagram />);
      expect(c2.querySelector('[aria-label]')).toBeInTheDocument();

      const { container: c3 } = render(<WaterMainLimitationDiagram />);
      expect(c3.querySelector('[aria-label]')).toBeInTheDocument();

      const { container: c4 } = render(<OpenVentedToUnventedDiagram />);
      expect(c4.querySelector('[aria-label]')).toBeInTheDocument();
    });
  });

  describe('no colour-only communication', () => {
    it('PressureVsStorageDiagram shows text labels alongside visual indicators', () => {
      render(<PressureVsStorageDiagram />);
      expect(screen.getByText('Mains pressure')).toBeInTheDocument();
      expect(screen.getByText('High (2–4 bar)')).toBeInTheDocument();
      expect(screen.getByText('Unvented cylinder')).toBeInTheDocument();
      expect(screen.getByText('Shower')).toBeInTheDocument();
    });

    it('WarmVsHotRadiatorsDiagram shows text labels for temperature ranges', () => {
      render(<WarmVsHotRadiatorsDiagram />);
      expect(screen.getByText('Surface: 35–50°C')).toBeInTheDocument();
      expect(screen.getByText('Surface: 65–80°C')).toBeInTheDocument();
    });

    it('WaterMainLimitationDiagram shows text labels for flow and outlets', () => {
      render(<WaterMainLimitationDiagram />);
      expect(screen.getByText('Incoming main — fixed limit')).toBeInTheDocument();
      expect(screen.getByText('Set by street supply')).toBeInTheDocument();
    });

    it('OpenVentedToUnventedDiagram shows before and after text labels', () => {
      render(<OpenVentedToUnventedDiagram />);
      expect(screen.getByText('Before: open-vented')).toBeInTheDocument();
      expect(screen.getByText('After: sealed + unvented')).toBeInTheDocument();
    });
  });

  describe('diagrams map to taxonomy concepts', () => {
    it('all registry entries have non-empty conceptIds', () => {
      for (const entry of diagramExplanationRegistry) {
        expect(entry.conceptIds.length).toBeGreaterThan(0);
      }
    });

    it('all registry entries have non-empty misconceptionsTargeted', () => {
      for (const entry of diagramExplanationRegistry) {
        expect(entry.misconceptionsTargeted.length).toBeGreaterThan(0);
      }
    });

    it('all registry entries have non-empty journeyIds', () => {
      for (const entry of diagramExplanationRegistry) {
        expect(entry.journeyIds.length).toBeGreaterThan(0);
      }
    });

    it('all registry entries have non-empty screenReaderSummary and whatThisMeans', () => {
      for (const entry of diagramExplanationRegistry) {
        expect(entry.screenReaderSummary.length).toBeGreaterThan(0);
        expect(entry.whatThisMeans.length).toBeGreaterThan(0);
      }
    });

    it('registry has exactly four entries', () => {
      expect(diagramExplanationRegistry).toHaveLength(4);
    });
  });

  describe('golden journeys render diagrams', () => {
    it('OpenVentedToSealedUnventedJourney renders diagram wrappers', () => {
      const { container } = render(<OpenVentedToSealedUnventedJourney />);
      const wrappers = container.querySelectorAll('.atlas-edu-diagram__wrapper');
      expect(wrappers.length).toBeGreaterThan(0);
    });

    it('RegularToRegularUnventedJourney renders diagram wrappers', () => {
      const { container } = render(<RegularToRegularUnventedJourney />);
      const wrappers = container.querySelectorAll('.atlas-edu-diagram__wrapper');
      expect(wrappers.length).toBeGreaterThan(0);
    });

    it('OpenVentedToSealedUnventedJourney contains visual explanations section', () => {
      render(<OpenVentedToSealedUnventedJourney />);
      expect(screen.getByRole('region', { name: 'Visual explanations' })).toBeInTheDocument();
    });

    it('RegularToRegularUnventedJourney contains visual explanations section', () => {
      render(<RegularToRegularUnventedJourney />);
      expect(screen.getByRole('region', { name: 'Visual explanations' })).toBeInTheDocument();
    });
  });
});
