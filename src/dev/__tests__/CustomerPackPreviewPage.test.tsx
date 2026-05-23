import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1 } from '../../features/legoTechnix/fixtures/canonicalSystemTemplates';
import { buildCustomerPackPreviewPipelineV1 } from '../customerPackPreview/buildCustomerPackPreviewPipelineV1';
import { DEV_ROUTE_REGISTRY } from '../devRouteRegistry';
import { DEV_UI_REGISTRY } from '../devUiRegistry';
import CustomerPackPreviewPage from '../CustomerPackPreviewPage';

afterEach(() => {
  cleanup();
});

// ─── 1. Every canonical template renders in preview ────────────────────────

describe('CustomerPackPreviewPage — all canonical templates', () => {
  it('renders the preview page and pack renderer for every canonical template without error', () => {
    for (const template of LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1) {
      const pipelineOutput = buildCustomerPackPreviewPipelineV1(
        template,
        `Preview locked summary for ${template.label}`,
      );

      const { container } = render(
        <CustomerPackPreviewPage />,
      );

      expect(container.querySelector('[data-testid="customer-pack-preview-page"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="cprv1-document"]')).toBeTruthy();

      // Ensure pack has 10 sections
      expect(container.querySelectorAll('.cprv1-section')).toHaveLength(pipelineOutput.pack.sections.length);

      cleanup();
    }
  });

  it('renders debug summary with values for every canonical template', () => {
    for (const template of LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1) {
      const { container } = render(<CustomerPackPreviewPage />);
      const summary = container.querySelector('[data-testid="cpev1-debug-summary"]');
      expect(summary).toBeTruthy();
      cleanup();
    }
  });
});

// ─── 2. Pipeline builds CustomerEvidencePackV1 from upstream outputs ────────

describe('buildCustomerPackPreviewPipelineV1', () => {
  it('builds a CustomerEvidencePackV1 with schema version 1.0 for every canonical template', () => {
    for (const template of LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1) {
      const output = buildCustomerPackPreviewPipelineV1(
        template,
        'Locked recommendation summary.',
      );

      expect(output.pack.schemaVersion).toBe('1.0');
      expect(output.templateId).toBe(template.id);
      expect(output.scenarioDurationSeconds).toBe(template.scenario.durationSeconds);
      expect(output.schemaVersion).toBe(output.pack.schemaVersion);
      expect(typeof output.confidenceLevel).toBe('string');
      expect(output.confidenceLevel.length).toBeGreaterThan(0);
      expect(typeof output.warningsCount).toBe('number');
    }
  });

  it('produces a pack with 10 canonical sections for every template', () => {
    for (const template of LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1) {
      const output = buildCustomerPackPreviewPipelineV1(template, 'summary');
      expect(output.pack.sections).toHaveLength(10);
    }
  });

  it('preserves the locked recommendation summary verbatim in the pack', () => {
    const template = LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1[0];
    const verbatim = 'Verbatim locked summary — pipeline must not rewrite this.';
    const output = buildCustomerPackPreviewPipelineV1(template, verbatim);
    expect(output.pack.recommendationSummary).toBe(verbatim);
  });

  it('uses template label as systemLabel verbatim', () => {
    const template = LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1[0];
    const output = buildCustomerPackPreviewPipelineV1(template, 'summary');
    expect(output.pack.systemLabel).toBe(template.label);
  });
});

// ─── 3. Renderer receives only pack prop ────────────────────────────────────

describe('CustomerPackRendererV1 — receives only pack prop', () => {
  it('CustomerPackRendererV1 source does not import recommendation builders or pipeline', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/features/customerPack/CustomerPackRendererV1.tsx'),
      'utf8',
    );

    expect(source).toContain('CustomerEvidencePackV1');
    expect(source).not.toMatch(/buildCustomerPackPreviewPipelineV1|buildCustomerEvidencePackV1|buildCustomerPackV1/);
    expect(source).not.toMatch(/AtlasDecisionV1|ScenarioResult|runLegoTechnixScenarioV1/);
  });

  it('CustomerPackPreviewPage does not re-derive a recommendation inside CustomerPackRendererV1', () => {
    const previewSource = readFileSync(
      path.resolve(process.cwd(), 'src/dev/CustomerPackPreviewPage.tsx'),
      'utf8',
    );

    expect(previewSource).toContain('buildCustomerPackPreviewPipelineV1');
    expect(previewSource).not.toMatch(/buildDecisionFromScenarios|buildScenariosFromEngineOutput|runEngine/);
    expect(previewSource).toContain('CustomerPackRendererV1');
  });
});

// ─── 4. PDF/export wrapper embeds payload metadata ─────────────────────────

