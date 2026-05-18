import { useMemo, useState } from 'react';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';
import { educationalContentRegistry } from '../content/educationalContentRegistry';
import { diagramExplanationRegistry } from '../diagrams/diagramExplanationRegistry';
import { DiagramRenderer, isDiagramRendererIdSupported } from '../diagrams/DiagramRenderer';
import { EducationalAnimationRenderer, educationalAnimationRegistry } from '../animations';
import { welcomePackArchetypes } from '../packComposer/archetypes/welcomePackArchetypes';
import { buildLibraryCoverageAudit } from '../coverage/buildLibraryCoverageAudit';
import { buildLibraryAuthoringBacklog } from '../coverage/backlog/buildLibraryAuthoringBacklog';
import { matchesVisualReadinessFilter, type VisualReadinessFilter } from '../visualReadiness';
import '../../portal/visualLanguage/atlasVisualLanguage.css';

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

function customerSentence(summary: string | undefined, fallback: string): string {
  if (summary?.trim()) return summary;
  return fallback;
}

function StoryboardCard({
  title,
  eyebrow,
  copy,
  meta,
  preview,
  testId,
  footer,
}: {
  title: string;
  eyebrow: string;
  copy: string;
  meta: string[];
  preview: React.ReactNode;
  testId?: string;
  footer?: React.ReactNode;
}) {
  return (
    <article className="atlas-library-storyboard" data-testid={testId}>
      <div>
        <p className="atlas-library-storyboard__eyebrow">{eyebrow}</p>
        <h2 style={{ margin: '0.2rem 0 0.35rem', fontSize: 18 }}>{title}</h2>
        <p className="atlas-library-storyboard__copy">{copy}</p>
      </div>
      <div className="atlas-library-storyboard__meta">
        {meta.map((item) => (
          <span key={item} className="atlas-library-storyboard__meta-chip">{item}</span>
        ))}
      </div>
      <div className="atlas-library-storyboard__preview">{preview}</div>
      {footer}
    </article>
  );
}

