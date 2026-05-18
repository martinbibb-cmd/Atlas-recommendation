import { DiagramRenderer, SUPPORTED_DIAGRAM_RENDERER_IDS } from '../diagrams/DiagramRenderer';
import { getDiagramById } from '../diagrams/diagramExplanationRegistry';

const SYMBOLIC_QA_NOTES: Record<string, string> = {
  system_fit_decision_map: 'Still symbolic: decision nodes read as process blocks, not household hardware shapes.',
  stored_hot_water_recovery_timeline: 'Still symbolic: timeline bars communicate sequence, not physical plant geometry.',
  flow_restriction_bottleneck: 'Partly symbolic: restriction cue is abstract relative to full property pipe routing.',
};

export function DiagramFixturePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', color: '#0f172a', padding: '1rem' }} data-testid="diagram-fixture-page">
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: 24 }}>Heating Diagram Fixture</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
          Side-by-side homeowner visual QA at mobile width and print width.
        </p>
      </header>

      <section style={{ display: 'grid', gap: '1rem' }} data-testid="diagram-fixture-grid">
        {SUPPORTED_DIAGRAM_RENDERER_IDS.map((diagramId) => {
          const registryEntry = getDiagramById(diagramId);
          const qaNote = SYMBOLIC_QA_NOTES[diagramId];
          return (
            <article
              key={diagramId}
              data-testid={`diagram-fixture-card-${diagramId}`}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                background: '#fff',
                padding: '0.85rem',
                display: 'grid',
                gap: '0.75rem',
              }}
            >
              <div>
                <h2 style={{ margin: '0 0 0.25rem', fontSize: 16 }}>{registryEntry?.title ?? diagramId}</h2>
                <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>{diagramId}</p>
              </div>

              <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                <section data-testid={`diagram-fixture-mobile-${diagramId}`}>
                  <h3 style={{ margin: '0 0 0.3rem', fontSize: 12 }}>Mobile width (320px)</h3>
                  <div style={{ width: 320, maxWidth: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.5rem' }}>
                    <DiagramRenderer diagramId={diagramId} reducedMotion />
                  </div>
                </section>

                <section data-testid={`diagram-fixture-print-${diagramId}`}>
                  <h3 style={{ margin: '0 0 0.3rem', fontSize: 12 }}>Print width (A4-safe)</h3>
                  <div style={{ width: 720, maxWidth: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.5rem' }}>
                    <DiagramRenderer diagramId={diagramId} printSafe reducedMotion />
                  </div>
                </section>
              </div>

              {qaNote ? (
                <p
                  data-testid={`diagram-fixture-qa-note-${diagramId}`}
                  style={{ margin: 0, fontSize: 12, color: '#7c2d12', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: '0.5rem 0.6rem' }}
                >
                  Visual QA note: {qaNote}
                </p>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}

export default DiagramFixturePage;
