/**
 * CustomerPackPreviewPage.tsx
 *
 * /dev/customer-pack-preview — developer preview for the evidence-driven
 * customer pack end-to-end pipeline.
 *
 * What this page does:
 *   1. Lets the developer choose any of the six canonical LegoTechnix templates.
 *   2. Runs the canonical pipeline:
 *        canonical template → scenario → DHW metrics → confidence report
 *        → explainability report → CustomerEvidencePackV1
 *   3. Renders the pack using CustomerPackRendererV1 inside a print-safe wrapper.
 *   4. Shows a debug summary (template id, scenario duration, schema version,
 *      confidence level, warnings count) outside the print area.
 *   5. Provides a print / PDF export button backed by window.print().
 *
 * Rules (must not be broken):
 *   - CustomerPackRendererV1 receives only the pack prop.
 *   - This page builds the pack; CustomerPackRendererV1 does not.
 *   - No physics calculations in React components.
 *   - No recommendation re-derivation.
 *   - No polished graphics or animation.
 *   - The debug toolbar is suppressed in print / PDF output.
 */

import { useMemo, useState } from 'react';
import { LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1 } from '../features/legoTechnix/fixtures/canonicalSystemTemplates';
import { CustomerPackRendererV1 } from '../features/customerPack/CustomerPackRendererV1';
import { buildCustomerPackPreviewPipelineV1 } from './customerPackPreview/buildCustomerPackPreviewPipelineV1';
import { CustomerPackPrintExportWrapper } from './customerPackPreview/CustomerPackPrintExportWrapper';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Canonical recommendation summary placeholder used in the preview context. */
const PREVIEW_RECOMMENDATION_SUMMARY =
  'This system has been selected by the Atlas recommendation engine based on your home survey evidence. This is a canonical preview — the locked summary would be supplied by the engine in production.';

// ─── Component ────────────────────────────────────────────────────────────────

interface CustomerPackPreviewPageProps {
  onBack?: () => void;
}

export default function CustomerPackPreviewPage({ onBack }: CustomerPackPreviewPageProps) {
  const [templateId, setTemplateId] = useState<string>(
    LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1[0].id,
  );

  const selectedTemplate = useMemo(
    () =>
      LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1.find((t) => t.id === templateId)
      ?? LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1[0],
    [templateId],
  );

  const pipelineOutput = useMemo(
    () => buildCustomerPackPreviewPipelineV1(selectedTemplate, PREVIEW_RECOMMENDATION_SUMMARY),
    [selectedTemplate],
  );

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }} data-testid="customer-pack-preview-page">
      {/* ── Debug toolbar — hidden on print ── */}
      <div
        className="cpev1-toolbar no-print"
        data-testid="cpev1-toolbar"
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'grid',
          gap: '0.5rem',
        }}
      >
        {onBack ? (
          <button type="button" className="back-btn" onClick={onBack} data-testid="cpev1-back-btn">
            ← Back
          </button>
        ) : null}

        <div className="atlas-dev-notice" data-testid="cpev1-dev-banner">
          <strong>Customer pack preview</strong>
          <span>
            Evidence-driven pack pipeline: canonical template → scenario → DHW metrics →
            confidence report → explainability report → CustomerEvidencePackV1 →
            CustomerPackRendererV1
          </span>
        </div>

        {/* Template selector */}
        <div>
          <label htmlFor="cpev1-template-select" style={{ marginRight: '0.5rem', fontWeight: 600 }}>
            Canonical template
          </label>
          <select
            id="cpev1-template-select"
            data-testid="cpev1-template-select"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Debug summary */}
        <dl
          data-testid="cpev1-debug-summary"
          style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '0.75rem', rowGap: '0.2rem', fontSize: '0.8rem' }}
        >
          <dt style={{ fontWeight: 600, color: '#475569' }}>Template id</dt>
          <dd data-testid="cpev1-debug-template-id" style={{ margin: 0, fontFamily: 'monospace' }}>
            {pipelineOutput.templateId}
          </dd>

          <dt style={{ fontWeight: 600, color: '#475569' }}>Scenario duration</dt>
          <dd data-testid="cpev1-debug-scenario-duration" style={{ margin: 0, fontFamily: 'monospace' }}>
            {pipelineOutput.scenarioDurationSeconds}s
          </dd>

          <dt style={{ fontWeight: 600, color: '#475569' }}>Schema version</dt>
          <dd data-testid="cpev1-debug-schema-version" style={{ margin: 0, fontFamily: 'monospace' }}>
            {pipelineOutput.schemaVersion}
          </dd>

          <dt style={{ fontWeight: 600, color: '#475569' }}>Confidence level</dt>
          <dd data-testid="cpev1-debug-confidence-level" style={{ margin: 0, fontFamily: 'monospace' }}>
            {pipelineOutput.confidenceLevel}
          </dd>

          <dt style={{ fontWeight: 600, color: '#475569' }}>Warnings</dt>
          <dd data-testid="cpev1-debug-warnings-count" style={{ margin: 0, fontFamily: 'monospace' }}>
            {pipelineOutput.warningsCount}
          </dd>
        </dl>

        {/* Export / Print */}
        <div>
          <button
            type="button"
            data-testid="cpev1-print-btn"
            onClick={() => { window.print(); }}
            style={{ fontWeight: 600 }}
          >
            Print / Export PDF
          </button>
        </div>
      </div>

      {/* ── Print-safe pack output ── */}
      <CustomerPackPrintExportWrapper pipelineOutput={pipelineOutput}>
        <CustomerPackRendererV1 pack={pipelineOutput.pack} />
      </CustomerPackPrintExportWrapper>

      {/* Print suppression: hide the toolbar when printing */}
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  );
}
