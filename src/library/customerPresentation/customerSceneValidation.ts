import {
  type LibraryStorySceneCompositionV1,
  type PortalJourneyPrintSectionV1,
} from '../portal/pdf/buildPortalJourneyPrintModel';

export interface CustomerPresentationScene {
  sceneId: string;
  sectionId: PortalJourneyPrintSectionV1['sectionId'];
  heading: string;
  takeaway: string;
  visualAssetId?: string;
  explanation?: string;
  technicalDetail?: string;
  composition?: LibraryStorySceneCompositionV1;
  sourceSection: PortalJourneyPrintSectionV1;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveTechnicalDetail(section: PortalJourneyPrintSectionV1): string | undefined {
  const details = [section.reassurance, ...section.items]
    .filter(hasText)
    .map((value) => value.trim());
  if (details.length === 0) return undefined;
  return details.join(' ');
}

export function isValidCustomerPresentationScene(
  scene: CustomerPresentationScene,
): boolean {
  return hasText(scene.heading) && hasText(scene.takeaway);
}

export function buildCustomerPresentationScenes(
  sections: readonly PortalJourneyPrintSectionV1[],
): CustomerPresentationScene[] {
  return sections
    .map((section) => {
      const storyScene = section.storyScene;
      return {
        sceneId: `${section.sectionId}-${section.contentId}`,
        sectionId: section.sectionId,
        heading: storyScene?.title ?? section.heading,
        takeaway: storyScene?.customerTakeaway ?? section.keyTakeaway,
        visualAssetId: storyScene?.visualAssetId ?? section.diagramRendererId ?? section.diagramId,
        explanation: storyScene?.whyItMatters ?? section.summary,
        technicalDetail: resolveTechnicalDetail(section),
        composition: storyScene?.composition,
        sourceSection: section,
      };
    })
    .filter(isValidCustomerPresentationScene);
}
