import type { ReactNode } from 'react';
import { renderTopologyTemplate } from '../templates/index';
import type { VisualTopologyId } from '../visualTopologyRegistry';
import type { VisualTopologyRenderOptions } from './types';

export { renderTopologyTemplate } from '../templates/index';
export type { VisualTopologyRenderOptions } from './types';

export function renderVisualTopology(
  topologyId: VisualTopologyId,
  options: VisualTopologyRenderOptions,
): ReactNode {
  return renderTopologyTemplate(topologyId, options);
}
