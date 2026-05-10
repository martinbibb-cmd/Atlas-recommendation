import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CalmWelcomePackViewModelV1 } from '../packRenderer/CalmWelcomePackViewModelV1';
import { CalmWelcomePack } from '../packRenderer/CalmWelcomePack';

const safeViewModel: CalmWelcomePackViewModelV1 = {
  packId: 'welcome-pack:customer-safe',
  recommendedScenarioId: 'ashp',
  title: 'Welcome pack — Air source heat pump with cylinder',
  brandName: 'Atlas',
  brandLogoUrl: 'https://example.com/atlas-logo.svg',
  brandContactLabel: 'hello@atlas.example',
  brandTone: 'technical',
  generatedAt: '2026-05-10T00:00:00.000Z',
  visitReference: 'VIS-123',
  customerFacingSections: [
    {
      sectionId: 'calm_summary',
      title: 'What Atlas found',
      cards: [
        {
          title: 'Decision summary',
          summary: 'This setup fits your home and comfort pattern.',
        },
      ],
    },
    {
      sectionId: 'why_this_fits',
      title: 'Why this fits',
      cards: [
        {
          assetId: 'asset-why',
          conceptId: 'concept-why',
          title: 'Stable comfort',
          summary: 'Steady flow temperatures support reliable comfort.',
        },
      ],
    },
    {
      sectionId: 'living_with_the_system',
      title: 'Living with your system',
      cards: [
        {
          assetId: 'asset-living',
          conceptId: 'concept-living',
          title: 'Daily use',
          summary: 'Small steady adjustments work better than large swings.',
        },
      ],
    },
    {
      sectionId: 'relevant_explainers',
      title: 'Relevant explainers',
      cards: [
        {
          assetId: 'asset-explainer',
          conceptId: 'concept-explainer',
          title: 'Flow temperature guide',
          summary: 'Lower flow temperatures can improve seasonal performance.',
        },
      ],
    },
    {
      sectionId: 'safety_and_compliance',
      title: 'Safety and compliance',
      cards: [
        {
          assetId: 'asset-safety',
          conceptId: 'concept-safety',
          title: 'Safety checks',
          summary: 'Keep discharge paths clear and accessible.',
          safetyNotice: 'Do not cap or block safety discharge routes.',
        },
      ],
    },
    {
      sectionId: 'next_steps',
      title: 'Next steps',
      cards: [
        {
          assetId: 'asset-next',
          conceptId: 'concept-next',
          title: 'Installer visit',
          summary: 'Arrange a final suitability check and installation date.',
        },
      ],
    },
  ],
  qrDestinations: [
    {
      assetId: 'asset-deep',
      destination: 'atlas://educational-library/asset-deep',
      title: 'Deep detail guide',
      reason: 'Deferred to deeper detail.',
    },
  ],
  internalOmissionLog: [
    {
      sectionId: 'optional_technical_appendix',
      reason: 'internal diagnostic note',
    },
  ],
  pageEstimate: {
    usedPages: 4,
    maxPages: 4,
  },
  readiness: {
    safeForCustomer: true,
    blockingReasons: [],
  },
};

describe('CalmWelcomePack', () => {
  it('renders a blocking panel only when view model is not safe for customer output', () => {
    render(
      <CalmWelcomePack
        viewModel={{
          ...safeViewModel,
          readiness: {
            safeForCustomer: false,
            blockingReasons: ['Eligibility filter missing.'],
          },
        }}
      />,
    );

    expect(screen.getByTestId('cwpr-blocking-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('cwpr-document')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Why this fits' })).toBeNull();
  });

  it('renders customer-safe sections, semantic headings, and QR destination labels', () => {
    render(<CalmWelcomePack viewModel={safeViewModel} />);

    expect(screen.getByRole('heading', { level: 1, name: safeViewModel.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'What Atlas found' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Why this fits' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Living with your system' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Relevant explainers' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Safety and compliance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'QR and deeper detail' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Next steps' })).toBeInTheDocument();
    expect(screen.getByText(/QR destination label:/i)).toBeInTheDocument();
  });

  it('renders optional brand metadata header and footer when present', () => {
    render(<CalmWelcomePack viewModel={safeViewModel} />);

    expect(screen.getByTestId('cwpr-brand-header')).toBeInTheDocument();
    expect(screen.getByAltText('Atlas logo')).toBeInTheDocument();
    expect(screen.getByText('Atlas')).toBeInTheDocument();

    expect(screen.getByTestId('cwpr-brand-footer')).toBeInTheDocument();
    expect(screen.getByText('Contact: hello@atlas.example')).toBeInTheDocument();
    expect(screen.getByText('Reference: VIS-123')).toBeInTheDocument();
    expect(screen.getByText('Generated: 2026-05-10T00:00:00.000Z')).toBeInTheDocument();
  });

  it('does not render branded customer content when the pack is blocked', () => {
    render(
      <CalmWelcomePack
        viewModel={{
          ...safeViewModel,
          readiness: {
            safeForCustomer: false,
            blockingReasons: ['Eligibility filter missing.'],
          },
        }}
      />,
    );

    expect(screen.getByTestId('cwpr-blocking-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('cwpr-brand-header')).toBeNull();
    expect(screen.queryByTestId('cwpr-brand-footer')).toBeNull();
    expect(screen.queryByText('Atlas')).toBeNull();
    expect(screen.queryByText('Reference: VIS-123')).toBeNull();
  });

  it('does not render internal omission log text, QA/audit/eligibility words, or content-pending placeholders', () => {
    const { container } = render(<CalmWelcomePack viewModel={safeViewModel} />);
    const output = (container.textContent ?? '').toLowerCase();

    expect(output).not.toContain('internal diagnostic note');
    expect(output).not.toContain('qa');
    expect(output).not.toContain('audit');
    expect(output).not.toContain('eligibility');
    expect(output).not.toContain('content pending');
  });

  it('imports print stylesheet path and applies print-friendly class names', () => {
    expect(existsSync(path.resolve(process.cwd(), 'src/library/packRenderer/calmWelcomePack.css'))).toBe(true);

    const { container } = render(<CalmWelcomePack viewModel={safeViewModel} />);
    expect(container.querySelector('.cwpr-print-friendly')).not.toBeNull();
  });
});
