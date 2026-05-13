/**
 * src/storage/workflow/index.ts
 *
 * Public surface of the implementation-workflow storage adapter boundary.
 */

export type {
  ReadinessChangeLogEventType,
  ReadinessChangeLogEventV1,
  ReadinessGateSnapshot,
  MaterialsReviewState,
  ImplementationPackSnapshotMetadataV1,
  PersistedImplementationWorkflowV1,
  WorkflowSchemaVersion,
} from './PersistedImplementationWorkflowV1';
export { WORKFLOW_SCHEMA_VERSION } from './PersistedImplementationWorkflowV1';

export type {
  WorkflowStorageTarget,
  WorkflowStorageSaveResult,
  WorkflowStorageLoadResult,
  WorkflowStorageDeleteResult,
  WorkflowStorageExportResult,
  WorkflowStateListEntry,
  WorkflowStorageAdapterV1,
} from './WorkflowStorageAdapterV1';

export { LocalWorkflowStorageAdapter } from './LocalWorkflowStorageAdapter';
export { GoogleDriveWorkflowStorageAdapterStub } from './GoogleDriveWorkflowStorageAdapterStub';
export { DisabledWorkflowStorageAdapter } from './DisabledWorkflowStorageAdapter';
