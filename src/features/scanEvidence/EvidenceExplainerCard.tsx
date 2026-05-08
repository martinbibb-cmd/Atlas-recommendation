/**
 * EvidenceExplainerCard.tsx
 *
 * Renders customer-friendly "Why this matters" cards alongside the
 * "Evidence used" capture-point pills for one or more proposal sections.
 *
 * Design rules:
 *   - In customer mode (customerFacing=true):
 *       • Only confirmed (reviewed) capture refs are shown.
 *       • Sections with zero confirmed refs are skipped entirely.
 *       • Only `customerText` is displayed — no engineer notes.
 *       • No "needs review" badges, no unresolved capture-point pills.
 *   - In engineer mode (customerFacing=false):
 *       • All refs are shown; unresolved ones carry a "needs review" badge.
 *       • Both `customerText` and `engineerNotes` are displayed.
 *       • Review-warning summary is shown when any ref is unresolved.
 *   - No unsupported claims ("fits perfectly", "confirmed") appear in
 *     customer text unless the underlying capture ref is resolved.
 *   - No engine logic — pure presentation.
 *   - The component renders nothing when no visible refs exist across all
 *     provided links.
 */

import { EvidenceProofBlock } from './EvidenceProofBlock';
import {
  getExplainerForSection,
  groupLinksBySection,
  SECTION_HEADING_LABELS,
} from './evidenceExplainers';
import type { EvidenceCaptureRef, EvidenceProofLinkV1 } from './EvidenceProofLinkV1';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EvidenceExplainerCardProps {
  /**
   * All evidence proof links to display.  The component groups them by
   * proposal section and renders one explainer block per section.
   */
  links: EvidenceProofLinkV1[];

  /**
   * When true, only confirmed (reviewed) evidence is shown and only
   * customer-safe plain-English text is rendered.
   * Defaults to false (engineer mode).
   */
  customerFacing?: boolean;

  /**
   * Called when the user clicks a capture-ref pill.
   * Receives the capturePointId and the storyboard card key.
   * When absent, pills are rendered but are not interactive links.
   */
  onOpenCapturePoint?: (
    capturePointId: string,
    storyboardCardKey: EvidenceCaptureRef['storyboardCardKey'],
  ) => void;
}

// ─── Section block ────────────────────────────────────────────────────────────

function SectionExplainerBlock({
  sectionLinks,
  customerFacing,
  onOpenCapturePoint,
}: {
  sectionLinks: EvidenceProofLinkV1[];
  customerFacing: boolean;
  onOpenCapturePoint?: EvidenceExplainerCardProps['onOpenCapturePoint'];
}) {
  const section = sectionLinks[0]?.section;
  if (!section) return null;

  const explainer = getExplainerForSection(section, sectionLinks, customerFacing);
  if (!explainer) return null;

  const sectionHeading = SECTION_HEADING_LABELS[section];
  const hasUnresolved =
    !customerFacing &&
    sectionLinks.some((l) => l.captureRefs.some((r) => !r.isResolved));

  return (
    <div
      data-testid={`evidence-explainer-section-${section}`}
      style={{
        marginTop: '0.5rem',
        padding: '0.65rem 0.8rem',
        background: hasUnresolved ? '#fffbeb' : '#f0fdf4',
        border: `1px solid ${hasUnresolved ? '#fde68a' : '#bbf7d0'}`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
      }}
    >
      {/* Section heading */}
      <div
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          color: hasUnresolved ? '#92400e' : '#15803d',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {sectionHeading}
      </div>

      {/* Why this matters */}
      <p
        data-testid={`evidence-explainer-customer-text-${section}`}
        style={{
          margin: 0,
          fontSize: '0.82rem',
          color: '#1e293b',
          lineHeight: 1.5,
        }}
      >
        {explainer.customerText}
      </p>

      {/* Engineer notes (hidden in customer mode) */}
      {!customerFacing && (
        <p
          data-testid={`evidence-explainer-engineer-notes-${section}`}
          style={{
            margin: 0,
            fontSize: '0.76rem',
            color: '#64748b',
            fontStyle: 'italic',
            lineHeight: 1.45,
          }}
        >
          {explainer.engineerNotes}
        </p>
      )}

      {/* Evidence used pills */}
      <EvidenceProofBlock
        links={sectionLinks}
        customerFacing={customerFacing}
        onOpenCapturePoint={onOpenCapturePoint}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * EvidenceExplainerCard renders one "Why this matters" block per proposal
 * section found in the provided proof links.
 *
 * Place this component in proposal/pack cards wherever evidence supports the
 * recommendation (boiler, cylinder, flue, radiators, or general sections).
 *
 * The component renders nothing when:
 *   - No links are provided.
 *   - customerFacing=true and all refs are unresolved across all sections.
 */
export function EvidenceExplainerCard({
  links,
  customerFacing = false,
  onOpenCapturePoint,
}: EvidenceExplainerCardProps) {
  if (links.length === 0) return null;

  const grouped = groupLinksBySection(links);
  if (grouped.size === 0) return null;

  // Pre-filter to sections that actually have an explainer to show
  const visibleEntries = Array.from(grouped.entries()).filter(([section, sectionLinks]) =>
    getExplainerForSection(section, sectionLinks, customerFacing) !== null,
  );

  if (visibleEntries.length === 0) return null;

  return (
    <div
      data-testid="evidence-explainer-card"
      aria-label="Why this matters — evidence supporting this recommendation"
    >
      <div
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          color: '#0369a1',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.3rem',
        }}
      >
        Why this matters
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {visibleEntries.map(([section, sectionLinks]) => (
          <SectionExplainerBlock
            key={section}
            sectionLinks={sectionLinks}
            customerFacing={customerFacing}
            onOpenCapturePoint={onOpenCapturePoint}
          />
        ))}
      </div>
    </div>
  );
}