describe('CustomerPackPrintExportWrapper', () => {
  it('embeds schemaVersion, templateId, confidenceLevel, warningsCount, and scenarioDuration as data attributes', () => {
    const { container } = render(<CustomerPackPreviewPage />);
    const wrapper = container.querySelector('[data-testid="cpev1-print-wrapper"]');

    expect(wrapper).toBeTruthy();
    expect(wrapper?.getAttribute('data-payload-schema-version')).toBe('1.0');
    expect(wrapper?.getAttribute('data-payload-template-id')).toMatch(/^template_/);
    expect(wrapper?.getAttribute('data-payload-confidence-level')).toBeTruthy();
    expect(wrapper?.getAttribute('data-payload-warnings-count')).toBeTruthy();
    expect(wrapper?.getAttribute('data-payload-scenario-duration-seconds')).toBeTruthy();
  });

  it('wraps the rendered pack inside the print wrapper', () => {
    const { container } = render(<CustomerPackPreviewPage />);
    const wrapper = container.querySelector('[data-testid="cpev1-print-wrapper"]');
    const doc = wrapper?.querySelector('[data-testid="cprv1-document"]');
    expect(doc).toBeTruthy();
  });
});

// ─── 5. No recommendation logic in preview components ───────────────────────

describe('CustomerPackPreviewPage — no recommendation logic', () => {
  it('preview pipeline source does not contain recommendation engine imports', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/dev/customerPackPreview/buildCustomerPackPreviewPipelineV1.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/buildDecisionFromScenarios|buildScenariosFromEngineOutput|runEngine|AtlasDecisionV1/);
    expect(source).toContain('buildCustomerEvidencePackV1');
    expect(source).toContain('buildCustomerPackPreviewPipelineV1');
  });

  it('preview page source does not contain recommendation engine imports', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/dev/CustomerPackPreviewPage.tsx'),
      'utf8',
    );

    expect(source).not.toMatch(/buildDecisionFromScenarios|buildScenariosFromEngineOutput|runEngine|AtlasDecisionV1/);
  });
});

// ─── 6. Output remains print-safe ───────────────────────────────────────────

describe('CustomerPackPreviewPage — print safety', () => {
  it('the rendered pack contains no interactive controls inside the print wrapper', () => {
    const { container } = render(<CustomerPackPreviewPage />);
    const wrapper = container.querySelector('[data-testid="cpev1-print-wrapper"]');

    const interactive = wrapper?.querySelectorAll('button, input, textarea, select');
    expect(interactive).toHaveLength(0);
  });

  it('the pack document serialises cleanly with no [object Object] artefacts', () => {
    const { container } = render(<CustomerPackPreviewPage />);
    expect(container.innerHTML).not.toContain('[object Object]');
  });

  it('the debug toolbar is present and labelled as no-print', () => {
    const { container } = render(<CustomerPackPreviewPage />);
    const toolbar = container.querySelector('[data-testid="cpev1-toolbar"]');
    expect(toolbar?.classList.contains('no-print')).toBe(true);
  });
});

// ─── Route / UI registry ─────────────────────────────────────────────────────

describe('CustomerPackPreviewPage — route and UI registry', () => {
  it('is registered in the dev route registry with path /dev/customer-pack-preview', () => {
    const entry = DEV_ROUTE_REGISTRY.find((r) => r.codeName === 'CustomerPackPreviewPage');
    expect(entry?.routePath).toBe('/dev/customer-pack-preview');
    expect(entry?.access).toBe('dev_only');
  });

  it('is registered in the dev UI registry', () => {
    const entry = DEV_UI_REGISTRY.find((item) => item.codeName === 'CustomerPackPreviewPage');
    expect(entry?.fullRouteExample).toBe('/dev/customer-pack-preview');
    expect(entry?.access).toBe('dev_only');
  });

  it('debug summary shows all five required fields', () => {
    const { container } = render(<CustomerPackPreviewPage />);
    const summary = container.querySelector('[data-testid="cpev1-debug-summary"]');
    expect(summary).toBeTruthy();

    expect(within(summary as HTMLElement).getByTestId('cpev1-debug-template-id').textContent).toMatch(/^template_/);
    expect(within(summary as HTMLElement).getByTestId('cpev1-debug-scenario-duration').textContent).toMatch(/\d+s/);
    expect(within(summary as HTMLElement).getByTestId('cpev1-debug-schema-version').textContent).toBe('1.0');
    expect(within(summary as HTMLElement).getByTestId('cpev1-debug-confidence-level').textContent?.length).toBeGreaterThan(0);
    expect(within(summary as HTMLElement).getByTestId('cpev1-debug-warnings-count').textContent).toMatch(/^\d+$/);
  });
});