export function LibraryExplorerPage() {
  const [tab, setTab] = useState<LibraryExplorerTab>('concepts');
  const [visualFilter, setVisualFilter] = useState<VisualReadinessFilter>('all');

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
  const filteredDiagrams = useMemo(
    () => diagramExplanationRegistry.filter((entry) => matchesVisualReadinessFilter(entry, visualFilter)),
    [visualFilter],
  );
  const filteredAnimations = useMemo(
    () => educationalAnimationRegistry.filter((entry) => matchesVisualReadinessFilter(entry, visualFilter)),
    [visualFilter],
  );

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', color: '#0f172a', padding: '1rem' }} data-testid="library-explorer-page">
      <header style={{ marginBottom: '1rem', display: 'grid', gap: '0.85rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.35rem', fontSize: 24 }}>Library Explorer</h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
            Preview the customer-facing story first, then inspect the registry metadata behind it.
          </p>
        </div>
        <section className="atlas-library-storyboard" data-testid="library-explorer-storyboard">
          <div>
            <p className="atlas-library-storyboard__eyebrow">Physics storytelling gate</p>
            <h2 style={{ margin: '0.2rem 0 0.35rem', fontSize: 18 }}>Every visual must read like a household moment</h2>
            <p className="atlas-library-storyboard__copy">
              If a customer cannot explain the visual in one sentence, it is still a placeholder no matter how tidy the layout looks.
            </p>
          </div>
          <div className="atlas-library-storyboard__meta">
            <span className="atlas-library-storyboard__meta-chip">{`Projection-safe ${audit.readinessScore.projectionSafePct}%`}</span>
            <span className="atlas-library-storyboard__meta-chip">{`Concepts ${audit.readinessScore.projectionSafeCount}/${audit.readinessScore.totalConcepts}`}</span>
            <span className="atlas-library-storyboard__meta-chip">{`Backlog ${backlog.backlogItems.length}`}</span>
          </div>
          <p className="atlas-library-storyboard__copy">
            <a href="/dev/diagram-fixture">Open Diagram Fixture →</a>
          </p>
        </section>
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

      <section
        data-testid="library-explorer-visual-filters"
        style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}
      >
        {([
          ['all', 'All visuals'],
          ['production_ready', 'Production-ready'],
          ['draft', 'Draft'],
          ['placeholder', 'Placeholder'],
          ['needs_redesign', 'Needs redesign'],
        ] as const).map(([filterId, label]) => (
          <button
            key={filterId}
            type="button"
            data-testid={`library-explorer-visual-filter-${filterId}`}
            onClick={() => setVisualFilter(filterId)}
            style={{
              padding: '0.3rem 0.65rem',
              borderRadius: 999,
              border: '1px solid',
              borderColor: visualFilter === filterId ? '#0f766e' : '#cbd5e1',
              background: visualFilter === filterId ? '#f0fdfa' : '#fff',
              color: visualFilter === filterId ? '#115e59' : '#334155',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </section>

      {tab === 'animations' && (
        <section data-testid="library-explorer-panel-animations" style={{ display: 'grid', gap: '0.75rem' }}>
          {filteredAnimations.map((animation) => (
            <StoryboardCard
              key={animation.animationId}
              testId={`library-explorer-animation-${animation.animationId}`}
              eyebrow="Animation story"
              title={animation.title}
              copy={customerSentence(
                animation.screenReaderSummary,
                `This animation explains ${animation.purpose} without making the customer decode raw telemetry first.`,
              )}
              meta={[
                animation.animationId,
                animation.visualStatus,
                animation.customerReady ? 'customer-ready' : 'internal-only',
              ]}
              preview={
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <section>
                    <h3 style={{ margin: '0 0 0.3rem', fontSize: 12 }}>Digital preview</h3>
                    <EducationalAnimationRenderer animationId={animation.animationId} mode="digital" />
                  </section>
                  <section>
                    <h3 style={{ margin: '0 0 0.3rem', fontSize: 12 }}>Reduced motion</h3>
                    <EducationalAnimationRenderer animationId={animation.animationId} prefersReducedMotion />
                  </section>
                  <section>
                    <h3 style={{ margin: '0 0 0.3rem', fontSize: 12 }}>Print fallback</h3>
                    <EducationalAnimationRenderer animationId={animation.animationId} mode="print" />
                  </section>
                </div>
              }
              footer={
                <p className="atlas-library-storyboard__copy">
                  Purpose: {animation.purpose}. Replacement needed: {animation.replacementNeededReason ?? 'no'}.
                </p>
              }
            />
          ))}
        </section>
      )}

      {tab === 'diagrams' && (
        <section data-testid="library-explorer-panel-diagrams" style={{ display: 'grid', gap: '0.75rem' }}>
          {filteredDiagrams.map((diagram) => (
            <StoryboardCard
              key={diagram.diagramId}
              testId={`library-explorer-diagram-${diagram.diagramId}`}
              eyebrow="Diagram story"
              title={diagram.title}
              copy={customerSentence(
                diagram.screenReaderSummary,
                `This diagram should let a customer explain ${diagram.title.toLowerCase()} in one sentence.`,
              )}
              meta={[
                diagram.diagramId,
                diagram.visualStatus,
                diagram.customerReady ? 'customer-ready' : 'internal-only',
              ]}
              preview={<DiagramRenderer diagramId={diagram.diagramId} printSafe />}
              footer={
                <p className="atlas-library-storyboard__copy">
                  Linked concepts: {diagram.conceptIds.join(', ') || 'none'}. Print-safe state: {isDiagramRendererIdSupported(diagram.diagramId) ? 'renderer available' : 'renderer missing'}.
                </p>
              }
            />
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
              <StoryboardCard
                key={journeyId}
                testId={`library-explorer-journey-${journeyId}`}
                eyebrow="Journey composition"
                title={journeyId}
                copy={`This journey currently pulls together ${conceptIds.length} concepts, ${diagrams.length} diagrams, and ${animations.length} animations.`}
                meta={[
                  missingCoverage.length === 0 ? 'covered' : `missing ${missingCoverage.length}`,
                  livedCards.length > 0 ? `${livedCards.length} lived cards` : 'no lived cards',
                  printSections.length > 0 ? `${printSections.length} print sections` : 'no print sections',
                ]}
                preview={
                  <div style={{ fontSize: 12, display: 'grid', gap: '0.35rem' }}>
                    <div><strong>Concepts:</strong> {conceptIds.join(', ') || 'none'}</div>
                    <div><strong>Diagrams:</strong> {diagrams.map((entry) => entry.diagramId).join(', ') || 'none'}</div>
                    <div><strong>Animations:</strong> {animations.length > 0 ? animations.map((entry) => entry.animationId).join(', ') : 'none'}</div>
                    <div><strong>Lived-experience cards:</strong> {livedCards.map((entry) => entry.contentId).join(', ') || 'none'}</div>
                    <div><strong>Print sections:</strong> {printSections.join(', ') || 'none'}</div>
                  </div>
                }
              />
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
              <StoryboardCard
                key={concept.conceptId}
                testId={`library-explorer-concept-${concept.conceptId}`}
                eyebrow={concept.category}
                title={`${concept.conceptId} — ${concept.title}`}
                copy={customerSentence(
                  content?.livingExperiencePattern?.printSummary ?? content?.printSummary,
                  `${concept.title} still needs a one-sentence household explanation.`,
                )}
                meta={[
                  `audience ${concept.defaultAudience}`,
                  `depth ${concept.defaultDepth}`,
                  coverage?.projectionSafe ? 'projection-safe' : 'projection gap',
                ]}
                preview={
                  <div style={{ fontSize: 12, display: 'grid', gap: '0.35rem' }}>
                    <div><strong>Educational content:</strong> {content?.contentId ?? 'missing'}</div>
                    <div><strong>Lived-experience pattern:</strong> {content?.livingExperiencePattern ? 'present' : 'missing'}</div>
                    <div><strong>Diagrams:</strong> {diagrams.length > 0 ? diagrams.map((entry) => entry.diagramId).join(', ') : 'none'}</div>
                    <div><strong>Animations:</strong> {animations.length > 0 ? animations.map((entry) => entry.animationId).join(', ') : 'none'}</div>
                    <div><strong>Backlog gaps:</strong> {gaps.length > 0 ? gaps.join(', ') : 'none'}</div>
                  </div>
                }
              />
            );
          })}
        </section>
      )}

      {tab === 'lived-experience' && (
        <section data-testid="library-explorer-panel-lived-experience" style={{ display: 'grid', gap: '0.75rem' }}>
          {educationalContentRegistry
            .filter((entry) => hasLivedExperience(entry))
            .map((entry) => (
              <StoryboardCard
                key={entry.contentId}
                testId={`library-explorer-lived-${entry.contentId}`}
                eyebrow="Lived experience"
                title={entry.title}
                copy={customerSentence(
                  entry.livingExperiencePattern?.printSummary ?? entry.livingWithSystemGuidance,
                  entry.printSummary,
                )}
                meta={[
                  entry.contentId,
                  entry.conceptId,
                  entry.livingExperiencePattern ? 'pattern present' : 'guidance only',
                ]}
                preview={
                  <div style={{ fontSize: 12, display: 'grid', gap: '0.35rem' }}>
                    <div><strong>Guidance:</strong> {entry.livingWithSystemGuidance ?? 'none'}</div>
                    <div><strong>Pattern:</strong> {entry.livingExperiencePattern ? 'present' : 'missing'}</div>
                    <div><strong>Print summary:</strong> {entry.livingExperiencePattern?.printSummary ?? entry.printSummary}</div>
                  </div>
                }
              />
            ))}
        </section>
      )}

      {tab === 'print-fallbacks' && (
        <section data-testid="library-explorer-panel-print-fallbacks" style={{ display: 'grid', gap: '0.75rem' }}>
          <StoryboardCard
            eyebrow="Print fallback"
            title="Animation print fallbacks"
            copy="Every motion asset needs a readable still state and a reduced-motion explanation before it can be treated as customer-safe."
            meta={[`${educationalAnimationRegistry.length} animations`]}
            preview={
              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 12 }}>
                {educationalAnimationRegistry.map((entry) => (
                  <li key={entry.animationId}>
                    {entry.animationId}: print={entry.printFallback}, reduced-motion={entry.reducedMotionFallback}
                  </li>
                ))}
              </ul>
            }
          />
          <StoryboardCard
            eyebrow="Print fallback"
            title="Diagram print safety"
            copy="A diagram is only production-safe when the same story survives projection, print, and reduced-motion contexts."
            meta={[`${diagramExplanationRegistry.length} diagrams`]}
            preview={
              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 12 }}>
                {diagramExplanationRegistry.map((entry) => (
                  <li key={entry.diagramId}>
                    {entry.diagramId}: {isDiagramRendererIdSupported(entry.diagramId) ? 'print-safe renderer available' : 'renderer missing'}
                  </li>
                ))}
              </ul>
            }
          />
          <StoryboardCard
            eyebrow="Print fallback"
            title="Content print summaries"
            copy="Print summaries are the one-sentence comprehension test for text-led concepts."
            meta={[`${educationalContentRegistry.length} content entries`]}
            preview={
              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 12 }}>
                {educationalContentRegistry.map((entry) => (
                  <li key={entry.contentId}>{entry.contentId}: {entry.printSummary}</li>
                ))}
              </ul>
            }
          />
        </section>
      )}

      {tab === 'projection-safety' && (
        <section data-testid="library-explorer-panel-projection-safety" style={{ display: 'grid', gap: '0.75rem' }}>
          <StoryboardCard
            eyebrow="Projection safety"
            title="Projection readiness"
            copy="Projection safety is a visual-language problem: if the meaning disappears on a large screen, the asset is not ready for real customer use."
            meta={[
              `safe ${audit.readinessScore.projectionSafeCount}/${audit.readinessScore.totalConcepts}`,
              `${audit.readinessScore.projectionSafePct}% ready`,
            ]}
            preview={
              <div style={{ fontSize: 12, display: 'grid', gap: '0.35rem' }}>
                <div>projection-safe concepts: {audit.readinessScore.projectionSafeCount} / {audit.readinessScore.totalConcepts}</div>
                <div>projection-safe percentage: {audit.readinessScore.projectionSafePct}%</div>
              </div>
            }
          />
          <StoryboardCard
            eyebrow="Projection safety"
            title="Concepts with projection gaps"
            copy="These concepts still need a clearer large-format reading before they can anchor a presentation or customer portal route."
            meta={[`${audit.conceptCoverage.filter((entry) => !entry.projectionSafe).length} gaps`]}
            preview={
              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 12 }}>
                {audit.conceptCoverage.filter((entry) => !entry.projectionSafe).map((entry) => (
                  <li key={entry.conceptId}>{entry.conceptId} — {entry.conceptTitle}</li>
                ))}
              </ul>
            }
          />
        </section>
      )}
    </main>
  );
}

export default LibraryExplorerPage;
