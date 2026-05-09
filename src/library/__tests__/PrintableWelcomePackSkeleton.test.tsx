import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PrintableWelcomePackViewModelV1 } from '../packRenderer/PrintableWelcomePackViewModelV1';
import { PrintableWelcomePackSkeleton } from '../packRenderer/PrintableWelcomePackSkeleton';

const viewModel: PrintableWelcomePackViewModelV1 = {
  packId: 'welcome-pack:ashp',
  archetypeId: 'heat_pump_install',
  recommendedScenarioId: 'ashp',
  title: 'Welcome pack skeleton — Air source heat pump with cylinder',
  subtitle: 'Content pending. Scenario: ashp.',
  pageEstimate: {
    usedPages: 3,
    maxPages: 4,
  },
  printNotes: [
    'Content pending: this renderer outputs a structured skeleton only.',
    'No recommendation logic is executed in this renderer.',
  ],
  sections: [
    {
      sectionId: 'calm_summary',
      title: 'Calm summary',
      purpose: 'Open with a short, low-friction summary.',
      conceptIds: ['system_work_explainer'],
      assetIds: ['SystemWorkExplainerCards'],
      placeholderText: 'Content pending: calm summary copy will be authored.',
      printPriority: 'must_print',
      cognitiveLoadEstimate: 'low',
    },
    {
      sectionId: 'why_this_fits',
      title: 'Why this fits',
      purpose: 'Explain why this exact scenario fits.',
      conceptIds: ['control_strategy'],
      assetIds: ['ControlsVisual'],
      placeholderText: 'Content pending: why-this-fits explanation copy will be authored.',
      printPriority: 'must_print',
      cognitiveLoadEstimate: 'medium',
    },
    {
      sectionId: 'living_with_the_system',
      title: 'Living with your system',
      purpose: 'Set day-to-day expectations.',
      conceptIds: [],
      assetIds: [],
      placeholderText: 'Content pending: living-with-the-system guidance will be authored.',
      printPriority: 'should_print',
      cognitiveLoadEstimate: 'low',
    },
    {
      sectionId: 'relevant_explainers',
      title: 'Relevant explainers',
      purpose: 'Collect static explainer cards.',
      conceptIds: [],
      assetIds: [],
      placeholderText: 'Content pending: explainer card copy will be authored.',
      printPriority: 'should_print',
      cognitiveLoadEstimate: 'low',
    },
    {
      sectionId: 'safety_and_compliance',
      title: 'Safety and compliance',
      purpose: 'Surface must-print safety concepts.',
      conceptIds: ['legionella_pasteurisation'],
      assetIds: ['HpCylinderDiagram'],
      placeholderText: 'Content pending: safety wording will be authored.',
      printPriority: 'must_print',
      cognitiveLoadEstimate: 'low',
    },
    {
      sectionId: 'optional_technical_appendix',
      title: 'Optional technical appendix',
      purpose: 'Provide optional technical depth.',
      conceptIds: [],
      assetIds: [],
      placeholderText: 'Content pending: appendix detail will be authored.',
      printPriority: 'digital_ok',
      cognitiveLoadEstimate: 'low',
    },
    {
      sectionId: 'next_steps',
      title: 'Next steps',
      purpose: 'Confirm immediate practical steps.',
      conceptIds: [],
      assetIds: [],
      placeholderText: 'Content pending: next-step checklist text will be authored.',
      printPriority: 'must_print',
      cognitiveLoadEstimate: 'low',
    },
  ],
  qrDestinations: [
    {
      assetId: 'FlowRestrictionAnimation',
      destination: 'atlas://educational-library/FlowRestrictionAnimation',
      conceptIds: ['flow_restriction'],
      reason: 'Deferred to QR deep dive to protect print budget and cognitive load.',
    },
  ],
  omittedSummary: {
    deferredConceptIds: ['flow_restriction'],
    omittedAssets: [
      {
        assetId: 'FlowRestrictionAnimation',
        reason: 'Deferred to QR deep dive to protect print budget and cognitive load.',
        conceptIds: ['flow_restriction'],
        deferredToQr: true,
      },
    ],
  },
};

describe('PrintableWelcomePackSkeleton', () => {
  it('renders semantic section headings', () => {
    render(<PrintableWelcomePackSkeleton viewModel={viewModel} />);

    expect(screen.getByRole('heading', { level: 1, name: /welcome pack skeleton/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'What Atlas found' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Why this fits' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Living with your system' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Relevant explainers' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Safety and compliance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'QR and deeper detail' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Next steps' })).toBeInTheDocument();
  });

  it('renders static asset placeholders instead of animation components', () => {
    render(<PrintableWelcomePackSkeleton viewModel={viewModel} />);

    expect(screen.getByTestId('pwps-asset-placeholder-FlowRestrictionAnimation')).toBeInTheDocument();
    expect(screen.getByTestId('pwps-asset-placeholder-SystemWorkExplainerCards')).toBeInTheDocument();
    expect(screen.queryByLabelText(/oversized boiler cycling pattern animation/i)).toBeNull();
    expect(screen.queryByLabelText(/flow restriction animation/i)).toBeNull();
  });
});
