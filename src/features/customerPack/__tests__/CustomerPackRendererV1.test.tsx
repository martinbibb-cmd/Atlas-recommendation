import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CUSTOMER_EVIDENCE_SECTION_IDS_V1,
  LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1,
  buildCustomerEvidencePackV1,
  buildDhwRecoveryMetricsV1,
  buildHydraulicConfidenceReportV1,
  buildLegoTechnixExplainabilityReportV1,
  runLegoTechnixScenarioV1,
} from '../../legoTechnix';
import type { CustomerEvidencePackV1 } from '../../legoTechnix';
import type { LegoTechnixSimulationStateV1 } from '../../legoTechnix/simulation/LegoTechnixSimulationStateV1';
import { CustomerPackRendererV1 } from '../CustomerPackRendererV1';

afterEach(() => {
  cleanup();
});

function cloneState(state: LegoTechnixSimulationStateV1): LegoTechnixSimulationStateV1 {
  return JSON.parse(JSON.stringify(state)) as LegoTechnixSimulationStateV1;
}

function buildPackFromTemplate(
  templateId: string,
  recommendationSummary = 'Locked recommendation summary from the recommendation engine.',
): CustomerEvidencePackV1 {
  const template = LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1.find((entry) => entry.id === templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const scenarioResult = runLegoTechnixScenarioV1({
    graph: template.graph,
    initialState: cloneState(template.initialState),
    ...template.scenario,
  });
  const dhwRecoveryMetrics = buildDhwRecoveryMetricsV1(scenarioResult);
  const hydraulicConfidenceReport = buildHydraulicConfidenceReportV1(template.graph, {
    ...scenarioResult,
    dhwRecoveryMetrics,
  });
  const explainabilityReport = buildLegoTechnixExplainabilityReportV1({
    graph: template.graph,
    scenarioResult,
    dhwRecoveryMetrics,
    hydraulicConfidenceReport,
  });

  return buildCustomerEvidencePackV1({
    lockedRecommendation: {
      systemLabel: template.label,
      systemType: template.systemType,
      recommendationSummary,
    },
    explainabilityReport,
    hydraulicConfidenceReport,
    dhwRecoveryMetrics,
    scenarioResult,
  });
}

const CANONICAL_TEMPLATES = [...LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1];

describe('CustomerPackRendererV1', () => {
  it('renders all 10 canonical sections deterministically for every canonical template', () => {
    for (const template of LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1) {
      const pack = buildPackFromTemplate(template.id, `Locked summary for ${template.label}`);
      const first = render(<CustomerPackRendererV1 pack={pack} />).container.innerHTML;
      cleanup();
      const second = render(<CustomerPackRendererV1 pack={pack} />).container.innerHTML;
      cleanup();

      expect(first).toBe(second);

      const { container } = render(<CustomerPackRendererV1 pack={pack} />);
      const renderedSections = Array.from(
        container.querySelectorAll<HTMLElement>('.cprv1-section'),
      ).map((element) => element.dataset.testid?.replace('cprv1-section-', ''));

      expect(renderedSections).toEqual([...CUSTOMER_EVIDENCE_SECTION_IDS_V1]);
      cleanup();
    }
  });

  it('consumes CustomerEvidencePackV1 only and does not import recommendation builders', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/features/customerPack/CustomerPackRendererV1.tsx'),
      'utf8',
    );

    expect(source).toContain('CustomerEvidencePackV1');
    expect(source).not.toMatch(/AtlasDecisionV1|ScenarioResult|buildCustomerPackV1|buildCustomerEvidencePackV1/);
  });

  it('renders recommendation text verbatim', () => {
    const verbatimSummary = 'Verbatim summary — do not reinterpret, rank, or rewrite this sentence.';
    const pack = buildPackFromTemplate('template_heat_pump_unvented_weather_comp', verbatimSummary);
    const lockedPack: CustomerEvidencePackV1 = {
      ...pack,
      systemLabel: 'Locked recommendation label — exact customer wording',
      recommendationSummary: verbatimSummary,
    };

    render(<CustomerPackRendererV1 pack={lockedPack} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(lockedPack.systemLabel);
    expect(screen.getByTestId('cprv1-recommendation-summary').textContent).toBe(verbatimSummary);
    expect(screen.getByText('Chosen system label').nextElementSibling?.textContent).toBe(
      lockedPack.systemLabel,
    );
  });

  it('renders recommendation evidence blocks for fit, simulation, and confirmation', () => {
    const pack = buildPackFromTemplate('template_heat_pump_unvented_weather_comp');
    render(<CustomerPackRendererV1 pack={pack} />);

    const evidence = screen.getByTestId('cprv1-recommendation-evidence');
    expect(within(evidence).getByText('Why it fits this household')).toBeTruthy();
    expect(within(evidence).getByText('What Atlas simulated')).toBeTruthy();
    expect(within(evidence).getByText('What remains to be confirmed')).toBeTruthy();
  });

  it('contains no recommendation logic and renders inconsistent evidence verbatim', () => {
    const pack = buildPackFromTemplate('template_regular_boiler_vented_cylinder_y_plan');
    const lockedPack: CustomerEvidencePackV1 = {
      ...pack,
      systemLabel: 'Locked label only',
      recommendationSummary: 'Chosen elsewhere. Renderer must not second-guess this text.',
      sections: pack.sections.map((section, index) =>
        index === 0
          ? {
              ...section,
              summary: 'Home understanding remains evidence-only even when recommendation copy changes.',
            }
          : section,
      ),
    };

    render(<CustomerPackRendererV1 pack={lockedPack} />);

    expect(screen.getByText('Chosen elsewhere. Renderer must not second-guess this text.')).toBeTruthy();
    expect(
      screen.getAllByText('Home understanding remains evidence-only even when recommendation copy changes.'),
    ).toHaveLength(2);
  });

  it('renders customer-safe confidence wording strings only', () => {
    const pack = buildPackFromTemplate('template_regular_boiler_vented_cylinder_y_plan');
    const confidencePack: CustomerEvidencePackV1 = {
      ...pack,
      sections: pack.sections.map((section, index) =>
        index === 0
          ? {
              ...section,
              cards: [
                ...section.cards,
                {
                  type: 'confidence_story',
                  heading: 'Confidence wording coverage',
                  summary: 'Customer-safe wording coverage.',
                  metrics: [
                    { label: 'Measured', value: 'Confirmed', confidenceWording: 'Measured during the visit' },
                    { label: 'Manufacturer', value: 'Confirmed', confidenceWording: 'Based on manufacturer information' },
                    { label: 'Estimated', value: 'Derived', confidenceWording: 'Estimated from the visible system layout' },
                    { label: 'Assumed', value: 'Pending', confidenceWording: 'Pipe route not fully confirmed' },
                    { label: 'Unknown', value: 'Pending', confidenceWording: 'Requires installer confirmation' },
                  ],
                  warnings: [],
                  confidenceWording: 'Measured during the visit',
                },
              ],
            }
          : section,
      ),
    };

    render(<CustomerPackRendererV1 pack={confidencePack} />);

    expect(screen.getAllByText('Measured during the visit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Based on manufacturer information').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Estimated from the visible system layout').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pipe route not fully confirmed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Requires installer confirmation').length).toBeGreaterThan(0);
    expect(screen.queryByText('derived')).toBeNull();
    expect(screen.queryByText('unknown')).toBeNull();
  });

  it('maps warning severities to print-safe warning chips', () => {
    const pack = buildPackFromTemplate('template_regular_boiler_vented_cylinder_y_plan');
    const warningPack: CustomerEvidencePackV1 = {
      ...pack,
      sections: [
        {
          ...pack.sections[0],
          warnings: [
            { category: 'uncertainty', severity: 'info', message: 'Info warning' },
            { category: 'comfort', severity: 'attention', message: 'Attention warning' },
            { category: 'hydraulic_risk', severity: 'important', message: 'Important warning' },
          ],
          cards: [
            {
              ...pack.sections[0].cards[0],
              warnings: [
                { category: 'uncertainty', severity: 'info', message: 'Card info warning' },
                { category: 'comfort', severity: 'attention', message: 'Card attention warning' },
                { category: 'hydraulic_risk', severity: 'important', message: 'Card important warning' },
              ],
            },
          ],
        },
        ...pack.sections.slice(1),
      ],
    };

    const { container } = render(<CustomerPackRendererV1 pack={warningPack} />);
    const infoChip = within(container).getByText('Info warning').closest('[data-severity]');
    const attentionChip = within(container).getByText('Attention warning').closest('[data-severity]');
    const importantChip = within(container).getByText('Important warning').closest('[data-severity]');

    expect(infoChip?.getAttribute('data-severity')).toBe('info');
    expect(attentionChip?.getAttribute('data-severity')).toBe('attention');
    expect(importantChip?.getAttribute('data-severity')).toBe('important');
  });

  it('renders timeline summaries deterministically', () => {
    const pack = buildPackFromTemplate('template_system_boiler_unvented_cylinder_s_plan');
    const first = render(<CustomerPackRendererV1 pack={pack} />).container.textContent;
    cleanup();
    const second = render(<CustomerPackRendererV1 pack={pack} />).container.textContent;

    expect(first).toBe(second);
    expect(screen.getAllByTestId('cprv1-timeline-entry').length).toBeGreaterThan(0);
  });

  it('renders stratified and mixed DHW wording differently', () => {
    const stratifiedPack = buildPackFromTemplate('template_mixergy_stratified_cylinder');
    const mixedPack = buildPackFromTemplate('template_regular_boiler_vented_cylinder_y_plan');

    const { rerender } = render(<CustomerPackRendererV1 pack={stratifiedPack} />);
    expect(screen.getByText(/stores hot water in layers/i)).toBeTruthy();

    rerender(<CustomerPackRendererV1 pack={mixedPack} />);
    expect(screen.getByText(/mixes hot water throughout its volume/i)).toBeTruthy();
  });

  it('renders customer-safe deterministic snapshots for all six canonical templates', () => {
    expect(CANONICAL_TEMPLATES).toHaveLength(6);

    for (const template of CANONICAL_TEMPLATES) {
      const pack = buildPackFromTemplate(template.id, `Locked summary for ${template.label}`);
      const first = render(<CustomerPackRendererV1 pack={pack} />).container.innerHTML;
      cleanup();
      const second = render(<CustomerPackRendererV1 pack={pack} />).container.innerHTML;

      expect(second).toBe(first);
      expect(second).toMatchSnapshot(template.id);
      expect(second).not.toMatch(/template_[a-z0-9_]+/i);
      expect(second).not.toMatch(
        /unknown_static_head|unknown_safety_markers|missing_pipe_geometry|low_confidence|scenario_velocity_warning/i,
      );
      expect(second).not.toMatch(/\bbased on survey findings\b/i);
      expect(second).not.toMatch(/\bdaily operation remains straightforward\b/i);
      expect(second).not.toMatch(/\bbehavior|color|favorite|optimize\b/i);
      expect(second).not.toContain('buildCustomerEvidencePackV1');
      cleanup();
    }
  });

  it('handles missing optional sections gracefully', () => {
    const pack = buildPackFromTemplate('template_heat_pump_unvented_weather_comp');
    const sparsePack: CustomerEvidencePackV1 = {
      ...pack,
      sections: pack.sections.map((section, index) =>
        index === 1
          ? {
              ...section,
              cards: [],
              warnings: [],
              timelineSummaries: [],
            }
          : section,
      ),
    };

    render(<CustomerPackRendererV1 pack={sparsePack} />);

    const section = screen.getByTestId('cprv1-section-what_atlas_found');
    expect(within(section).getByText('No additional evidence was recorded for this section.')).toBeTruthy();
  });

  it('remains serializable and print-safe', () => {
    const pack = buildPackFromTemplate('template_heat_pump_unvented_weather_comp');
    const serialized = JSON.stringify(pack);
    const parsed = JSON.parse(serialized) as CustomerEvidencePackV1;
    const { container } = render(<CustomerPackRendererV1 pack={parsed} />);
    const document = container.querySelector('.cprv1-document');

    expect(serialized).toContain('recommendationSummary');
    expect(document).toBeTruthy();
    expect(document?.getAttribute('data-visual-tokens')).toBe('customer-pack-v1');
    expect(document?.getAttribute('data-layout-mode')).toBe('print-and-portal');
    expect(container.querySelector('.cprv1-card-grid')?.getAttribute('data-layout')).toBe(
      'responsive-metric-cards',
    );
    expect(container.querySelectorAll('button, input, textarea, select')).toHaveLength(0);
    expect(container.innerHTML).not.toContain('[object Object]');
  });
});
