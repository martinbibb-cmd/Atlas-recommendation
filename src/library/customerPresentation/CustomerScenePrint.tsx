import type { CustomerPresentationScene } from './customerSceneValidation';
import { CustomerSceneRenderer } from './CustomerSceneRenderer';
import { CUSTOMER_SCENE_LAYOUTS } from './customerSceneLayouts';

interface CustomerScenePrintProps {
  scenes: readonly CustomerPresentationScene[];
  startingPage?: number;
}

export function CustomerScenePrint({ scenes, startingPage = 1 }: CustomerScenePrintProps) {
  return (
    <div className={CUSTOMER_SCENE_LAYOUTS.print.containerClassName} data-testid="customer-scene-print">
      {scenes.map((scene, index) => (
        <div key={scene.sceneId} className={CUSTOMER_SCENE_LAYOUTS.print.sceneClassName}>
          <CustomerSceneRenderer scene={scene} mode="print" pageNumber={startingPage + index} />
        </div>
      ))}
    </div>
  );
}
