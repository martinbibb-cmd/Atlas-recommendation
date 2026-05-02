-- Migration 0014: create atlas_adapter_brand_profiles table
--
-- Backs the D1StorageAdapter 'brandProfiles' collection.
-- payload_json holds a complete serialised BrandProfileV1 object.
-- This table is only queried when the D1 storage adapter is active;
-- local (browser localStorage) mode does not touch this table.

CREATE TABLE IF NOT EXISTS atlas_adapter_brand_profiles (
  id           TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_atlas_adapter_brand_profiles_updated_at
  ON atlas_adapter_brand_profiles (updated_at DESC);
