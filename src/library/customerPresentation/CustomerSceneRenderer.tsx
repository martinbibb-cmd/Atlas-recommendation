import { DiagramRenderer, isDiagramRendererIdSupported } from '../diagrams/DiagramRenderer';
import { isApprovedCustomerPdfVisualAssetId } from '../pdfVisuals/customerPdfVisualRegistry';
import {
  getVisualAssetManifestEntry,
  getVisualAssetRendererAvailability,
} from '../portal/pdf/visualAssetManifest';
import { resolveLegoTechnicCustomerVisualDecision } from '../portal/pdf/legoTechnicCustomerVisualManifest';
import type { CustomerPresentationScene } from './customerSceneValidation';
import { CUSTOMER_SCENE_TYPOGRAPHY } from './customerSceneTypography';

type SectionVisualPlan =
  | {
      rendererType: 'diagram_component';
      visualAssetId: string;
      fallbackUsed: false;
    }
  | {
      rendererType: 'print_fallback';
      visualAssetId: string;
      fallbackUsed: true;
      fallbackAssetId: string;
    }
  | {
      rendererType: 'none';
      visualAssetId?: string;
      fallbackUsed: false;
      blockingReason: string;
    };

interface CustomerSceneRendererProps {
  scene: CustomerPresentationScene;
  mode: 'portal' | 'print';
  pageNumber?: number;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveSectionVisualAssetId(scene: CustomerPresentationScene): string | undefined {
  const section = scene.sourceSection;
  if (scene.visualAssetId) return scene.visualAssetId;
  if (section.diagramRendererId) return section.diagramRendererId;
  if (!section.diagramId) return undefined;
  return section.diagramId;
}

function resolveSectionVisualPlan(scene: CustomerPresentationScene): SectionVisualPlan {
  const visualAssetId = resolveSectionVisualAssetId(scene);
  if (!visualAssetId) {
    return {
      rendererType: 'none',
      fallbackUsed: false,
      blockingReason: 'No visual asset declared for this section.',
    };
  }
  if (!isApprovedCustomerPdfVisualAssetId(visualAssetId)) {
    return {
      rendererType: 'none',
      visualAssetId,
      fallbackUsed: false,
      blockingReason: `Visual asset "${visualAssetId}" is not approved in customerPdfVisualRegistry.`,
    };
  }

  const manifestEntry = getVisualAssetManifestEntry(visualAssetId);
  if (manifestEntry == null) {
    return {
      rendererType: 'none',
      visualAssetId,
      fallbackUsed: false,
      blockingReason: `Visual asset "${visualAssetId}" is missing from the visual manifest.`,
    };
  }
  if (!manifestEntry.supportedSurfaces.includes('pdf')) {
    return {
      rendererType: 'none',
      visualAssetId,
      fallbackUsed: false,
      blockingReason: `Visual asset "${visualAssetId}" is not PDF-supported.`,
    };
  }

  const availability = getVisualAssetRendererAvailability(visualAssetId);
  const requestedRendererType: SectionVisualPlan['rendererType'] = availability.hasDiagramRenderer
    ? 'diagram_component'
    : availability.hasPrintFallback
      ? 'print_fallback'
      : 'none';
  const visualDecision = resolveLegoTechnicCustomerVisualDecision({
    visualId: visualAssetId,
    rendererUsed: requestedRendererType,
    surface: 'print_preview',
  });
  if (!visualDecision.allowed) {
    return {
      rendererType: 'none',
      visualAssetId,
      fallbackUsed: false,
      blockingReason: visualDecision.blockedReason
        ?? `Visual asset "${visualAssetId}" is blocked by legoTechnicCustomerVisualManifest.`,
    };
  }
  if (availability.hasDiagramRenderer && isDiagramRendererIdSupported(visualAssetId)) {
    return {
      rendererType: 'diagram_component',
      visualAssetId,
      fallbackUsed: false,
    };
  }

  return {
    rendererType: 'none',
    visualAssetId,
    fallbackUsed: false,
    blockingReason: `No canonical diagram renderer is available for "${visualAssetId}".`,
  };
}

function renderPrintScene(scene: CustomerPresentationScene, pageNumber: number | undefined) {
  const section = scene.sourceSection;
  const storyScene = section.storyScene;
  const composition = storyScene?.composition;
  const pageArchetype = composition?.pageArchetype ?? 'explanation';
  const densityTier = composition?.densityTier ?? 'balanced';
  const focalVisualPriority = composition?.focalVisualPriority ?? 'supporting';
  const sceneTitle = scene.heading;
  const sceneCustomerTakeaway = scene.takeaway;
  const sceneWhyItMatters = scene.explanation ?? section.summary;
  const sceneWhatYouWillNotice = storyScene?.whatYouWillNotice ?? section.items[0] ?? section.reassurance;
  const noticeItems = storyScene != null
    ? [sceneWhatYouWillNotice]
    : section.items;
  const visualPlan = resolveSectionVisualPlan(scene);
  const shouldRenderVisualFallback =
    pageArchetype !== 'quiet' && visualPlan.rendererType !== 'diagram_component';

  return (
    <section
      className={`pjpp-page pjpp-section pjpp-section--${section.sectionId} pjpp-section--archetype-${pageArchetype} pjpp-section--density-${densityTier} pjpp-section--focal-${focalVisualPriority}`}
      aria-labelledby={`pjpp-section-heading-${scene.sceneId}`}
      data-testid={`pjpp-section-${section.sectionId}`}
      data-page={pageNumber}
      data-archetype={pageArchetype}
      data-reading-region="true"
    >
      <h2 id={`pjpp-section-heading-${scene.sceneId}`} className="pjpp-section__heading">
        {sceneTitle}
      </h2>

      <p className="pjpp-section__summary">{sceneCustomerTakeaway}</p>

      {pageArchetype === 'quiet' ? (
        <div className="pjpp-quiet-content" data-testid={`pjpp-quiet-${section.sectionId}`}>
          <p className="pjpp-quiet-content__copy">{sceneWhyItMatters}</p>
        </div>
      ) : (
        <p className="pjpp-section__takeaway" data-testid={`pjpp-takeaway-${section.sectionId}`}>
          <strong>Customer takeaway:</strong> {sceneCustomerTakeaway}
        </p>
      )}

      {visualPlan.rendererType === 'diagram_component' && pageArchetype !== 'quiet' ? (
        <figure
          className="pjpp-section__diagram"
          data-testid={`pjpp-diagram-${section.sectionId}`}
          data-print-safe="true"
          style={{ '--pjpp-visual-scale': composition?.visualScale ?? 1 } as Record<string, number>}
        >
          <DiagramRenderer diagramId={visualPlan.visualAssetId} printSafe reducedMotion />
          {section.diagramCaption ? (
            <figcaption className="pjpp-section__diagram-caption">{section.diagramCaption}</figcaption>
          ) : null}
        </figure>
      ) : null}

      {shouldRenderVisualFallback ? (
        <article
          className="pjpp-section__visual-fallback-card"
          data-testid={`pjpp-visual-fallback-${section.sectionId}`}
          data-warning-code={
            hasText(visualPlan.visualAssetId) && isApprovedCustomerPdfVisualAssetId(visualPlan.visualAssetId)
              ? 'approved_visual_missing'
              : undefined
          }
        >
          <p className="pjpp-section__visual-fallback-title">Visual content not available</p>
          <p className="pjpp-section__visual-fallback-copy">{sceneWhyItMatters}</p>
        </article>
      ) : null}

      {hasText(sceneWhyItMatters) && pageArchetype !== 'quiet' && visualPlan.rendererType === 'diagram_component' ? (
        <p className="pjpp-section__visual-explanation" data-testid={`pjpp-visual-explanation-${section.sectionId}`}>
          {sceneWhyItMatters}
        </p>
      ) : null}

      {pageArchetype === 'quiet' ? null : (
        <ul className="pjpp-outcome-cards" data-testid={`pjpp-items-${section.sectionId}`}>
          {noticeItems.slice(0, composition?.maxCardsPerPage ?? 3).map((item, i) => (
            <li key={`${section.sectionId}-${i}`} className="pjpp-outcome-card">
              <p className="pjpp-outcome-card__label">What you will notice</p>
              <p className="pjpp-outcome-card__copy">{item}</p>
            </li>
          ))}
        </ul>
      )}
      {import.meta.env.DEV && visualPlan.rendererType === 'none' && pageArchetype !== 'quiet' ? (
        <p className="pjpp-section__diagram-caption" data-testid={`pjpp-missing-visual-${section.sectionId}`}>
          Missing visual: {visualPlan.blockingReason}
        </p>
      ) : null}

      {pageArchetype !== 'quiet' ? (
        <aside className="pjpp-reassurance" data-testid={`pjpp-reassurance-${section.sectionId}`} data-reading-region="true">
          {section.reassurance}
        </aside>
      ) : null}
    </section>
  );
}

function renderPortalScene(scene: CustomerPresentationScene) {
  const canRenderVisual = scene.visualAssetId != null
    && isApprovedCustomerPdfVisualAssetId(scene.visualAssetId)
    && isDiagramRendererIdSupported(scene.visualAssetId);
  return (
    <section
      className="customer-scene-card"
      data-testid={`customer-scene-${scene.sectionId}`}
      aria-labelledby={`customer-scene-heading-${scene.sceneId}`}
      data-reading-region="true"
    >
      <h2 id={`customer-scene-heading-${scene.sceneId}`} className={CUSTOMER_SCENE_TYPOGRAPHY.headingClassName}>
        {scene.heading}
      </h2>
      <p className={CUSTOMER_SCENE_TYPOGRAPHY.takeawayClassName}>{scene.takeaway}</p>
      {canRenderVisual ? (
        <figure className="customer-scene__diagram" data-print-safe="true" data-testid={`customer-scene-diagram-${scene.sectionId}`}>
          <DiagramRenderer diagramId={scene.visualAssetId} printSafe reducedMotion />
        </figure>
      ) : null}
      {scene.explanation ? (
        <p className={CUSTOMER_SCENE_TYPOGRAPHY.explanationClassName}>{scene.explanation}</p>
      ) : null}
      {scene.technicalDetail ? (
        <details className={CUSTOMER_SCENE_TYPOGRAPHY.disclosureClassName} data-testid={`customer-scene-technical-${scene.sectionId}`}>
          <summary>Technical detail</summary>
          <p>{scene.technicalDetail}</p>
        </details>
      ) : null}
    </section>
  );
}

export function CustomerSceneRenderer({ scene, mode, pageNumber }: CustomerSceneRendererProps) {
  if (mode === 'print') return renderPrintScene(scene, pageNumber);
  return renderPortalScene(scene);
}
