/**
 * EvidenceProofBlock.tsx
 *
 * Renders an "Evidence used" block next to a proposal/recommendation section.
 *
 * Design rules:
 *   - Evidence only supports existing engine decisions — it does not drive them.
 *   - In customer-safe mode (customerFacing=true), only confirmed (reviewed)
 *     capture refs are shown.  Unresolved refs are hidden completely.
 *   - In engineer mode (customerFacing=false), all refs are shown; unresolved
 *     ones are flagged with a "Needs review" badge.
 *   - When all refs are unresolved in customer mode, the block renders nothing.
 *   - Clicking a capture-ref pill calls onOpenCapturePoint with the
 *     capturePointId and storyboardCardKey so the caller can navigate to the
 *     storyboard/graph at that point.
 *   - No engine logic lives here — pure presentation.
 */

import type { EvidenceProofLinkV1, EvidenceCaptureRef } from './EvidenceProofLinkV1';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EvidenceProofBlockProps {
  /** The proof link(s) for the proposal section this block is attached to. */
  links: EvidenceProofLinkV1[];
  /**
   * When true, only confirmed (reviewed) capture refs are displayed.
   * The block is entirely hidden when no confirmed refs exist.
   * Defaults to false (engineer mode shows all refs).
   */
  customerFacing?: boolean;
  /**
   * Called when the user clicks a capture-ref pill.
   * Receives the capturePointId and the storyboardCardKey of the matching
   * storyboard card so the caller can deep-link into the evidence viewer.
   */
  onOpenCapturePoint?: (
    capturePointId: string,
    storyboardCardKey: EvidenceCaptureRef['storyboardCardKey'],
  ) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CARD_KEY_LABELS: Record<EvidenceCaptureRef['storyboardCardKey'], string> = {
  'key-objects':      'Object',
  'measurements':     'Measurement',
  'ghost-appliances': 'Ghost appliance',
  'what-scanned':     'Scan context',
  'open-review':      'Needs review',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CaptureRefPill({
  captureRef,
  customerFacing,
  onOpen,
}: {
  captureRef: EvidenceCaptureRef;
  customerFacing: boolean;
  onOpen?: EvidenceProofBlockProps['onOpenCapturePoint'];
}) {
  if (customerFacing && !captureRef.isResolved) return null;

  const isUnresolved = !captureRef.isResolved;
  const cardLabel = CARD_KEY_LABELS[captureRef.storyboardCardKey];

  const pillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.74rem',
    fontWeight: 600,
    borderRadius: 999,
    padding: '0.15rem 0.55rem',
    border: isUnresolved
      ? '1px solid #fcd34d'
      : '1px solid #bfdbfe',
    background: isUnresolved ? '#fffbeb' : '#eff6ff',
    color: isUnresolved ? '#92400e' : '#1d4ed8',
    cursor: onOpen ? 'pointer' : 'default',
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
  };

  const label = captureRef.label.length > 0 ? captureRef.label : captureRef.capturePointId;

  if (onOpen) {
    return (
      <a
        href={`#captured-evidence-capture-point-${captureRef.capturePointId}`}
        style={pillStyle}
        aria-label={`Open evidence: ${label} (${cardLabel})`}
        onClick={(e) => {
          e.preventDefault();
          onOpen(captureRef.capturePointId, captureRef.storyboardCardKey);
        }}
      >
        <span style={{ opacity: 0.75, fontSize: '0.65rem' }}>{cardLabel}</span>
        <span>{label}</span>
        {isUnresolved && (
          <span
            style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              background: '#fde68a',
              color: '#92400e',
              borderRadius: 999,
              padding: '0.05rem 0.3rem',
            }}
          >
            needs review
          </span>
        )}
      </a>
    );
  }

  return (
    <span style={pillStyle} aria-label={`Evidence: ${label} (${cardLabel})`}>
      <span style={{ opacity: 0.75, fontSize: '0.65rem' }}>{cardLabel}</span>
      <span>{label}</span>
      {isUnresolved && (
        <span
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            background: '#fde68a',
            color: '#92400e',
            borderRadius: 999,
            padding: '0.05rem 0.3rem',
          }}
        >
          needs review
        </span>
      )}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * EvidenceProofBlock renders the capture-point references that support a
 * proposal section.
 *
 * Place this component below the proposal heading/content for any section
 * that has capture evidence (boiler, cylinder, flue, radiators, general).
 *
 * The block is invisible when no links are provided, when all links have zero
 * capture refs, or when customerFacing=true and all refs are unresolved.
 */
export function EvidenceProofBlock({
  links,
  customerFacing = false,
  onOpenCapturePoint,
}: EvidenceProofBlockProps) {
  // Collect all capture refs across all links for this block
  const allRefs: EvidenceCaptureRef[] = links.flatMap((link) => link.captureRefs);

  // In customer mode, only show confirmed refs
  const visibleRefs = customerFacing
    ? allRefs.filter((r) => r.isResolved)
    : allRefs;

  // De-duplicate by capturePointId + storyboardCardKey for display
  const deduped = visibleRefs.filter(
    (ref, idx, arr) =>
      arr.findIndex(
        (r) => r.capturePointId === ref.capturePointId && r.storyboardCardKey === ref.storyboardCardKey,
      ) === idx,
  );

  if (deduped.length === 0) return null;

  // Aggregate review status for the block header badge
  const hasUnresolved = !customerFacing && allRefs.some((r) => !r.isResolved);

  return (
    <aside
      data-testid="evidence-proof-block"
      aria-label="Evidence used for this section"
      style={{
        marginTop: '0.75rem',
        padding: '0.6rem 0.75rem',
        background: hasUnresolved ? '#fffbeb' : '#f0f9ff',
        border: `1px solid ${hasUnresolved ? '#fde68a' : '#bae6fd'}`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: hasUnresolved ? '#92400e' : '#0369a1',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Evidence used
        </span>
        {hasUnresolved && !customerFacing && (
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: '#92400e',
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: 999,
              padding: '0.05rem 0.4rem',
            }}
          >
            some items need review
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {deduped.map((ref, idx) => (
          <CaptureRefPill
            key={`${ref.capturePointId}-${ref.storyboardCardKey}-${idx}`}
            captureRef={ref}
            customerFacing={customerFacing}
            onOpen={onOpenCapturePoint}
          />
        ))}
      </div>
    </aside>
  );
}
