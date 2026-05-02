-- Migration 0016: create atlas_adapter_scan_captures table
--
-- Backs the D1StorageAdapter 'scanCaptures' collection.
-- payload_json holds a complete serialised SessionCaptureV2 object.
-- This table is only queried when the D1 storage adapter is active;
-- local (browser localStorage) mode does not touch this table.

CREATE TABLE IF NOT EXISTS atlas_adapter_scan_captures (
  id           TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_atlas_adapter_scan_captures_updated_at
  ON atlas_adapter_scan_captures (updated_at DESC);
