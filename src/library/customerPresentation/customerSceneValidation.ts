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

export function customerSceneHasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveTechnicalDetail(section: PortalJourneyPrintSectionV1): string | undefined {
  const details = [section.reassurance, ...section.items]
    .filter(customerSceneHasText)
    .map((value) => value.trim());
  if (details.length === 0) return undefined;
  return details.join(' ');
}

export function resolveCustomerSceneVisualAssetId(
  section: PortalJourneyPrintSectionV1,
): string | undefined {
  return section.storyScene?.visualAssetId ?? section.diagramRendererId ?? section.diagramId;
}

export function isValidCustomerPresentationScene(
  scene: CustomerPresentationScene,
): boolean {
  return customerSceneHasText(scene.heading) && customerSceneHasText(scene.takeaway);
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
        visualAssetId: resolveCustomerSceneVisualAssetId(section),
        explanation: storyScene?.whyItMatters ?? section.summary,
        technicalDetail: resolveTechnicalDetail(section),
        composition: storyScene?.composition,
        sourceSection: section,
      };
    })
    .filter(isValidCustomerPresentationScene);
}
