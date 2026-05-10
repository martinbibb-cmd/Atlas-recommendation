import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PrintableWelcomePackViewModelV1 } from '../packRenderer/PrintableWelcomePackViewModelV1';
import { PrintableWelcomePackSkeleton } from '../packRenderer/PrintableWelcomePackSkeleton';

const viewModel: PrintableWelcomePackViewModelV1 = {
  packId: 'welcome-pack:print-equivalents',
  archetypeId: 'boiler_replacement',
  recommendedScenarioId: 'combi',
  title: 'Welcome pack skeleton — print equivalent checks',
  subtitle: 'Content pending. Scenario: combi.',
  pageEstimate: {
    usedPages: 2,
    maxPages: 4,
  },
  printNotes: [
    'Content pending: this renderer outputs a structured skeleton only.',
    'No recommendation logic is executed in this renderer.',
  ],
  sections: [
    {
      sectionId: 'calm_summary',
      title: 'What Atlas found',
      purpose: 'Open with a short, low-friction summary.',
      conceptIds: ['physics_myth_busting', 'system_fit_explanation'],
      assetIds: ['WhatIfLab', 'SystemWorkExplainerCards'],
      placeholderText: 'Content pending.',
      printPriority: 'must_print',
      cognitiveLoadEstimate: 'low',
    },
    {
      sectionId: 'why_this_fits',
      title: 'Why this fits',
      purpose: 'Explain why this exact scenario fits.',
      conceptIds: ['boiler_cycling', 'load_matching'],
      assetIds: ['BoilerCyclingAnimation'],
      placeholderText: 'Content pending.',
      printPriority: 'must_print',
      cognitiveLoadEstimate: 'medium',
    },
    {
      sectionId: 'living_with_the_system',
      title: 'Living with your system',
      purpose: 'Set day-to-day expectations.',
      conceptIds: [],
      assetIds: [],
      placeholderText: 'Content pending.',
      printPriority: 'should_print',
      cognitiveLoadEstimate: 'low',
    },
    {
      sectionId: 'relevant_explainers',
      title: 'Relevant explainers',
      purpose: 'Collect static explainer cards.',
      conceptIds: ['flow_restriction', 'pipework_constraint', 'emitter_sizing', 'flow_temperature'],
      assetIds: ['FlowRestrictionAnimation', 'RadiatorUpgradeAnimation'],
      placeholderText: 'Content pending.',
      printPriority: 'should_print',
      cognitiveLoadEstimate: 'medium',
    },
    {
      sectionId: 'safety_and_compliance',
      title: 'Safety and compliance',
      purpose: 'Surface must-print safety concepts.',
      conceptIds: [],
      assetIds: [],
      placeholderText: 'Content pending.',
      printPriority: 'must_print',
      cognitiveLoadEstimate: 'low',
    },
    {
      sectionId: 'optional_technical_appendix',
      title: 'Optional technical appendix',
      purpose: 'Provide optional technical depth.',
      conceptIds: [],
      assetIds: [],
      placeholderText: 'Content pending.',
      printPriority: 'digital_ok',
      cognitiveLoadEstimate: 'low',
    },
    {
      sectionId: 'next_steps',
      title: 'Next steps',
      purpose: 'Confirm immediate practical steps.',
      conceptIds: [],
      assetIds: [],
      placeholderText: 'Content pending.',
      printPriority: 'must_print',
      cognitiveLoadEstimate: 'low',
    },
  ],
  qrDestinations: [],
  omittedSummary: {
    deferredConceptIds: [],
    omittedAssets: [],
  },
};

describe('PrintableWelcomePackSkeleton print-equivalent rendering', () => {
  it('renders print-equivalent cards for core animation assets and uses placeholders for non-equivalent assets', () => {
    render(<PrintableWelcomePackSkeleton viewModel={viewModel} />);

    expect(screen.getByTestId('pwps-print-equivalent-WhatIfLab')).toBeInTheDocument();
    expect(screen.getByTestId('pwps-print-equivalent-BoilerCyclingAnimation')).toBeInTheDocument();
    expect(screen.getByTestId('pwps-print-equivalent-FlowRestrictionAnimation')).toBeInTheDocument();
    expect(screen.getByTestId('pwps-print-equivalent-RadiatorUpgradeAnimation')).toBeInTheDocument();

    expect(screen.getByTestId('pwps-asset-placeholder-SystemWorkExplainerCards')).toBeInTheDocument();
    expect(screen.queryByTestId('pwps-asset-placeholder-WhatIfLab')).toBeNull();
    expect(screen.queryByTestId('pwps-asset-placeholder-BoilerCyclingAnimation')).toBeNull();
  });

  it('does not render live animation components in print skeleton output', () => {
    render(<PrintableWelcomePackSkeleton viewModel={viewModel} />);

    expect(screen.queryByLabelText(/Oversized boiler cycling pattern animation/i)).toBeNull();
    expect(screen.queryByLabelText(/flow restriction animation/i)).toBeNull();
    expect(screen.queryByLabelText(/radiator upgrade animation/i)).toBeNull();
  });
});
