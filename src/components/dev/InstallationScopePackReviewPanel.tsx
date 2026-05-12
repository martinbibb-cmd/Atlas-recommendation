/**
 * InstallationScopePackReviewPanel.tsx
 *
 * Dev-only panel for reviewing InstallationScopePackV1 scope bundles.
 *
 * Purpose:
 *   Renders scope pack cards with included/optional lines, audience summaries,
 *   and accept/edit/reject/needs-check workflow controls.  NOT customer-facing.
 *
 * Access: dev_only — never mounts in production customer journeys.
 *
 * Usage:
 *   <InstallationScopePackReviewPanel packs={scopePacks} lines={specLines} />
 */

import type { InstallationScopePackV1, ScopePackReviewStatus } from '../../specification/scopePacks';
import type { SpecificationLineV1 } from '../../specification/specLines';

interface Props {
  packs: readonly InstallationScopePackV1[];
  lines: readonly SpecificationLineV1[];
  onPacksChange?: (packs: InstallationScopePackV1[]) => void;
}

const STATUS_COLORS: Record<ScopePackReviewStatus, string> = {
  suggested:   '#6366f1',
  accepted:    '#16a34a',
  edited:      '#d97706',
  rejected:    '#dc2626',
  needs_check: '#db2777',
};

const STATUS_OPTIONS: readonly ScopePackReviewStatus[] = [
  'suggested',
  'accepted',
  'edited',
  'rejected',
  'needs_check',
];

function StatusBadge({ status }: { status: ScopePackReviewStatus }) {
  return (
    <span
      style={{
        display:       'inline-block',
        padding:       '1px 7px',
        borderRadius:  4,
        fontSize:      10,
        fontWeight:    700,
        letterSpacing: 0.5,
        color:         '#fff',
        background:    STATUS_COLORS[status],
        verticalAlign: 'middle',
      }}
    >
      {status.toUpperCase().replace('_', ' ')}
    </span>
  );
}

function LineChip({ line }: { line: SpecificationLineV1 }) {
  return (
    <li
      key={line.lineId}
      style={{
        fontSize:     12,
        padding:      '0.3rem 0.5rem',
        borderRadius: 6,
        background:   '#f1f5f9',
        border:       '1px solid #e2e8f0',
        display:      'flex',
        gap:          '0.4rem',
        alignItems:   'flex-start',
      }}
    >
      <span
        style={{
          fontSize:     10,
          fontWeight:   700,
          background:   '#1d4ed8',
          color:        '#fff',
          padding:      '1px 5px',
          borderRadius: 3,
          flexShrink:   0,
          marginTop:    1,
        }}
      >
        {line.lineType}
      </span>
      <span>
        <strong>{line.label}</strong>
        {line.description !== line.label ? (
          <span style={{ color: '#475569' }}> — {line.description}</span>
        ) : null}
      </span>
    </li>
  );
}

