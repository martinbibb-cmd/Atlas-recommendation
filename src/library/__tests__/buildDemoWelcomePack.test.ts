import { describe, expect, it } from 'vitest';
import { getContentForConcepts } from '../content/contentLookup';
import { buildDemoWelcomePack } from '../dev/buildDemoWelcomePack';
import { welcomePackDemoFixtureList } from '../dev/welcomePackDemoFixtures';

describe('buildDemoWelcomePack', () => {
  it('builds all demo fixtures successfully and returns archetype IDs', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      const result = buildDemoWelcomePack({ fixtureId: fixture.id });
      expect(result.plan.archetypeId.length).toBeGreaterThan(0);
      expect(result.viewModel.archetypeId).toBe(result.plan.archetypeId);
    }
  });

  it('keeps recommendedScenarioId unchanged through plan and view model', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      const result = buildDemoWelcomePack({ fixtureId: fixture.id });
      expect(result.plan.recommendedScenarioId).toBe(fixture.atlasDecision.recommendedScenarioId);
      expect(result.viewModel.recommendedScenarioId).toBe(fixture.atlasDecision.recommendedScenarioId);
      expect(result.calmViewModel.recommendedScenarioId).toBe(fixture.atlasDecision.recommendedScenarioId);
    }
  });

  it('includes selected concept content in the composed view model', () => {
    const { plan, viewModel } = buildDemoWelcomePack({ fixtureId: 'heat_pump_install' });
    const selectedContent = getContentForConcepts(plan.selectedConceptIds);
    const combinedSectionText = viewModel.sections.map((section) => section.placeholderText).join('\n');
    const hasComposedContent = viewModel.sections.some((section) => !section.placeholderText.startsWith('Content pending:'));

    expect(plan.selectedConceptIds.length).toBeGreaterThan(0);
    expect(hasComposedContent).toBe(true);
    if (selectedContent.length > 0) {
      expect(selectedContent.some((entry) => combinedSectionText.includes(entry.title))).toBe(true);
    }
  });

  it('surfaces omitted and deferred reasons in the view model summary', () => {
    const { viewModel } = buildDemoWelcomePack({ fixtureId: 'water_supply_constraint' });
    expect(viewModel.omittedSummary.omittedAssets.length).toBeGreaterThan(0);
    expect(viewModel.omittedSummary.omittedAssets.every((item) => item.reason.trim().length > 0)).toBe(true);
  });
});
