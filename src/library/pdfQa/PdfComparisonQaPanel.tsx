import { useMemo } from 'react';
import type { PdfComparisonScenarioV1 } from './PdfComparisonScenarioV1';
import { buildPdfComparisonAudit } from './buildPdfComparisonAudit';
import type {
  PdfAuditFindingV1,
  PdfAuditSeverityV1,
  PdfPositiveCheckV1,
  PdfLegacyDiffSummaryV1,
} from './PdfComparisonAuditV1';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PdfAuditSeverityV1 }) {
  const colors: Record<PdfAuditSeverityV1, { bg: string; fg: string; label: string }> = {
    pass: { bg: '#dcfce7', fg: '#166534', label: '✓ Pass' },
    warn: { bg: '#fef9c3', fg: '#713f12', label: '⚠ Warn' },
    fail: { bg: '#fee2e2', fg: '#991b1b', label: '✗ Fail' },
  };
  const { bg, fg, label } = colors[status];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  );
}

// ─── Finding list ─────────────────────────────────────────────────────────────

function FindingList({
  label,
  findings,
  testId,
}: {
  label: string;
  findings: readonly PdfAuditFindingV1[];
  testId: string;
}) {
  if (findings.length === 0) {
    return (
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <strong>{label}</strong>
          <span style={{ color: '#16a34a', fontWeight: 600 }} data-testid={testId}>
            ✓ none found
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: '0.3rem' }}>
        <strong>{label}</strong>
        <span style={{ color: '#dc2626', fontWeight: 600 }} data-testid={testId}>
          {findings.length} finding{findings.length !== 1 ? 's' : ''}
        </span>
      </div>
      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 11, color: '#475569' }}>
        {findings.map((f) => (
          <li key={`${f.ruleId}:${f.sectionId}:${f.excerpt}`} style={{ marginBottom: '0.15rem' }}>
            <StatusBadge status={f.severity} />
            {' '}
            <span style={{ marginLeft: 4 }}>{f.description}</span>
            {f.excerpt && (
              <code
                style={{
                  display: 'block',
                  marginTop: '0.1rem',
                  marginLeft: '1rem',
                  fontSize: 10,
                  color: '#7c3aed',
                  background: '#f5f3ff',
                  borderRadius: 4,
                  padding: '1px 5px',
                }}
              >
                {f.excerpt}
              </code>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Positive check list ──────────────────────────────────────────────────────

function PositiveCheckList({ checks }: { checks: readonly PdfPositiveCheckV1[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: 12 }}>
      {checks.map((c) => (
        <li
          key={c.checkId}
          data-testid={`positive-check-${c.checkId}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: '0.25rem',
          }}
        >
          <span style={{ fontSize: 12 }}>{c.passed ? '✓' : '✗'}</span>
          <span
            style={{
              color: c.passed ? '#166534' : '#991b1b',
              fontWeight: c.passed ? 400 : 600,
            }}
          >
            {c.description}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Legacy diff section ──────────────────────────────────────────────────────

function LegacyDiffSection({ diff }: { diff: PdfLegacyDiffSummaryV1 }) {
  return (
    <div data-testid="pdf-comparison-legacy-diff" style={{ fontSize: 12 }}>
      <div style={{ marginBottom: '0.25rem' }}>
        <strong>Recommendation match:</strong>{' '}
        <span style={{ color: diff.recommendationSummaryMatch ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
          {diff.recommendationSummaryMatch ? '✓ matched' : '✗ mismatch'}
        </span>
      </div>
      <div style={{ marginBottom: '0.25rem' }}>
        <strong>Common sections:</strong>{' '}
        <span style={{ color: '#475569' }}>{diff.commonSectionIds.join(', ') || 'none'}</span>
      </div>
      {diff.sectionsOnlyInCanonical.length > 0 && (
        <div style={{ marginBottom: '0.25rem' }}>
          <strong style={{ color: '#2563eb' }}>Only in canonical:</strong>{' '}
          <span style={{ color: '#475569' }}>{diff.sectionsOnlyInCanonical.join(', ')}</span>
        </div>
      )}
      {diff.sectionsOnlyInLegacy.length > 0 && (
        <div>
          <strong style={{ color: '#d97706' }}>Only in legacy:</strong>{' '}
          <span style={{ color: '#475569' }}>{diff.sectionsOnlyInLegacy.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PdfComparisonQaPanelProps {
  /** The PDF scenario to audit. */
  scenario: PdfComparisonScenarioV1;
  /**
   * Optional canonical scenario for legacy diff.
   * Only meaningful when scenario.mode is a legacy mode.
   */
  canonicalScenario?: PdfComparisonScenarioV1;
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function PdfComparisonQaPanel({
  scenario,
  canonicalScenario,
}: PdfComparisonQaPanelProps) {
  const audit = useMemo(
    () => buildPdfComparisonAudit(scenario, canonicalScenario),
    [scenario, canonicalScenario],
  );

  return (
    <div
      style={{ fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}
      data-testid="pdf-comparison-qa-panel"
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: '0.75rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
          PDF Comparison QA
        </h3>
        <StatusBadge status={audit.overallStatus} />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
          {audit.mode} · {audit.scenarioLabel}
        </span>
      </div>

      {/* ── Summary row ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
        data-testid="pdf-comparison-summary"
      >
        <div style={{ fontSize: 12 }}>
          <span style={{ color: '#dc2626', fontWeight: 700 }} data-testid="pdf-comparison-fail-count">
            {audit.failCount}
          </span>{' '}
          <span style={{ color: '#64748b' }}>fail{audit.failCount !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ fontSize: 12 }}>
          <span style={{ color: '#d97706', fontWeight: 700 }} data-testid="pdf-comparison-warn-count">
            {audit.warnCount}
          </span>{' '}
          <span style={{ color: '#64748b' }}>warn{audit.warnCount !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ fontSize: 12 }}>
          <span style={{ color: '#16a34a', fontWeight: 700 }} data-testid="pdf-comparison-positive-pass-count">
            {audit.positivePassCount}/{audit.positiveTotalCount}
          </span>{' '}
          <span style={{ color: '#64748b' }}>positive checks passed</span>
        </div>
      </div>

      {/* ── Forbidden term findings ───────────────────────────────────────── */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '0.75rem',
          background: '#fff',
          marginBottom: '0.75rem',
        }}
        data-testid="pdf-comparison-forbidden-terms"
      >
        <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 600 }}>Forbidden term findings</p>
        <FindingList
          label="Technical terminology leakage"
          findings={audit.forbiddenTermFindings}
          testId="forbidden-term-findings-count"
        />
      </div>

      {/* ── Guessed capacity findings ─────────────────────────────────────── */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '0.75rem',
          background: '#fff',
          marginBottom: '0.75rem',
        }}
        data-testid="pdf-comparison-guessed-capacity"
      >
        <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 600 }}>Guessed capacity findings</p>
        <FindingList
          label="Guessed tank/CWS capacity ranges"
          findings={audit.guessedCapacityFindings}
          testId="guessed-capacity-findings-count"
        />
      </div>

      {/* ── Misleading phrasing findings ──────────────────────────────────── */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '0.75rem',
          background: '#fff',
          marginBottom: '0.75rem',
        }}
        data-testid="pdf-comparison-misleading-phrasing"
      >
        <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 600 }}>Missing reassurance findings</p>
        <FindingList
          label={'Misleading "system unchanged" phrasing'}
          findings={audit.misleadingPhrasingFindings}
          testId="misleading-phrasing-findings-count"
        />
      </div>

      {/* ── Legacy heading findings ───────────────────────────────────────── */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '0.75rem',
          background: '#fff',
          marginBottom: '0.75rem',
        }}
        data-testid="pdf-comparison-legacy-headings"
      >
        <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 600 }}>Legacy report heading findings</p>
        <FindingList
          label="Legacy headings"
          findings={audit.legacyHeadingFindings}
          testId="legacy-heading-findings-count"
        />
      </div>

      {/* ── Positive checks ───────────────────────────────────────────────── */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '0.75rem',
          background: '#fff',
          marginBottom: '0.75rem',
        }}
        data-testid="pdf-comparison-positive-checks"
      >
        <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 600 }}>Positive verification checks</p>
        <PositiveCheckList checks={audit.positiveChecks} />
      </div>

      {/* ── Projection safety ─────────────────────────────────────────────── */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '0.75rem',
          background: '#fff',
          marginBottom: '0.75rem',
        }}
        data-testid="pdf-comparison-projection-safety"
      >
        <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 600 }}>Projection safety status</p>
        {(() => {
          const check = audit.positiveChecks.find((c) => c.checkId === 'projection_safety_pass');
          if (check == null) return null;
          return (
            <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusBadge status={check.passed ? 'pass' : 'fail'} />
              <span style={{ color: '#475569' }}>{check.description}</span>
            </div>
          );
        })()}
      </div>

      {/* ── Legacy diff summary ───────────────────────────────────────────── */}
      {audit.legacyDiffSummary != null && (
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '0.75rem',
            background: '#fff',
            marginBottom: '0.75rem',
          }}
        >
          <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 600 }}>
            Legacy-vs-canonical diff summary
          </p>
          <LegacyDiffSection diff={audit.legacyDiffSummary} />
        </div>
      )}

      <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>
        Generated {audit.generatedAt} · v{audit.schemaVersion}
      </p>
    </div>
  );
}
