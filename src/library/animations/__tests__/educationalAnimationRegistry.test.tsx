import { describe, expect, it } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { educationalAnimationRegistry } from '../educationalAnimationRegistry';
import { EducationalAnimationRenderer } from '../EducationalAnimationRenderer';
import { buildLibraryCoverageAudit } from '../../coverage/buildLibraryCoverageAudit';
import { buildLibraryAuthoringBacklog } from '../../coverage/backlog/buildLibraryAuthoringBacklog';

const FIRST_ANIMATION_ID = educationalAnimationRegistry[0]?.animationId ?? 'stored_hot_water_recovery';

describe('educationalAnimationRegistry', () => {
  it('every animation has a reduced-motion fallback', () => {
    expect(educationalAnimationRegistry.length).toBeGreaterThan(0);
    for (const animation of educationalAnimationRegistry) {
      expect(animation.reducedMotionFallback.trim().length).toBeGreaterThan(0);
    }
  });

  it('every animation has a screen-reader summary', () => {
    expect(educationalAnimationRegistry.length).toBeGreaterThan(0);
    for (const animation of educationalAnimationRegistry) {
      expect(animation.screenReaderSummary.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('EducationalAnimationRenderer', () => {
  it('print mode never renders motion controls and always uses print fallback', () => {
    render(<EducationalAnimationRenderer animationId={FIRST_ANIMATION_ID} mode="print" />);

    expect(screen.queryByRole('button', { name: /^play animation$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^pause animation$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^replay animation$/i })).toBeNull();
    expect(screen.getByTestId(`educational-animation-print-fallback-${FIRST_ANIMATION_ID}`)).toBeInTheDocument();
  });
});

describe('animation coverage and backlog expectation gates', () => {
  it('coverage hasAnimation is driven by canonical animation registry entries', () => {
    const audit = buildLibraryCoverageAudit();
    const cyclingConcept = audit.conceptCoverage.find((concept) => concept.conceptId === 'boiler_cycling');
    const pressureVsStorageConcept = audit.conceptCoverage.find((concept) => concept.conceptId === 'pressure_vs_storage');

    expect(cyclingConcept?.hasAnimation).toBe(false);
    expect(pressureVsStorageConcept?.hasAnimation).toBe(true);
  });

  it('no animation blocker exists for concepts that do not expect animation', () => {
    const audit = buildLibraryCoverageAudit();
    const backlog = buildLibraryAuthoringBacklog(audit);

    const animationGapsForNonExpectedConcepts = backlog.backlogItems.filter((item) => {
      if (item.gapType !== 'animation') return false;
      const coverage = audit.conceptCoverage.find((concept) => concept.conceptId === item.conceptId);
      return coverage?.expectsAnimation === false;
    });

    expect(animationGapsForNonExpectedConcepts).toEqual([]);
  });
});

describe('EducationalAnimationRenderer — digital mode controls', () => {
  it('digital mode renders Play and Replay controls for every registered animation', () => {
    for (const animation of educationalAnimationRegistry) {
      const { container, unmount } = render(
        <EducationalAnimationRenderer animationId={animation.animationId} mode="digital" />,
      );
      const scope = within(container);

      expect(
        scope.queryByRole('button', { name: /^play animation$/i }),
        `Animation "${animation.animationId}" is missing a Play button in digital mode`,
      ).not.toBeNull();
      expect(
        scope.queryByRole('button', { name: /^replay animation$/i }),
        `Animation "${animation.animationId}" is missing a Replay button in digital mode`,
      ).not.toBeNull();

      unmount();
      cleanup();
    }
  });
});

describe('EducationalAnimationRenderer — reduced-motion fallback', () => {
  it('reduced-motion mode renders a static fallback and no motion controls', () => {
    for (const animation of educationalAnimationRegistry) {
      const { container, unmount } = render(
        <EducationalAnimationRenderer
          animationId={animation.animationId}
          prefersReducedMotion
        />,
      );
      const scope = within(container);

      expect(
        scope.getByTestId(`educational-animation-reduced-motion-${animation.animationId}`),
        `Animation "${animation.animationId}" is missing reduced-motion container`,
      ).toBeTruthy();
      expect(
        scope.getByTestId(`educational-animation-reduced-motion-fallback-${animation.animationId}`),
        `Animation "${animation.animationId}" is missing reduced-motion static fallback`,
      ).toBeTruthy();
      expect(
        scope.queryByRole('button', { name: /^play animation$/i }),
        `Animation "${animation.animationId}" incorrectly shows a Play button in reduced-motion mode`,
      ).toBeNull();

      unmount();
      cleanup();
    }
  });
});

describe('EducationalAnimationRenderer — print/PDF mode', () => {
  it('print mode uses printFallback and never shows motion controls for every registered animation', () => {
    for (const animation of educationalAnimationRegistry) {
      const { container, unmount } = render(
        <EducationalAnimationRenderer animationId={animation.animationId} mode="print" />,
      );
      const scope = within(container);

      expect(
        scope.getByTestId(`educational-animation-print-fallback-${animation.animationId}`),
        `Animation "${animation.animationId}" is missing print-fallback in print mode`,
      ).toBeTruthy();
      expect(
        scope.queryByRole('button', { name: /^play animation$/i }),
        `Animation "${animation.animationId}" shows a Play button in print mode`,
      ).toBeNull();
      expect(
        scope.queryByRole('button', { name: /^pause animation$/i }),
        `Animation "${animation.animationId}" shows a Pause button in print mode`,
      ).toBeNull();
      expect(
        scope.queryByRole('button', { name: /^replay animation$/i }),
        `Animation "${animation.animationId}" shows a Replay button in print mode`,
      ).toBeNull();

      unmount();
      cleanup();
    }
  });
});

