-- Migration 0017: create atlas_adapter_visit_manifests table
--
-- Backs the D1StorageAdapter 'visitManifests' collection.
-- payload_json holds a complete serialised ExternalVisitManifestV1 object.
--
-- Each row is keyed by visitId (one manifest per visit).
-- The manifest stores file references only — no file blobs, no survey data,
-- no transcript text, and no photo metadata beyond ClientFileReferenceV1
-- reference records.
--
-- This table is only queried when the D1 storage adapter is active;
-- local (browser localStorage) mode does not touch this table.

CREATE TABLE IF NOT EXISTS atlas_adapter_visit_manifests (
  id           TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_atlas_adapter_visit_manifests_updated_at
  ON atlas_adapter_visit_manifests (updated_at DESC);
