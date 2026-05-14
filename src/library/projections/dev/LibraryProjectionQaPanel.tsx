import { useMemo, useState } from 'react';
import { buildLibraryAudienceProjection } from '../buildLibraryAudienceProjection';
import type { LibraryAudienceV1 } from '../LibraryAudienceV1';
import type { LibraryContentProjectionV1 } from '../LibraryContentProjectionV1';
import type { CalmWelcomePackViewModelV1 } from '../../packRenderer/CalmWelcomePackViewModelV1';
import type { OperationalDigestV1 } from '../../../workflow/operationalDigest/OperationalDigestV1';
import type { EducationalContentV1 } from '../../content/EducationalContentV1';

// ─── Leakage check definitions ───────────────────────────────────────────────

/**
 * Terms that must NOT appear in the customer projection (case-insensitive match
 * against card title + summary).
 */
const CUSTOMER_FORBIDDEN_TERMS: readonly string[] = [
  'inhibitor',
  'bs7593',
  'bs 7593',
  'benchmark',
  'fill pressure',
  'zone valve',
  'g3 mechanics',
  'mcs mechanics',
];

/**
 * Terms that MUST appear in at least one engineer card to satisfy the
 * commissioning completeness check.
 */
const ENGINEER_REQUIRED_TERMS: readonly string[] = [
  'fit',
  'check',
  'commission',
];

/**
 * Terms that MUST appear in at least one office card to satisfy the
 * qualification/compliance readiness check.
 */
const OFFICE_REQUIRED_TERMS: readonly string[] = [
  'qualification',
  'compliance',
  'readiness',
  'qualified',
];

// ─── Leakage analysis ────────────────────────────────────────────────────────

interface LeakageCheckResult {
  readonly warnings: string[];
  readonly passed: boolean;
}

function checkCustomerLeakage(projection: LibraryContentProjectionV1): LeakageCheckResult {
  const warnings: string[] = [];
  for (const card of projection.visibleCards) {
    const haystack = `${card.title} ${card.summary}`.toLowerCase();
    for (const term of CUSTOMER_FORBIDDEN_TERMS) {
      if (haystack.includes(term.toLowerCase())) {
        warnings.push(
          `Leakage: card "${card.title}" contains forbidden term "${term}"`,
        );
      }
    }
  }
  return { warnings, passed: warnings.length === 0 };
}

function checkEngineerCompleteness(projection: LibraryContentProjectionV1): LeakageCheckResult {
  const warnings: string[] = [];
  const allText = projection.visibleCards
    .map((c) => `${c.title} ${c.summary}`)
    .join(' ')
    .toLowerCase();

  const missingTerms = ENGINEER_REQUIRED_TERMS.filter((term) => !allText.includes(term));
  for (const term of missingTerms) {
    warnings.push(`Missing commissioning content: no card mentions "${term}"`);
  }
  return { warnings, passed: warnings.length === 0 };
}

function checkOfficeCompleteness(projection: LibraryContentProjectionV1): LeakageCheckResult {
  const warnings: string[] = [];
  const allText = projection.visibleCards
    .map((c) => `${c.title} ${c.summary}`)
    .join(' ')
    .toLowerCase();

  const missingTerms = OFFICE_REQUIRED_TERMS.filter((term) => !allText.includes(term));
  for (const term of missingTerms) {
    warnings.push(`Missing qualification/compliance content: no card mentions "${term}"`);
  }
  return { warnings, passed: warnings.length === 0 };
}

function checkAuditTraceCompleteness(
  projection: LibraryContentProjectionV1,
  digest: OperationalDigestV1,
): LeakageCheckResult {
  const warnings: string[] = [];
  const tracedIds = new Set(projection.auditTrace.flatMap((entry) => entry.linkedConceptIds));

  for (const item of digest.items) {
    if (!tracedIds.has(item.id)) {
      warnings.push(`Audit trace missing digest item ID: "${item.id}"`);
    }
    for (const taskId of item.linkedTaskIds) {
      if (!tracedIds.has(taskId)) {
        warnings.push(`Audit trace missing linked task ID: "${taskId}" (from digest item "${item.id}")`);
      }
    }
  }

  return { warnings, passed: warnings.length === 0 };
}

// ─── Per-audience summary ─────────────────────────────────────────────────────

interface AudienceSummary {
  readonly audience: LibraryAudienceV1;
  readonly projection: LibraryContentProjectionV1;
  readonly visibleCardCount: number;
  readonly visibleDiagramCount: number;
  readonly visibleDigestItemCount: number;
  readonly hiddenItemCount: number;
  readonly auditTraceCount: number;
  readonly leakageCheck: LeakageCheckResult;
}

