import { useState } from 'react';
import {
  VISUAL_TOPOLOGY_REGISTRY,
  type PipeTraceability,
  type VisualTopologyEntry,
} from './visualTopologyRegistry';
import { renderVisualTopology } from './topologies';
import { VISUAL_PRIMITIVE_REGISTRY } from '../visualPrimitives/visualPrimitiveRegistry';
import { HumanVisualReviewChecklist } from '../dev/HumanVisualReviewChecklist';
import { assessTopologyHydraulicTruth } from '../hydraulicTruth';

type SupplementalViewMode = 'mobile' | 'pipe_trace' | 'print_safe';

const VIEW_LABELS: Record<SupplementalViewMode, string> = {
  mobile: '📱 Mobile-width view',
  pipe_trace: '🧭 Pipe-trace view',
  print_safe: '🖨 Print-safe view',
};

function traceabilityBadge(value: PipeTraceability): string {
  if (value === 'clear') return '✓ clear';
  if (value === 'adequate') return '⚠ adequate';
  return '✖ unclear';
}

function TopologyCard({
  entry,
  showLabels,
  printSafe,
  pipeTrace,
  mobileWidth,
}: {
  entry: VisualTopologyEntry;
  showLabels: boolean;
  printSafe: boolean;
  pipeTrace: boolean;
  mobileWidth: boolean;
}) {
  const installerReview = assessTopologyHydraulicTruth(entry.id);
  const failingFlags = Object.entries(installerReview.flags)
    .filter(([, value]) => value)
    .map(([flag]) => flag);

  return (
    <article
      data-testid={`vt-gallery-card-${entry.id}`}
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        background: '#fff',
        padding: '0.85rem',
        display: 'grid',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>{entry.title}</h3>
        <code style={{ fontSize: 10, color: '#64748b' }}>{entry.id}</code>
      </div>

      {renderVisualTopology(entry.id, {
        showLabels,
        printSafe,
        pipeTrace,
        mobileWidth,
      })}

      <div style={{ fontSize: 11, color: '#475569', display: 'grid', gap: 2 }}>
        <p style={{ margin: 0 }}><strong>System type:</strong> {entry.systemType}</p>
        <p style={{ margin: 0 }}><strong>Purpose:</strong> {entry.physicalPurpose}</p>
        <p style={{ margin: 0 }}>
          <strong>Recognisability:</strong> {entry.recognisability.replace(/_/g, ' ')} ·{' '}
          <strong>Pipe traceability:</strong> {traceabilityBadge(entry.pipeTraceability)}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Print safe:</strong> {entry.printSafe ? '✓' : '✗'} ·{' '}
          <strong>Motion safe:</strong> {entry.motionSafe ? '✓' : '✗'} ·{' '}
          <strong>Allowed customer use:</strong> {entry.allowedCustomerUse ? 'yes' : 'no'}
        </p>
        {entry.qaNote && (
          <p style={{ margin: 0, color: '#7c2d12', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 6, padding: '4px 8px' }}>
            QA note: {entry.qaNote}
          </p>
        )}
      </div>

      <div
        data-testid={`vt-installer-review-${entry.id}`}
        style={{
          fontSize: 11,
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          background: '#f8fafc',
          padding: '0.5rem 0.6rem',
          display: 'grid',
          gap: 4,
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>
          Installer review mode · Plausibility score: {installerReview.plausibilityScore}%
        </p>
        <p style={{ margin: 0 }}>
          <strong>Hydraulic intent:</strong> {installerReview.hydraulicIntentSummary}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Safety notes:</strong> {installerReview.safetyNotes.join(' · ')}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Regulatory notes:</strong> {installerReview.regulatoryNotes.join(' · ')}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Known simplifications:</strong> {installerReview.knownSimplifications.join(' · ')}
        </p>
        <p style={{ margin: 0 }}>
          <strong>QA state:</strong>{' '}
          {failingFlags.length === 0
            ? 'PASS — no hydraulic-truth flags'
            : `FLAGGED — ${failingFlags.join(', ')}`}
        </p>
      </div>
    </article>
  );
}

export function VisualTopologyGallery() {
  const [viewMode, setViewMode] = useState<SupplementalViewMode>('mobile');
  const registeredPrimitiveIds = new Set(VISUAL_PRIMITIVE_REGISTRY.map((entry) => entry.id));
  const missingPrimitiveRefs = VISUAL_TOPOLOGY_REGISTRY.flatMap((topology) =>
    topology.primitivesUsed
      .filter((id) => !registeredPrimitiveIds.has(id))
      .map((id) => `${topology.id}:${id}`),
  );

  return (
    <main
      style={{ fontFamily: 'system-ui, sans-serif', color: '#0f172a', padding: '1rem' }}
      data-testid="visual-topology-gallery"
    >
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: 24 }}>Visual Topology Gallery — PR 2</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 13, maxWidth: '74ch' }}>
          Canonical connected heating-system layouts composed from PR 1 primitives only.
        </p>
      </header>

      <HumanVisualReviewChecklist
        checklistId="vt-gallery-human-review"
        title="Topology reviewer checklist"
        intro="Review each topology in no-label mode first, then confirm the mobile, pipe-trace, and print-safe views still tell the same story."
        reviewerPrompts={[
          'No-label view comes first',
          'Pipe-trace view must make flow and return obvious',
          'Installer plausibility matters as much as visual neatness',
        ]}
        questionNotes={{
          overlay_stays_clear: 'Mark this N/A in the topology gallery and answer it in the overlay gallery when callouts are active.',
        }}
      />

      <section data-testid="vt-gallery-primary-no-label" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 16, margin: '0 0 0.5rem' }}>Primary fixture — no-label view first</h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: 12, color: '#713f12', background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
          Labels hidden for recognisability QA. Pipework must remain physically readable without text.
        </p>
        <div
          data-testid="vt-gallery-physical-realism-callouts"
          style={{ margin: '0 0 0.75rem', fontSize: 12, color: '#1e3a8a', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, padding: '0.5rem 0.75rem', display: 'grid', gap: 2 }}
        >
          <span>QA checks: bottom-based radiator connections, ABV shape realism, Mixergy simplicity, and Mixergy vs thermal-store separation.</span>
          <span>Warn on excessive hose/loop routing; flow and return should be traceable by eye to real component ports.</span>
        </div>
        <section data-testid="vt-gallery-grid-no-label" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
          {VISUAL_TOPOLOGY_REGISTRY.map((entry) => (
            <TopologyCard
              key={`no-label-${entry.id}`}
              entry={entry}
              showLabels={false}
              printSafe={false}
              pipeTrace={false}
              mobileWidth={false}
            />
          ))}
        </section>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 16, margin: '0 0 0.5rem' }}>Supplemental QA views</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' }}>
          {(Object.keys(VIEW_LABELS) as SupplementalViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: viewMode === mode ? '#3b82f6' : '#cbd5e1',
                background: viewMode === mode ? '#eff6ff' : '#fff',
                color: viewMode === mode ? '#1d4ed8' : '#374151',
                fontSize: 12,
                fontWeight: viewMode === mode ? 600 : 400,
                cursor: 'pointer',
              }}
              aria-pressed={viewMode === mode}
            >
              {VIEW_LABELS[mode]}
            </button>
          ))}
        </div>
        <section data-testid="vt-gallery-grid-supplemental" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
          {VISUAL_TOPOLOGY_REGISTRY.map((entry) => (
            <TopologyCard
              key={`supplemental-${entry.id}-${viewMode}`}
              entry={entry}
              showLabels
              printSafe={viewMode === 'print_safe'}
              pipeTrace={viewMode === 'pipe_trace'}
              mobileWidth={viewMode === 'mobile'}
            />
          ))}
        </section>
      </section>

      <section style={{ marginBottom: '2rem' }} data-testid="vt-gallery-registry-metadata">
        <h2 style={{ fontSize: 16, margin: '0 0 0.5rem' }}>Registry metadata</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11, minWidth: 780 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                {['ID', 'System type', 'Primitives', 'Recognisability', 'Traceability', 'Print', 'Motion', 'Customer use'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VISUAL_TOPOLOGY_REGISTRY.map((entry) => (
                <tr key={`registry-${entry.id}`}>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}><code style={{ fontSize: 10 }}>{entry.id}</code></td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>{entry.systemType}</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>{entry.primitivesUsed.join(', ')}</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>{entry.recognisability.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>{entry.pipeTraceability}</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>{entry.printSafe ? '✓' : '✗'}</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>{entry.motionSafe ? '✓' : '✗'}</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>{entry.allowedCustomerUse ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section data-testid="vt-gallery-installer-review-summary" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 16, margin: '0 0 0.5rem' }}>Hydraulic truth installer review summary</h2>
        <p style={{ margin: 0, fontSize: 12, color: '#334155' }}>
          Topologies are now checked against canonical hydraulic truth constraints (hydraulic intent, safety, regulation, and simplification boundaries).
        </p>
      </section>

      <section data-testid="vt-gallery-missing-primitive-warning">
        <h2 style={{ fontSize: 16, margin: '0 0 0.5rem' }}>Missing primitive warnings</h2>
        {missingPrimitiveRefs.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#166534', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
            ✓ All topology primitive references resolve to registered visual primitives.
          </p>
        ) : (
          <div style={{ fontSize: 12, color: '#7f1d1d', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
            <p style={{ margin: '0 0 0.35rem' }}>✖ Missing primitive links detected:</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {missingPrimitiveRefs.map((ref) => <li key={ref}>{ref}</li>)}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

export default VisualTopologyGallery;
