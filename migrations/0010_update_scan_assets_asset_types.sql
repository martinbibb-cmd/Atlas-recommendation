-- Migration 0010: add floor_plan_snapshot to scan_assets asset_type constraint
--
-- SQLite does not support ALTER TABLE ... ALTER COLUMN for CHECK constraints.
-- We recreate the table using the 12-step SQLite rename pattern:
--   1. Create new table with the updated constraint.
--   2. Copy all rows from the old table.
--   3. Drop the old table.
--   4. Rename the new table.
--   5. Recreate indexes.
--
-- Adds 'floor_plan_snapshot' and 'object_pin_ref' to the allowed asset_type
-- values so that SessionCaptureV2 import assets can be stored correctly.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS scan_assets_new (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
  asset_type    TEXT NOT NULL CHECK (asset_type IN (
                  'photo', 'ply', 'transcript', 'scan_bundle',
                  'floor_plan_snapshot', 'object_pin_ref'
                )),
  r2_key        TEXT NOT NULL UNIQUE,
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  captured_at   TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

INSERT INTO scan_assets_new
  SELECT id, session_id, asset_type, r2_key, file_name, mime_type, captured_at, metadata_json
  FROM scan_assets;

DROP TABLE scan_assets;

ALTER TABLE scan_assets_new RENAME TO scan_assets;

CREATE INDEX IF NOT EXISTS idx_scan_assets_session_id ON scan_assets(session_id);

PRAGMA foreign_keys = ON;
