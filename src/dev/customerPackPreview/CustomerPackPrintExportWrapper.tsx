/**
 * CustomerPackPrintExportWrapper.tsx
 *
 * Print / PDF export shell for CustomerEvidencePackV1 output.
 *
 * Rules:
 *   - Wraps CustomerPackRendererV1 output in a print-safe container.
 *   - Embeds machine-readable payload metadata as data attributes so that any
 *     downstream PDF pipeline can extract schema version, template id, and
 *     confidence level from the HTML snapshot.
 *   - No physics, no recommendation logic, no animation.
 */

import type { ReactNode } from 'react';
import type { CustomerPackPreviewPipelineOutputV1 } from './buildCustomerPackPreviewPipelineV1';

export interface CustomerPackPrintExportWrapperProps {
  /** Debug metadata from the preview pipeline — embedded as data attributes. */
  readonly pipelineOutput: CustomerPackPreviewPipelineOutputV1;
  /** The rendered customer pack content (CustomerPackRendererV1 output). */
  readonly children: ReactNode;
}

export function CustomerPackPrintExportWrapper({
  pipelineOutput,
  children,
}: CustomerPackPrintExportWrapperProps) {
  return (
    <div
      className="cpev1-print-wrapper"
      data-testid="cpev1-print-wrapper"
      data-payload-schema-version={pipelineOutput.schemaVersion}
      data-payload-template-id={pipelineOutput.templateId}
      data-payload-confidence-level={pipelineOutput.confidenceLevel}
      data-payload-warnings-count={String(pipelineOutput.warningsCount)}
      data-payload-scenario-duration-seconds={String(pipelineOutput.scenarioDurationSeconds)}
    >
      {children}
    </div>
  );
}
