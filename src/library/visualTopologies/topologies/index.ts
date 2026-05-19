import type { ReactNode } from 'react';
import { renderTopologyTemplate } from '../templates/index';
import type { VisualTopologyId } from '../visualTopologyRegistry';
import type { VisualTopologyRenderOptions } from './types';

export { renderTopologyTemplate } from '../templates/index';
export type { VisualTopologyRenderOptions } from './types';

/**
 * Public topology render API used by galleries/explainers.
 * Delegates to canonical template renderers so port-attachment geometry and
 * layout declarations are applied consistently in all consuming surfaces.
 */
export function renderVisualTopology(
  topologyId: VisualTopologyId,
  options: VisualTopologyRenderOptions,
): ReactNode {
  return renderTopologyTemplate(topologyId, options);
}
