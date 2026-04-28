-- Migration 0008: create scan_assets table
--
-- Stores references to binary blobs uploaded to R2 (photos, .ply point
-- clouds, scan bundles, transcripts).  The r2_key is the object key in the
-- ATLAS_ASSETS_R2 bucket.

CREATE TABLE IF NOT EXISTS scan_assets (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
  asset_type    TEXT NOT NULL CHECK (asset_type IN ('photo', 'ply', 'transcript', 'scan_bundle')),
  r2_key        TEXT NOT NULL UNIQUE,
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  captured_at   TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_scan_assets_session_id ON scan_assets(session_id);
