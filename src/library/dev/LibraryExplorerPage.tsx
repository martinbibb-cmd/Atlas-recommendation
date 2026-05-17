import { useMemo, useState } from 'react';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';
import { educationalContentRegistry } from '../content/educationalContentRegistry';
import { diagramExplanationRegistry } from '../diagrams/diagramExplanationRegistry';
import { DiagramRenderer, isDiagramRendererIdSupported } from '../diagrams/DiagramRenderer';
import { EducationalAnimationRenderer, educationalAnimationRegistry } from '../animations';
import { welcomePackArchetypes } from '../packComposer/archetypes/welcomePackArchetypes';
import { buildLibraryCoverageAudit } from '../coverage/buildLibraryCoverageAudit';
import { buildLibraryAuthoringBacklog } from '../coverage/backlog/buildLibraryAuthoringBacklog';

type LibraryExplorerTab =
  | 'concepts'
  | 'journeys'
  | 'diagrams'
  | 'animations'
  | 'lived-experience'
  | 'print-fallbacks'
  | 'projection-safety';

const TAB_LABELS: Record<LibraryExplorerTab, string> = {
  concepts: 'Concepts',
  journeys: 'Journeys',
  diagrams: 'Diagrams',
  animations: 'Animations',
  'lived-experience': 'Lived experience',
  'print-fallbacks': 'Print fallbacks',
  'projection-safety': 'Projection safety',
};

function conceptSetFromArchetype(archetypeId: string): Set<string> {
  const archetype = welcomePackArchetypes.find((entry) => entry.goldenJourneyId === archetypeId);
  if (!archetype) return new Set();
  return new Set([
    ...archetype.requiredConceptIds,
    ...archetype.recommendedConceptIds,
    ...archetype.optionalConceptIds,
    ...archetype.trustRecoveryConceptIds,
    ...archetype.livingWithSystemConceptIds,
  ]);
}

function hasLivedExperience(entry: (typeof educationalContentRegistry)[number]): boolean {
  return (
    entry.livingExperiencePattern != null ||
    (entry.livingWithSystemGuidance != null && entry.livingWithSystemGuidance.trim().length > 0)
  );
}

