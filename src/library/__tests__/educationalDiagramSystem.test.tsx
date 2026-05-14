import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  HeatPumpRealityJourney,
  OpenVentedToSealedUnventedJourney,
  RegularToRegularUnventedJourney,
  WaterConstraintJourney,
} from '../demoJourneys';
import {
  FlowRestrictionBottleneckDiagram,
  OpenVentedToUnventedDiagram,
  PressureVsStorageDiagram,
  StoredHotWaterRecoveryTimelineDiagram,
  SystemFitDecisionMapDiagram,
  WarmVsHotRadiatorsDiagram,
  WarmRadiatorEmitterSizingDiagram,
  WaterMainLimitationDiagram,
  WeatherCompensationCurveDiagram,
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

    it('SystemFitDecisionMapDiagram renders data-print-safe when printSafe=true', () => {
      const { container } = render(<SystemFitDecisionMapDiagram printSafe />);
      expect(container.querySelector('[data-print-safe="true"]')).toBeInTheDocument();
    });

    it('StoredHotWaterRecoveryTimelineDiagram renders data-print-safe when printSafe=true', () => {
      const { container } = render(<StoredHotWaterRecoveryTimelineDiagram printSafe />);
      expect(container.querySelector('[data-print-safe="true"]')).toBeInTheDocument();
    });

    it('WarmRadiatorEmitterSizingDiagram renders data-print-safe when printSafe=true', () => {
      const { container } = render(<WarmRadiatorEmitterSizingDiagram printSafe />);
      expect(container.querySelector('[data-print-safe="true"]')).toBeInTheDocument();
    });

    it('FlowRestrictionBottleneckDiagram renders data-print-safe when printSafe=true', () => {
      const { container } = render(<FlowRestrictionBottleneckDiagram printSafe />);
      expect(container.querySelector('[data-print-safe="true"]')).toBeInTheDocument();
    });

    it('WeatherCompensationCurveDiagram renders data-print-safe when printSafe=true', () => {
      const { container } = render(<WeatherCompensationCurveDiagram printSafe />);
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

    it('SystemFitDecisionMapDiagram has screen-reader summary', () => {
      const { container } = render(<SystemFitDecisionMapDiagram />);
      expect(container.querySelector('.atlas-edu-diagram__screen-reader-summary')).toBeInTheDocument();
    });

    it('StoredHotWaterRecoveryTimelineDiagram has screen-reader summary', () => {
      const { container } = render(<StoredHotWaterRecoveryTimelineDiagram />);
      expect(container.querySelector('.atlas-edu-diagram__screen-reader-summary')).toBeInTheDocument();
    });

    it('WarmRadiatorEmitterSizingDiagram has screen-reader summary', () => {
      const { container } = render(<WarmRadiatorEmitterSizingDiagram />);
      expect(container.querySelector('.atlas-edu-diagram__screen-reader-summary')).toBeInTheDocument();
    });

    it('FlowRestrictionBottleneckDiagram has screen-reader summary', () => {
      const { container } = render(<FlowRestrictionBottleneckDiagram />);
      expect(container.querySelector('.atlas-edu-diagram__screen-reader-summary')).toBeInTheDocument();
    });

    it('WeatherCompensationCurveDiagram has screen-reader summary', () => {
      const { container } = render(<WeatherCompensationCurveDiagram />);
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

      const { container: c5 } = render(<SystemFitDecisionMapDiagram />);
      expect(c5.querySelector('[aria-label]')).toBeInTheDocument();

      const { container: c6 } = render(<StoredHotWaterRecoveryTimelineDiagram />);
      expect(c6.querySelector('[aria-label]')).toBeInTheDocument();

      const { container: c7 } = render(<WarmRadiatorEmitterSizingDiagram />);
      expect(c7.querySelector('[aria-label]')).toBeInTheDocument();

      const { container: c8 } = render(<FlowRestrictionBottleneckDiagram />);
      expect(c8.querySelector('[aria-label]')).toBeInTheDocument();

      const { container: c9 } = render(<WeatherCompensationCurveDiagram />);
      expect(c9.querySelector('[aria-label]')).toBeInTheDocument();
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

    it('SystemFitDecisionMapDiagram shows explicit decision-step labels', () => {
      render(<SystemFitDecisionMapDiagram />);
      expect(screen.getByText('Step 1: Confirm demand pattern')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Confirm supply and pipework limits')).toBeInTheDocument();
      expect(screen.getByText('Step 3: Confirm heat-delivery path')).toBeInTheDocument();
    });

    it('FlowRestrictionBottleneckDiagram shows bottleneck text labels', () => {
      render(<FlowRestrictionBottleneckDiagram />);
      expect(screen.getByText('Bottleneck section (restricted bore or legacy pipework)')).toBeInTheDocument();
      expect(screen.getByText('Throughput capped at restriction point')).toBeInTheDocument();
    });

    it('WeatherCompensationCurveDiagram shows curve point labels as text', () => {
      render(<WeatherCompensationCurveDiagram />);
      expect(screen.getByText(/-2°C outside/i)).toBeInTheDocument();
      expect(screen.getByText(/16°C outside/i)).toBeInTheDocument();
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

    it('registry has exactly nine entries', () => {
      expect(diagramExplanationRegistry).toHaveLength(9);
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

    it('HeatPumpRealityJourney contains visual explanations section', () => {
      render(<HeatPumpRealityJourney />);
      expect(screen.getByRole('region', { name: 'Visual explanations' })).toBeInTheDocument();
    });

    it('WaterConstraintJourney contains visual explanations section', () => {
      render(<WaterConstraintJourney />);
      expect(screen.getByRole('region', { name: 'Visual explanations' })).toBeInTheDocument();
    });

    it('HeatPumpRealityJourney renders diagram wrappers', () => {
      const { container } = render(<HeatPumpRealityJourney />);
      const wrappers = container.querySelectorAll('.atlas-edu-diagram__wrapper');
      expect(wrappers.length).toBeGreaterThan(0);
    });

    it('WaterConstraintJourney renders diagram wrappers', () => {
      const { container } = render(<WaterConstraintJourney />);
      const wrappers = container.querySelectorAll('.atlas-edu-diagram__wrapper');
      expect(wrappers.length).toBeGreaterThan(0);
    });
  });
});