const ALL_AUDIENCES: readonly LibraryAudienceV1[] = [
  'customer',
  'surveyor',
  'office',
  'engineer',
  'audit',
];

function buildAudienceSummary(
  audience: LibraryAudienceV1,
  calmViewModel: CalmWelcomePackViewModelV1,
  operationalDigest: OperationalDigestV1,
  educationalContent: readonly EducationalContentV1[],
): AudienceSummary {
  const projection = buildLibraryAudienceProjection({
    calmViewModel,
    operationalDigest,
    educationalContent,
    audience,
  });

  // Count cards that originated from the digest (identified by assetId rather than conceptId).
  const digestItemCount = projection.visibleCards.filter((c) => c.assetId != null && c.conceptId == null).length;

  let leakageCheck: LeakageCheckResult;
  if (audience === 'customer') {
    leakageCheck = checkCustomerLeakage(projection);
  } else if (audience === 'engineer') {
    leakageCheck = checkEngineerCompleteness(projection);
  } else if (audience === 'office') {
    leakageCheck = checkOfficeCompleteness(projection);
  } else if (audience === 'audit') {
    leakageCheck = checkAuditTraceCompleteness(projection, operationalDigest);
  } else {
    leakageCheck = { warnings: [], passed: true };
  }

  return {
    audience,
    projection,
    visibleCardCount: projection.visibleCards.length,
    visibleDiagramCount: projection.visibleDiagrams.length,
    visibleDigestItemCount: digestItemCount,
    hiddenItemCount: projection.hiddenReasonLog.length,
    auditTraceCount: projection.auditTrace.length,
    leakageCheck,
  };
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 999,
        padding: '0.15rem 0.5rem',
        color: ok ? '#166534' : '#92400e',
        background: ok ? '#dcfce7' : '#fef3c7',
      }}
    >
      {label}
    </span>
  );
}

function CountBadge({ value, label }: { value: number; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '0.4rem 0.65rem',
        minWidth: '4.5rem',
        background: '#f8fafc',
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{value}</span>
      <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
    </div>
  );
}

// ─── Audience tab panel ───────────────────────────────────────────────────────

interface AudienceTabPanelProps {
  summary: AudienceSummary;
}

