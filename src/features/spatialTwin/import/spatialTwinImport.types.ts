import type { SpatialTwinModelV1 } from '../state/spatialTwin.types';

export interface SpatialTwinImportResult {
  status: 'success' | 'success_with_warnings' | 'failed';
  model?: SpatialTwinModelV1;
  warnings: string[];
  error?: string;
}
