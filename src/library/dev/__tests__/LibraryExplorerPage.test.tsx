import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LibraryExplorerPage } from '../LibraryExplorerPage';
import { educationalAnimationRegistry } from '../../animations/educationalAnimationRegistry';
import { diagramExplanationRegistry } from '../../diagrams/diagramExplanationRegistry';
import { DEV_UI_REGISTRY } from '../../../dev/devUiRegistry';

describe('LibraryExplorerPage', () => {
  it('appears in the dev menu inventory registry', () => {
    const entry = DEV_UI_REGISTRY.find((item) => item.codeName === 'LibraryExplorerPage');
    expect(entry).toBeDefined();
    expect(entry?.commonName).toBe('Library Explorer');
    expect(entry?.routePath).toBe('/dev/library-explorer');
    expect(entry?.access).toBe('dev_only');
  });

  it('animations tab lists all registered animation IDs', () => {
    render(<LibraryExplorerPage />);
    fireEvent.click(screen.getByTestId('library-explorer-tab-animations'));

    for (const animation of educationalAnimationRegistry) {
      expect(screen.getByTestId(`library-explorer-animation-${animation.animationId}`)).toBeTruthy();
      expect(screen.getByText(animation.animationId)).toBeTruthy();
    }
  });

  it('each animation previews digital, reduced-motion, and print modes', () => {
    render(<LibraryExplorerPage />);
    fireEvent.click(screen.getByTestId('library-explorer-tab-animations'));

    for (const animation of educationalAnimationRegistry) {
      expect(screen.getByTestId(`educational-animation-${animation.animationId}`)).toBeTruthy();
      expect(screen.getByTestId(`educational-animation-reduced-motion-${animation.animationId}`)).toBeTruthy();
      expect(screen.getByTestId(`educational-animation-print-${animation.animationId}`)).toBeTruthy();
    }
  });

  it('journey tab shows animation mappings', () => {
    render(<LibraryExplorerPage />);
    fireEvent.click(screen.getByTestId('library-explorer-tab-journeys'));

    const animationsByJourney = new Map<string, string[]>();
    for (const animation of educationalAnimationRegistry) {
      for (const journeyId of animation.journeyIds) {
        const current = animationsByJourney.get(journeyId) ?? [];
        animationsByJourney.set(journeyId, [...current, animation.animationId]);
      }
    }

    for (const [journeyId, animationIds] of animationsByJourney.entries()) {
      const card = screen.getByTestId(`library-explorer-journey-${journeyId}`);
      for (const animationId of animationIds) {
        expect(card.textContent).toContain(animationId);
      }
    }
  });

  it('concept tab shows linked diagrams and animations for concepts with both', () => {
    render(<LibraryExplorerPage />);
    fireEvent.click(screen.getByTestId('library-explorer-tab-concepts'));

    const conceptWithBoth = (() => {
      for (const animation of educationalAnimationRegistry) {
        const conceptId = animation.conceptIds.find((id) =>
          diagramExplanationRegistry.some((diagram) => diagram.conceptIds.includes(id)),
        );
        if (!conceptId) continue;
        const diagramId = diagramExplanationRegistry.find((diagram) => diagram.conceptIds.includes(conceptId))?.diagramId;
        if (diagramId) return { conceptId, animationId: animation.animationId, diagramId };
      }
      return undefined;
    })();

    expect(conceptWithBoth).toBeDefined();
    const conceptCard = screen.getByTestId(`library-explorer-concept-${conceptWithBoth!.conceptId}`);
    expect(conceptCard.textContent).toContain(conceptWithBoth!.animationId);
    expect(conceptCard.textContent).toContain(conceptWithBoth!.diagramId);
  });

  it('has no invisible animation registry entries', () => {
    render(<LibraryExplorerPage />);
    fireEvent.click(screen.getByTestId('library-explorer-tab-animations'));

    const visibleCards = educationalAnimationRegistry.filter((animation) =>
      screen.queryByTestId(`library-explorer-animation-${animation.animationId}`) != null,
    );

    expect(visibleCards).toHaveLength(educationalAnimationRegistry.length);
  });

  it('production-ready filter narrows diagram inventory to customer-ready production visuals', () => {
    render(<LibraryExplorerPage />);
    fireEvent.click(screen.getByTestId('library-explorer-tab-diagrams'));
    fireEvent.click(screen.getByTestId('library-explorer-visual-filter-production_ready'));

    const productionReady = diagramExplanationRegistry.filter(
      (diagram) => diagram.visualStatus === 'production_ready' && diagram.customerReady,
    );

    for (const diagram of productionReady) {
      expect(screen.getByTestId(`library-explorer-diagram-${diagram.diagramId}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('library-explorer-diagram-system_fit_decision_map')).toBeNull();
  });

  it('needs redesign filter shows draft and placeholder visuals that still need replacement', () => {
    render(<LibraryExplorerPage />);
    fireEvent.click(screen.getByTestId('library-explorer-tab-animations'));
    fireEvent.click(screen.getByTestId('library-explorer-visual-filter-needs_redesign'));

    expect(screen.queryByTestId('library-explorer-animation-water_main_bottleneck')).toBeNull();
    expect(screen.getByTestId('library-explorer-animation-stored_hot_water_recovery')).toBeTruthy();
  });
});
