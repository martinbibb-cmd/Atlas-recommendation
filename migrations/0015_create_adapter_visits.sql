-- Migration 0015: create atlas_adapter_visits table
--
-- Backs the D1StorageAdapter 'visits' collection.
-- payload_json holds a complete serialised AtlasVisit object.
-- This is distinct from the 'visits' table (migration 0002) which stores
-- full engineer visit records; this table holds the lightweight AtlasVisit
-- identity objects used by the storage adapter interface.
-- This table is only queried when the D1 storage adapter is active;
-- local (browser sessionStorage) mode does not touch this table.

CREATE TABLE IF NOT EXISTS atlas_adapter_visits (
  id           TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_atlas_adapter_visits_updated_at
  ON atlas_adapter_visits (updated_at DESC);