export default function InstallationScopePackReviewPanel({ packs, lines, onPacksChange }: Props) {
  const lineById = new Map(lines.map((l) => [l.lineId, l]));

  function updateStatus(packId: string, status: ScopePackReviewStatus) {
    onPacksChange?.(
      packs.map((pack) => (pack.packId === packId ? { ...pack, reviewStatus: status } : pack)),
    );
  }

  if (packs.length === 0) {
    return (
      <p
        style={{ margin: 0, color: '#6b7280', fontSize: 13 }}
        data-testid="scope-pack-review-panel-empty"
      >
        No scope packs generated for this fixture.
      </p>
    );
  }

  return (
    <div
      style={{ display: 'grid', gap: '1rem' }}
      data-testid="scope-pack-review-panel"
    >
      {packs.map((pack) => {
        const includedLines = pack.defaultIncludedLineIds
          .map((id) => lineById.get(id))
          .filter((l): l is SpecificationLineV1 => l !== undefined);

        const optionalLines = pack.defaultExcludedLineIds
          .map((id) => lineById.get(id))
          .filter((l): l is SpecificationLineV1 => l !== undefined);

        return (
          <section
            key={pack.packId}
            style={{
              border:       '1px solid #e2e8f0',
              borderRadius: 10,
              padding:      '0.85rem',
              background:   '#fff',
            }}
            data-testid={`scope-pack-card-${pack.packId}`}
          >
            {/* ─── Header ──────────────────────────────────────────────── */}
            <div
              style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'flex-start',
                gap:            '0.75rem',
                marginBottom:   '0.6rem',
              }}
            >
              <div>
                <h3
                  style={{ margin: '0 0 0.2rem', fontSize: '0.95rem' }}
                  data-testid={`scope-pack-label-${pack.packId}`}
                >
                  {pack.label}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>{pack.description}</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <StatusBadge status={pack.reviewStatus} />
                <select
                  value={pack.reviewStatus}
                  onChange={(e) => updateStatus(pack.packId, e.target.value as ScopePackReviewStatus)}
                  style={{ fontSize: 12 }}
                  data-testid={`scope-pack-status-${pack.packId}`}
                  aria-label={`Review status for ${pack.label}`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ─── Included spec lines ─────────────────────────────────── */}
            <div style={{ marginBottom: '0.6rem' }}>
              <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.82rem', color: '#1e40af' }}>
                Included lines ({includedLines.length})
              </h4>
              {includedLines.length > 0 ? (
                <ul
                  style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.3rem' }}
                  data-testid={`scope-pack-included-lines-${pack.packId}`}
                >
                  {includedLines.map((line) => (
                    <LineChip key={line.lineId} line={line} />
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>None</p>
              )}
            </div>

            {/* ─── Optional / add-on lines ─────────────────────────────── */}
            {optionalLines.length > 0 ? (
              <div style={{ marginBottom: '0.6rem' }}>
                <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.82rem', color: '#6b7280' }}>
                  Optional / add-on lines ({optionalLines.length})
                </h4>
                <ul
                  style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.3rem' }}
                  data-testid={`scope-pack-optional-lines-${pack.packId}`}
                >
                  {optionalLines.map((line) => (
                    <LineChip key={line.lineId} line={line} />
                  ))}
                </ul>
              </div>
            ) : null}

            {/* ─── Summaries ───────────────────────────────────────────── */}
            <div
              style={{
                display:             'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap:                 '0.5rem',
                marginTop:           '0.6rem',
              }}
            >
              <div
                style={{
                  background:   '#f0fdf4',
                  border:       '1px solid #bbf7d0',
                  borderRadius: 6,
                  padding:      '0.5rem',
                }}
              >
                <p style={{ margin: '0 0 0.25rem', fontSize: 10, fontWeight: 700, color: '#166534' }}>
                  CUSTOMER SUMMARY
                </p>
                <p
                  style={{ margin: 0, fontSize: 12, color: '#166534' }}
                  data-testid={`scope-pack-customer-summary-${pack.packId}`}
                >
                  {pack.customerSummary}
                </p>
              </div>

              <div
                style={{
                  background:   '#eff6ff',
                  border:       '1px solid #bfdbfe',
                  borderRadius: 6,
                  padding:      '0.5rem',
                }}
              >
                <p style={{ margin: '0 0 0.25rem', fontSize: 10, fontWeight: 700, color: '#1e40af' }}>
                  ENGINEER SUMMARY
                </p>
                <p
                  style={{ margin: 0, fontSize: 12, color: '#1e40af' }}
                  data-testid={`scope-pack-engineer-summary-${pack.packId}`}
                >
                  {pack.engineerSummary}
                </p>
              </div>

              <div
                style={{
                  background:   '#faf5ff',
                  border:       '1px solid #e9d5ff',
                  borderRadius: 6,
                  padding:      '0.5rem',
                }}
              >
                <p style={{ margin: '0 0 0.25rem', fontSize: 10, fontWeight: 700, color: '#6b21a8' }}>
                  OFFICE SUMMARY
                </p>
                <p
                  style={{ margin: 0, fontSize: 12, color: '#6b21a8' }}
                  data-testid={`scope-pack-office-summary-${pack.packId}`}
                >
                  {pack.officeSummary}
                </p>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
