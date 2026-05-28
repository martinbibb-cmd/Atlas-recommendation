export interface CustomerSceneLayoutPreset {
  containerClassName: string;
  sceneClassName: string;
}

export const CUSTOMER_SCENE_LAYOUTS: Record<'portal' | 'print', CustomerSceneLayoutPreset> = {
  portal: {
    containerClassName: 'customer-scene-deck customer-scene-deck--portal',
    sceneClassName: 'customer-scene customer-scene--portal',
  },
  print: {
    containerClassName: 'customer-scene-print customer-scene-print--a4',
    sceneClassName: 'customer-scene customer-scene--print',
  },
};
