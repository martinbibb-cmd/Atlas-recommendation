import type { CustomerPresentationScene } from './customerSceneValidation';
import { CustomerSceneRenderer } from './CustomerSceneRenderer';
import { CUSTOMER_SCENE_LAYOUTS } from './customerSceneLayouts';

interface CustomerSceneDeckProps {
  scenes: readonly CustomerPresentationScene[];
}

export function CustomerSceneDeck({ scenes }: CustomerSceneDeckProps) {
  return (
    <article
      className={CUSTOMER_SCENE_LAYOUTS.portal.containerClassName}
      data-testid="customer-scene-deck"
    >
      {scenes.map((scene) => (
        <div key={scene.sceneId} className={CUSTOMER_SCENE_LAYOUTS.portal.sceneClassName}>
          <CustomerSceneRenderer scene={scene} mode="portal" />
        </div>
      ))}
    </article>
  );
}
