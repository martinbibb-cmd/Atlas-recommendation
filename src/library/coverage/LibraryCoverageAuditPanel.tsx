import { useMemo, useState } from 'react';
import { buildLibraryCoverageAudit } from './buildLibraryCoverageAudit';
import type { LibraryConceptCoverageV1 } from './LibraryCoverageAuditV1';

// ─── Coverage pill ────────────────────────────────────────────────────────────

function CoveragePill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        background: ok ? '#dcfce7' : '#fee2e2',
        color: ok ? '#166534' : '#991b1b',
        marginRight: 3,
      }}
    >
      {label}
    </span>
  );
}

// ─── Readiness bar ────────────────────────────────────────────────────────────

interface ReadinessBarProps {
  label: string;
  count: number;
  total: number;
  pct: number;
  color: string;
  testId?: string;
}

function ReadinessBar({ label, count, total, pct, color, testId }: ReadinessBarProps) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }} data-testid={testId}>
          {count} / {total} ({pct}%)
        </span>
      </div>
      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 4 }}>
        <div
          style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }}
        />
      </div>
    </div>
  );
}

// ─── Missing list ─────────────────────────────────────────────────────────────

function MissingList({ label, ids, testId }: { label: string; ids: readonly string[]; testId: string }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? ids : ids.slice(0, 5);

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
        <strong>{label}</strong>
        <span
          style={{ color: ids.length === 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}
          data-testid={testId}
        >
          {ids.length === 0 ? '✓ complete' : `${ids.length} missing`}
        </span>
      </div>
      {ids.length > 0 && (
        <>
          <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1rem', fontSize: 11, color: '#475569' }}>
            {visible.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
          {ids.length > 5 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              style={{
                fontSize: 11,
                color: '#2563eb',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.1rem 0',
              }}
            >
              {expanded ? '▲ Show less' : `▼ Show ${ids.length - 5} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Concept row ──────────────────────────────────────────────────────────────

function ConceptCoverageRow({ concept }: { concept: LibraryConceptCoverageV1 }) {
  return (
    <tr
      style={{
        background: concept.projectionSafe ? undefined : '#fffbeb',
        borderBottom: '1px solid #f1f5f9',
      }}
      data-testid={`coverage-row-${concept.conceptId}`}
    >
      <td style={{ padding: '0.3rem 0.4rem', fontSize: 11, fontWeight: 600, color: '#1e293b' }}>
        {concept.conceptId}
        <div style={{ fontWeight: 400, color: '#64748b', fontSize: 10 }}>{concept.conceptTitle}</div>
      </td>
      <td style={{ padding: '0.3rem 0.2rem', fontSize: 11, color: '#475569' }}>{concept.category}</td>
      <td style={{ padding: '0.3rem 0.2rem' }}>
        <CoveragePill ok={concept.hasDiagram} label="diag" />
        <CoveragePill ok={concept.hasAnimation} label="anim" />
        <CoveragePill ok={concept.hasPrintCard} label="print" />
      </td>
      <td style={{ padding: '0.3rem 0.2rem' }}>
        <CoveragePill ok={concept.hasLivedExperienceContent} label="lived" />
        <CoveragePill ok={concept.hasWhatYouMayNotice} label="notice" />
        <CoveragePill ok={concept.hasMisconceptionReality} label="misc" />
      </td>
      <td style={{ padding: '0.3rem 0.2rem' }}>
        <CoveragePill ok={concept.hasJourneyRouting} label="routed" />
      </td>
      <td style={{ padding: '0.3rem 0.2rem' }}>
        <CoveragePill ok={concept.projectionSafe} label={concept.projectionSafe ? '✓ safe' : '✗ gap'} />
      </td>
    </tr>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'gaps_only' | 'no_visual' | 'no_lived' | 'unrouted';

const FILTER_LABELS: Record<FilterMode, string> = {
  all: 'All concepts',
  gaps_only: 'Not projection-safe',
  no_visual: 'No visual assets',
  no_lived: 'No lived-experience',
  unrouted: 'Unrouted',
};

export function LibraryCoverageAuditPanel() {
  const audit = useMemo(() => buildLibraryCoverageAudit(), []);
  const { readinessScore, missingByType, conceptCoverage } = audit;

  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const filteredConcepts = useMemo(() => {
    switch (filterMode) {
      case 'gaps_only':
        return conceptCoverage.filter((c) => !c.projectionSafe);
      case 'no_visual':
        return conceptCoverage.filter((c) => !c.hasDiagram && !c.hasAnimation);
      case 'no_lived':
        return conceptCoverage.filter((c) => !c.hasLivedExperienceContent && !c.hasWhatYouMayNotice);
      case 'unrouted':
        return conceptCoverage.filter((c) => !c.hasJourneyRouting);
      default:
        return conceptCoverage;
    }
  }, [conceptCoverage, filterMode]);

  return (
    <div
      style={{ fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}
      data-testid="library-coverage-audit-panel"
    >
      <h3 style={{ margin: '0 0 0.75rem', fontSize: 14, fontWeight: 700 }}>
        Library Content Coverage Audit
      </h3>
      <p style={{ margin: '0 0 1rem', fontSize: 12, color: '#64748b' }}>
        {readinessScore.totalConcepts} concepts tracked across all registered taxonomy entries.
      </p>

      {/* ── Readiness scores ─────────────────────────────────────────────── */}
      <div
        style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#fff', marginBottom: '1rem' }}
        data-testid="coverage-readiness-scores"
      >
        <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 600 }}>Readiness scores</p>
        <ReadinessBar
          label="Customer-ready (lived + notice + misconception)"
          count={readinessScore.customerReadyCount}
          total={readinessScore.totalConcepts}
          pct={readinessScore.customerReadyPct}
          color="#16a34a"
          testId="readiness-customer-ready"
        />
        <ReadinessBar
          label="Visually-ready (diagram or animation)"
          count={readinessScore.visuallyReadyCount}
          total={readinessScore.totalConcepts}
          pct={readinessScore.visuallyReadyPct}
          color="#2563eb"
          testId="readiness-visually-ready"
        />
        <ReadinessBar
          label="Print-ready (has print equivalent)"
          count={readinessScore.printReadyCount}
          total={readinessScore.totalConcepts}
          pct={readinessScore.printReadyPct}
          color="#7c3aed"
          testId="readiness-print-ready"
        />
        <ReadinessBar
          label="Projection-safe (routed + lived/notice)"
          count={readinessScore.projectionSafeCount}
          total={readinessScore.totalConcepts}
          pct={readinessScore.projectionSafePct}
          color="#0891b2"
          testId="readiness-projection-safe"
        />
      </div>

      {/* ── Missing coverage by type ─────────────────────────────────────── */}
      <div
        style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#fff', marginBottom: '1rem' }}
        data-testid="coverage-missing-by-type"
      >
        <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 600 }}>Missing coverage by type</p>
        <MissingList label="Missing diagram" ids={missingByType.missingDiagram} testId="missing-diagram-count" />
        <MissingList label="Missing animation" ids={missingByType.missingAnimation} testId="missing-animation-count" />
        <MissingList label="Missing print card" ids={missingByType.missingPrintCard} testId="missing-print-card-count" />
        <MissingList label="Missing lived-experience content" ids={missingByType.missingLivedExperienceContent} testId="missing-lived-experience-count" />
        <MissingList label="Missing misconception/reality" ids={missingByType.missingMisconceptionReality} testId="missing-misconception-count" />
        <MissingList label="Missing what-you-may-notice" ids={missingByType.missingWhatYouMayNotice} testId="missing-what-you-may-notice-count" />
        <MissingList label="Not routed by any journey" ids={missingByType.missingJourneyRouting} testId="missing-journey-routing-count" />
      </div>

      {/* ── Per-concept table ────────────────────────────────────────────── */}
      <div
        style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', overflow: 'hidden', marginBottom: '1rem' }}
        data-testid="coverage-concept-table"
      >
        <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, marginRight: '0.25rem' }}>Filter:</span>
          {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              data-testid={`coverage-filter-${mode}`}
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                border: '1px solid',
                borderColor: filterMode === mode ? '#2563eb' : '#cbd5e1',
                background: filterMode === mode ? '#eff6ff' : '#fff',
                color: filterMode === mode ? '#1d4ed8' : '#475569',
                cursor: 'pointer',
              }}
            >
              {FILTER_LABELS[mode]}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
            {filteredConcepts.length} concept{filteredConcepts.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.3rem 0.4rem', textAlign: 'left', fontWeight: 600 }}>Concept</th>
                <th style={{ padding: '0.3rem 0.2rem', textAlign: 'left', fontWeight: 600 }}>Category</th>
                <th style={{ padding: '0.3rem 0.2rem', textAlign: 'left', fontWeight: 600 }}>Visual</th>
                <th style={{ padding: '0.3rem 0.2rem', textAlign: 'left', fontWeight: 600 }}>Content</th>
                <th style={{ padding: '0.3rem 0.2rem', textAlign: 'left', fontWeight: 600 }}>Routing</th>
                <th style={{ padding: '0.3rem 0.2rem', textAlign: 'left', fontWeight: 600 }}>Projection</th>
              </tr>
            </thead>
            <tbody>
              {filteredConcepts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                    No concepts match this filter.
                  </td>
                </tr>
              ) : (
                filteredConcepts.map((concept) => (
                  <ConceptCoverageRow key={concept.conceptId} concept={concept} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>
        Generated {audit.generatedAt} · v{audit.schemaVersion}
      </p>
    </div>
  );
}