function AudienceTabPanel({ summary }: AudienceTabPanelProps) {
  const { projection, leakageCheck } = summary;

  return (
    <div
      data-testid={`qa-panel-audience-${summary.audience}`}
      style={{ display: 'grid', gap: '0.65rem' }}
    >
      {/* Counts row */}
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}
        data-testid={`qa-counts-${summary.audience}`}
      >
        <CountBadge value={summary.visibleCardCount} label="cards" />
        <CountBadge value={summary.visibleDiagramCount} label="diagrams" />
        <CountBadge value={summary.visibleDigestItemCount} label="digest" />
        <CountBadge value={summary.hiddenItemCount} label="hidden" />
        <CountBadge value={summary.auditTraceCount} label="trace" />
      </div>

      {/* Leakage / completeness check */}
      <div
        style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 0.65rem', background: '#fff' }}
        data-testid={`qa-leakage-${summary.audience}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            {summary.audience === 'customer' ? 'Leakage check'
              : summary.audience === 'engineer' ? 'Commissioning completeness'
              : summary.audience === 'office' ? 'Qualification/compliance readiness'
              : summary.audience === 'audit' ? 'Audit trace completeness'
              : 'Check'}
          </span>
          <StatusPill ok={leakageCheck.passed} label={leakageCheck.passed ? 'PASS' : 'WARN'} />
        </div>

        {leakageCheck.warnings.length > 0 ? (
          <ul
            style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 12, color: '#92400e' }}
            data-testid={`qa-leakage-warnings-${summary.audience}`}
          >
            {leakageCheck.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : (
          <p
            style={{ margin: 0, fontSize: 12, color: '#166534' }}
            data-testid={`qa-leakage-pass-${summary.audience}`}
          >
            No issues detected.
          </p>
        )}
      </div>

      {/* Hidden reasons */}
      {projection.hiddenReasonLog.length > 0 ? (
        <div
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 0.65rem', background: '#fff' }}
          data-testid={`qa-hidden-reasons-${summary.audience}`}
        >
          <p style={{ margin: '0 0 0.3rem', fontSize: 12, fontWeight: 600 }}>
            Hidden items ({projection.hiddenReasonLog.length})
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 12 }}>
            {projection.hiddenReasonLog.map((entry) => (
              <li key={entry.contentId}>
                <strong>{entry.title}</strong> — {entry.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Audit trace (collapsed summary) */}
      <div
        style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 0.65rem', background: '#fff' }}
        data-testid={`qa-audit-trace-${summary.audience}`}
      >
        <p style={{ margin: '0 0 0.3rem', fontSize: 12, fontWeight: 600 }}>
          Audit trace — {projection.auditTrace.length} entries
        </p>
        {projection.auditTrace.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No trace entries.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 12 }}>
            {projection.auditTrace.map((entry) => (
              <li key={entry.contentId}>
                <span
                  style={{
                    fontWeight: 600,
                    color: entry.decision === 'visible' ? '#166534' : '#991b1b',
                  }}
                >
                  {entry.decision === 'visible' ? '✓' : '✕'}
                </span>
                {' '}
                {entry.title}
                {entry.linkedConceptIds.length > 0 ? (
                  <span style={{ color: '#64748b' }}>
                    {' '}[{entry.linkedConceptIds.join(', ')}]
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LibraryProjectionQaPanelProps {
  readonly calmViewModel: CalmWelcomePackViewModelV1;
  readonly operationalDigest: OperationalDigestV1;
  readonly educationalContent: readonly EducationalContentV1[];
}

// ─── Main panel ──────────────────────────────────────────────────────────────

/**
 * LibraryProjectionQaPanel
 *
 * Dev-only surface that runs all five audience projections against a canonical
 * CalmWelcomePackViewModelV1 + OperationalDigestV1 and shows:
 *
 * - visible card / diagram / digest item counts per audience
 * - hidden item counts + hidden reasons
 * - audit trace count
 * - audience-specific leakage and completeness checks
 *
 * Mount at /dev/welcome-pack and /dev/portal-fixtures.
 * Never expose to customer-facing routes.
 */
export function LibraryProjectionQaPanel({
  calmViewModel,
  operationalDigest,
  educationalContent,
}: LibraryProjectionQaPanelProps) {
  const [activeAudience, setActiveAudience] = useState<LibraryAudienceV1>('customer');

  const summaries = useMemo<AudienceSummary[]>(
    () =>
      ALL_AUDIENCES.map((audience) =>
        buildAudienceSummary(audience, calmViewModel, operationalDigest, educationalContent),
      ),
    [calmViewModel, operationalDigest, educationalContent],
  );

  const activeSummary = summaries.find((s) => s.audience === activeAudience) ?? summaries[0]!;

  const overallWarningCount = summaries.reduce(
    (total, s) => total + s.leakageCheck.warnings.length,
    0,
  );

  return (
    <section
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        background: '#fff',
        overflow: 'hidden',
      }}
      data-testid="library-projection-qa-panel"
    >
      {/* Header */}
      <div
        style={{
          padding: '0.6rem 0.75rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '0.95rem', flex: 1 }}>
          Library Audience Projection QA
        </h2>
        {overallWarningCount > 0 ? (
          <StatusPill ok={false} label={`${overallWarningCount} warning${overallWarningCount !== 1 ? 's' : ''}`} />
        ) : (
          <StatusPill ok={true} label="All checks passed" />
        )}
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Audience projection tabs"
        style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          overflowX: 'auto',
        }}
      >
        {ALL_AUDIENCES.map((audience) => {
          const summary = summaries.find((s) => s.audience === audience);
          const hasWarnings = (summary?.leakageCheck.warnings.length ?? 0) > 0;
          const isActive = audience === activeAudience;
          return (
            <button
              key={audience}
              role="tab"
              aria-selected={isActive}
              data-testid={`qa-tab-${audience}`}
              onClick={() => setActiveAudience(audience)}
              style={{
                padding: '0.45rem 0.75rem',
                border: 'none',
                borderBottom: isActive ? '2px solid #1d4ed8' : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 400,
                color: isActive ? '#1d4ed8' : '#334155',
                whiteSpace: 'nowrap',
              }}
            >
              {audience}
              {hasWarnings ? (
                <span
                  aria-label="has warnings"
                  style={{ marginLeft: '0.3rem', color: '#d97706', fontSize: 10 }}
                >
                  ⚠
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      <div style={{ padding: '0.75rem' }}>
        <AudienceTabPanel summary={activeSummary} />
      </div>
    </section>
  );
}