export function LibraryExplorerPage() {
  const [tab, setTab] = useState<LibraryExplorerTab>('concepts');

  const audit = useMemo(() => buildLibraryCoverageAudit(), []);
  const backlog = useMemo(() => buildLibraryAuthoringBacklog(audit), [audit]);
  const coverageByConcept = useMemo(
    () => new Map(audit.conceptCoverage.map((entry) => [entry.conceptId, entry])),
    [audit],
  );
  const backlogByConcept = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of backlog.backlogItems) {
      const existing = map.get(item.conceptId) ?? [];
      map.set(item.conceptId, [...existing, item.gapType]);
    }
    return map;
  }, [backlog]);

  const journeyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const archetype of welcomePackArchetypes) {
      if (archetype.goldenJourneyId) ids.add(archetype.goldenJourneyId);
    }
    for (const entry of diagramExplanationRegistry) {
      for (const journeyId of entry.journeyIds) ids.add(journeyId);
    }
    for (const animation of educationalAnimationRegistry) {
      for (const journeyId of animation.journeyIds) ids.add(journeyId);
    }
    return [...ids].sort();
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', color: '#0f172a', padding: '1rem' }} data-testid="library-explorer-page">
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: 24 }}>Library Explorer</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
          Inspect concepts, journeys, diagrams, animations, lived-experience patterns, print fallbacks, and projection status.
        </p>
      </header>

      <nav style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {(Object.keys(TAB_LABELS) as LibraryExplorerTab[]).map((tabId) => (
          <button
            key={tabId}
            type="button"
            data-testid={`library-explorer-tab-${tabId}`}
            onClick={() => setTab(tabId)}
            style={{
              padding: '0.3rem 0.65rem',
              borderRadius: 999,
              border: '1px solid',
              borderColor: tab === tabId ? '#2563eb' : '#cbd5e1',
              background: tab === tabId ? '#eff6ff' : '#fff',
              color: tab === tabId ? '#1d4ed8' : '#334155',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {TAB_LABELS[tabId]}
          </button>
        ))}
      </nav>

      {tab === 'animations' && (
        <section data-testid="library-explorer-panel-animations" style={{ display: 'grid', gap: '0.75rem' }}>
          {educationalAnimationRegistry.map((animation) => (
            <article
              key={animation.animationId}
              data-testid={`library-explorer-animation-${animation.animationId}`}
              style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#fff' }}
            >
              <h2 style={{ margin: '0 0 0.35rem', fontSize: 15 }}>{animation.title}</h2>
              <div style={{ fontSize: 12, color: '#334155', display: 'grid', gap: '0.15rem' }}>
                <div><strong>animationId:</strong> {animation.animationId}</div>
                <div><strong>purpose:</strong> {animation.purpose}</div>
                <div><strong>conceptIds:</strong> {animation.conceptIds.join(', ') || 'none'}</div>
                <div><strong>journeyIds:</strong> {animation.journeyIds.join(', ') || 'none'}</div>
                <div><strong>customerSafe:</strong> {animation.customerSafe ? 'true' : 'false'}</div>
                <div><strong>durationMs:</strong> {animation.durationMs}</div>
                <div><strong>screenReaderSummary:</strong> {animation.screenReaderSummary}</div>
                <div><strong>reducedMotionFallback:</strong> {animation.reducedMotionFallback}</div>
                <div><strong>printFallback:</strong> {animation.printFallback}</div>
              </div>
              <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.6rem' }}>
                <section>
                  <h3 style={{ margin: '0 0 0.3rem', fontSize: 12 }}>Digital</h3>
                  <EducationalAnimationRenderer animationId={animation.animationId} mode="digital" />
                </section>
                <section>
                  <h3 style={{ margin: '0 0 0.3rem', fontSize: 12 }}>Reduced motion</h3>
                  <EducationalAnimationRenderer animationId={animation.animationId} prefersReducedMotion />
                </section>
                <section>
                  <h3 style={{ margin: '0 0 0.3rem', fontSize: 12 }}>Print</h3>
                  <EducationalAnimationRenderer animationId={animation.animationId} mode="print" />
                </section>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === 'diagrams' && (
        <section data-testid="library-explorer-panel-diagrams" style={{ display: 'grid', gap: '0.75rem' }}>
          {diagramExplanationRegistry.map((diagram) => (
            <article
              key={diagram.diagramId}
              data-testid={`library-explorer-diagram-${diagram.diagramId}`}
              style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#fff' }}
            >
              <h2 style={{ margin: '0 0 0.35rem', fontSize: 15 }}>{diagram.title}</h2>
              <div style={{ fontSize: 12, color: '#334155', display: 'grid', gap: '0.15rem' }}>
                <div><strong>diagramId:</strong> {diagram.diagramId}</div>
                <div><strong>linked concepts:</strong> {diagram.conceptIds.join(', ') || 'none'}</div>
                <div><strong>journey usage:</strong> {diagram.journeyIds.join(', ') || 'none'}</div>
                <div><strong>screen reader summary:</strong> {diagram.screenReaderSummary}</div>
                <div><strong>print-safe state:</strong> {isDiagramRendererIdSupported(diagram.diagramId) ? 'print_safe' : 'renderer_missing'}</div>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <DiagramRenderer diagramId={diagram.diagramId} printSafe />
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === 'journeys' && (
        <section data-testid="library-explorer-panel-journeys" style={{ display: 'grid', gap: '0.75rem' }}>
          {journeyIds.map((journeyId) => {
            const journeyConcepts = conceptSetFromArchetype(journeyId);
            const diagrams = diagramExplanationRegistry.filter((entry) => entry.journeyIds.includes(journeyId));
            const animations = educationalAnimationRegistry.filter((entry) => entry.journeyIds.includes(journeyId));
            for (const entry of diagrams) for (const conceptId of entry.conceptIds) journeyConcepts.add(conceptId);
            for (const entry of animations) for (const conceptId of entry.conceptIds) journeyConcepts.add(conceptId);
            const conceptIds = [...journeyConcepts].sort();
            const livedCards = educationalContentRegistry.filter((entry) =>
              conceptIds.includes(entry.conceptId) && hasLivedExperience(entry),
            );
            const archetype = welcomePackArchetypes.find((entry) => entry.goldenJourneyId === journeyId);
            const printSections = archetype?.defaultSections ?? [];
            const missingCoverage = conceptIds.filter((conceptId) => {
              const coverage = coverageByConcept.get(conceptId);
              return coverage != null && (!coverage.hasDiagram || !coverage.hasJourneyRouting || !coverage.projectionSafe);
            });

            return (
              <article
                key={journeyId}
                data-testid={`library-explorer-journey-${journeyId}`}
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#fff', fontSize: 12 }}
              >
                <h2 style={{ margin: '0 0 0.35rem', fontSize: 15 }}>{journeyId}</h2>
                <div><strong>concepts used:</strong> {conceptIds.join(', ') || 'none'}</div>
                <div><strong>diagrams used:</strong> {diagrams.map((entry) => entry.diagramId).join(', ') || 'none'}</div>
                <div>
                  <strong>animations used:</strong>{' '}
                  {animations.length > 0 ? animations.map((entry) => entry.animationId).join(', ') : 'none'}
                </div>
                <div><strong>lived-experience cards used:</strong> {livedCards.map((entry) => entry.contentId).join(', ') || 'none'}</div>
                <div><strong>print sections used:</strong> {printSections.join(', ') || 'none'}</div>
                <div style={{ marginTop: '0.25rem' }}>
                  <strong>coverage:</strong>{' '}
                  {missingCoverage.length === 0 ? 'covered' : `missing (${missingCoverage.length})`}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {tab === 'concepts' && (
        <section data-testid="library-explorer-panel-concepts" style={{ display: 'grid', gap: '0.75rem' }}>
          {educationalConceptTaxonomy.map((concept) => {
            const content = educationalContentRegistry.find((entry) => entry.conceptId === concept.conceptId);
            const diagrams = diagramExplanationRegistry.filter((entry) => entry.conceptIds.includes(concept.conceptId));
            const animations = educationalAnimationRegistry.filter((entry) => entry.conceptIds.includes(concept.conceptId));
            const coverage = coverageByConcept.get(concept.conceptId);
            const gaps = backlogByConcept.get(concept.conceptId) ?? [];
            return (
              <article
                key={concept.conceptId}
                data-testid={`library-explorer-concept-${concept.conceptId}`}
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#fff', fontSize: 12 }}
              >
                <h2 style={{ margin: '0 0 0.35rem', fontSize: 15 }}>
                  {concept.conceptId} — {concept.title}
                </h2>
                <div><strong>taxonomy metadata:</strong> {concept.category} · audience {concept.defaultAudience} · depth {concept.defaultDepth}</div>
                <div><strong>educational content:</strong> {content?.contentId ?? 'missing'}</div>
                <div><strong>lived-experience pattern:</strong> {content?.livingExperiencePattern ? 'present' : 'missing'}</div>
                <div>
                  <strong>diagrams:</strong>{' '}
                  {diagrams.length > 0 ? diagrams.map((entry) => entry.diagramId).join(', ') : 'none'}
                </div>
                <div>
                  <strong>animations:</strong>{' '}
                  {animations.length > 0 ? animations.map((entry) => entry.animationId).join(', ') : 'none'}
                </div>
                <div><strong>projection safety status:</strong> {coverage?.projectionSafe ? 'safe' : 'gap'}</div>
                <div><strong>backlog gaps:</strong> {gaps.length > 0 ? gaps.join(', ') : 'none'}</div>
              </article>
            );
          })}
        </section>
      )}

      {tab === 'lived-experience' && (
        <section data-testid="library-explorer-panel-lived-experience" style={{ display: 'grid', gap: '0.75rem' }}>
          {educationalContentRegistry
            .filter((entry) => hasLivedExperience(entry))
            .map((entry) => (
              <article
                key={entry.contentId}
                data-testid={`library-explorer-lived-${entry.contentId}`}
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#fff', fontSize: 12 }}
              >
                <h2 style={{ margin: '0 0 0.35rem', fontSize: 15 }}>{entry.contentId}</h2>
                <div><strong>conceptId:</strong> {entry.conceptId}</div>
                <div><strong>title:</strong> {entry.title}</div>
                <div><strong>guidance:</strong> {entry.livingWithSystemGuidance ?? 'none'}</div>
                <div><strong>pattern:</strong> {entry.livingExperiencePattern ? 'present' : 'missing'}</div>
                <div><strong>print summary:</strong> {entry.livingExperiencePattern?.printSummary ?? entry.printSummary}</div>
              </article>
            ))}
        </section>
      )}

      {tab === 'print-fallbacks' && (
        <section data-testid="library-explorer-panel-print-fallbacks" style={{ display: 'grid', gap: '0.75rem' }}>
          <article style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#fff', fontSize: 12 }}>
            <h2 style={{ margin: '0 0 0.35rem', fontSize: 15 }}>Animation print fallbacks</h2>
            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
              {educationalAnimationRegistry.map((entry) => (
                <li key={entry.animationId}>
                  {entry.animationId}: print={entry.printFallback}, reduced-motion={entry.reducedMotionFallback}
                </li>
              ))}
            </ul>
          </article>
          <article style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#fff', fontSize: 12 }}>
            <h2 style={{ margin: '0 0 0.35rem', fontSize: 15 }}>Diagram print safety</h2>
            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
              {diagramExplanationRegistry.map((entry) => (
                <li key={entry.diagramId}>
                  {entry.diagramId}: {isDiagramRendererIdSupported(entry.diagramId) ? 'print-safe renderer available' : 'renderer missing'}
                </li>
              ))}
            </ul>
          </article>
          <article style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#fff', fontSize: 12 }}>
            <h2 style={{ margin: '0 0 0.35rem', fontSize: 15 }}>Content print summaries</h2>
            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
              {educationalContentRegistry.map((entry) => (
                <li key={entry.contentId}>{entry.contentId}: {entry.printSummary}</li>
              ))}
            </ul>
          </article>
        </section>
      )}

      {tab === 'projection-safety' && (
        <section data-testid="library-explorer-panel-projection-safety" style={{ display: 'grid', gap: '0.75rem' }}>
          <article style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#fff', fontSize: 12 }}>
            <h2 style={{ margin: '0 0 0.35rem', fontSize: 15 }}>Projection readiness</h2>
            <div>projection-safe concepts: {audit.readinessScore.projectionSafeCount} / {audit.readinessScore.totalConcepts}</div>
            <div>projection-safe percentage: {audit.readinessScore.projectionSafePct}%</div>
          </article>
          <article style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#fff', fontSize: 12 }}>
            <h2 style={{ margin: '0 0 0.35rem', fontSize: 15 }}>Concepts with projection gaps</h2>
            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
              {audit.conceptCoverage.filter((entry) => !entry.projectionSafe).map((entry) => (
                <li key={entry.conceptId}>{entry.conceptId} — {entry.conceptTitle}</li>
              ))}
            </ul>
          </article>
        </section>
      )}
    </main>
  );
}

export default LibraryExplorerPage;
